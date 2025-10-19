'use client'
import React, {  useEffect, useImperativeHandle, forwardRef, useMemo, useRef, useState } from 'react'
import { useThree, useLoader, Canvas, useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Raycaster, Vector3, Quaternion,} from 'three'
import * as THREE from "three"
import { OrbitControls, useTexture, Line, Html } from '@react-three/drei'
import {EffectComposer, Bloom} from "@react-three/postprocessing"
import * as Engine from "./engine"
import * as Constants from "./constants"
import { Roboto_Mono } from 'next/font/google'

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400'], // or ['400', '700'] if you need multiple weights
});


function Skysphere({ textureURL }) {
  const texture = useTexture(textureURL);

  return (
    <mesh 
    scale={[-1, 1, 1]}
    rotation = {[0,Math.PI/2,0]}
    >
      <sphereGeometry args={[Engine.max_view*0.99, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}

function lerp(a,b,f){
  return a*(f-1)+b*(f);
}


function locateFactorOnLine(point, samples) {
  let minDist = Infinity;
  let bestI = 0;
  let bestT = 0;

  const ab = new THREE.Vector3();
  const ap = new THREE.Vector3();

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];

    ab.subVectors(b, a);
    const denom = ab.lengthSq();
    if (denom === 0) continue;

    ap.subVectors(point, a);
    let t = ap.dot(ab) / denom;       // projection factor
    t = Math.max(0, Math.min(1, t));  // clamp to [0,1]

    const qx = a.x + ab.x * t;
    const qy = a.y + ab.y * t;
    const qz = a.z + ab.z * t;
    const distSq = (point.x - qx) ** 2 + (point.y - qy) ** 2 + (point.z - qz) ** 2;

    if (distSq < minDist) {
      minDist = distSq;
      bestI = i;
      bestT = t;
    }
  }

  // Normalize: 0 at start, 1 at end
  return (bestI + bestT) / (samples.length - 1);
}

function Curve(props) {
  // Generate Catmull-Rom curve points

  const displayRef = useRef();
  const hitboxRef = useRef();
  const [positions, setPositions] = useState(new Float32Array());
  const [hovered, setHovered] = useState(false);
  const [pointPos,setPointPos] = useState(-1);



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
      if(props.ref.current.length>props.id){
        displayRef.current.position.copy(props.ref.current[props.id]);
        hitboxRef.current.position.copy(props.ref.current[props.id]);
      }
    }
  })

  var curve = useMemo(()=>{
    return new THREE.CatmullRomCurve3(props.points)
  },props.points)

  function handleHover(e){
    var pos = e.pointOnLine;
    //var factor = locate_point_on_line(pos,props.points);
    var factor = locateFactorOnLine(pos,props.points)
    if(factor<0) factor = -factor;
    setPointPos(factor);
    setHovered(true);
  }
  function hoverInOut(hovering_in){
    setHovered(hovering_in);
  }

  var point = (
    <sprite scale = {0} position={pointPos>=0?curve.getPoint(pointPos):[0,0,0]}>
      <Html center style={{pointerEvents:"none"}}>
        <div className='w-1 h-1 rounded-full border-5'>
        </div>
      </Html>
    </sprite>
  )

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
        onPointerMove = {()=>{}}
        lineWidth={1.5}
        scale = {props.scale??1}
      >
      </Line>
      <Line
        ref={hitboxRef}
        points={props.points}
        visible={false}
        onPointerMove={handleHover}
        onPointerOver={()=>hoverInOut(true)}
        onPointerOut={()=>hoverInOut(false)}
        lineWidth={15}
        scale = {props.scale??1}
      >
      </Line>
      {hovered?point:null}
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

const Halo = forwardRef((props, ref) => {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [clickable, setClickable] = useState(true)
  const [transparency, setTransparency] = useState(1);
  const [zindex,setZindex] = useState(0);
  const [isHovered,setIsHovered] = useState(false);
  const [fontOpacity,setFontOpacity] = useState(1);

  useImperativeHandle(ref, () => ({
    setSize: (r) => setSize({ width: r * 2, height: r * 2 }),
    setClickable,
    setTransparency,
    setZindex,
    setFontOpacity
  }));

  var tag_class = ' absolute -right-0 -top-5 w-0 '+robotoMono.className
  var main_class = " transition-all select-none rounded-full relative border-1 border-black";

  if(isHovered){
    main_class += "";
  } else {
    main_class += "/50 opacity-75";
  }

  var font_transparency = transparency*size.width/props.maxWidth;

  return (
    <div
    onMouseOver={()=>setIsHovered(true)}
    onMouseOut ={()=>setIsHovered(false)}
    onMouseDown={props.onClick}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        opacity: `${transparency*100}%`,
        color: `${props.color}`,
        backgroundColor:`${props.color}`,
        zIndex: zindex,
      }}
      className={main_class}
    ><div style= {{textShadow: "0px 1px 4px rgba(0, 0, 0, 1)", opacity:fontOpacity}} className={tag_class}>{props.name}</div>
      <div className='rounded-full min-h-full border-2'></div></div>
  )
})

function KeplerBody(props){
  const ref = useRef()
  const haloRef = useRef();
  const {camera,size} = useThree();
  const [zi,setZ] = useState(10);
  const htmlRef = useRef();

  let celestial_body = props.CelestialObject;

  var orbit_points = useMemo(()=>{
    if(celestial_body.orbital_cache.length == 0) return [];
    var points = new Array(Engine.orbit_resolution+1);
    var skip = Engine.cache_scalar-1;
    var iterator = 0;
    for(let i = 0; i < Engine.orbit_resolution; i++){
      points[i] = new Vector3(
        Constants.Inv_AU*(celestial_body.orbital_cache.cache[iterator++]),
        Constants.Inv_AU*(celestial_body.orbital_cache.cache[iterator++]),
        Constants.Inv_AU*(celestial_body.orbital_cache.cache[iterator++])
      );
      iterator += skip*3;
    }
    points[Engine.orbit_resolution] = (new Vector3(
      Constants.Inv_AU*(celestial_body.orbital_cache.cache[0]),
      Constants.Inv_AU*(celestial_body.orbital_cache.cache[1]),
      Constants.Inv_AU*(celestial_body.orbital_cache.cache[2])
    ))
    return points;
  },[celestial_body !== null ? celestial_body : null]);

  useFrame((scene)=>{
    if(ref){
      var orbit_data = celestial_body.position_at_timestamp(props.timestamp.current);
      var position = orbit_data[0];
      position = position.map(v=>v*Engine.au_to_system_units_scalar);
      if(celestial_body.name == "Sun"){
        var dist = scene.camera.position.distanceTo(new Vector3(...position));
        position[0] += Math.random()*1e-5*dist; //jank fix for a rendering bug regarding zi state changes. forces the element to update
      } 
      ref.current.position.copy(new Vector3(...position));

      const raycaster = new Raycaster();

      const radiusWorld = celestial_body.size * Constants.Inv_AU * celestial_body.render_scalar * Engine.au_to_system_units_scalar
      const cameraDistance = ref.current.position.distanceTo(camera.position)
      const theta = Math.atan(radiusWorld / cameraDistance)
      const ndcRadius = Math.tan(theta) / Math.tan((camera.fov * Math.PI) / 360)
      const pixelRadius = (size.height / 2) * ndcRadius

      if(haloRef?.current){
        var radius = pixelRadius+10
        var culling_size = 0.0005;
        var shrink_size = 0.005;
        var min_radius = 3
        var hide_on_radius = 1;
        var transparency = 1;
        var scalar;
        if(pixelRadius<culling_size){
          transparency = pixelRadius/culling_size;
        }
        if(pixelRadius<shrink_size){
          scalar =pixelRadius/shrink_size;
          radius *= scalar;
          radius =  Math.floor(radius)
          radius =  Math.max(min_radius,radius);
        }
        if(pixelRadius>hide_on_radius-1){
          transparency = Math.max(0,1-pixelRadius+hide_on_radius);
        }
        haloRef.current.setTransparency(transparency);
        haloRef.current.setSize(radius);
        haloRef.current.setFontOpacity(scalar**2);
        var z = 10000+Math.floor(1000*Math.log2(1/cameraDistance))
        setZ(z);
        //if(celestial_body.name == "Sun") console.log(zi,"sun asdfasdfa sdf",z)
      }

    }
  })

  function focusCamera(){
    props.cameraFocusRef.current = ref.current;
    props.cameraRefocusRef.current = true;
  }

  function onMenuOpen(e){
    const worldPosition = ref.current.getWorldPosition(new Vector3());

    // Project the world position to normalized device coordinates (NDC)
    const ndc = worldPosition.clone().project(camera);

    // Convert NDC to screen coordinates
    const screenX = (ndc.x + 1) / 2 * size.width;
    const screenY = (-ndc.y + 1) / 2 * size.height;

    props.onMenuOpen(screenX,screenY,celestial_body.name,[
      <ContextMenuOption title="focus camera" onClick={focusCamera}/>,
      <ContextMenuOption title="target"/>
    ])
  }

  const texture = useTexture(celestial_body.textureURL);
  texture.rotation// = Math.PI/2;
  var color = "white"

  return (<group>
    <mesh
      ref={ref}
      scale = {celestial_body.size*Constants.Inv_AU*celestial_body.render_scalar*Engine.au_to_system_units_scalar}
      rotation = {[Math.PI/2,0,0]}
      
      >
      <icosahedronGeometry args= {[1,10,10]} ></icosahedronGeometry>
      <meshStandardMaterial
       emissiveIntensity={celestial_body.emissive}
       emissive={new THREE.Color("white")}
        {...(texture ? {map: texture} : {})}
        {...(texture ? {emissiveMap: texture} : {})}
        />
      <Html 
        ref={htmlRef}
        center
        zIndexRange={[zi, zi]}
        >
        <Halo ref = {haloRef} color={celestial_body.color} onClick={onMenuOpen} name={celestial_body.name}></Halo>
      </Html>
    </mesh>
    {orbit_points?(
      <Curve
        scale = {Engine.au_to_system_units_scalar}
        color = "white"
        points={orbit_points}
      ></Curve>):[]}
  </group>)
}



function ConicBody(props,texture){
  const spriteRef = useRef();
  const curveRef = useRef([]);

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
      var section_index = 0;
      var section;
      for(section_index = 0; section_index < conic_path.length; section_index++){
        section = conic_path[section_index];
        if(section.termination == null) break;
        if(props.timestamp.current < section.termination) break;
      }
      var orbit_position = section.conic.position_at_time(props.timestamp.current).multiplyScalar(Engine.meters_to_system_units_scalar);

      var orbit_data = section.body.position_at_timestamp(props.timestamp.current);
      var position = orbit_data[0];
      var body_position = new Vector3(...position.map(v=>v*Engine.au_to_system_units_scalar));

      orbit_position.add(body_position);

      spriteRef.current.position.copy(orbit_position);
      if(curveRef?.current){
        for(let i = 0; i < conic_path.length; i++){
          var segment = conic_path[i];
          var body_position = segment.body.position_at_timestamp_vec3(props.timestamp.current);
          if(curveRef.current.length<i+1){
            curveRef.current.push(new Vector3());
          }
          curveRef.current[i].copy(body_position);
        }
      } 
    }
  })

  var curves = [];
  for(let i = 0; i < conic_path.length; i++){
    var curve = (
      <Curve
      ref={curveRef}
      points = {conic_path[i].conic.vec3Cache}
      color="white"
      id = {i}
    />
    )
    curves.push(curve);
  }

  return (<group>
    
    {curves}
    {
    <sprite
    ref = {spriteRef}
      scale = {0.00}
    >
      <Html center zIndexRange={[1000]}>
        <div className="w-8 h-8 bg-transparent">
          <img src="/sattelite_sprite.png" />
        </div>
        
      </Html>

    </sprite>}
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
    //camera.frustumCulled = false;
    camera.near = 3e-4
    camera.far = Engine.max_view
    camera.fov = 10
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

function FrameTracker(props){
  var previousTrackedPosition = useRef(new Vector3(0,0,0));



  useEffect(() => {
    function handleWheel(event) {
      event.preventDefault();

      const zoomFactor = 0.25;
      const delta = event.deltaY > 0 ? -zoomFactor : zoomFactor;


      var scalar = 1+delta

      Engine.set_scalar(Engine.au_to_system_units_scalar*scalar); // clamp to avoid zero or negative scale
    }

    const canvasContainer = document.getElementById('canvas-container');
    //canvasContainer?.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvasContainer?.removeEventListener('wheel', handleWheel);
    };
  }, []);


  useFrame((state,delta_s) => {
    var new_position = props.cameraFocusRef.current.position;
    var delta_position = new_position.clone().sub(previousTrackedPosition.current);
    previousTrackedPosition.current.copy(new_position)
    state.camera.position.add(delta_position)


    if(props.cameraRefocusRef.current){
      var target_dist = props.cameraFocusRef.current.scale.x*10;
      var delta = state.camera.position.clone().sub(props.cameraFocusRef.current.position);
      var current_dist = state.camera.position.distanceTo(props.cameraFocusRef.current.position);
      var scalar = target_dist/current_dist
      delta.multiplyScalar(scalar);
      state.camera.position.copy(delta.add(props.cameraFocusRef.current.position))
      props.cameraRefocusRef.current = false;
    }

    props.cameraRef.current.target.copy(new_position);
    props.timestamp.current += delta_s * 1000  * Engine.ms_per_ms; // advance simulation time
    if(props.clockRef?.current){
      props.clockRef.current.setTime(props.timestamp.current);
    }
  });
}

function Clock(props){
  const [warp,setWarp] = useState(Engine.warp_state);
  //const time = useState(0);
  const clockRef = useRef();
  useImperativeHandle(props.ref,()=>({
    setTime: (time)=>{
      var date = new Date();
      date.setTime(time);
      var string = Engine.formatDate(date);
      clockRef.current.innerHTML = string;
    }
  }))

  function setWarpGlobal(v){
    Engine.set_warp(v);
    setWarp(v);
  }

  function Arrow(props){
    var style = {color:"#aaa"};
    if(props.warp >= props.id){
      style.color="#fff";
    }
    return (
    <span 
      style={style}
      className="w-2.5 inline-flex  justify-center overflow-hidden items-center  cursor-pointer"
      onMouseDown={()=>{setWarpGlobal(props.id)}}
    >
      ⏵︎
    </span>
    )
  }
  


  
  var arrows = []
  for(let i = 1 ; i < Engine.warps.length; i++){
    arrows.push(
      <Arrow warp = {warp} id = {i} key={i}/>
    )
  }

  return(
      <div 
        className={`${robotoMono.className} rounded-bl-full absolute p-0.5 pl-7 top-0 right-0 bg-gray-700 text-3xl`}>
        <div
        ref = {clockRef}>
        </div>
        <hr></hr>
        <div className='text-3xl h-10'>
          <div className='inline-flex w-50 justify-end no-leading'>
            <div className="inline-block w-10 text-right">{Engine.warps[warp].name}</div>
            <div className="inline-block w-35">{Engine.warps[warp].unit}</div>
          </div>
          <span 
            onClick={()=>setWarpGlobal(0)}
            style={warp>0?{color:"#aaa"}:{}}
          >
            ⏸︎
          </span>
          {arrows}
        </div>
      </div>
  )
}

function ContextMenuOption(props){
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setActive] = useState(false);

  var className = "pl-1 pr-1 ";

  if(isActive){
    className += "bg-gray-700 ";
  }
  else if(isHovered){
    className += "bg-gray-800 ";
  }

  function onMouseDown(e){
    setActive(true);
    if(props.onClick) props.onClick(e);
  }

  function onMouseUp(e){
    setActive(false);
  }


  return (
    <div className={className}
      onMouseOver={()=>setIsHovered(true)}
      onMouseOut ={()=>setIsHovered(false)}
      onMouseDown={onMouseDown}
      onMouseUp = {onMouseUp}
    >{props.title}</div>
  )
}

function ContextMenu(props){


  const menuRef = useRef();

  useEffect(() => {
    function handleClickOutside(event,openTime) {
      var time = new Date();
      if (time - props.openTime<100) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(event.target) && props.openTime == openTime) {
        props.onClose?.();
        document.removeEventListener('mousedown', handleClickOutside);
      }
    }

    var func = (e)=>{handleClickOutside(e,props.openTime)}

    document.removeEventListener('mousedown', func);
    document.addEventListener('mousedown', func);

    return () => {
    };
  },[]);




  return(
    <div 
    ref={menuRef}
    tabIndex={0}
    onBlur={()=>props.onClose()}
    
    style={{top:props.pos_y,left:props.pos_x}}
    className='absolute min-w-min w-32 block bg-gray-900 overflow-hidden rounded-xl drop-shadow' >
      <p className="pl-1">{props.title}</p>
      <hr className='ml-1 mr-1 mb-1'></hr>
      {props.children}
    </div>
  )
}

function LoadingScreen(props){


  return(
    <div style={{"zIndex":100000}} className= 'absolute inset-0 bg-[#222] flex justify-center items-center text-5xl'>
      <div className={robotoMono.className+" flex flex-col justify-center items-center"}>
        Loading Large Textures
        <div className='w-50 h-50 overflow-hidden flex items-center justify-center'>
        <img className='w-50 spin' src="./wheel.png"/>
        
<style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(-360deg);
          }
        }
        .spin {
          /* Customize the speed with a CSS variable */
          --spin-speed: 1.2s;
          animation: spin var(--spin-speed) linear infinite;
          /* Enable GPU compositing */
          will-change: transform;
        }

        /* Respect user motion preferences */
        @media (prefers-reduced-motion: reduce) {
          .spin {
            animation: none;
          }
        }
      `}</style>

        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const oControlsRef = useRef()
  const timestamp = useRef(0);
  const clockRef = useRef();
  const cameraFocusRef = useRef({position:new Vector3(0,0,0)});
  const applyCameraRefocus = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuState = useRef({
    left:0,
    top:0,
    title:"",
    children:[]
  });
  var planets = Engine.solar_system_bodies;

  function openMenu(pos_x,pos_y,title,children){
    menuState.current.left=pos_x;
    menuState.current.top=pos_y;
    menuState.current.title=title;
    menuState.current.children = children;
    menuState.current.openTime = new Date();
    setMenuOpen(true);
  }

  var planet_objects =planets.map(p=>{
    return (<KeplerBody
      key = {p.name}
      CelestialObject={p}
      timestamp={timestamp}
      onMenuOpen={openMenu}
      cameraFocusRef={cameraFocusRef}
      cameraRefocusRef = {applyCameraRefocus}
      />)
  });
  return (
    <div className="font-sans flex min-h-screen ">
      <div id="canvas-container" className = "bg-white flex-1 relative">
        <div style={{"zIndex":10000}} className = "absolute select-none left-0 right-0">
          {menuOpen?(
            <ContextMenu 
              openTime = {menuState.current.openTime}
              onClose={()=>{setMenuOpen(false)}}
              pos_x={menuState.current.left}
              pos_y={menuState.current.top}
              title={menuState.current.title}
            >
              {menuState.current.children}
            </ContextMenu>):null
          }
          <Clock ref={clockRef}/>
        </div>
        <Canvas>
          <EffectComposer>
            <Bloom
              intensity={0.5}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
            />
          </EffectComposer>
          <Skysphere textureURL={"starmap_2020_16k_low.webp"}/>
          <FrameTracker  
            cameraRef={oControlsRef}
            cameraFocusRef={cameraFocusRef}
            cameraRefocusRef = {applyCameraRefocus}
            timestamp = {timestamp}
            clockRef = {clockRef}
          />
          <BackgroundTexture URL = "2k_stars_milky_way.jpg"/>
          <ambientLight intensity={Math.PI / 20} />
          <spotLight position={[0,0,0]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
          <pointLight position={[0, 0, 0]} decay={0} intensity={Math.PI*4} />
          {planet_objects}
          <ConicBody signature_position = {[-2.7e10,1.445e11,0]} signature_velocity={[-33000,-5000,0]} signature_time={0} timestamp={timestamp} textureURL = "vercel.svg"/>
          <ZUp/>
          <OrbitControls 
          enablePan={false}
            ref={oControlsRef}
            position = {[0,0,0]}
            minDistance={0.001}
            maxDistance={Engine.max_camera_dist}
            minPolarAngle={-Math.PI}  // 45° from top
            maxPolarAngle={Math.PI}  // lock to equatorial plane
          />
        </Canvas>
      </div>
      <div className = "w-75 min-h-screen bg-gray-700 block">
          <div className='w-75'>
            <div className='h-10 ml-1 text-3xl'>Info</div>
          </div>
          <div classname="w-75">

          </div>
      </div>
    </div>
  );
}

