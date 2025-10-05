import * as THREE from 'three';
import { Vector3 as Vec3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import * as ORBIT from "./orbital_mech.js"


//Scene, cam, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);


//Load space background
const spaceBackground = new THREE.TextureLoader().load('./assets/data/2k_stars.jpg')
scene.background = spaceBackground;

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

//
const textureLoader = new THREE.TextureLoader();
    const hash_buf = new ArrayBuffer(12);
    const hash_f32 = new Float32Array(hash_buf);
    const hash_u32 = new Uint32Array(hash_buf);
    const controls = new OrbitControls( camera, renderer.domElement );

//van's code

class CelestialObject{
    constructor(name, size, texture,distanceFromSun){
        this.name = name;
        this.size = size;
        console.log(this.texture)
        this.texture = texture;
        this.distanceFromSun = distanceFromSun;
    }
    createMesh() {   
    let geometry = new THREE.SphereGeometry(this.size, 32, 32);
    console.log(this.texture)
    let material = new THREE.MeshPhongMaterial({ "map": this.texture });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = this.name;
    this.mesh.position.x = this.distanceFromSun;
    }

    addToScene(scene) {
    scene.add(this.mesh);
    }

    update(){
    }
}

//Loads textures 
async function loadTextures(){
    const textureLoader = new THREE.TextureLoader();
    const sunTexture = await textureLoader.loadAsync('assets/data/2k_sun.jpg')
    const mercuryTexture = await textureLoader.loadAsync('assets/data/2k_mercury.jpg')
    const venusTexture = await textureLoader.loadAsync('assets/data/2k_venus_atmosphere.jpg')
    const earthTexture = await textureLoader.loadAsync('assets/data/2k_earth_daymap.jpg')
    const marsTexture = await textureLoader.loadAsync('assets/data/2k_mars.jpg')
    const jupiterTexture = await textureLoader.loadAsync('assets/data/2k_jupiter.jpg')
    const saturnTexture = await textureLoader.loadAsync('assets/data/2k_saturn.jpg')
    const uranusTexture = await textureLoader.loadAsync('assets/data/2k_uranus.jpg')
    const neptuneTexture = await textureLoader.loadAsync('assets/data/2k_neptune.jpg')
    return {sunTexture, mercuryTexture, venusTexture, earthTexture, marsTexture, jupiterTexture, saturnTexture, uranusTexture, neptuneTexture}
}

const planetsData = [
  { name: 'Mercury', size: .2, texture: 'mercury', distanceFromSun: 30},
  { name: 'Venus', size: .4, texture: 'venus', distanceFromSun: 50},
  { name: 'Earth', size: .5, texture: 'earth', distanceFromSun: 70},
  { name: 'Mars', size: .7, texture: 'mars', distanceFromSun: 90},
  { name: 'Jupiter', size: 1, texture: 'jupiter', distanceFromSun: 150},
  { name: 'Saturn', size: 1.8, texture: 'saturn', distanceFromSun: 200},
  { name: 'Uranus', size: 1.5, texture: 'uranus', distanceFromSun: 250},
  { name: 'Neptune', size: 1.4, texture: 'neptune', distanceFromSun: 300},
];

var planets;
// Load textures and create the planets
async function createScene() {
    try{
        const textures = await loadTextures();
        console.log(textures);
        //Map function that goes over planetsData array. Elements are passed as PlanetData
        planets = planetsData.map(planetData =>{
            const texture = textures[planetData.texture+"Texture"];  
            console.log(texture);  
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
        console.log("planets created")

    console.log(planets)
}   


//stationary sun
const sun = new CelestialObject('Sun', 1, textures.sunTexture, 0, 0, 0, 'star');
sun.createMesh();
sun.addToScene(scene);

camera.position.set(0, 100, 500)

async function van(){
    
    //no speed and velocity

    // Add the visual representation of the sun

    geometries.set("ground", new THREE.PlaneGeometry(500, 500));
    materials.set("ground",new THREE.ShadowMaterial({ opacity: 0.5 }));
    meshes.set("ground", new THREE.Mesh(geometries.get("ground"), materials.get("ground")));
    meshes.get("ground").rotation.x = - Math.PI / 2;
    meshes.get("ground").position.y = -5;
    meshes.get("ground").receiveShadow = true;

    await createScene();
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

var orbital_scalar = 3;

function dist(a1,a2){
    return Math.sqrt(Math.pow(a1[0]-a2[0],2)+Math.pow(a1[1]-a2[1],2)+Math.pow(a1[2]-a2[2],2))
}

async function charles(){

    registerPath("jupiter orbit");

    var points = [];
    materials.set("line basic",new THREE.LineBasicMaterial({color:0x00ff00}))



    planets.forEach(planet=>{
        var name = planet.name.toLowerCase();
        registerPath(name+" orbit");
        var hypothetical_time = starting_date;
        var startpos = ORBIT.kepler_orbital_position(ORBIT.sets[name],ORBIT.date_to_kepler_time(hypothetical_time));
        var orbital_position = [0,0,0];
        var prev_dist = 0;
        var cur_dist = 0;
        var prev_delta = 0;
        var cur_delta = 0;
        var past_half = false;
        var i = 0;
        while(i<10000 || prev_delta>cur_delta){
            i++;
            hypothetical_time.setTime(hypothetical_time.getTime()+100000000);
            orbital_position = ORBIT.kepler_orbital_position(ORBIT.sets[name],ORBIT.date_to_kepler_time(hypothetical_time));
            
            pathes.get(name+" orbit").lineTo(
                orbital_position[0]*orbital_scalar,
                orbital_position[1]*orbital_scalar,
                orbital_position[2]*orbital_scalar
            )
            prev_delta = cur_dist-prev_dist;
            prev_dist = cur_dist
            cur_dist = dist(startpos,orbital_position)
            cur_delta = prev_dist-cur_dist
            if(i > 100000) break;
        }
        meshes.set(name+" orbit", new THREE.Line(geometries.get(name+" orbit"),materials.get("line basic")));

        registerPathUpdate(name+" orbit");
    })
    




    registerPathUpdate("jupiter orbit");
    
}

var starting_date = new Date(2025,1,1);
var tick_speed_seconds = 100000;
var time = starting_date;
var time_julian = 0;

function formatDateClassic(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // months 0-11
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}:${month}:${day} ${hour}:${minute}:${second}`;
}

function charles_update(){
    
    time.setTime(time.getTime()+tick_speed_seconds*1000);
    time_julian = ORBIT.date_to_kepler_time(time);

    document.getElementById("time").innerText=formatDateClassic(time);

    var point = (ORBIT.kepler_orbital_position(ORBIT.sets["jupiter"],time_julian));

    path_update_queue.forEach(path_name=>{
        geometries.get(path_name).setFromPoints(pathes.get(path_name).getPoints());
        //console.log(geometries.get(path_name),pathes.get(path_name).getPoints());
    })
    path_update_queue = [];

    planets.forEach(planet=>{
        var name = planet.name.toLowerCase();
        var orbital_position = ORBIT.kepler_orbital_position(ORBIT.sets[name],time_julian);
        planet.mesh.position.x = orbital_position[0]*orbital_scalar;
        planet.mesh.position.y = orbital_position[1]*orbital_scalar;
        planet.mesh.position.z = orbital_position[2]*orbital_scalar;
    })
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
    await van();
    await charles();

    meshes.forEach(v=>scene.add(v));
    lights.forEach(v=>scene.add(v));
    //animate()
    renderer.setAnimationLoop(animate)

}

camera.position.set(0,200,200);


function animate() {

    //updates every celestial obj
    planets.forEach(planet=>{
        planet.update()
    } );
    //sun.update();

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
initialize();
//animate();

