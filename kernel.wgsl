    struct Params { 
      tri_count: u32,
      attribute_count:u32
    };

    struct CellNeighborhood{
      adjacents: vec<u32,3>,
      groups: vec<u32,3>
    }

    struct CellStatics{
      normal: vec3,
      v1_dir: vec3,
      pad: vec2,
    };

    struct CellDynamics{
      face_flux: vec3,
      pressure: f32,
      velocity: vec2,
      humidity: f32,
      air_temperature: f32,
      ground_temperature: f32,
      ground_water_mass: f32,
      pad: vec2
    };

    @group(0) @binding(0) var<storage, read> neighborhoods : array<CellNeighborhood>;
    @group(0) @binding(1) var<storage, read_write> statics : array<CellStatics>;
    @group(0) @binding(1) var<storage, read_write> attributes_1 : array<CellDynamics>;
    @group(0) @binding(1) var<storage, read_write> attributes_2 : array<CellDynamics>;
    @group(0) @binding(2) var<uniform> params : Params;

    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
      let idx : u32 = gid.x;
      let param_ptr = idx*params.attribute_count;
      let neighborhood_ptr = idx*3;
      outData[idx] = inData[idx] * 2.0;
    }
    