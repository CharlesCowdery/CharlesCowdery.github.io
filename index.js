import * as THREE from 'three';
import { Vector3 as Vec3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


//Scene, cam, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setAnimationLoop(animate)
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop( animate );


// Add a light source to represent the sun
const sunLight = new THREE.PointLight(0xFFFF00, 1, 500, 2);
sunLight.position.set(0, 100, 0);
sunLight.castShadow = true;
scene.add(sunLight);

document.body.appendChild(renderer.domElement);

const geometries = new Map();
const materials = new Map();
const meshes = new Map();
const lights = new Map();
const pathes = new Map();
const textures = new Map();

//Load texture for the sun(local image)
const textureLoader = new THREE.TextureLoader();

    const hash_buf = new ArrayBuffer(12);
    const hash_f32 = new Float32Array(hash_buf);
    const hash_u32 = new Uint32Array(hash_buf);
    const controls = new OrbitControls( camera, renderer.domElement );

//van's code

class CelestialObject{
    constructor(name, size, texture,type='planet',distanceFromSun){
        this.name = name;
        this.size = size;
        this.texture = texture;
        this.type = type;

        this.distanceFromSun = distanceFromSun;
    }

createMesh() 
{
    let geometry = new THREE.SphereGeometry(this.size, 32, 32);
    let material = new THREE.MeshPhongMaterial({ map: this.texture });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = this.name;
    this.mesh.position.x = this.distanceFromSun;
}

addToScene(scene) 
{
    scene.add(this.mesh);
}
}

async function createCelestrialObjects(){
    const textureLoader = new THREE.TextureLoader();
    const sunTexture = await textureLoader.loadAsync('assets/data/2k_sun.jpg')
    const mercuryTexture = await textureLoader.loadAsync('assets/data/2k_mercury.jpg')
    const venusTexture = await textureLoader.loadAsync('assets/data/2k_venus.jpg')
    const earthTexture = await textureLoader.loadAsync('assets/data/2k_earth.jpg')
    const marsTexture = await textureLoader.loadAsync('assets/data/2k_mars.jpg')
    const jupiterTexture = await textureLoader.loadAsync('assets/data/2k_jupiter.jpg')
    const saturnTexture = await textureLoader.loadAsync('assets/data/2k_saturn.jpg')
    const uranusTexture = await textureLoader.loadAsync('assets/data/2k_uranus.jpg')
    const neptuneTexture = await textureLoader.loadAsync('assets/data/2k_neptune.jpg')
    return {sunTexture, mercuryTexture, venusTexture, earthTexture, marsTexture, jupiterTexture, saturnTexture, uranusTexture, neptuneTexture}
}

const planetsData = [
  { name: 'Mercury', size: 2, texture: 'mercury', distanceFromSun: 30},
  { name: 'Venus', size: 4, texture: 'venus', distanceFromSun: 50},
  { name: 'Earth', size: 5, texture: 'earth', distanceFromSun: 70},
  { name: 'Mars', size: 7, texture: 'mars', distanceFromSun: 90},
  { name: 'Jupiter', size: 20, texture: 'jupiter', distanceFromSun: 150},
  { name: 'Saturn', size: 18, texture: 'saturn', distanceFromSun: 200},
  { name: 'Uranus', size: 15, texture: 'uranus', distanceFromSun: 250},
  { name: 'Neptune', size: 14, texture: 'neptune', distanceFromSun: 300},
];

var planets;
// Load textures and create the planets
async function createScene() {
    try{
        const textures = await loadTextures();
        
        //Map function that goes over planetsData array. Elements are passed as PlanetData
        planets = planetsData.map(planetData =>{
            const texture = textures[planetData.texture];    
            const planet = new CelestialObject(
                planetData.name,
                planetData.size,
                texture,
                planetData.distanceFromSun
            );
            planet.createMesh();
            planet.addToScene(scene);
            return planet;
        });
    } catch (error) {
    console.error("Error loading textures or creating scene:", error);
    }
    console.log(planets)
}   


//stationary sun
const sun = new CelestialObject('Sun', 30, textures.sunTexture, 0, 0, 0, 'star');
sun.createMesh();
sun.addToScene(scene);

camera.position.set(0, 100, 500)

async function van(){
    
    //no speed and velocity

    lights.set("sun" , new THREE.PointLight(0xFFFF00, 1, 500, 2));
    lights.get("sun").position.set(0, 0, 0); // Position the light (the sun)
    lights.get("sun").castShadow = true;

    textures.set("sun",textureLoader.load('assets/data/2k_sun.jpg'));
    geometries.set("sun",new THREE.SphereGeometry(10, 32, 32));
    materials.set("sun",new THREE.MeshBasicMaterial({ color: 0xFFFF00 }));
    meshes.set("sun", new THREE.Mesh(geometries.get("sun"),materials.get("sun")));
    meshes.get("sun").position.set(0,100,0);
    // Add the visual representation of the sun

    geometries.set("ground", new THREE.PlaneGeometry(500, 500));
    materials.set("ground",new THREE.ShadowMaterial({ opacity: 0.5 }));
    meshes.set("ground", new THREE.Mesh(geometries.get("ground"), materials.get("ground")));
    meshes.get("ground").rotation.x = - Math.PI / 2;
    meshes.get("ground").position.y = -5;
    meshes.get("ground").receiveShadow = true;

// Enable shadows for the sun light
}

//van's code

async function charles(){

}

//deleted async initialize

camera.position.set(0,100,500);


//Animation loop
function animate() {
    requestAnimationFrame(animate);

    //updates every celestial obj

    planets.forEach(planet=> planet.update());
    sun.update();

    //updates controls and render
    controls.update();
    renderer.render(scene, camera);

}

animate();
createScene();