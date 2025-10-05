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
const sunLight = new THREE.PointLight(0xFFFFFF, 2, 100, 2);
sunLight.position.set(0, 0, 0);
sunLight.castShadow = true;
scene.add(sunLight);

document.body.appendChild(renderer.domElement);

const geometries = new Map();
const materials = new Map();
const meshes = new Map();
const lights = new Map();
const curves = new Map();
const textures = new Map();

//
const textureLoader = new THREE.TextureLoader();
    const hash_buf = new ArrayBuffer(12);
    const hash_f32 = new Float32Array(hash_buf);
    const hash_u32 = new Uint32Array(hash_buf);
    const controls = new OrbitControls( camera, renderer.domElement );

//van's code

class CelestialObject{
    constructor(name, size, texture,distanceFromSun,mass,SOI){
        this.name = name;
        this.size = size;
        this.texture = texture;
        this.distanceFromSun = distanceFromSun;
        this.mass = mass;
        this.position = [0,0,0];
        this.SOI = SOI;
    }
    createMesh() {   
    let geometry = new THREE.SphereGeometry(this.size*2/Au*1e3, 32, 32);
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

    copy(){
        var n = new CelestialObject(this.name,this.size,"",this.distanceFromSun,this.mass,this.SOI);
        n.position = [...this.position];
        return n;
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
    { name: "Sun", size: 1e7, texture: "sun", distanceFromSun: 0, mass:1.989e30, SOI: 1e100},
    { name: 'Mercury', size: 2.4e6, texture: 'mercury', distanceFromSun: 30,mass:3.285e23, SOI: 1e8},
    { name: 'Venus', size: 6e6, texture: 'venus', distanceFromSun: 50,mass:4.867e24, SOI: 1e8},
    { name: 'Earth', size: 6.4e6, texture: 'earth', distanceFromSun: 70, mass:5.97219e30, SOI: 1e15},
    { name: 'Mars', size: 3.4e6, texture: 'mars', distanceFromSun: 90,mass:6.39e23, SOI: 1e9},
    { name: 'Jupiter', size: 7e7, texture: 'jupiter', distanceFromSun: 150, mass: 1.898e27, SOI: 1e10},
    { name: 'Saturn', size: 6e7, texture: 'saturn', distanceFromSun: 200, mass : 5.683e26, SOI: 1e10},
    { name: 'Uranus', size: 2.5e7, texture: 'uranus', distanceFromSun: 250, mass: 8.681e25, SOI: 1e10},
    { name: 'Neptune', size: 2.5e7, texture: 'neptune', distanceFromSun: 300, mass : 1.024e26, SOI: 1e10},
  
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
            //console.log(texture);  
            const planet = new CelestialObject(
                planetData.name,
                planetData.size,
                texture,
                planetData.distanceFromSun,
                planetData.mass,
                planetData.SOI
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


var curve_update_queue = [];
function registerCurveUpdate(curve_name){
    curve_update_queue.push(curve_name);
}

function registerCurve(curve_name){
    curves.set(curve_name,new THREE.CatmullRomCurve3([new Vec3(0,0,0),new Vec3(0,0,0),new Vec3(0,0,0),new Vec3(0,0,0)]));
    geometries.set(curve_name,new THREE.BufferGeometry());
}

function dist(a1,a2){
    return Math.sqrt(Math.pow(a1[0]-a2[0],2)+Math.pow(a1[1]-a2[1],2)+Math.pow(a1[2]-a2[2],2))
}

const Au = 149597870700;
const G_constant = 6.6743*10e-11
var GS_force = new Float32Array([0,0,0]);
var delta = new Float32Array([0,0,0]);

var wd = null;
var working_data_count = 0;
var working_data_p_count = 0;

function gravity_solve(prj,step,t){  
    prj.acceleration[0] = 0;
    prj.acceleration[1] = 0;
    prj.acceleration[2] = 0;  
    var r = dist([0,0,0],prj.position);
    for(let i = 0; i < working_data_count; i++){
        var s = i*working_data_p_count
        if(i > 0){
            var apx_dist = r-wd[s+3];
            if(apx_dist>wd[s+6]) continue;
            if(apx_dist<-wd[s+6]){
                break;
            }
        }

        delta[0] = wd[s+0]-prj.position[0]
        delta[1] = wd[s+1]-prj.position[1]
        delta[2] = wd[s+2]-prj.position[2]

        var p_dist = Math.sqrt(delta[0]*delta[0]+delta[1]*delta[1]+delta[2]*delta[2]);
        var force_scalar = G_constant*wd[4]/(p_dist*p_dist*p_dist);

        prj.acceleration[0] += delta[0]*force_scalar;
        prj.acceleration[1] += delta[1]*force_scalar;
        prj.acceleration[2] += delta[2]*force_scalar;

        if(p_dist<wd[s+7]){
            wd[s+7] = p_dist;
            wd[s+8] = t;
            wd[s+9] =  prj.position[0];
            wd[s+10] = prj.position[1];
            wd[s+11] = prj.position[2];
        }
    }

    prj.acceleration

    prj.position[0] += prj.velocity[0]*step+0.5*GS_force[0]*GS_force[0]*step;
    prj.position[1] += prj.velocity[1]*step+0.5*GS_force[1]*GS_force[1]*step;
    prj.position[2] += prj.velocity[2]*step+0.5*GS_force[2]*GS_force[2]*step;

    prj.velocity[0]+=prj.acceleration[0]*step;
    prj.velocity[1]+=prj.acceleration[1]*step;
    prj.velocity[2]+=prj.acceleration[2]*step;
}

var orbit_cache_start_time_ms = 0;
var orbit_cache_start_time_s = 0;

var cache_size = 1000000;
var cache_t_step_seconds = 1000;
var cache_index_mulitiplier = 3*8;
var p_orbit_cache = new Float32Array(cache_size*cache_index_mulitiplier)

function complete_cache(){
    orbit_cache_start_time_ms = starting_date.getTime();
    orbit_cache_start_time_s = orbit_cache_start_time_ms/1000;
    var time = orbit_cache_start_time_ms;
    var tj = 0;
    var i = 0;
    var au_scalar_1 = Au/Math.sqrt(3);
    for(let t = 0; t < cache_size; t++){
        for(let pi = 1; pi < planets.length; pi++){
            var name = planets[pi].name.toLowerCase();
            var orbital_position = ORBIT.kepler_orbital_position(ORBIT.sets[name],tj);
            p_orbit_cache[i++] = orbital_position[0]*au_scalar_1;
            p_orbit_cache[i++] = orbital_position[1]*au_scalar_1;
            p_orbit_cache[i++] = orbital_position[2]*au_scalar_1;
        }
        time = time+cache_t_step_seconds*1000;
        tj = ORBIT.time_to_kepler_time(time);
    }
    console.log(p_orbit_cache)
}

function simulate_path(proj_orig,steps,point_count,t_start_s){
    var points = [];

    var proj = proj_orig.clone();

    var tms = t_start_s*1000;
    var ts = tms/1000;

    var step_base_seconds = 100;
    var step_base_ms = step_base_seconds*1000;
    var step_s = step_base_seconds;
    var step_ms = step*1000;

    let my_working_data = []
    working_data_count = planets.length;

    planets.forEach(v=>{
        my_working_data.push(
            0,//0 px
            0,//1 py
            0,//2 pz
            0,//3 sdist
            v.mass,//4
            v.size,//5
            v.SOI,//6
            0,//7  capprch
            0,//8  tapprch
            0,//9  csx
            0,//10 csy
            0,//11 csz
        )
    });
    wd = new Float32Array(my_working_data.flat());
    working_data_p_count = my_working_data[0].length;
    var au_scalar_2 = 1/Au*Math.sqrt(3)*orbital_scalar
    var step = 1000;
    var cross_vec = new Float32Array([0,0,0]);

    var t1_index;
    var t2_index;

    var point_every = steps/point_count;
    var next_point = 0;

    console.log(wd)

    for(let i = 0; i < steps; i++){
        var ti_ur = (ts-orbit_cache_start_time_s)/cache_t_step_seconds
        var t1_index = Math.floor(ti_ur)*cache_index_mulitiplier;
        var t2_index = Math.ceil(ti_ur)*cache_index_mulitiplier;
        var mix = (Math.floor(ts-orbit_cache_start_time_s)%cache_t_step_seconds)/cache_t_step_seconds;
        var mix1 = 1-mix;
        var mix2 = mix;
        var ti1 = t1_index;
        var ti2 = t2_index;
        for(let pi = 1; pi < planets.length; pi++){
            //console.log(planets[pi].name,ti_ur,t1_index,t2_index,ti1,ti2,
            //    p_orbit_cache[ti1+0]*mix1,p_orbit_cache[ti2+0]*mix2,
            //    p_orbit_cache[ti1+1]*mix1,p_orbit_cache[ti2+1]*mix2,
            //    p_orbit_cache[ti1+2]*mix1,p_orbit_cache[ti2+2]*mix2)
            wd[pi*working_data_p_count+0] = (p_orbit_cache[ti1++]*mix1+p_orbit_cache[ti2++]*mix2);
            wd[pi*working_data_p_count+1] = (p_orbit_cache[ti1++]*mix1+p_orbit_cache[ti2++]*mix2);
            wd[pi*working_data_p_count+2] = (p_orbit_cache[ti1++]*mix1+p_orbit_cache[ti2++]*mix2);
        }

        console.log(wd);

        gravity_solve(proj,step);
        
        if(i>next_point){
            points.push(
                new Vec3(
                    proj.position[0]*au_scalar_2,
                    proj.position[1]*au_scalar_2,
                    proj.position[2]*au_scalar_2
                ));
            next_point += point_every;
        }

        ts = ts+step_s;
        tms = tms+step_ms;

        cross_product(cross_vec,proj.velocity,proj.acceleration);
        var mag = 1e-7+dist(cross_vec,[0,0,0])/dist([0,0,0],proj.velocity);
        mag = Math.max(1,1/mag*step_base_seconds);

        step_s = mag*step_base_seconds;
        step_ms = mag*step_base_ms;
    }
    return [points,wd];
}

var orbital_scalar = 1  ;

document.getElementById("t_button_0").addEventListener("click",()=>{
    tick_speed_seconds = 10;
    let i = 0;
    for(; i < 1; i++){
        document.getElementById("t_button_"+i).style.color="white";
    } 
    for(; i < 5; i++){
        document.getElementById("t_button_"+i).style.color="grey";
    }
})
document.getElementById("t_button_1").addEventListener("click",()=>{
    tick_speed_seconds = 100;
    let i = 0;
    for(; i < 2; i++){
        document.getElementById("t_button_"+i).style.color="white";
    } 
    for(; i < 5; i++){
        document.getElementById("t_button_"+i).style.color="grey";
    }
})
document.getElementById("t_button_2").addEventListener("click",()=>{
    tick_speed_seconds = 1000;
    let i = 0;
    for(; i < 3; i++){
        document.getElementById("t_button_"+i).style.color="white";
    } 
    for(; i < 5; i++){
        document.getElementById("t_button_"+i).style.color="grey";
    }
})
document.getElementById("t_button_3").addEventListener("click",()=>{
    tick_speed_seconds = 10000;
    let i = 0;
    for(; i < 4; i++){
        document.getElementById("t_button_"+i).style.color="white";
    } 
    for(; i < 5; i++){
        document.getElementById("t_button_"+i).style.color="grey";
    }
})
document.getElementById("t_button_4").addEventListener("click",()=>{
    tick_speed_seconds = 100000;
    let i = 0;
    for(; i < 5; i++){
        document.getElementById("t_button_"+i).style.color="white";
    } 
    for(; i < 5; i++){
        document.getElementById("t_button_"+i).style.color="grey";
    }
})

class Projectile{
    constructor(mass, position = [0,0,0], velocity = [0,0,0]){
        this.mass = mass;
        this.position = new Float32Array(position);
        this.velocity = new Float32Array(velocity);
        this.acceleration = new Float32Array([0,0,0]);
        this.mesh = null;

    }
    bindMesh(mesh){
        this.mesh = mesh;
    }
    clone(){
        var n = new Projectile();
        n.mass = this.mass;
        n.position = this.position;
        n.velocity = this.velocity;
        n.acceleration = this.acceleration;
        return n;
    }
}

var projectiles = {};

function cross_product(v_out,v1,v2){
    v_out[0] = v1[1]*v2[2]-v1[2]*v2[1];
    v_out[1] = v1[2]*v2[0]-v1[0]*v2[2];
    v_out[2] = v1[0]*v2[1]-v1[1]*v2[0];
}

async function charles(){


    var points = [];
    materials.set("line basic",new THREE.LineBasicMaterial({color:0xfffffff}))

    ORBIT.test_kepler_time_scaling(ORBIT.sets["earth"])

    complete_cache();
    registerCurve("test orbit");

    var t_proj = new Projectile(100,[2*Au,2*Au,2*Au],[40000,0,0]);

    var s_start = new Date();

    var sim_data = simulate_path(t_proj,10000,1000);

    var s_end = new Date();

    console.log(sim_data[0])

    console.log("sim time: ", s_end-s_start)
        curves.set("test orbit", new THREE.CatmullRomCurve3(sim_data[0]));

    registerCurveUpdate("test orbit");

    planets[0].mesh.castShadow=false;

    meshes.set("test orbit", new THREE.Line(geometries.get("test orbit"),materials.get("line basic")));
    //pathes.get("test orbit").moveTo(t_proj.position[0],t_proj.position[1],t_proj.position[2])


    planets.forEach(planet=>{
        var name = planet.name.toLowerCase();
        if(!(name in ORBIT.sets)) return;
        registerCurve(name+" orbit");
        var hypothetical_time = new Date(starting_date.getTime());
        var startpos = ORBIT.kepler_orbital_position(ORBIT.sets[name],ORBIT.date_to_kepler_time(hypothetical_time));
        var orbital_position = [0,0,0];
        var prev_dist = 0;
        var cur_dist = 0;
        var prev_delta = 0;
        var cur_delta = 0;
        var past_half = false;
        var i = 0;
        var step = Math.pow(planet.distanceFromSun,2.5);  

        var points = []

        while(i<4000 || prev_delta>cur_delta){
            i++;
            
            hypothetical_time.setTime(hypothetical_time.getTime()+step*4000);
            orbital_position = ORBIT.kepler_orbital_position(ORBIT.sets[name],ORBIT.date_to_kepler_time(hypothetical_time));
            
            points.push(new Vec3(
                orbital_position[0]*orbital_scalar,
                orbital_position[1]*orbital_scalar,
                orbital_position[2]*orbital_scalar)
            )
            prev_delta = cur_dist-prev_dist;
            prev_dist = cur_dist
            cur_dist = dist(startpos,orbital_position)
            cur_delta = prev_dist-cur_dist
            if(i > 100000) break;
        }

        curves.set(name+" orbit", new THREE.CatmullRomCurve3(points));
        meshes.set(name+" orbit", new THREE.Line(geometries.get(name+" orbit"),materials.get("line basic")));

        registerCurveUpdate(name+" orbit");
    })




    registerCurveUpdate("jupiter orbit");
    
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
var targetindex = 0;

function charles_update(){
    
    time.setTime(time.getTime()+tick_speed_seconds*1000);
    time_julian = ORBIT.date_to_kepler_time(time);

    


    document.getElementById("time").innerText=formatDateClassic(time);

    var point = (ORBIT.kepler_orbital_position(ORBIT.sets["jupiter"],time_julian));

    curve_update_queue.forEach(curve_name=>{
        geometries.get(curve_name).setFromPoints(curves.get(curve_name).getPoints(1000));
    })
    curve_update_queue = [];
    
    var au_scalar = Au/Math.sqrt(3);
    let i = 0;
    planets.forEach(planet=>{
        var name = planet.name.toLowerCase();
        if(!(name in ORBIT.sets)) return;
        var orbital_position = ORBIT.kepler_orbital_position(ORBIT.sets[name],time_julian);
        planet.mesh.position.x = orbital_position[0]*orbital_scalar;
        planet.mesh.position.y = orbital_position[1]*orbital_scalar;
        planet.mesh.position.z = orbital_position[2]*orbital_scalar;
        planet.position[0] = orbital_position[0]*au_scalar;
        planet.position[1] = orbital_position[1]*au_scalar;
        planet.position[2] = orbital_position[2]*au_scalar;
        planet.distanceFromSun = dist([0,0,0],planet.position);
        
    })
    let cameratarget = planets[targetindex];
    controls.target = new Vec3(
        cameratarget.position[0]/Au*Math.sqrt(3),
        cameratarget.position[1]/Au*Math.sqrt(3),
        cameratarget.position[2]/Au*Math.sqrt(3)
    );

}

//

window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        targetindex+=1;
        targetindex%=planets.length
        // optional: do something else here if you want to handle Tab yourself
    }
}, true); // use capture phase to catch it before the browser does


//deleted async initialize

camera.position.set(0,10,5);


//Animation loop
async function initialize(){
    geometries.set("basic sphere", new THREE.IcosahedronGeometry(1,10));
    materials .set("green matte", new THREE.MeshPhongMaterial({flatShading:true, color:0x00ff00}));
    //meshes    .set("test sphere", new THREE.Mesh(geometries.get("basic sphere"),materials.get("green matte")));
    
    textures.set("earth",textureLoader.load("./assets/data/2k_earth_daymap.jpg"));


    lights.set("ambient", new THREE.AmbientLight(0xffffff,0.5));


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

camera.position.set(0,20,20 );


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

