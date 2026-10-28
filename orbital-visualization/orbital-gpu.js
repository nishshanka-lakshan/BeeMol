/* Optional WebGPU grid evaluator. CPU conventions and validation remain authoritative. */
(function () {
  'use strict';
  let devicePromise;
  async function getDevice() {
    if (!globalThis.navigator?.gpu) return null;
    if (!devicePromise) devicePromise = navigator.gpu.requestAdapter().then(adapter => adapter?.requestDevice()).catch(() => null);
    return devicePromise;
  }
  const shader = `
struct Settings { dims: vec4f, origin: vec4f, step: vec4f }
@group(0) @binding(0) var<uniform> settings: Settings;
@group(0) @binding(1) var<storage, read> shells: array<vec4f>;
@group(0) @binding(2) var<storage, read> primitives: array<vec2f>;
@group(0) @binding(3) var<storage, read> terms: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> output: array<f32>;
fn power(x: f32, n: f32) -> f32 {
 if(n < 0.5) { return 1.0; } if(n < 1.5) { return x; }
 if(n < 2.5) { return x*x; } return x*x*x;
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
 let index = gid.x + gid.y * 16384u;
 let dims = vec3u(settings.dims.xyz);
 if(index >= dims.x*dims.y*dims.z) { return; }
 let iz=index%dims.z; let iy=(index/dims.z)%dims.y; let ix=index/(dims.y*dims.z);
 let p=settings.origin.xyz+vec3f(f32(ix),f32(iy),f32(iz))*settings.step.xyz;
 var total=0.0;
 for(var s=0u; s<u32(settings.dims.w); s++) {
  let a=shells[2u*s]; let b=shells[2u*s+1u]; let d=p-a.xyz;
  let r2=dot(d,d); var radial=0.0;
  for(var k=0u;k<u32(b.x);k++) {let primitive=primitives[u32(a.w)+k];let t=primitive.x*r2;if(t<48.0){radial+=primitive.y*exp(-t);}}
  if(abs(radial)<1e-18){continue;}
  var angular=0.0;
  for(var k=0u;k<u32(b.z);k++){let term=terms[u32(b.y)+k];angular+=term.w*power(d.x,term.x)*power(d.y,term.y)*power(d.z,term.z);}
  total+=radial*angular;
 }
 output[index]=total;
}`;
  // Polynomial terms for the same normalized real spherical harmonics as the CPU.
  function pack(model, mo, A) {
    const shells=[], primitives=[], terms=[];
    for (const shell of model.shells) {
      const c=mo.coeff, o=shell.offset;
      const start=terms.length/4;
      const term=(x,y,z,value)=>{if(value)terms.push(x,y,z,value);};
      if(shell.l===0) term(0,0,0,A.s*c[o]);
      else if(shell.l===1) {term(1,0,0,A.p*c[o]);term(0,1,0,A.p*c[o+1]);term(0,0,1,A.p*c[o+2]);}
      else if(shell.l===2) {
        term(0,0,2,2*A.d0*c[o]);term(2,0,0,-A.d0*c[o]+A.d2*c[o+3]);term(0,2,0,-A.d0*c[o]-A.d2*c[o+3]);
        term(1,0,1,A.d1*c[o+1]);term(0,1,1,A.d1*c[o+2]);term(1,1,0,A.d1*c[o+4]);
      } else if(shell.l===3) {
        term(0,0,3,2*A.f0*c[o]);term(2,0,1,-3*A.f0*c[o]+A.f2*c[o+3]);term(0,2,1,-3*A.f0*c[o]-A.f2*c[o+3]);
        term(1,0,2,4*A.f1*c[o+1]);term(3,0,0,-A.f1*c[o+1]+A.f3*c[o+5]);term(1,2,0,-A.f1*c[o+1]-3*A.f3*c[o+5]);
        term(0,1,2,4*A.f1*c[o+2]);term(2,1,0,-A.f1*c[o+2]+3*A.f3*c[o+6]);term(0,3,0,-A.f1*c[o+2]-A.f3*c[o+6]);term(1,1,1,A.f2m*c[o+4]);
      } else throw Error('Unsupported GPU shell');
      shells.push(shell.atom.x,shell.atom.y,shell.atom.z,primitives.length/2,shell.primitives.length,start,terms.length/4-start,0);
      for(const p of shell.primitives) primitives.push(p.a,p.c);
    }
    return {shells:new Float32Array(shells),primitives:new Float32Array(primitives),terms:new Float32Array(terms.length?terms:[0,0,0,0])};
  }
  async function evaluate(model, mo, dims, min, steps, A) {
    const device=await getDevice(); if(!device) return null;
    const count=dims.reduce((a,b)=>a*b,1),bytes=count*4;
    if(bytes>device.limits.maxStorageBufferBindingSize || bytes>device.limits.maxBufferSize) return null;
    const buffers=[];
    function buffer(data,usage){const b=device.createBuffer({size:Math.max(4,data.byteLength),usage:usage|GPUBufferUsage.COPY_DST});buffers.push(b);device.queue.writeBuffer(b,0,data);return b;}
    device.pushErrorScope('validation');
    try {
      const packed=pack(model,mo,A);
      const settings=buffer(new Float32Array([...dims,model.shells.length,...min,0,...steps,0]),GPUBufferUsage.UNIFORM);
      const inputs=[settings,...[packed.shells,packed.primitives,packed.terms].map(data=>buffer(data,GPUBufferUsage.STORAGE))];
      const output=device.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});buffers.push(output);
      const read=device.createBuffer({size:bytes,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});buffers.push(read);
      const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:device.createShaderModule({code:shader}),entryPoint:'main'}});
      const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[...inputs,output].map((b,binding)=>({binding,resource:{buffer:b}}))});
      const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(256,Math.ceil(count/16384));pass.end();encoder.copyBufferToBuffer(output,0,read,0,bytes);device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);const result=new Float32Array(read.getMappedRange().slice(0));read.unmap();return result;
    } finally {
      const error=await device.popErrorScope();
      buffers.forEach(b=>b.destroy());
      if(error) throw Error(error.message);
    }
  }
  window.BeeMolOrbitalGPU={evaluate,pack};
})();
