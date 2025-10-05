// - Runs a prograde-impact scenario, backtraces to initial state,
// - Interceptor co-orbits Earth and uses constant-accel rendezvous guidance,
// - Tracks cumulative delta-v, shows HUD, renders bodies and trails,
// - On successful intercept: interceptor and asteroid stop (velocities zeroed, no further thrust),
//   Earth continues orbiting under Sun gravity; asteroid mesh remains at collision point (visible).
// - On impact with Earth: Earth continues, asteroid stops at impact point.
// - Interceptor thrust is disabled after intercept.

(async () => {
  // Ensure THREE available
  if (typeof THREE === 'undefined') {
    const three = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    window.THREE = three;
  }

  // --- Constants ---
  const G = 6.67430e-11;
  const M_SUN = 1.9885e30;
  const AU = 1.495978707e11;
  const R_EARTH = 6.371e6;
  const R_AST = 500; // asteroid radius (m)
  const R_INT = 50;  // interceptor radius of starting explosion (m)

  const RENDER_SCALE = 150;
  const M_TO_SCENE = (1 / AU) * RENDER_SCALE;

  // Physics timing
  const DT_PHYS = 600;             // 600 s per substep (10 minutes)
  const SUBSTEPS_PER_FRAME = 6;    // physics substeps per render frame
  const BACK_DAYS = 180;           // backtrace days to separate bodies

  // Interceptor capability
  const INTERCEPTOR_MAX_ACCEL = 0.05; // m/s^2

  // Visual minimums
  const MIN_EARTH_VIS = 2.5;
  const MIN_AST_VIS   = 1.0;
  const MIN_INT_VIS   = 0.8;

  // --- Three.js setup ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.position.set(0, RENDER_SCALE * 2.6, RENDER_SCALE * 0.9);
  camera.lookAt(0, 0, 0);

  // Sun
  const sunRadiusScene = Math.max(6.9634e8 * M_TO_SCENE, 8);
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(sunRadiusScene, 32, 16),
    new THREE.MeshPhongMaterial({ color: 0xffffcc, emissive: 0xffff66, emissiveIntensity: 2.5 })
  );
  scene.add(sunMesh);
  const sunLight = new THREE.PointLight(0xffffff, 3.2, 0, 2);
  scene.add(sunLight);

  // Earth mesh
  const earthVis = Math.max(R_EARTH * M_TO_SCENE, MIN_EARTH_VIS);
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(earthVis, 24, 24),
    new THREE.MeshPhongMaterial({ color: 0x2266ff, shininess: 30 })
  );
  scene.add(earthMesh);

  // Asteroid and interceptor meshes
  const astVis = Math.max(R_AST * M_TO_SCENE, MIN_AST_VIS);
  const astMesh = new THREE.Mesh(
    new THREE.SphereGeometry(astVis, 12, 12),
    new THREE.MeshPhongMaterial({ color: 0xffaa33, shininess: 8 })
  );
  scene.add(astMesh);

  const intVis = Math.max(R_INT * M_TO_SCENE, MIN_INT_VIS);
  const intMesh = new THREE.Mesh(
    new THREE.SphereGeometry(intVis, 12, 12),
    new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x88ff88, shininess: 20 })
  );
  scene.add(intMesh);

  // Earth orbit reference ring
  (function addOrbit(radiusAU, color = 0x2244ff) {
    const segments = 360;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * radiusAU * RENDER_SCALE, Math.sin(t) * radiusAU * RENDER_SCALE, 0));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }));
    scene.add(line);
  })(1.0, 0x2244ff);

  // Trails
  const MAX_TRAIL = 1500;
  function makeTrail(color) {
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_TRAIL * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setDrawRange(0, 0);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color }));
    scene.add(line);
    return { geom, pos, idx: 0 };
  }
  const trailEarth = makeTrail(0x66aaff);
  const trailAst   = makeTrail(0xffcc88);
  const trailInt   = makeTrail(0x88ff88);

  function pushTrail(trail, sceneVec3) {
    const arr = trail.pos;
    let i = trail.idx;
    if (i >= MAX_TRAIL) {
      for (let k = 0; k < MAX_TRAIL - 1; k++) {
        arr[k * 3 + 0] = arr[(k + 1) * 3 + 0];
        arr[k * 3 + 1] = arr[(k + 1) * 3 + 1];
        arr[k * 3 + 2] = arr[(k + 1) * 3 + 2];
      }
      i = MAX_TRAIL - 1;
      arr[i * 3 + 0] = sceneVec3.x;
      arr[i * 3 + 1] = sceneVec3.y;
      arr[i * 3 + 2] = sceneVec3.z;
      trail.idx = i + 1;
    } else {
      arr[i * 3 + 0] = sceneVec3.x;
      arr[i * 3 + 1] = sceneVec3.y;
      arr[i * 3 + 2] = sceneVec3.z;
      trail.idx = i + 1;
    }
    trail.geom.attributes.position.needsUpdate = true;
    trail.geom.setDrawRange(0, Math.min(trail.idx, MAX_TRAIL));
  }

  function simToScene(pos) {
    return new THREE.Vector3(pos.x * M_TO_SCENE, pos.y * M_TO_SCENE, pos.z * M_TO_SCENE);
  }

  // --- Numeric helpers (plain vectors) ---
  const vClone = v => ({ x: v.x, y: v.y, z: v.z });
  const vAdd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const vSub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const vMul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  const vLen = a => Math.hypot(a.x, a.y, a.z);
  const vNorm = a => { const L = vLen(a) || 1; return { x: a.x / L, y: a.y / L, z: a.z / L }; };

  // Orbital functions
  function circularVelocity(rMeters) { return Math.sqrt(G * M_SUN / rMeters); }
  function accelFromSun(pos) {
    const r2 = pos.x * pos.x + pos.y * pos.y + pos.z * pos.z;
    const r = Math.sqrt(r2);
    const r3 = r2 * r + 1e-30;
    const f = -G * M_SUN / r3;
    return { x: pos.x * f, y: pos.y * f, z: pos.z * f };
  }

  // Velocity-Verlet integrator with optional constant extra acceleration (thrust)
  function verletStep(body, dtSec, extraAccel = { x: 0, y: 0, z: 0 }) {
    if (body.active === false) return; // skip inactive bodies
    const a_t = accelFromSun(body.r);
    const a_total_t = { x: a_t.x + extraAccel.x, y: a_t.y + extraAccel.y, z: a_t.z + extraAccel.z };
    const r_next = vAdd(vAdd(body.r, vMul(body.v, dtSec)), vMul(a_total_t, 0.5 * dtSec * dtSec));
    const a_next = accelFromSun(r_next);
    const a_total_next = { x: a_next.x + extraAccel.x, y: a_next.y + extraAccel.y, z: a_next.z + extraAccel.z };
    const v_next = vAdd(body.v, vMul(vAdd(a_total_t, a_total_next), 0.5 * dtSec));
    body.r = r_next;
    body.v = v_next;
  }

  function checkCollisionMeters(A, B) {
    const d = vLen(vSub(A.r, B.r));
    const sumR = (A.radius || 0) + (B.radius || 0);
    return d <= sumR;
  }

  // --- Build prograde impact and backtrace to initial state ---
  function makeProgradeImpactAndBacktrace(backDays = BACK_DAYS) {
    const theta = Math.random() * Math.PI * 2;
    const impactPos = { x: Math.cos(theta) * AU, y: Math.sin(theta) * AU, z: 0 };
    const vEarthMag = circularVelocity(AU);
    const vEarth = { x: -Math.sin(theta) * vEarthMag, y: Math.cos(theta) * vEarthMag, z: 0 };

    const relSpeed = 200 + Math.random() * 2500;
    const along = vNorm(vEarth);
    const sign = Math.random() < 0.7 ? 1 : -1;
    const vAstImpact = vAdd(vEarth, vMul(along, sign * relSpeed));

    const impact = {
      earth: { r: vClone(impactPos), v: vClone(vEarth), mass: 5.972e24, radius: R_EARTH },
      asteroid: { r: vClone(impactPos), v: vClone(vAstImpact), mass: null, radius: R_AST }
    };

    const steps = Math.ceil((backDays * 24 * 3600) / DT_PHYS);
    const bE = { r: vClone(impact.earth.r), v: vClone(impact.earth.v) };
    const bA = { r: vClone(impact.asteroid.r), v: vClone(impact.asteroid.v) };
    for (let i = 0; i < steps; i++) {
      verletStep(bE, -DT_PHYS);
      verletStep(bA, -DT_PHYS);
    }

    return {
      initialEarth: { r: bE.r, v: bE.v, mass: impact.earth.mass, radius: impact.earth.radius },
      initialAsteroid: { r: bA.r, v: bA.v, mass: impact.asteroid.mass, radius: impact.asteroid.radius },
      approxTimeToImpactSec: steps * DT_PHYS
    };
  }

  // --- Initialize bodies ---
  const init = makeProgradeImpactAndBacktrace();
  const earth = { r: init.initialEarth.r, v: init.initialEarth.v, mass: init.initialEarth.mass, radius: init.initialEarth.radius, active: true };
  const asteroid = { r: init.initialAsteroid.r, v: init.initialAsteroid.v, mass: null, radius: R_AST, active: true };
  const interceptor = {
    r: vAdd(vClone(earth.r), vMul(vNorm(earth.v), -1e5)), // 100 km behind Earth along-track
    v: vClone(earth.v),
    mass: 2000,
    radius: R_INT,
    active: true
  };

  console.log('Approx seconds until impact (if no interception):', init.approxTimeToImpactSec);

  // --- Guidance: constant-accel rendezvous solver ---
  function interceptorGuidanceAccel(interceptorBody, asteroidBody, maxAccel = INTERCEPTOR_MAX_ACCEL) {
    // If asteroid is inactive (stopped) or destroyed, return zero accel
    if (asteroidBody.active === false) return { x: 0, y: 0, z: 0 };

    const relP = vSub(asteroidBody.r, interceptorBody.r);
    const relV = vSub(asteroidBody.v, interceptorBody.v);
    const dist = vLen(relP);

    // TOF heuristic
    const tofMin = 10 * 60;            // 10 min
    const tofMax = 3 * 24 * 3600;      // 3 days
    const nominalClosure = 2000;       // m/s
    let tof = Math.max(tofMin, Math.min(tofMax, dist / nominalClosure));

    // Predicted asteroid position (constant velocity)
    const predictedAst = vAdd(asteroidBody.r, vMul(asteroidBody.v, tof));

    // Solve constant accel: interceptor.r + interceptor.v*tof + 0.5*a*tof^2 = predictedAst
    const term = vSub(predictedAst, vAdd(interceptorBody.r, vMul(interceptorBody.v, tof)));
    const factor = 2 / (tof * tof);
    let aCmd = vMul(term, factor);

    const aMag = vLen(aCmd);
    if (aMag < 1e-12) return { x: 0, y: 0, z: 0 };
    if (aMag > maxAccel) {
      const s = maxAccel / aMag;
      aCmd = vMul(aCmd, s);
    }
    return aCmd;
  }

  // --- HUD for cumulative delta-v and status ---
  let cumulativeDeltaV = 0.0; // m/s
  const hud = document.createElement('div');
  hud.style.position = 'fixed';
  hud.style.left = '12px';
  hud.style.top = '12px';
  hud.style.padding = '8px 12px';
  hud.style.background = 'rgba(0,0,0,0.6)';
  hud.style.color = '#fff';
  hud.style.fontFamily = 'monospace';
  hud.style.fontSize = '13px';
  hud.style.zIndex = 9999;
  hud.style.borderRadius = '6px';
  hud.innerText = 'Delta-v: 0.000000 km/s\nStatus: running';
  document.body.appendChild(hud);
  function updateHud() {
    const dv_km_s = (cumulativeDeltaV / 1000).toFixed(6);
    const status = asteroid.active === false && interceptor.active === false ? 'intercepted (stopped)' :
                   asteroid.active === false && interceptor.active === true  ? 'asteroid stopped' :
                   asteroid.active === true && interceptor.active === false  ? 'interceptor stopped' :
                   'running';
    hud.innerText = `Delta-v: ${dv_km_s} km/s\nStatus: ${status}`;
  }

  // --- Flash helper ---
  let flashFades = [];
  function spawnFlashMeters(posMeters, scale = 1, color = 0xffee88) {
    const posS = simToScene(posMeters);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(earthVis * 0.6 * scale, 12, 12),
      new THREE.MeshBasicMaterial({ color, emissive: 0xffffcc, transparent: true, opacity: 1 }));
    mesh.position.copy(posS);
    scene.add(mesh);
    const light = new THREE.PointLight(color, 8.0 * scale, RENDER_SCALE * 0.6, 2);
    light.position.copy(posS);
    scene.add(light);
    const dur = 1.5;
    let elapsed = 0;
    const fade = (dtSec) => {
      elapsed += dtSec;
      const t = Math.min(1, elapsed / dur);
      if (t >= 1) {
        scene.remove(mesh); scene.remove(light); mesh.geometry.dispose(); mesh.material.dispose();
        return false;
      }
      mesh.material.opacity = 1 - t;
      light.intensity = 8 * (1 - t) * (1 - t) * scale;
      return true;
    };
    flashFades.push(fade);
  }

  // --- Physics substep advance ---
  let running = true;
  function physicsSubstepAdvance(nSubsteps = SUBSTEPS_PER_FRAME) {
    for (let i = 0; i < nSubsteps; i++) {
      if (!running) break;

      // Earth always advances (active)
      verletStep(earth, DT_PHYS);

      // Determine interceptor accel (zero if interceptor inactive)
      let accel = { x: 0, y: 0, z: 0 };
      if (interceptor.active !== false) accel = interceptorGuidanceAccel(interceptor, asteroid, INTERCEPTOR_MAX_ACCEL);

      // Accumulate delta-v from thrust for interceptor only when active
      if (interceptor.active !== false) {
        const a_thrust_mag = vLen(accel);
        cumulativeDeltaV += a_thrust_mag * DT_PHYS;
      }

      // Advance asteroid (skip if inactive)
      if (asteroid.active !== false) verletStep(asteroid, DT_PHYS);

      // Advance interceptor with thrust if active
      if (interceptor.active !== false) verletStep(interceptor, DT_PHYS, accel);

      // Collision: interceptor vs asteroid
      if (interceptor.active !== false && asteroid.active !== false && checkCollisionMeters(asteroid, interceptor)) {
        // Stop both bodies: zero velocities, mark inactive
        asteroid.v = { x: 0, y: 0, z: 0 };
        interceptor.v = { x: 0, y: 0, z: 0 };
        asteroid.active = false;
        interceptor.active = false;
        spawnFlashMeters(asteroid.r, 1.8, 0x99ff99);
        console.log('Interceptor hit asteroid — success.');
        console.log(`Cumulative delta-v at intercept: ${cumulativeDeltaV.toFixed(6)} m/s (${(cumulativeDeltaV/1000).toFixed(6)} km/s).`);
      }

      // Collision: asteroid vs Earth
      if (asteroid.active !== false && checkCollisionMeters(asteroid, earth)) {
        // Stop asteroid only; Earth continues
        asteroid.v = { x: 0, y: 0, z: 0 };
        asteroid.active = false;
        interceptor.active = false; // stop interceptor thrusting to avoid further delta-v
        spawnFlashMeters(earth.r, 2.5, 0xffcc66);
        console.log('Asteroid impacted Earth — asteroid stopped at impact point.');
        console.log(`Cumulative delta-v at impact: ${cumulativeDeltaV.toFixed(6)} m/s (${(cumulativeDeltaV/1000).toFixed(6)} km/s).`);
      }
    }
    updateHud();
  }

  // --- Animation loop ---
  function animateFrame() {
    requestAnimationFrame(animateFrame);

    if (running) physicsSubstepAdvance();

    // Update meshes to current positions
    earthMesh.position.copy(simToScene(earth.r));
    astMesh.position.copy(simToScene(asteroid.r));
    intMesh.position.copy(simToScene(interceptor.r));

    // Update trails
    pushTrail(trailEarth, simToScene(earth.r));
    pushTrail(trailAst, simToScene(asteroid.r));
    pushTrail(trailInt, simToScene(interceptor.r));

    // Flash fades
    const keep = [];
    for (const f of flashFades) if (f(1/60)) keep.push(f);
    flashFades = keep;

    // Keep asteroid visible even after stop (per request); interceptor stays visible but inactive
    renderer.render(scene, camera);
  }
  animateFrame();

  // --- UI controls ---
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { running = !running; updateHud(); console.log(running ? 'Resumed' : 'Paused'); }
    if (e.key.toLowerCase() === 'r') location.reload();
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Expose some debug handles
  window.__sim = {
    earth, asteroid, interceptor,
    getCumulativeDeltaV_m_s: () => cumulativeDeltaV,
    getCumulativeDeltaV_km_s: () => cumulativeDeltaV / 1000,
    resume: () => { running = true; updateHud(); },
    pause: () => { running = false; updateHud(); }
  };

})();