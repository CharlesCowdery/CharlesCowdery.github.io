
//`               a              e               I                L            long.peri.      long.node.`
//`           au, au/Cy     rad, rad/Cy     deg, deg/Cy      deg, deg/Cy      deg, deg/Cy     deg, deg/Cy`
var planet_data = `Mercury   0.38709927      0.20563593      7.00497902      252.25032350     77.45779628     48.33076593
          0.00000037      0.00001906     -0.00594749   149472.67411175      0.16047689     -0.12534081
venus     0.72333566      0.00677672      3.39467605      181.97909950    131.60246718     76.67984255
          0.00000390     -0.00004107     -0.00078890    58517.81538729      0.00268329     -0.27769418
earth   1.00000261      0.01671123     -0.00001531      100.46457166    102.93768193      0.0
          0.00000562     -0.00004392     -0.01294668    35999.37244981      0.32327364      0.0
mars      1.52371034      0.09339410      1.84969142       -4.55343205    -23.94362959     49.55953891
          0.00001847      0.00007882     -0.00813131    19140.30268499      0.44441088     -0.29257343
jupiter   5.20288700      0.04838624      1.30439695       34.39644051     14.72847983    100.47390909
         -0.00011607     -0.00013253     -0.00183714     3034.74612775      0.21252668      0.20469106
saturn    9.53667594      0.05386179      2.48599187       49.95424423     92.59887831    113.66242448
         -0.00125060     -0.00050991      0.00193609     1222.49362201     -0.41897216     -0.28867794
uranus   19.18916464      0.04725744      0.77263783      313.23810451    170.95427630     74.01692503
         -0.00196176     -0.00004397     -0.00242939      428.48202785      0.40805281      0.04240589
neptune  30.06992276      0.00859048      1.77004347      -55.12002969     44.96476227    131.78422574
          0.00026291      0.00005105      0.00035372      218.45945325     -0.32241464     -0.00508664`

var units = planet_data.split("\n").map(v=>v.replace(/ +/gm," ").split([" "]))
var sets = {}
for(let i = 0; i < units.length;i+=2){
    var body = units[i][0];
    var t1 = units[i].slice(1).map(v=>parseFloat(v));
    var t2 = units[i+1].slice(1).map(v=>parseFloat(v));
    sets[body] = {
        axis:{
            initial:t1[0],
            delta:t2[0]
        },
        eccentricity:{
            initial:t1[1],
            delta:t2[1]
        },
        inclination:{
            initial:t1[2],
            delta:t2[2]
        },
        mean_longitude:{
            initial:t1[3],
            delta:t2[3]
        },
        longitude_perihelion:{
            initial:t1[4],
            delta:t2[4]
        },
        longitude_ascending:{
            initial:t1[5],
            delta:t2[5]
        }
    }
}

function kepler_orbital_position(orbit_data,time_eph){

    var time = (time_eph-2451545)/36525;

    var a =  orbit_data.axis.initial                 + orbit_data.axis.delta                 *time;
    var e =  orbit_data.eccentricity.initial         + orbit_data.eccentricity.delta          *time;
    var I =  orbit_data.inclination.initial          + orbit_data.inclination.delta           *time;
    var mL = orbit_data.mean_longitude.initial       + orbit_data.mean_longitude.delta        *time;
    var Lp = orbit_data.longitude_perihelion.initial + orbit_data.longitude_perihelion.delta  *time;
    var La = orbit_data.longitude_ascending.initial  + orbit_data.longitude_ascending.delta   *time;


    var e_star = e*180/Math.PI;

    var perihelion = Lp-La;
    var mean_anomaly = mL-Lp

    var anomaly = mean_anomaly+e_star*Math.sin(mean_anomaly);
    var delta_anomaly=1;
    var delta_mean_anomaly = 0;
    let i = 0;

    console.log(anomaly,mean_anomaly)

    while(Math.abs(delta_anomaly)>1e-10){
        //console.log(anomaly)
        delta_mean_anomaly=mean_anomaly-(anomaly-e_star*Math.sin(anomaly));
        delta_anomaly=delta_mean_anomaly/(1-e*Math.cos(anomaly));
        anomaly = delta_anomaly+anomaly;
        i++;
        if(i>1000){
            break;
        }
    }

    console.log(anomaly)

    mean_anomaly=anomaly-e_star*Math.sin(anomaly);

    var x_prime = a*(Math.cos(anomaly)-e);
    var y_prime = a*Math.sqrt(1-e*e)*Math.sin(anomaly);
    var z_prime = 0;

    var x_eccl = Math.cos(perihelion)*Math.cos(La)*x_prime+Math.sin(perihelion)*Math.sin(perihelion)*Math.cos(I)*y_prime;
    var y_eccl = Math.cos(perihelion)*Math.sin(La)*x_prime+Math.sin(perihelion)*Math.cos(perihelion)*Math.cos(I)*y_prime;
    var z_eccl = Math.sin(perihelion)*Math.sin(I)*x_prime+Math.cos(perihelion)*Math.sin(I)*y_prime;

    return [x_eccl,y_eccl,z_eccl];
}


console.log(kepler_orbital_position(sets["jupiter"],1002))

//tf7fd7tfd97rct87

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

console.log("Planetary orbit simulation starting...");

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.z = 300;
//camera.position.set(0, 300, 0); // move camera above the orbit
//camera.up.set(0, 0, -1);        // orient "up" so z-axis points right way
//camera.lookAt(0, 0, 0);         // look at the center (the Sun)


const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.PointLight(0xffffff, 1);
light.position.set(0,0,0);
scene.add(light);

// Sun
const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({color:0xffff00});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

// Planet
const planetGeometry = new THREE.SphereGeometry(3, 32, 32);
const planetMaterial = new THREE.MeshBasicMaterial({color:0x00aaff});
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
scene.add(planet);

// Trail
const trailMaterial = new THREE.LineBasicMaterial({color:0xffffff});
let trailPoints = [];
let trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
let trail = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trail);

// Physics constants
const G = 1;
const M = 1000;
const dt = 0.5;

// State (position & velocity)
const state = {
    r0: new THREE.Vector3(100, 0, 0),
    v0: new THREE.Vector3(0, 2, 0),
};

function updatePhysics() {
    const r = state.r0.clone().negate();
    const r_mag = r.length();
    const F_mag = (G * M) / (r_mag * r_mag);
    const a = r.normalize().multiplyScalar(F_mag);

    state.v0.add(a.multiplyScalar(dt));
    state.r0.add(state.v0.clone().multiplyScalar(dt));
}

function updateTrail() {
    trailPoints.push(state.r0.clone());
    if (trailPoints.length > 1000) trailPoints.shift();

    trailGeometry.dispose(); // clean old geometry
    trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
    trail.geometry = trailGeometry;
}

function animate() {
    requestAnimationFrame(animate);

    updatePhysics();
    updateTrail();

    planet.position.copy(state.r0);

    renderer.render(scene, camera);
}

animate();
