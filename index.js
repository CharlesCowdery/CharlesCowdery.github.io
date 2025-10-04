import * as THREE from 'three';
import { Vector3 as Vec3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//Load texture for the sun(local image)
const textureLoader = new THREE.TextureLoader();
const sunTexture = textureLoader.load('assets/data/2k_sun.jpg')

const geometries = new Map();
const materials = new Map();
const meshes = new Map();
const lights = new Map();
const pathes = new Map();
const textures = new Map();


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
//const geometry = new THREE.BoxGeometry( 1, 1, 1 );
//const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
//const cube = new THREE.Mesh( geometry, material );
//scene.add( cube );

    const hash_buf = new ArrayBuffer(12);
    const hash_f32 = new Float32Array(hash_buf);
    const hash_u32 = new Uint32Array(hash_buf);


    const controls = new OrbitControls( camera, renderer.domElement );

async function initialize(){
    geometries.set("basic sphere", new THREE.IcosahedronGeometry(1,10));
    materials .set("green matte", new THREE.MeshPhongMaterial({flatShading:true, color:0x00ff00}));
    meshes    .set("test sphere", new THREE.Mesh(geometries.get("basic sphere"),materials.get("green matte")));
    
    textures.set("earth",textureLoader.load("./assets/data/2k_earth_daymap.jpg"));
    


    lights.set("dirlight", new THREE.DirectionalLight( 0xffffff, 3 ));
	lights.get("dirlight").position.set( 2, 2, 2 );
    lights.set("ambient", new THREE.AmbientLight(0x404040,1));


    //let neighborhood = compute_neighbors(geometries.get("basic sphere")); 

    //console.log(neighborhood)

    //sim = new EulerSim();
    //await sim.init(neighborhood.tris.length);

    meshes.forEach((v,k)=>{scene.add(v)});
    lights.forEach(v=>scene.add(v));
}

camera.position.set(0,20,100);

function animate() {
    requestAnimationFrame(animate);

  //cube.rotation.x += 0.01;
  //cube.rotation.y += 0.01;

  controls.update();

  renderer.render( scene, camera );

}


initialize();