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

  const displayRef = useRef();
  const hitboxRef = useRef();
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

  useFrame(()=>{
    if(props.ref?.current){
      if(props.ref.current.position){
        displayRef.current.position.copy(props.ref.current.position);
        hitboxRef.current.position.copy(props.ref.current.position);
      }
    }
  })

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
        ref={displayRef}
        points={props.points}
        color = {hovered?"red":"white"}
        onPointerOver = {()=>{setHovered(true)}}
        onPointerOut = {()=>{setHovered(false)}}
        onPointerMove = {()=>{hoverIn()}}
        lineWidth={1}
      >
      </Line>
      <Line
        ref={hitboxRef}
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
  const ref = useRef()
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

  useFrame(()=>{
    if(ref){
      var orbit_data = celestial_body.position_at_timestamp(props.timestamp.current);
      var position = orbit_data[0];
      position = position.map(v=>v*Engine.au_to_system_units_scalar);
      ref.current.position.copy(new Vector3(...position));
    }
  })

  const texture = useTexture(celestial_body.textureURL);
  texture.rotation// = Math.PI/2;
  var color = "white"

  return (<group>
    <mesh
      ref={ref}
      scale = {1}
      rotation = {[Math.PI/2,0,0]}
      >
      <icosahedronGeometry args= {[celestial_body.size*Constants.Inv_AU*celestial_body.render_scalar*Engine.au_to_system_units_scalar,10,10]} ></icosahedronGeometry>
      <meshStandardMaterial  {...(texture ? {map: texture} : {})} />
    </mesh>
    {orbit_points?
    (<Curve
    color = "white"
      points={orbit_points}
    ></Curve>):[]}
  </group>)
}



function ConicBody(props,texture){
  const spriteRef = useRef();
  const curveRef = useRef({"position":new Vector3(0,0,0)});

  var conic_path = useMemo(()=>{
    return Engine.calculate_conic_path(
      props.signature_position,
      props.signature_velocity,
      props.signature_time
    )
  },[...props.signature_position,...props.signature_velocity,props.signature_time])

  var sprite = useTexture(props.textureURL)
  useFrame(()=>{
    if(spriteRef.current){
      //ref.current.position.copy(new Vector3(...props.signature_position.map(v=>v/Constants.AU*Engine.au_to_system_units_scalar)))
      var orbit_position = conic_path.conic.position_at_time(props.timestamp.current).multiplyScalar(Engine.meters_to_system_units_scalar);

      var orbit_data = conic_path.body.position_at_timestamp(props.timestamp.current);
      var position = orbit_data[0];
      var body_position = new Vector3(...position.map(v=>v*Engine.au_to_system_units_scalar));

      orbit_position.add(body_position);

      spriteRef.current.position.copy(orbit_position);
      if(curveRef?.current){
        curveRef.current.position.copy(body_position);
      } else {}
    }
  })

  return (<group>
    <Curve
      ref={curveRef}
      points = {conic_path.conic.vec3Cache}
      color="white"
    />
    <sprite
    ref = {spriteRef}
      scale = {0.05}
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
    camera.frustumCulled = false;
    camera.near = 1e-10
    camera.far = 1e10
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

function FrameTracker(props){
  useFrame((state,delta_ms) => {
    props.timestamp.current += delta_ms * Engine.ms_per_ms; // advance simulation time
  });
}

export default function Home() {
  const timestamp = useRef(0);
  var planets = Engine.solar_system_bodies;
  var planet_objects =planets.map(p=>{
    return (<KeplerBody key = {p.name} CelestialObject={p} timestamp={timestamp}></KeplerBody>)
  });
  return (
    <div className="font-sans flex min-h-screen ">
      <div id="canvas-container" className = "bg-white flex-1">
        <Canvas>
          <FrameTracker timestamp = {timestamp}/>
          <BackgroundTexture URL = "2k_stars_milky_way.jpg"/>
          <ambientLight intensity={Math.PI / 2} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
          <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
          {planet_objects}
          <ConicBody signature_position = {[-2.7e10,1.445e11,0]} signature_velocity={[1000,-10,0]} signature_time={0} timestamp={timestamp} textureURL = "vercel.svg"/>
          <ZUp/>
          <OrbitControls 
            position = {[0,0,0]}
            minDistance={1}
            minPolarAngle={-Math.PI}  // 45° from top
            maxPolarAngle={Math.PI}  // lock to equatorial plane
          />
        </Canvas>
      </div>
      {/*<div className = "bg-[#222] flex-1">a</div>*/}
    </div>
  );
}

