import * as THREE from 'three';
import { Vector3 as Vec3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import * as ORBIT from "./orbital_mech.js"


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

function van_update(){

}

// charles functions

var path_update_queue = [];
function registerPathUpdate(path_name){
    path_update_queue.push(path_name);
}

function registerPath(path_name){
    pathes.set(path_name,new THREE.Path());
    geometries.set(path_name,new THREE.BufferGeometry());
}

async function charles(){

    registerPath("jupiter orbit");

    var points = [];
    for(let i = 0; i < 10 ; i++){
        var point = (ORBIT.kepler_orbital_position(ORBIT.sets["earth"],i/10));
        pathes.get("jupiter orbit").lineTo(point[0]*10,point[1]*10,point[2]*10);
    }


    materials.set("line basic",new THREE.LineBasicMaterial({color:0x00ff00}))

    meshes.set("jupiter orbit", new THREE.Line(geometries.get("jupiter orbit"),materials.get("line basic")));

    registerPathUpdate("jupiter orbit");
    
}

var t = 0

function charles_update(){
    t++;
    var point = (ORBIT.kepler_orbital_position(ORBIT.sets["jupiter"],t*10));

    meshes.get("sun").position.set(point[0]*10,point[1]*10,point[2]*10)

    path_update_queue.forEach(path_name=>{
        geometries.get(path_name).setFromPoints(pathes.get(path_name).getPoints());
        console.log(geometries.get(path_name),pathes.get(path_name).getPoints());
    })
    path_update_queue = [];
}

//

//deleted async initialize

camera.position.set(0,100,500);


//Animation loop
async function initialize(){
    geometries.set("basic sphere", new THREE.IcosahedronGeometry(1,10));
    materials .set("green matte", new THREE.MeshPhongMaterial({flatShading:true, color:0x00ff00}));
    //meshes    .set("test sphere", new THREE.Mesh(geometries.get("basic sphere"),materials.get("green matte")));
    
    textures.set("earth",textureLoader.load("./assets/data/2k_earth_daymap.jpg"));


    lights.set("dirlight", new THREE.DirectionalLight( 0xffffff, 3 ));
	lights.get("dirlight").position.set( 2, 2, 2 );
    lights.set("ambient", new THREE.AmbientLight(0x404040,1));


    //let neighborhood = compute_neighbors(geometries.get("basic sphere")); 

    //console.log(neighborhood)

    //sim = new EulerSim();
    //await sim.init(neighborhood.tris.length);
    van();
    charles();

    meshes.forEach(v=>scene.add(v));
    lights.forEach(v=>scene.add(v));
}

camera.position.set(0,200,200);

function animate() {

    //updates every celestial obj

    planets.forEach(planet=> planet.update());
    sun.update();

    //updates controls and render
    controls.update();
    renderer.render(scene, camera);
  //cube.rotation.x += 0.01;
  //cube.rotation.y += 0.01;

  van_update();
  charles_update();

  controls.update();

  renderer.render( scene, camera );
    //requestAnimationFrame(animate);

}

animate();
createScene();