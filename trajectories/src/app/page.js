'use client'
import React, {  useEffect, useMemo, useRef, useState } from 'react'
import { useThree, useLoader, Canvas, useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, TextureLoader, Vector3 } from 'three'
import { OrbitControls, useTexture } from '@react-three/drei'
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

  const [positions, setPositions] = useState(new Float32Array());

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

  return (positions.length) ? (
    <line>
      {buffer}
        
      <lineBasicMaterial color={props.color??"black"} />
    </line>
  ): null;
}

function KeplerBody(props){
  const meshRef = useRef()


  let celestial_body = props.CelestialObject;
  let orbital_parameters = celestial_body.orbit_parameters;

  var orbit_points = useMemo(()=>{
    if(Array.isArray(orbital_parameters)) return[];
    var t = 0;
    var mean_anomaly_start  = Engine.kepler_orbital_position(orbital_parameters,Engine.time_to_kepler_time(t))[1];
    var mean_anomaly_end    = mean_anomaly_start;
    var t_high = 1;
    var t_low = 0;
    var variation = 2*Math.PI-(mean_anomaly_end-mean_anomaly_start);
    do{
      t_high*=2;
      mean_anomaly_end = Engine.kepler_orbital_position(orbital_parameters,Engine.time_to_kepler_time(t_high))[1]
      variation = 2*Math.PI-(mean_anomaly_end-mean_anomaly_start);
    } while(variation>0);

    var i = 0;
    do{
      t = (t_high+t_low)/2;
      mean_anomaly_end = Engine.kepler_orbital_position(orbital_parameters,Engine.time_to_kepler_time(t))[1]
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

    var points = [];

    var t_end = t;
    var t_start = 0;
    var count = 1000;
    var increment = (t_end-t_start)/count;
    for(t = 0; t < t_end; t+=increment){
      var position = Engine.kepler_orbital_position(orbital_parameters,Engine.time_to_kepler_time(t))[0];
      position = position.map(v=>Engine.AU_to_system_units(v));
      position = new Vector3(...position);
      points.push(position);
      if(position.x == undefined) {
        console.log(position,t)
      };
    }
    return points;
  },[orbital_parameters !== null ? orbital_parameters : null]);

  var position = [0,0,0];
  if(Array.isArray(orbital_parameters)){
    position = orbital_parameters;
  }
  else{
    var orbit_data = Engine.kepler_orbital_position(orbital_parameters,Engine.time_to_kepler_time(props.timestamp))
    position = orbit_data[0];
  }
  position = position.map(v=>Engine.AU_to_system_units(v));
  position = new Vector3(...position);

  const texture = useTexture(celestial_body.textureURL);


  return (<group>
    <mesh
      position = {position}
      ref={meshRef}
      scale = {celestial_body.size*Constants.Inv_AU*celestial_body.render_scalar}
    >
      <icosahedronGeometry args= {[1,10,10]} ></icosahedronGeometry>
      <meshStandardMaterial  {...(texture ? {map: texture} : {})} />
    </mesh>
    {orbit_points?
    (<Curve
    color = "white"
      points={orbit_points}
    ></Curve>):[]}
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

export default function Home() {
  var planets = Engine.solar_system_bodies;
  var planet_objects =planets.map(p=>{
    return (<KeplerBody key = {p.name} CelestialObject={p} timestamp={0}></KeplerBody>)
  });
  return (
    <div className="font-sans flex min-h-screen ">
      <div id="canvas-container" className = "bg-white flex-1">
        <Canvas>
          <BackgroundTexture URL = "2k_stars_milky_way.jpg"/>
          <ambientLight intensity={Math.PI / 2} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
          <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
          {planet_objects}
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

