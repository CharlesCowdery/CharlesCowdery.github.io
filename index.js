import * as THREE from 'three/webgpu';
import { Vector3 as Vec3 } from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGPURenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

const geometries = new Map();
const materials = new Map();
const meshes = new Map();
const lights = new Map();
const pathes = new Map();

//const geometry = new THREE.BoxGeometry( 1, 1, 1 );
//const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
//const cube = new THREE.Mesh( geometry, material );
//scene.add( cube );

    const hash_buf = new ArrayBuffer(12);
    const hash_f32 = new Float32Array(hash_buf);
    const hash_u32 = new Uint32Array(hash_buf);

function hash3fast(v) {

    let x = v[0];
    let y = v[1];
    let z = v[2];


    hash_f32[0] = x;
    hash_f32[1] = y;
    hash_f32[2] = z;

    let cantor = (a,b)=>{return 0.5*(a+b)*(a+b+a)+b};
    let H_ab = cantor(hash_u32[0],hash_u32[1]);


    let h = cantor(H_ab,hash_u32[2]);
    return h;
}

class EulerSim{
    //(normal x y z) (v1 pointing x y z)
    static_attribute_count = 
    //(vel x vel y) (3 x face flux) (p) (d) (t) (specific humidity) (ground temperature) (ground water mass)
    attribute_count = 3+3+2+3+1+1+1+1+1; 
    adapter = null;
    device = null;
    
    tri_count;
    
    neighbor_buffer_size;
    attribute_buffer_size;

    neighbor_buffer;
    attribute_buffer_1;
    attribute_buffer_2;

    async init(tri_count){
        if (!('gpu' in navigator)) {
            throw new Error('WebGPU not supported in this browser (navigator.gpu missing).');
        }
        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) throw new Error('No GPU adapter found.');
        this.device = await this.adapter.requestDevice();

        this.tri_count = tri_count;
        this.neighbor_buffer_size = tri_count*3*4;
        this.attribute_buffer_size = tri_count*this.attribute_count*4;
        
        console.log(tri_count)

        this.neighbor_buffer = this.device.createBuffer({
            size:this.neighbor_buffer_size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.attribute_buffer_1 = this.device.createBuffer({
            size:this.attribute_buffer_size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        })
        this.attribute_buffer_2 = this.device.createBuffer({
            size:this.attribute_buffer_size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        })

        var shaderCode = await fetch("./kernel.wgsl");
        shaderCode = await shaderCode.text();
        console.log(shaderCode);

        const module = this.device.createShaderModule({ code: shaderCode });
        const pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module, entryPoint: 'main' },
        });

        // Create uniform buffer for element count (u32)
        const uniformBuf = this.device.createBuffer({
            size: 8, // u32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        // write element count
        this.queue.writeBuffer(uniformBuf, 0, new Uint32Array([tri_count,this.attribute_count]));

        // Bind group
        this.bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
            { binding: 0, resource: { buffer: this.neighbor_buffer } },
            { binding: 1, resource: { buffer: this.attribute_buffer } },
            { binding: 2, resource: { buffer: uniformBuf } },
            ],
        });
        
        this.commandEncoder = this.device.createCommandEncoder();
    }
    async compute(){
        // Command encoding: compute pass then copy to readback buffer
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);

        // Dispatch: ceil(elementCount / workgroup_size)
        const workgroupSize = 64;
        const dispatchX = Math.ceil(elementCount / workgroupSize);
        pass.dispatchWorkgroups(dispatchX);
        pass.end();

        // Copy output to readback buffer for CPU read
        commandEncoder.copyBufferToBuffer(gpuOutput, 0, readbackBuffer, 0, bufferSize);

        // Submit
        const commands = commandEncoder.finish();
        device.queue.submit([commands]);

        // Read back results
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        const copyArrayBuffer = readbackBuffer.getMappedRange();
        const result = new Float32Array(copyArrayBuffer.slice(0));
        readbackBuffer.unmap();

        return result;
    }
}

//async function runCompute() {
//
//
//  // Request adapter & device
//  // Input data (Float32Array)
//  const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
//  const bytesPerElement = input.BYTES_PER_ELEMENT;
//  const elementCount = input.length;
//  const bufferSize = input.byteLength;
//
//  // Create GPU buffers
//  const gpuInput = device.createBuffer({
//    size: bufferSize,
//    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
//    mappedAtCreation: true,
//  });
//  // copy initial data into mapped buffer then unmap
//  new Float32Array(gpuInput.getMappedRange()).set(input);
//  gpuInput.unmap();
//
//  const gpuOutput = device.createBuffer({
//    size: bufferSize,
//    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
//  });
//
//  // Buffer to read back results (mapped for reading after copy)
//  const readbackBuffer = device.createBuffer({
//    size: bufferSize,
//    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
//  });
//
//  // WGSL compute shader: read storage buffer, write doubled values to output buffer
//  const shaderCode = `
//    struct Params { count: u32 };
//    @group(0) @binding(0) var<storage, read> inData : array<f32>;
//    @group(0) @binding(1) var<storage, read_write> outData : array<f32>;
//    @group(0) @binding(2) var<uniform> params : Params;
//
//    @compute @workgroup_size(64)
//    fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
//      let idx : u32 = gid.x;
//      if (idx >= params.count) { return; }
//      outData[idx] = inData[idx] * 2.0;
//    }
//  `;
//
//  // Create shader module & pipeline
//  const module = device.createShaderModule({ code: shaderCode });
//  const pipeline = device.createComputePipeline({
//    layout: 'auto',
//    compute: { module, entryPoint: 'main' },
//  });
//
//  // Create uniform buffer for element count (u32)
//  const uniformBuf = device.createBuffer({
//    size: 4, // u32
//    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
//  });
//  // write element count
//  device.queue.writeBuffer(uniformBuf, 0, new Uint32Array([elementCount]));
//
//  // Bind group
//  const bindGroup = device.createBindGroup({
//    layout: pipeline.getBindGroupLayout(0),
//    entries: [
//      { binding: 0, resource: { buffer: gpuInput } },
//      { binding: 1, resource: { buffer: gpuOutput } },
//      { binding: 2, resource: { buffer: uniformBuf } },
//    ],
//  });
//
//  // Command encoding: compute pass then copy to readback buffer
//  const commandEncoder = device.createCommandEncoder();
//  const pass = commandEncoder.beginComputePass();
//  pass.setPipeline(pipeline);
//  pass.setBindGroup(0, bindGroup);
//
//  // Dispatch: ceil(elementCount / workgroup_size)
//  const workgroupSize = 64;
//  const dispatchX = Math.ceil(elementCount / workgroupSize);
//  pass.dispatchWorkgroups(dispatchX);
//  pass.end();
//
//  // Copy output to readback buffer for CPU read
//  commandEncoder.copyBufferToBuffer(gpuOutput, 0, readbackBuffer, 0, bufferSize);
//
//  // Submit
//  const commands = commandEncoder.finish();
//  device.queue.submit([commands]);
//
//  // Read back results
//  await readbackBuffer.mapAsync(GPUMapMode.READ);
//  const copyArrayBuffer = readbackBuffer.getMappedRange();
//  const result = new Float32Array(copyArrayBuffer.slice(0));
//  readbackBuffer.unmap();
//
//  return result; // Float32Array with doubled values
//}
//
//// Example usage:
//runCompute()
//  .then(result => console.log('GPU result:', Array.from(result)))
//  .catch(err => console.error('WebGPU error:', err));
//
//}

function compute_neighbors(geometry){
    let start = new Date();
    const vp = geometry.getAttribute("position").array

    const verts = [];
    const tris = [];
    const vert_map = new Map();

    for(let i = 0; i < vp.length; i+=9){
        let v1 = [vp[i+0],vp[i+1],vp[i+2]];
        let v2 = [vp[i+3],vp[i+4],vp[i+5]];
        let v3 = [vp[i+6],vp[i+7],vp[i+8]];

        let v1_hash = hash3fast(v1);
        let v2_hash = hash3fast(v2);
        let v3_hash = hash3fast(v3);

        //console.log(v1_hash,v2_hash,v3_hash)

        if(!vert_map.has(v1_hash)){
            vert_map.set(v1_hash,verts.length); 
            verts.push([v1,[]]);
        } 
        if(!vert_map.has(v2_hash)){
            vert_map.set(v2_hash,verts.length); 
            verts.push([v2,[]]);
        } 
        if(!vert_map.has(v3_hash)){
            vert_map.set(v3_hash,verts.length); 
            verts.push([v3,[]]);
        } 

        const v1_i=vert_map.get(v1_hash);
        const v2_i=vert_map.get(v2_hash);
        const v3_i=vert_map.get(v3_hash);


        const tri = [[v1_i,v2_i,v3_i],[]];
        const tri_i = tris.length;
        tris.push(tri);


        verts[v1_i][1].push(tri_i);
        verts[v2_i][1].push(tri_i);
        verts[v3_i][1].push(tri_i);
    }
    verts.forEach((v,vi)=>{
        v[1].sort();
    })
    tris.forEach((tri,tri_index)=>{
        const tri_verts = tri[0];
        //const v1 = verts[tri_verts[0]];
        //const v2 = verts[tri_verts[1]];
        //const v3 = verts[tri_verts[2]];
        for(let vi = 0; vi < 3; vi++){
            const v1 = verts[tri_verts[vi]];
            const v2 = verts[tri_verts[(vi+1)%3]];
            for(let t_li = 0; t_li < 6; t_li ++){
                const t = v1[1][t_li];
                if(v2[1].indexOf(t) != -1 && t!=tri_index){
                    tris[tri_index][1].push(t);
                }
            }
        }
    })
    let end = new Date();
    console.log("neighbor computation done.",end-start,"ms");
    return {
        tris:tris,
        verts:verts
    }
}

var sim;

async function initialize(){
    geometries.set("basic sphere", new THREE.IcosahedronGeometry(1,10));
    materials .set("green matte", new THREE.MeshPhongMaterial({flatShading:true, color:0x00ff00}));
    meshes    .set("test sphere", new THREE.Mesh(geometries.get("basic sphere"),materials.get("green matte")));
    
    lights.set("dirlight", new THREE.DirectionalLight( 0xffffff, 3 ));
	lights.get("dirlight").position.set( 2, 2, 2 );
    lights.set("ambient", new THREE.AmbientLight(0x404040,1));

    let neighborhood = compute_neighbors(geometries.get("basic sphere")); 

    console.log(neighborhood)

    sim = new EulerSim();
    await sim.init(neighborhood.tris.length);

    meshes.forEach((v,k)=>{scene.add(v)});
    lights.forEach(v=>scene.add(v));
}

camera.position.z = 5;

function animate() {

  //cube.rotation.x += 0.01;
  //cube.rotation.y += 0.01;

  renderer.render( scene, camera );

}



initialize();