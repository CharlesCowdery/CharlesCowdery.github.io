import * as THREE from 'three';
import {Vector3,Quaternion} from "three"
import * as Constants from "./constants"

const JD_J2000 = 2451545.0;       // JD of 2000 Jan 1.5 (noon)
const DAYS_PER_CENTURY = 36525.0;
export var au_to_system_units_scalar = 1;
export var global_offset = new Vector3(0,0,0);

export var orbit_resolution = 1000;
export const cache_scalar = 10;
export const cache_resolution = orbit_resolution*cache_scalar;
export const init_time = new Date();
export const max_view = 1e3;
export const max_camera_dist = 1e2
export var warp_state = 2;
export var ms_per_ms = 0;

export const warps = [
  {step:0,            name:"",    unit:"Pause"},
  {step:1,            name:"1",   unit:"x"},
  {step:2,            name:"2",   unit:"x"},
  {step:10,           name:"10",  unit:"x"},
  {step:60,           name:"1",   unit:"Min/s"},
  {step:60*60,        name:"1",   unit:"Hr/s"},
  {step:60*60*24,     name:"1",   unit:"Day/s"},
  {step:60*60*24*30,  name:"1",   unit:"Month/s"},
  {step:60*60*24*365, name:"1",   unit:"Year/s"},
]

export function set_scalar(v){
  au_to_system_units_scalar = v;
}

export function set_warp(v){
  warp_state = v;
  ms_per_ms = warps[warp_state].step;
}

set_warp(6)

class CelestialObject{
    constructor(name, size, mass, orbit_parameters, orbital_cache, render_scalar, textureURL, color  ){
        this.name = name;
        this.size = size;
        this.mass = mass;
        this.render_scalar = render_scalar
        this.textureURL = textureURL;
        this.color = color;
        this.position = [0,0,0];
        this.orbit_parameters = orbit_parameters;
        this.orbital_cache = orbital_cache;
        this.emissive=0;
    }
    position_at_timestamp(t){
        t = t-this.orbital_cache.period*Math.floor(t*this.orbital_cache.inv_period)
        if(Array.isArray(this.orbit_parameters)) return [this.position,0];
        return kepler_orbital_position(this.orbit_parameters,time_to_kepler_time(t));
    }
    position_at_timestamp_vec3(t){
      return new Vector3(...this.position_at_timestamp(t)[0]);
    }
    velocity_at_timestamp(t){
      t = t-this.orbital_cache.period*Math.floor(t*this.orbital_cache.inv_period)
      if(Array.isArray(this.orbit_parameters)) return [0,0,0];
      var delta = 1;
      var p1 = this.position_at_timestamp_vec3(t);
      var p2 = this.position_at_timestamp_vec3(t+delta);
      return p2.sub(p1).divideScalar(delta).multiplyScalar(1000); // because delta is in milliseconds. jank
    }
    velocity_at_timestamp_vec3(t){
      return new Vector3(...this.velocity_at_timestamp(t));
    }
    distance2(t,pos){
        var position = this.position_at_timestamp(t)[0].map(v=>v*Constants.AU);
        var a = (position[0]-pos[0]);
        var b = (position[1]-pos[1]);
        var c = (position[2]-pos[2]);
        var dist_2 = a*a+b*b+c*c
        return dist_2
    }
    pull(t,pos){
        var dist_2 = this.distance2(t,pos);
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

export class Conic{
  constructor(eccentricity,scalar,adjustment,initial_true_anomaly,initial_time,gravitational_force,angular_momentum,rotation_from_xy,rotation_to_xy){
    this.epsilon = 1e-5
    if(eccentricity == 1) eccentricity = 1.0001;
    this.eccentricity         = eccentricity;
    this.scalar               = scalar;
    this.adjustment           = adjustment;
    this.initial_time         = initial_time
    this.rotation_from_xy     = rotation_from_xy;
    this.rotation_to_xy       = rotation_to_xy;
    this.gravitational_force  = gravitational_force;
    this.angular_momentum     = angular_momentum
    this.direction            = Math.sign(angular_momentum);
    this.apoapsis             = scalar/(1-eccentricity);
    this.periapsis            = scalar/(1+eccentricity);
    this.specific_energy      = 0.5*angular_momentum**2-gravitational_force/this.periapsis;
    this.semi_major_axis      = scalar/(1+eccentricity*eccentricity);
    this.minimum_bound        = (eccentricity<=1)?0:-Math.acos(-1/eccentricity)+this.epsilon;
    this.maximum_bound        = (eccentricity<=1)?2*Math.PI:Math.acos(-1/eccentricity)-this.epsilon+1;


    if(eccentricity<1){
      this.mean_anomaly_per_ms = this.direction*Math.sqrt(gravitational_force/this.semi_major_axis**3)/1000;
      this.initial_mean_anomaly = true_to_mean_anomaly(initial_true_anomaly,eccentricity);
    } else {
      this.mean_anomaly_per_ms = (gravitational_force**2/angular_momentum**3)*((eccentricity**2-1)**(3/2))/1000;
      this.initial_mean_anomaly = true_to_mean_hyperbolic_anomaly(initial_true_anomaly,eccentricity);
      if(this.direction>0){
        this.minimum_bound = initial_true_anomaly;
      } else {
        this.maximum_bound = initial_true_anomaly;
      }
    }


    this.compute_cache(orbit_resolution*cache_scalar);
  }
  compute_cache(count){
    let is_hyperbolic = this.eccentricity>=1;
    let anomaly_start = this.minimum_bound;
    let anomaly_end = this.maximum_bound;
    let interval = (anomaly_end-anomaly_start)/count;
    this.cacheTime = new Float32Array(count);
    this.cache = new Float32Array(count*3);
    this.vec3Cache = new Array(count + ((!is_hyperbolic)?1:0)); //if its non-hyperbolic, one additional point is needed to close the loop
    var anomaly = anomaly_start
    var iterator = 0;
    let i = 0;
    for(i = 0; i < count; i++, anomaly+=interval){
      var point = this.sample_at_true_anomaly(anomaly);
      this.cacheTime[i] = this.time_at_anomaly(anomaly);
      this.cache[iterator++] = point.x;
      this.cache[iterator++] = point.y;
      this.cache[iterator++] = point.z;
      this.vec3Cache[i] = point.multiplyScalar(meters_to_system_units_scalar);
    }
    if(!is_hyperbolic) this.vec3Cache[i] = this.vec3Cache[0]; //if non-hyperbolic, close loop
  }
  time_at_anomaly(true_anomaly){
    var mean_anomaly;
    if(this.eccentricity<1){
      mean_anomaly = true_to_mean_anomaly(true_anomaly,this.eccentricity);
    } else {
      mean_anomaly = true_to_mean_hyperbolic_anomaly(true_anomaly,this.eccentricity);
    }
    mean_anomaly-=this.initial_mean_anomaly;
    var delta_t = mean_anomaly/this.mean_anomaly_per_ms;
    return this.initial_time+delta_t;
  }
  sample_at_true_anomaly(true_anomaly){
    var rotator = new Vector3(Math.cos(true_anomaly-this.adjustment),Math.sin(true_anomaly-this.adjustment),0);
    var radius = this.scalar/(1+this.eccentricity*Math.cos(true_anomaly));
    var position = rotator.multiplyScalar(radius);
    position = position.applyQuaternion(this.rotation_from_xy);
    return position;
  }
  true_anomaly_at_time(t){
    var delta_t = t-this.initial_time;
    var delta_mean_anomaly = delta_t*this.mean_anomaly_per_ms;
    var mean_anomaly = this.initial_mean_anomaly+delta_mean_anomaly;
    if(this.eccentricity<1){
      var true_anomaly = mean_to_true_anomaly(mean_anomaly,this.eccentricity);
    } else {
      var true_anomaly = mean_hyperbolic_to_true_anomaly(mean_anomaly,this.eccentricity);
    }
    return true_anomaly;
  }
  position_at_time(t){
    return this.sample_at_true_anomaly(this.true_anomaly_at_time(t));
  }
  velocity_at_time(t){
    var delta = 0.01
    var pos_at_time_1 = this.position_at_time(t);
    var pos_at_time_2 = this.position_at_time(t+delta);
    var velocity = pos_at_time_2.clone().sub(pos_at_time_1).divideScalar(delta);
    console.log(t,t+delta,pos_at_time_1,pos_at_time_2,velocity)
    return velocity;
  }

}

export function calculate_conic(velocity, position, body_mass, body_position, body_velocity, signature_time){
  var relative_position = position.clone().sub(body_position);

  var relative_velocity = velocity.clone().sub(body_velocity);
  var relative_velocity_offset = relative_velocity.clone().add(relative_position);

  var plane_normal = relative_position.clone().cross(relative_velocity).normalize();
  
  var rotation = new Quaternion().setFromUnitVectors(new Vector3(0,0,1),plane_normal)
  var inv_rotation = rotation.invert();

  var projected_position = relative_position.clone().applyQuaternion(inv_rotation);
  var projected_relative_velocity = relative_velocity_offset.clone().applyQuaternion(inv_rotation);
  var projected_velocity = projected_relative_velocity.clone().sub(projected_position);
  var velocity_magnitude = projected_velocity.clone().length();

  var radius = projected_position.clone().length();
  var tangential_velocity = projected_position.clone().cross(projected_velocity.clone()).z/radius;
  var angular_momentum = radius*tangential_velocity;
  var specific_energy = 0.5*velocity_magnitude*velocity_magnitude - Constants.G*body_mass/radius;

  var term_1 = -Constants.G*body_mass;
  var term_2 = Math.sqrt(term_1*term_1 + 2 * angular_momentum*angular_momentum * specific_energy);
  var term_3 = 2*specific_energy;

  var periapsis = (term_1+term_2)/term_3;
  var apoapsis = (term_1-term_2)/term_3;

  var eccentricity = (apoapsis-periapsis)/(apoapsis+periapsis);
  var scalar = apoapsis*(1-eccentricity);

  var theta_position = Math.atan2(projected_position.y, projected_position.x);
  var adjustment = Math.sign(projected_position.clone().dot(projected_velocity))*Math.sign(projected_position.clone().cross(projected_velocity).z)*Math.acos((scalar/radius-1)/eccentricity)-theta_position;

  console.log({
    rotation,
    inv_rotation,
    plane_normal,
    position,
    body_position,
    velocity,
    body_velocity,
    relative_position,
    relative_velocity,
    projected_position,
    projected_velocity
})

  return new Conic(
      eccentricity,
      scalar,
      adjustment,
      theta_position+adjustment,
      signature_time,
      -term_1,
      angular_momentum,
      rotation,
      inv_rotation
    );
}

class ConicSection{
    constructor(conic,body,signature_time,signature_position,signature_velocity){
        this.conic = conic;
        this.body  = body;
        this.signature_time = signature_time;
        this.signature_position = signature_position;
        this.signature_velocity = signature_velocity;
        this.relative_signature_position 
    }
    calculate_origination(){
        this.origination=null;
        this.termination=null;
        if(this.conic.eccentricity>=1){
        var can_originate = true;
        var can_terminate = false;
        var latest_origination = -1;
        var soonest_termination = this.conic.vec3Cache.length;
        var position = [0,0,0]
        var can_log = true;
        for(let i = 0; i < this.conic.vec3Cache.length; i++){
          var t = this.conic.cacheTime[i];
          var body_pos = kepler_orbital_position(this.body.orbit_parameters,time_to_kepler_time(t))[0];
          position[0] = this.conic.cache[i*3+0]+body_pos[0]*Constants.AU;
          position[1] = this.conic.cache[i*3+1]+body_pos[1]*Constants.AU;
          position[2] = this.conic.cache[i*3+2]+body_pos[2]*Constants.AU;
          var nearest = fetch_strongest_pull_at_time_t(position,t);
          if(i%100==0){
            //console.log(t,nearest.name, position)
          }
          if(nearest.name!=this.body.name){
            if(can_originate){
              latest_origination=i;
            }
            if(can_terminate){
              soonest_termination = i;
              break;
            }
          } else {
            can_originate = false;
            can_terminate = true;
          }
        }

        if(latest_origination!=-1){
          this.origination = this.conic.cacheTime[latest_origination];
          this.conic.minimum_bound = this.conic.true_anomaly_at_time(this.origination);
        } 
        if(soonest_termination!=this.conic.vec3Cache.length){
          this.termination = this.conic.cacheTime[soonest_termination];
          this.conic.maximum_bound = this.conic.true_anomaly_at_time(this.termination);
        } 
        this.conic.compute_cache(orbit_resolution*cache_scalar);
      }
    }
}

function fetch_strongest_pull_at_time_t(position,t){
  var strongest_index = 0;
  var strongest = 0;
  for(let i = 0; i < solar_system_bodies.length; i++){
    var force = solar_system_bodies[i].pull(t,position);
    if(force > strongest){
      strongest = force;
      strongest_index = i;
    }
  }
  return solar_system_bodies[strongest_index];
}

export function calculate_conic_path(signature_position,signature_velocity,signature_time){
  var path = [];
  
  for(let i = 0; i < 2; i++){
    var body = fetch_strongest_pull_at_time_t(signature_position,signature_time);
    var body_mass = body.mass;
    var body_position = body.position_at_timestamp_vec3(signature_time).multiplyScalar(Constants.AU);
    var body_velocity = body.velocity_at_timestamp_vec3(signature_time).multiplyScalar(Constants.AU);

    console.log(signature_velocity,body_velocity)

    var conic = calculate_conic(
      new Vector3(...signature_velocity),
      new Vector3(...signature_position),
      body_mass,
      body_position,
      body_velocity,
      signature_time
    );
    var section = new ConicSection(conic,body,signature_time,signature_position,signature_velocity);
    section.calculate_origination();
    section.calculate_origination();
    path.push(section);
    if(section.termination == null) break;
    signature_time = section.termination;
    console.log(signature_time);
    body_position = body.position_at_timestamp_vec3(signature_time).multiplyScalar(Constants.AU);
    body_velocity = body.velocity_at_timestamp_vec3(signature_time).multiplyScalar(Constants.AU);
    signature_position = section.conic.position_at_time(signature_time).add(body_position);
    signature_velocity = section.conic.velocity_at_time(signature_time).add(body_velocity);
    
  }
  console.log(path);

  return path;
}

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
    let cel_obj = new CelestialObject(name,config.size,config.mass,orbital_parameters,orbital_cache,config.s_scalar,config.texture,config.color);
    if(config.emissive) cel_obj.emissive = config.emissive
    solar_system_bodies_.push(cel_obj);
}
var end = new Date();


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

export function hyperbolic_to_true_anomaly(hyperbolic_anomaly,eccentricity){
    return 2*Math.atan2(
        Math.tanh(hyperbolic_anomaly/2),
        Math.sqrt((eccentricity-1)/(eccentricity+1))
    );
}

export function true_to_hyperbolic_anomaly(true_anomaly, eccentricity){
    return 2 * Math.atanh(
        Math.sqrt((eccentricity-1)/(eccentricity+1))*Math.tan(true_anomaly/2)
    )
}

export function true_to_mean_hyperbolic_anomaly(true_anomaly, eccentricity){
    var sub_term_1 = eccentricity*Math.sqrt(eccentricity**2-1)*Math.sin(true_anomaly);
    var sub_term_2 = (1+eccentricity*Math.cos(true_anomaly));
    var term_1 = sub_term_1/sub_term_2;
    var sub_term_3 = Math.sqrt(eccentricity+1);
    var sub_term_4 = Math.sqrt(eccentricity-1)*Math.tan(true_anomaly/2);
    var term_2 = Math.log((sub_term_3+sub_term_4)/(sub_term_3-sub_term_4));
    return term_1-term_2;
}

export function mean_hyperbolic_to_true_anomaly(hyperbolic_mean_anomaly,eccentricity){
    var hyperbolic_anomaly = Math.sign(hyperbolic_mean_anomaly)*eccentricity*Math.log10(Math.abs(hyperbolic_mean_anomaly));
    var delta_hyperbolic_anomaly=1;
    var delta_mean_hyperbolic_anomaly = 0;
    var i = 0;
    
    while(Math.abs(delta_hyperbolic_anomaly)>1e-10 && i<100){
        delta_mean_hyperbolic_anomaly = hyperbolic_mean_anomaly+hyperbolic_anomaly-eccentricity*Math.sinh(hyperbolic_anomaly);
        delta_hyperbolic_anomaly = delta_mean_hyperbolic_anomaly/(1+eccentricity*Math.cosh(hyperbolic_anomaly));
        hyperbolic_anomaly = delta_hyperbolic_anomaly+hyperbolic_anomaly;
        i++
    }  
    
    return hyperbolic_to_true_anomaly(hyperbolic_anomaly,eccentricity);
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

export function formatDate(date) {
  const pad = (n) => n.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // Months are 0-indexed
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}
