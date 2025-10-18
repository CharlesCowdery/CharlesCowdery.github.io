import * as THREE from 'three';
import * as Constants from "./constants"

const JD_J2000 = 2451545.0;       // JD of 2000 Jan 1.5 (noon)
const DAYS_PER_CENTURY = 36525.0;
export var au_to_system_units_scalar = 2;
export var orbit_resolution = 1000;
export const cache_scalar = 10;
export const cache_resolution = orbit_resolution*cache_scalar;
export const ms_per_ms = 1000*60*60*24;
export const init_time = new Date();

class CelestialObject{
    constructor(name, size, mass, orbit_parameters, orbital_cache, render_scalar, textureURL,  ){
        this.name = name;
        this.size = size;
        this.mass = mass;
        this.render_scalar = render_scalar
        this.textureURL = textureURL;
        this.position = [0,0,0];
        this.orbit_parameters = orbit_parameters;
        this.orbital_cache = orbital_cache;
    }
    position_at_timestamp(t){
        t = t-this.orbital_cache.period*Math.floor(t*this.orbital_cache.inv_period)
        if(Array.isArray(this.orbit_parameters)) return [this.position,0];
        return kepler_orbital_position(this.orbit_parameters,time_to_kepler_time(t));
    }
    pull(t,pos){
        var position = this.position_at_timestamp(t)[0];
        var a = (position[0]-pos[0]);
        var b = (position[1]-pos[1]);
        var c = (position[2]-pos[2]);
        var dist_2 = a*a+b*b+c*c
        return Constants.G*this.mass/dist_2;
    }
    copy(){
        var n = new CelestialObject(this.name,this.size,"",this.distanceFromSun,this.mass,this.SOI);
        n.position = [...this.position];
        return n;
    }
}

export const textureLoader = new THREE.TextureLoader();

export var meters_to_system_units_scalar = Constants.Inv_AU*au_to_system_units_scalar;

export function AU_to_system_units(au){
    return au*au_to_system_units_scalar;
}

export function meters_to_system_units(meters){
    return meters*Constants.Inv_AU*au_to_system_units_scalar;
}

var solar_system_bodies_ = [];

function compute_cache(orbital_parameters){
    var t = 0;
    var mean_anomaly_start  = kepler_orbital_position(orbital_parameters,time_to_kepler_time(t))[1];
    var mean_anomaly_end    = mean_anomaly_start;
    var t_high = 1;
    var t_low = 0;
    var variation = 2*Math.PI-(mean_anomaly_end-mean_anomaly_start);
    do{
      t_high*=2;
      mean_anomaly_end = kepler_orbital_position(orbital_parameters,time_to_kepler_time(t_high))[1]
      variation = 2*Math.PI-(mean_anomaly_end-mean_anomaly_start);
    } while(variation>0);

    var i = 0;
    do{
      t = (t_high+t_low)/2;
      mean_anomaly_end = kepler_orbital_position(orbital_parameters,time_to_kepler_time(t))[1]
      variation = 2*Math.PI-(mean_anomaly_end-mean_anomaly_start);
      if(variation<0){
        t_high = t;
      } else {
        t_low = t;
      }
      variation = 2*Math.PI-(mean_anomaly_end-mean_anomaly_start);
      i++;
      if(i > 1000) break;
    }
    while(Math.abs(variation)>(1e-10));


    var t_end = t;
    var t_start = 0;
    var count = cache_resolution;
    var increment = (t_end-t_start)/count;

    var points = new Float32Array(count*3);
    t = 0;
    var incrementor = 0;
    for(let i = 0; i < count; i++){
      var position = kepler_orbital_position(orbital_parameters,time_to_kepler_time(t))[0];
      //position = position.map(v=>AU_to_system_units(v));
      points[incrementor++] = position[0]*Constants.AU;
      points[incrementor++] = position[1]*Constants.AU;
      points[incrementor++] = position[2]*Constants.AU;
      t+=increment
    }
    return {
        cache:points,
        period:t_end-t_start,
        inv_period: 1/(t_end-t_start)
    }
}

var start = new Date();
for(let name in Constants.planet_configs){
    let config = Constants.planet_configs[name]
    let orbital_parameters = Constants.planet_constants[name.toLowerCase()] ?? config.position;
    let orbital_cache = new Float32Array([]);
    if(Constants.planet_constants[name.toLowerCase()]) orbital_cache = compute_cache(orbital_parameters);
    let cel_obj = new CelestialObject(name,config.size,config.mass,orbital_parameters,orbital_cache,config.s_scalar,config.texture);
    solar_system_bodies_.push(cel_obj);
}
var end = new Date();

console.log (end-start);

export const solar_system_bodies = solar_system_bodies_;



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

export function true_to_eccentric_anomaly(true_anomaly,eccentricity){
    var eccentric_anomaly = 2 * Math.atan2(
        Math.sqrt(1 - eccentricity) * Math.sin(true_anomaly / 2),
        Math.sqrt(1 + eccentricity) * Math.cos(true_anomaly / 2)
    );
    if (eccentric_anomaly < 0) eccentric_anomaly += 2*Math.PI;

    return eccentric_anomaly;
}

export function eccentric_to_true_anomaly(eccentric_anomaly,eccentricity){
    return 2 * Math.atan2(
        Math.sqrt(1 + eccentricity) * Math.sin(eccentric_anomaly / 2),
        Math.sqrt(1 - eccentricity) * Math.cos(eccentric_anomaly / 2)
    );
}

export function eccentric_to_mean_anomaly(eccentric_anomaly,eccentricity){
    return eccentric_anomaly - eccentricity * Math.sin(eccentric_anomaly);
}

export function true_to_mean_anomaly(true_anomaly,eccentricity){
    return eccentric_to_mean_anomaly(true_to_eccentric_anomaly(true_anomaly,eccentricity),eccentricity);
}

export function mean_to_true_anomaly(mean_anomaly,eccentricity){
    var anomaly = mean_anomaly+eccentricity*Math.sin(mean_anomaly);
    var delta_anomaly=1;
    var delta_mean_anomaly = 0;

    var i = 0;
    while(Math.abs(delta_anomaly)>1e-10 && i<10000){
        delta_mean_anomaly = (mean_anomaly-(anomaly-eccentricity*Math.sin(anomaly)));
        delta_anomaly = delta_mean_anomaly/(1-eccentricity*Math.cos(anomaly));
        anomaly = delta_anomaly+anomaly;
        i++
    }  
    
    return eccentric_to_true_anomaly(anomaly,eccentricity);
}

export function kepler_orbital_position(orbit_data,time_eph){

    var time = time_eph;

    var a =  orbit_data.axis.initial                 + orbit_data.axis.delta                  *time//au;
    var e =  orbit_data.eccentricity.initial         + orbit_data.eccentricity.delta          *time//radians;
    var I =  orbit_data.inclination.initial          + orbit_data.inclination.delta           *time//degrees;
    var mL = orbit_data.mean_longitude.initial       + orbit_data.mean_longitude.delta        *time//degrees;
    var Lp = orbit_data.longitude_perihelion.initial + orbit_data.longitude_perihelion.delta  *time//degrees
    var La = orbit_data.longitude_ascending.initial  + orbit_data.longitude_ascending.delta   *time//degrees

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

    var cosLa = Math.cos(La);
    var sinLa = Math.sin(La);
    var cos_perihelion = Math.cos(perihelion);
    var sin_perihelion = Math.sin(perihelion);
    var cos_I = Math.cos(I);
    var sin_I = Math.sin(I);

var x_eccl = ( cosLa*cos_perihelion - sinLa*sin_perihelion*cos_I) * x_prime
           + (-cosLa*sin_perihelion - sinLa*cos_perihelion*cos_I) * y_prime;

var y_eccl = ( sinLa*cos_perihelion + cosLa*sin_perihelion*cos_I) * x_prime
           + (-sinLa*sin_perihelion + cosLa*cos_perihelion*cos_I) * y_prime;

var z_eccl = (sin_perihelion*sin_I) * x_prime + (cos_perihelion*sin_I) * y_prime;

    return [[x_eccl,y_eccl,z_eccl],mean_anomaly];
}
