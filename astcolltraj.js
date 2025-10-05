import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

// Earth-Asteroid collision by tracing backward from a chosen impact, then running forward.
// Physical constants (SI)
const G = 6.67430e-11;            // m^3 kg^-1 s^-2
const M_sun = 1.9885e30;          // Sun mass, kg
const AU = 1.495978707e11;        // m
const R_earth = 6.371e6;          // m
const R_asteroid = 500;           // m (example small asteroid)

const renderScale = 150;          // 1 AU -> ~renderScale scene units
const mToScene = (1 / AU) * renderScale;
const earthVisualRadius = Math.max(R_earth * mToScene, 2.5);
const asteroidVisualRadius = Math.max(R_asteroid * mToScene, 1.0);
const sunVisualRadius = Math.max(6.9634e8 * mToScene, 8);

const dt = 60 * 60 * 3;           // integrator step: 3 hours per step (seconds)
const backwardDurationDays = 100;  
const backwardDuration = backwardDurationDays * 24 * 3600; // seconds

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
camera.position.set(0, renderScale * 3, renderScale * 0.8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Sun
const sunGeom = new THREE.SphereGeometry(sunVisualRadius, 32, 32);
const sunMat = new THREE.MeshPhongMaterial({ color: 0xffffaa, emissive: 0xffff66, emissiveIntensity: 2.5 });
const sunMesh = new THREE.Mesh(sunGeom, sunMat);
scene.add(sunMesh);
const sunLight = new THREE.PointLight(0xffffff, 3.5, 0, 2);
scene.add(sunLight);

// Earth (blue)
const earthGeom = new THREE.SphereGeometry(earthVisualRadius, 24, 24);
const earthMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, shininess: 30 });
const earthMesh = new THREE.Mesh(earthGeom, earthMat);
scene.add(earthMesh);

// Asteroid
const astGeom = new THREE.SphereGeometry(asteroidVisualRadius, 12, 12);
const astMat = new THREE.MeshPhongMaterial({ color: 0xffaa33, shininess: 5 });
const astMesh = new THREE.Mesh(astGeom, astMat);
scene.add(astMesh);

// Orbit rings for context
function addOrbitCircle(radiusAU, color = 0x555555) {
  const segments = 256;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * radiusAU * renderScale, Math.sin(t) * radiusAU * renderScale, 0));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));
  scene.add(line);
}
addOrbitCircle(1.0, 0x2244ff);

// Trails
const maxTrailPoints = 2000;
function makeTrail(color) {
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(maxTrailPoints * 3);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setDrawRange(0, 0);
  const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color }));
  scene.add(line);
  return { geom, pos, index: 0 };
}
const earthTrail = makeTrail(0x66aaff);
const astTrail = makeTrail(0xffcc88);

function simToScene(v) { return v.clone().multiplyScalar(mToScene); }

function pushTrail(trail, scenePos) {
  const arr = trail.pos;
  let idx = trail.index;
  if (idx >= maxTrailPoints) {
    // rotate left by one
    for (let i = 0; i < maxTrailPoints - 1; i++) {
      arr[i * 3 + 0] = arr[(i + 1) * 3 + 0];
      arr[i * 3 + 1] = arr[(i + 1) * 3 + 1];
      arr[i * 3 + 2] = arr[(i + 1) * 3 + 2];
    }
    idx = maxTrailPoints - 1;
    arr[idx * 3 + 0] = scenePos.x;
    arr[idx * 3 + 1] = scenePos.y;
    arr[idx * 3 + 2] = scenePos.z;
    trail.index = idx + 1;
  } else {
    arr[idx * 3 + 0] = scenePos.x;
    arr[idx * 3 + 1] = scenePos.y;
    arr[idx * 3 + 2] = scenePos.z;
    trail.index = idx + 1;
  }
  trail.geom.attributes.position.needsUpdate = true;
  trail.geom.setDrawRange(0, Math.min(trail.index, maxTrailPoints));
}

// state vector 
const state = {
  earth: { r: new THREE.Vector3(), v: new THREE.Vector3(), mass: 5.972e24, radius: R_earth },
  asteroid: { r: new THREE.Vector3(), v: new THREE.Vector3(), mass: 1e12, radius: R_asteroid }
};

// compute circular velocity magnitude at distance r (m)
function circularVelocity(rMeters) { return Math.sqrt(G * M_sun / rMeters); }

function accelFromSun(pos) {
  const r2 = pos.lengthSq();
  const r = Math.sqrt(r2);
  const r3 = r2 * r + 1e-30;
  return pos.clone().multiplyScalar(-G * M_sun / r3);
}

// Verlet integrator step
function verletStep(body, dtSec) {
  const a_t = accelFromSun(body.r);
  const r_next = body.r.clone().add(body.v.clone().multiplyScalar(dtSec)).add(a_t.clone().multiplyScalar(0.5 * dtSec * dtSec));
  const a_next = accelFromSun(r_next);
  const v_next = body.v.clone().add(a_t.clone().add(a_next).multiplyScalar(0.5 * dtSec));
  body.r.copy(r_next);
  body.v.copy(v_next);
}

// collision check
function checkCollision() {
  const diff = state.earth.r.clone().sub(state.asteroid.r);
  return diff.length() <= (state.earth.radius + state.asteroid.radius);
}

// Create impact configuration and trace back
function pickImpactAndTraceBack() {
  // pick random true anomaly (angle) on Earth's orbit for impact point
  const theta = Math.random() * Math.PI * 2;
  // impact position in meters (on Earth's orbit radius 1 AU)
  const impactPos = new THREE.Vector3(Math.cos(theta) * AU, Math.sin(theta) * AU, 0);

  // Earth velocity at that point (perpendicular, prograde)
  const vEarthMag = circularVelocity(AU);
  const vEarth = new THREE.Vector3(-Math.sin(theta) * vEarthMag, Math.cos(theta) * vEarthMag, 0);

  // asteroid at impact shares same position but we give it a different velocity so collision happens at that time
  // choose relative delta velocity (random direction in-plane, magnitude a few 100s to few 1000 m/s typical for NEOs)
  const deltaSpeed = 500 + Math.random() * 4500; // m/s
  const angle = Math.random() * Math.PI * 2;
  const dv = new THREE.Vector3(Math.cos(angle) * deltaSpeed, Math.sin(angle) * deltaSpeed, 0);

  // asteroid velocity at impact: Earth velocity plus dv (so relative speed is dv magnitude)
  const vAsteroidImpact = vEarth.clone().add(dv);

  // set state at impact moment
  const impactState = {
    earth: { r: impactPos.clone(), v: vEarth.clone() },
    asteroid: { r: impactPos.clone(), v: vAsteroidImpact.clone() }
  };

  // Integrate backward to t = -backwardDuration to produce plausible initial states
  // Use same integrator but stepping with negative dt
  const steps = Math.ceil(backwardDuration / dt);
  const bEarth = { r: impactState.earth.r.clone(), v: impactState.earth.v.clone() };
  const bAst = { r: impactState.asteroid.r.clone(), v: impactState.asteroid.v.clone() };

  for (let i = 0; i < steps; i++) {
    // backward step: integrate with dtBack = -dt using Verlet by reversing time
    verletStep(bEarth, -dt);
    verletStep(bAst, -dt);
  }

  // assign traced-back values into global state as simulation start
  state.earth.r.copy(bEarth.r);
  state.earth.v.copy(bEarth.v);
  state.asteroid.r.copy(bAst.r);
  state.asteroid.v.copy(bAst.v);

  // return the forward time (seconds) until impact from these initial states ~ backwardDuration
  return steps * dt;
}

// Impact explosion
let activeFlashFaders = [];
function spawnFlash(positionMeters) {
  const posScene = simToScene(positionMeters);
  const geom = new THREE.SphereGeometry(earthVisualRadius * 0.9, 12, 12);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffee88, emissive: 0xffffaa, transparent: true, opacity: 1.0 });
  const flashMesh = new THREE.Mesh(geom, mat);
  flashMesh.position.copy(posScene);
  scene.add(flashMesh);

  const point = new THREE.PointLight(0xffee88, 8.0, renderScale * 0.6, 2);
  point.position.copy(posScene);
  scene.add(point);

  const duration = 1.8;
  let elapsed = 0;
  const fade = (dtSec) => {
    elapsed += dtSec;
    const t = Math.min(1, elapsed / duration);
    if (t >= 1) {
      scene.remove(flashMesh);
      scene.remove(point);
      flashMesh.geometry.dispose();
      flashMesh.material.dispose();
      return false;
    } else {
      flashMesh.material.opacity = 1 - t;
      point.intensity = 8 * (1 - t) * (1 - t);
      return true;
    }
  };
  activeFlashFaders.push(fade);
}

// Initialize: pick impact and trace back
const timeToImpact = pickImpactAndTraceBack();
console.log('Traced back to initial state. Approx seconds until impact when running forward:', timeToImpact);

// Animation and simulation forward
let running = true;
let didCollision = false;
function updateTrailsAndMeshes() {
  earthMesh.position.copy(simToScene(state.earth.r));
  astMesh.position.copy(simToScene(state.asteroid.r));
  sunMesh.position.set(0, 0, 0);
  sunLight.position.copy(sunMesh.position);

  pushTrail(earthTrail, simToScene(state.earth.r));
  pushTrail(astTrail, simToScene(state.asteroid.r));
}

function stepPhysics() {
  verletStep(state.earth, dt);
  verletStep(state.asteroid, dt);
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  if (running) {
    stepPhysics();

    if (checkCollision() && !didCollision) {
      didCollision = true;
      running = false;
      const collisionPos = state.earth.r.clone().add(state.asteroid.r).multiplyScalar(0.5);
      console.log('Collision occurred at sim position (m):', collisionPos);
      spawnFlash(collisionPos);
    }
  }

  // update flash faders
  const still = [];
  const dtMs = 1 / 60; // approximate seconds per frame for fades
  for (const f of activeFlashFaders) if (f(dtMs)) still.push(f);
  activeFlashFaders = still;

  updateTrailsAndMeshes();
  renderer.render(scene, camera);
}

animate();

// Resize and controls
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Space to pause/resume, R to reset (reload)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    running = !running;
    console.log(running ? 'Resumed' : 'Paused');
  } else if (e.key.toLowerCase() === 'r') {
    location.reload();
  }
});

