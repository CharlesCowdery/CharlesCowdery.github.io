'use client'
import React, {  useEffect, useMemo, useRef, useState } from 'react'
import { useThree, useLoader, Canvas, useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, TextureLoader, Vector2, Vector3, Quaternion, TubeGeometry} from 'three'
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { OrbitControls, useTexture, Line } from '@react-three/drei'
import * as Engine from "./engine"
import * as Constants from "./constants"

function Box(props) {
  // This reference will give us direct access to the mesh
  const meshRef = useRef()
  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false)
  const [active, setActive] = useState(false)
  // Subscribe this component to the render-loop, rotate the mesh every frame
  useFrame((state, delta) => (meshRef.current.rotation.x += delta))
  // Return view, these are regular three.js elements expressed in JSX
  return (
    <mesh
      {...props}
      ref={meshRef}
      scale={active ? 1.5 : 1}
      onClick={(event) => setActive(!active)}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}

function Curve(props) {
  // Generate Catmull-Rom curve points

  const meshRef = useRef();
  const curveRef = useRef();
  const [positions, setPositions] = useState(new Float32Array());
  const [hovered, setHovered] = useState(false);

  useEffect(()=>{
    if(props.points.length == 0) return;
    const curve = new CatmullRomCurve3(props.points);
    const samples = curve.getPoints(1000);
    setPositions(new Float32Array(samples.flatMap(p=>[p.x,p.y,p.z])));
  },[props.points])

  var buffer = {};
  if(props.points.length>0){
    buffer = (<bufferGeometry><bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}/></bufferGeometry>);
  }

  function handleHover(e){
    //console.log(e)
    color = ref
  }
  function hoverInOut(hovering_in){
    setHovered(hovering_in);
  }

  var color = "white";

  //var points = useMemo(()=>points.flatMap(p=>[p.x,p.y,p.z]),[points]);

  return (positions.length) ? (
    <group>
      <Line
        points={props.points}
        color = {hovered?"red":"white"}
        onPointerOver = {()=>{setHovered(true)}}
        onPointerOut = {()=>{setHovered(false)}}
        onPointerMove = {()=>{hoverIn()}}
        lineWidth={1}
      >
      </Line>
      <Line
        points={props.points}
        visible={false}
        onPointerMove={handleHover}
        onPointerOver={()=>hoverInOut(true)}
        onPointerOut={()=>hoverInOut(false)}
        lineWidth={10}
      >
      </Line>
    </group>
  ): null;

  //return (positions.length) ? (
  //  <line key={props.points}>
  //    {buffer}
  //      
  //    <lineBasicMaterial color={props.color??"black"} />
  //  </line>
  //): null;
}

function KeplerBody(props){
  const meshRef = useRef()


  let celestial_body = props.CelestialObject;

  var orbit_points = useMemo(()=>{
    if(celestial_body.orbital_cache.length == 0) return [];
    var points = new Array(Engine.orbit_resolution+1);
    var skip = Engine.cache_scalar-1;
    var iterator = 0;
    for(let i = 0; i < Engine.orbit_resolution; i++){
      points[i] = new Vector3(
        Engine.meters_to_system_units(celestial_body.orbital_cache.cache[iterator++]),
        Engine.meters_to_system_units(celestial_body.orbital_cache.cache[iterator++]),
        Engine.meters_to_system_units(celestial_body.orbital_cache.cache[iterator++])
      );
      iterator += skip*3;
    }
    points[Engine.orbit_resolution] = (new Vector3(
      Engine.meters_to_system_units(celestial_body.orbital_cache.cache[0]),
      Engine.meters_to_system_units(celestial_body.orbital_cache.cache[1]),
      Engine.meters_to_system_units(celestial_body.orbital_cache.cache[2])
    ))
    return points;
  },[celestial_body !== null ? celestial_body : null]);

  var orbit_data = celestial_body.position_at_timestamp(props.timestamp);
  var position = orbit_data[0];
  
  position = position.map(v=>v*Engine.au_to_system_units_scalar);
  position = new Vector3(...position);

  const texture = useTexture(celestial_body.textureURL);
  texture.rotation// = Math.PI/2;

  var color = "white"

  return (<group>
    <mesh
      position = {position}
      ref={meshRef}
      scale = {1}
      rotation = {[Math.PI/2,0,0]}
    >
      <icosahedronGeometry args= {[celestial_body.size*Constants.Inv_AU*celestial_body.render_scalar,10,10]} ></icosahedronGeometry>
      <meshStandardMaterial  {...(texture ? {map: texture} : {})} />
    </mesh>
    {orbit_points?
    (<Curve
    color = "white"
      points={orbit_points}
    ></Curve>):[]}
  </group>)
}

class Conic{
  constructor(eccentricity,scalar,adjustment,initial_mean_anomaly,initial_time,gravitational_force,direction,rotation_from_xy,rotation_to_xy){
    this.eccentricity       = eccentricity;
    this.scalar             = scalar;
    this.adjustment         = adjustment;
    this.initial_mean_anomaly= initial_mean_anomaly
    this.initial_time       = initial_time
    this.rotation_from_xy   = rotation_from_xy;
    this.rotation_to_xy     = rotation_to_xy;
    this.gravitational_force= gravitational_force;
    this.semi_major_axis    = scalar/(1+eccentricity*eccentricity);
    this.mean_anomaly_per_ms= direction*Math.sqrt(gravitational_force/Math.pow(this.semi_major_axis,3))/1000;
    this.compute_cache(Engine.orbit_resolution);
  }
  compute_cache(count){
    let anomaly_start = 0;
    let anomaly_end = 2*Math.PI;
    let interval = (anomaly_end-anomaly_start)/count;
    this.cache = new Float32Array(count*3);
    this.vec3Cache = new Array(count+1);
    var anomaly = anomaly_start
    var iterator = 0;
    let i = 0;
    for(i = 0; i < count; i++, anomaly+=interval){
      var point = this.sample_at_true_anomaly(anomaly);
      this.cache[iterator++] = point.x;
      this.cache[iterator++] = point.y;
      this.cache[iterator++] = point.z;
      this.vec3Cache[i] = point.multiplyScalar(Engine.meters_to_system_units_scalar);
    }
    this.vec3Cache[i] = this.vec3Cache[0];
  }
  sample_at_true_anomaly(true_anomaly){
    var rotator = new Vector3(Math.cos(true_anomaly+this.adjustment),Math.sin(true_anomaly+this.adjustment),0);
    var radius = this.scalar/(1+this.eccentricity*Math.cos(true_anomaly));
    var position = rotator.multiplyScalar(radius);
    position = position.applyQuaternion(this.rotation_from_xy);
    return position;
  }
  position_at_time(t){
    var delta_t = t-this.initial_time;
    var delta_mean_anomaly = delta_t*this.mean_anomaly_per_ms;
    var mean_anomaly = -this.initial_mean_anomaly+delta_mean_anomaly;
    var true_anomaly = Engine.mean_to_true_anomaly(mean_anomaly,this.eccentricity);
    console.log("M:", mean_anomaly, "ν:", true_anomaly);
    return this.sample_at_true_anomaly(true_anomaly);
  }

}

function calculate_conic(velocity, position, body_mass, body_position, signature_time){
  var relative_position = position.clone().sub(body_position);

  var relative_velocity_offset = velocity.clone().add(relative_position);

  var plane_normal = relative_position.clone().normalize().cross(velocity.clone().normalize());
  
  var w = Math.cos(Math.acos(plane_normal.z)/2);
  var axis = plane_normal.clone().cross(new Vector3(0,0,1)).multiplyScalar(Math.sqrt(1-w*w));

  var rotation = new Quaternion(axis.x,axis.y,axis.z,w);
  var inv_rotation = rotation.invert();

  var projected_position = relative_position.clone().applyQuaternion(inv_rotation);
  var projected_relative_velocity = relative_velocity_offset.clone().applyQuaternion(inv_rotation);
  var projected_velocity = projected_relative_velocity.clone().sub(projected_position);
  var velocity_magnitude = projected_velocity.clone().length();

  var radius = projected_position.clone().length();
  var tangential_velocity = projected_position.clone().cross(projected_velocity).z/radius;
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

  console.log(projected_position)

  var mean_initial_anomaly = Engine.true_to_mean_anomaly(theta_position+adjustment,eccentricity)

  return new Conic(
      eccentricity,
      scalar,
      adjustment,
      mean_initial_anomaly,
      signature_time,
      -term_1,
      Math.sign(angular_momentum),
      rotation,
      inv_rotation
    );
}

function calculate_conic_path(signature_position,signature_velocity,signature_time){
  console.log("calculating conic path")
  var strongest_index = 0;
  var strongest = 0;
  for(let i = 0; i < Engine.solar_system_bodies.length; i++){
    var force = Engine.solar_system_bodies[i].pull(signature_time,signature_position);
    if(force > strongest){
      strongest = force;
      strongest_index = i;
    }
  }
  var body = Engine.solar_system_bodies[strongest_index];
  var body_mass = body.mass;
  var body_position = body.position;
  var conic = calculate_conic(
    new Vector3(...signature_velocity),
    new Vector3(...signature_position),
    body_mass,
    new Vector3(...body_position),
    signature_time
  );
  console.log(conic)
  return conic;
}

function ConicBody(props,texture){

  var conic_path = useMemo(()=>{
    return calculate_conic_path(
      props.signature_position,
      props.signature_velocity,
      props.signature_time
    )
  },[...props.signature_position,...props.signature_velocity,props.signature_time])

  var sprite = useTexture(props.textureURL)
  var position = conic_path.position_at_time(props.timestamp).multiplyScalar(Engine.meters_to_system_units_scalar);

  return (<group>
    <Curve
      points = {conic_path.vec3Cache}
      color="white"
    />
    <sprite
      scale = {0.05}
      position={position}
    >
      <spriteMaterial {...(sprite ? {map: sprite} : {})}
        sizeAttenuation={false}
      />
    </sprite>
  </group>)
}

function BackgroundTexture(props){
  const {scene} = useThree();
  var texture = useTexture(props.URL);
  useEffect(()=>{
    scene.background = texture;
  },[scene])
}

function ZUp() {
  const { camera } = useThree()
  useEffect(() => {
    camera.up.set(0, 0, 1)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

function FrameTracker(props){
  useFrame((state,delta_ms) => {
    props.setTime(props.timestamp + delta_ms * Engine.ms_per_ms); // advance simulation time
  });
}

export default function Home() {
  const [timestamp,setTimestamp] = useState(0);
  var planets = Engine.solar_system_bodies;
  var planet_objects =planets.map(p=>{
    return (<KeplerBody key = {p.name} CelestialObject={p} timestamp={timestamp}></KeplerBody>)
  });
  return (
    <div className="font-sans flex min-h-screen ">
      <div id="canvas-container" className = "bg-white flex-1">
        <Canvas>
          <FrameTracker timestamp = {timestamp} setTime = {setTimestamp}/>
          <BackgroundTexture URL = "2k_stars_milky_way.jpg"/>
          <ambientLight intensity={Math.PI / 2} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
          <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
          {planet_objects}
          <ConicBody signature_position = {[5e10,5e8,0]} signature_velocity={[30000,-30000,0]} signature_time={0} timestamp={timestamp} textureURL = "vercel.svg"/>
          <ZUp/>
          <OrbitControls 
            position = {[0,0,0]}
            minPolarAngle={-Math.PI}  // 45° from top
            maxPolarAngle={Math.PI}  // lock to equatorial plane
          />
        </Canvas>
      </div>
      {/*<div className = "bg-[#222] flex-1">a</div>*/}
    </div>
  );
}

