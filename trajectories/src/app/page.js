'use client'
import React, {  useEffect, useImperativeHandle, forwardRef, useMemo, useRef, useState } from 'react'
import { useThree, useLoader, Canvas, useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Raycaster, Vector3, Quaternion,} from 'three'
import * as THREE from "three"
import { OrbitControls, useTexture, Line, Html } from '@react-three/drei'
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
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[Engine.max_view*0.99, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
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
    //color = ref
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
        lineWidth={10}
        scale = {props.scale??1}
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

const Halo = forwardRef((props, ref) => {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [clickable, setClickable] = useState(true)
  const [transparency, setTransparency] = useState(1);
  const [zindex,setZindex] = useState(0);

  useImperativeHandle(ref, () => ({
    setSize: (r) => setSize({ width: r * 2, height: r * 2 }),
    setClickable: (state) => setClickable(state),
    setTransparency: (fraction) => setTransparency(fraction),
    setZindex: (index) => setZindex(index)
  }));

  return (
    <div
    onMouseDown={props.onClick}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        opacity: `${transparency*100}%`,
        color: `${props.color}`,
        zIndex: zindex
      }}
      className="rounded-full border-3 border-black "
    ><div className='rounded-full min-h-full border-2 border-white-400/60'></div></div>
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
        if(pixelRadius<culling_size){
          haloRef.current.setTransparency(pixelRadius/culling_size);
        }
        if(pixelRadius<shrink_size){
          radius*=pixelRadius/shrink_size;
          radius = Math.floor(radius)
          radius = Math.max(min_radius,radius);
        }
        haloRef.current.setSize(radius);
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
      <meshStandardMaterial  {...(texture ? {map: texture} : {})} />
      <Html 
        ref={htmlRef}
        center
        zIndexRange={[zi, zi]}
        >
        <Halo ref = {haloRef} color={celestial_body.color} onClick={onMenuOpen}></Halo>
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
    //camera.frustumCulled = false;
    camera.near = 1e-5
    camera.far = Engine.max_view
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

      console.log(delta,Engine.au_to_system_units_scalar)

      var scalar = 1+delta

      Engine.set_scalar(Engine.au_to_system_units_scalar*scalar); // clamp to avoid zero or negative scale
    }

    const canvasContainer = document.getElementById('canvas-container');
    //canvasContainer?.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvasContainer?.removeEventListener('wheel', handleWheel);
    };
  }, []);


  useFrame((state,delta_ms) => {
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
      console.log(props.cameraFocusRef.current)
      console.log(target_dist,current_dist,scalar)
      state.camera.position.copy(delta.add(props.cameraFocusRef.current.position))
      props.cameraRefocusRef.current = false;
    }

    props.cameraRef.current.target.copy(new_position);
    props.timestamp.current += delta_ms * Engine.ms_per_ms; // advance simulation time
    if(props.clockRef?.current){
      props.clockRef.current.setTime(props.timestamp.current);
    }
  });
}

function Clock(props){
  const [time,setTime] = useState(0);
  useImperativeHandle(props.ref,()=>({
    setTime
  }))

  var date = new Date();
  date.setTime(time);
  var string = Engine.formatDate(date);
  
  return(
      <div 
        className={`${robotoMono.className} rounded-bl-full absolute p-0.5 pl-7 top-0 right-0 bg-gray-700`}>{string}</div>
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
          <Skysphere textureURL={"2k_stars_milky_way.jpg"}/>
          <FrameTracker  
            cameraRef={oControlsRef}
            cameraFocusRef={cameraFocusRef}
            cameraRefocusRef = {applyCameraRefocus}
            timestamp = {timestamp}
            clockRef = {clockRef}
          />
          <BackgroundTexture URL = "2k_stars_milky_way.jpg"/>
          <ambientLight intensity={Math.PI / 2} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
          <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
          {planet_objects}
          <ConicBody signature_position = {[-2.7e10,1.445e11,0]} signature_velocity={[1000,-10,0]} signature_time={0} timestamp={timestamp} textureURL = "vercel.svg"/>
          <ZUp/>
          <OrbitControls 
            ref={oControlsRef}
            position = {[0,0,0]}
            minDistance={0.0001}
            maxDistance={Engine.max_camera_dist}
            minPolarAngle={-Math.PI}  // 45° from top
            maxPolarAngle={Math.PI}  // lock to equatorial plane
          />
        </Canvas>
      </div>
      {/*<div className = "bg-[#222] flex-1">a</div>*/}
    </div>
  );
}

