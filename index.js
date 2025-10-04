import * as THREE from 'three';
import { Vector3 as Vec3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import * as ORBIT from "./orbital_mech.js"

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setAnimationLoop(animate)
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop( animate );

document.body.appendChild(renderer.domElement);

const geometries = new Map();
const materials = new Map();
const meshes = new Map();
const lights = new Map();
const pathes = new Map();
const textures = new Map();

//Load texture for the sun(local image)
const textureLoader = new THREE.TextureLoader();


//const geometry = new THREE.BoxGeometry( 1, 1, 1 );
//const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
//const cube = new THREE.Mesh( geometry, material );
//scene.add( cube );

    const hash_buf = new ArrayBuffer(12);
    const hash_f32 = new Float32Array(hash_buf);
    const hash_u32 = new Uint32Array(hash_buf);


    const controls = new OrbitControls( camera, renderer.domElement );

async function van(){
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

  //cube.rotation.x += 0.01;
  //cube.rotation.y += 0.01;

  van_update();
  charles_update();

  controls.update();

  renderer.render( scene, camera );
    //requestAnimationFrame(animate);

}


initialize();