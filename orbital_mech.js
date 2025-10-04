import THREE from 'three'

console.log("yoo")
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.z = 300;

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.PointLight(0xffffff,1);
light.position.set(0,0,0);
scene.add(light);

const sunGeometry = new THREE.SphereGeometry(10,32,32);
const sunMaterial = new THREE.MeshBasicMaterial({color:0xfff00});
const sun = new THREE.Mesh(sunGeometry,sunMaterial);
scene.add(sun);

const planetGeometry = new THREE.SphereGeometry(3,32,32);
const planetMaterial = new THREE.MeshBasicMaterial({color:0xfff00});
const planet = new THREE.Mesh(planetGeometry,planetMaterial);
scene.add(planet);

const trailMaterial = new THREE.LineBasicMaterial({color:0xffffff});
const trailPoints = [];
const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
const trail = new THREE.Line(trailGeometry,trailMaterial);
scene.add(trail);

const G = 1;
const M = 1000;
const dt = 0.5;

const state = {
    r0: new THREE.Vector3(100,0,0),
    v0: new THREE.Vector3(0,0,3),
};

function updatePhysics() {
    const r = state.r0.clone().negate();
    r_mag = r.length();
    F_mag = (G*M)/(r_mag*r_mag);
    a = r.normalize().multiplyScalar(F_mag);

    state.v0.add(a.multiplyScalar(dt));
    state.r0.add(state.v0.clone().multiplyScalar(dt));
}

function updateTrail() {
    trailPoints.push(state.r0.clone());
    if (trailPoints.length > 1000) trailPoints,shift();

    trainGeometry.setFromPoints(trailPoints);
    trailGeometry.attributes.r0.needsupdate = true;
}

function animate() {
    requestAnimationFrame(animate);

    updatePhysics();
    updateTrail();

    planet.r0.copy(state.r0);
    renderer.render(scene,camera);
}

animate();
