import * as THREE from 'three';
import { Vector3 as Vec3 } from 'three';


// Set up scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//Load texture for the sun(local image)
const textureLoader = new THREE.TextureLoader();
const sunTexture = textureLoader.load('assets/data/2k_sun.jpg')


// Add a light source to represent the sun
const sunLight = new THREE.PointLight(0xFFFF00, 1, 500, 2);
sunLight.position.set(0, 100, 0); // Position the light (the sun)
scene.add(sunLight);

// Add the visual representation of the sun
const sunGeometry = new THREE.SphereGeometry(10, 32, 32); // Radius 10
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });

const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0, 100, 0);
scene.add(sun);

// Add a ground plane to cast shadows
const groundGeometry = new THREE.PlaneGeometry(500, 500);
const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.5 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = - Math.PI / 2; // Rotate to lie flat
ground.position.y = -5;
ground.receiveShadow = true;
scene.add(ground);

// Enable shadows for the sun light
sunLight.castShadow = true;

// Camera position
camera.position.z = 200;

// Window resize handling
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Animate the scene
function animate() {
    requestAnimationFrame(animate);

    // Optional: Rotate the sun
    sun.rotation.y += 0.01; // Rotate the sun mesh for a simple animation

    // Optional: Animate the sun position (like moving across the sky)
    //sun.position.x = Math.sin(Date.now() * 0.0002) * 100; // Simple back-and-forth motion
    //sun.position.z = Math.cos(Date.now() * 0.0002) * 100;

    renderer.render(scene, camera);
}

animate();
