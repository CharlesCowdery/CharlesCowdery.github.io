import * as THREE from 'three';
import * as Constants from "./constants"

class CelestialObject{
    constructor(name, size, mass, orbit_parameters, render_scalar, textureURL,  ){
        this.name = name;
        this.size = size;
        this.mass = mass;
        this.render_scalar = render_scalar
        this.textureURL = textureURL;
        this.position = [0,0,0];
        this.orbit_parameters = orbit_parameters;
    }
    copy(){
        var n = new CelestialObject(this.name,this.size,"",this.distanceFromSun,this.mass,this.SOI);
        n.position = [...this.position];
        return n;
    }
}

export const textureLoader = new THREE.TextureLoader();

export var au_to_system_scalar = 2;

export function AU_to_system_units(au){
    return au*au_to_system_scalar;
}

export function meters_to_system_units(meters){
    return meters*Constants.Inv_AU*au_to_system_scalar;
}

var solar_system_bodies_ = [];

for(let name in Constants.planet_configs){
    let config = Constants.planet_configs[name]
    let orbital_parameters = Constants.planet_constants[name.toLowerCase()] ?? config.position;
    let cel_obj = new CelestialObject(name,config.size,config.mass,orbital_parameters,config.s_scalar,config.texture);
    solar_system_bodies_.push(cel_obj);
}

export const solar_system_bodies = solar_system_bodies_;

const JD_J2000 = 2451545.0;       // JD of 2000 Jan 1.5 (noon)
const DAYS_PER_CENTURY = 36525.0;

// Convert JS Date → Julian Date
function date_to_julian_date(date) {
    const year = date.getUTCFullYear();
    let month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;

    let y = year, m = month;
    if (m <= 2) { y -= 1; m += 12; }

    const A = Math.floor(y / 100);
    const isGregorian = (year > 1582) || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
    const B = isGregorian ? 2 - A + Math.floor(A / 4) : 0;

    const JD = Math.floor(365.25 * (y + 4716))
             + Math.floor(30.6001 * (m + 1))
             + day + B - 1524.5
             + (hour + minute / 60 + second / 3600) / 24;

    return JD;
}

// Convert Julian Date → JS Date
function julian_date_to_date(JD) {
    let jd = JD + 0.5;
    const Z = Math.floor(jd);
    const F = jd - Z;
    let A = Z;

    if (Z >= 2299161) {
        const alpha = Math.floor((Z - 1867216.25) / 36524.25);
        A = Z + 1 + alpha - Math.floor(alpha / 4);
    }

    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);

    const day = B - D - Math.floor(30.6001 * E) + F;
    const month = (E < 14) ? E - 1 : E - 13;
    const year = (month > 2) ? C - 4716 : C - 4715;

    const dayFrac = day % 1;
    const dayInt = Math.floor(day);
    const hours = dayFrac * 24;
    const minutes = (hours % 1) * 60;
    const seconds = (minutes % 1) * 60;

    return new Date(Date.UTC(
        year,
        month - 1,
        dayInt,
        Math.floor(hours),
        Math.floor(minutes),
        Math.floor(seconds),
        Math.round((seconds % 1) * 1000)
    ));
}

// Convert JS Date → Kepler time (T)
export function date_to_kepler_time(date) {
    const JD = date_to_julian_date(date);
    return (JD - JD_J2000) / DAYS_PER_CENTURY;
}

export function time_to_kepler_time(date) {
    const JD = timestamp_to_julian_date(date);
    return (JD - JD_J2000) / DAYS_PER_CENTURY;
}

export function timestamp_to_julian_date(ms_since_epoch) {
    // Convert milliseconds since Unix epoch → Julian Date
    return (ms_since_epoch / 86400000) + 2440587.5;
}


export function kepler_orbital_position(orbit_data,time_eph){

    var time = time_eph;

    var a =  orbit_data.axis.initial                 + orbit_data.axis.delta                  *time//au;
    var e =  orbit_data.eccentricity.initial         + orbit_data.eccentricity.delta          *time//radians;
    var I =  orbit_data.inclination.initial          + orbit_data.inclination.delta           *time//degrees;
    var mL = orbit_data.mean_longitude.initial       + orbit_data.mean_longitude.delta        *time//degrees;
    var Lp = orbit_data.longitude_perihelion.initial + orbit_data.longitude_perihelion.delta  *time//degrees
    var La = orbit_data.longitude_ascending.initial  + orbit_data.longitude_ascending.delta   *time//degrees

    I = I/180*Math.PI;
    mL = mL/180*Math.PI;
    Lp = Lp/180*Math.PI;
    La = La/180*Math.PI;


    var perihelion = Lp-La;
    var mean_anomaly = mL-Lp

    var anomaly = mean_anomaly+e*Math.sin(mean_anomaly);
    var delta_anomaly=1;
    var delta_mean_anomaly = 0;

    while(Math.abs(delta_anomaly)>1e-10){
        delta_mean_anomaly = (mean_anomaly-(anomaly-e*Math.sin(anomaly)));
        delta_anomaly = delta_mean_anomaly/(1-e*Math.cos(anomaly));
        anomaly = delta_anomaly+anomaly;
    }    

    mean_anomaly=anomaly-e*Math.sin(anomaly);

    var x_prime = a*(Math.cos(anomaly)-e);
    var y_prime = a*Math.sqrt(1-e*e)*Math.sin(anomaly);
    var z_prime = 0;

var x_eccl = (Math.cos(La)*Math.cos(perihelion) - Math.sin(La)*Math.sin(perihelion)*Math.cos(I)) * x_prime
           + (-Math.cos(La)*Math.sin(perihelion) - Math.sin(La)*Math.cos(perihelion)*Math.cos(I)) * y_prime;

var y_eccl = (Math.sin(La)*Math.cos(perihelion) + Math.cos(La)*Math.sin(perihelion)*Math.cos(I)) * x_prime
           + (-Math.sin(La)*Math.sin(perihelion) + Math.cos(La)*Math.cos(perihelion)*Math.cos(I)) * y_prime;

var z_eccl = (Math.sin(perihelion)*Math.sin(I)) * x_prime + (Math.cos(perihelion)*Math.sin(I)) * y_prime;

    return [[x_eccl,y_eccl,z_eccl],mean_anomaly];
}
