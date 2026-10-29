/* Optional WebGPU marching tetrahedra. WebGL remains the display/export backend. */
(function(){
'use strict';
let initialization,activeGrid,gridBuffer,disabled=false,queue=Promise.resolve();
const shader=`
struct Settings {
 dims: vec4f, origin: vec4f,
 ax: vec4f, ay: vec4f, az: vec4f,
 nx: vec4f, ny: vec4f, nz: vec4f,
 config: vec4f,
}
@group(0) @binding(0) var<uniform> s: Settings;
@group(0) @binding(1) var<storage,read> field: array<f32>;
@group(0) @binding(2) var<storage,read_write> counter: atomic<u32>;
@group(0) @binding(3) var<storage,read_write> output: array<f32>;
const corners=array<vec3f,8>(vec3f(0,0,0),vec3f(1,0,0),vec3f(1,1,0),vec3f(0,1,0),vec3f(0,0,1),vec3f(1,0,1),vec3f(1,1,1),vec3f(0,1,1));
const tets=array<vec4u,6>(vec4u(0,5,1,6),vec4u(0,1,2,6),vec4u(0,2,3,6),vec4u(0,3,7,6),vec4u(0,7,4,6),vec4u(0,4,5,6));
fn at(p:vec3u)->f32 {let d=vec3u(s.dims.xyz);return field[(p.x*d.y+p.y)*d.z+p.z];}
fn sample(p:vec3f)->f32 {
 let d=vec3u(s.dims.xyz);let q=clamp(p,vec3f(0),vec3f(d-vec3u(1)));
 let a=vec3u(floor(q));let b=min(a+vec3u(1),d-vec3u(1));let f=fract(q);
 let lo=mix(mix(at(a),at(vec3u(b.x,a.y,a.z)),f.x),mix(at(vec3u(a.x,b.y,a.z)),at(vec3u(b.x,b.y,a.z)),f.x),f.y);
 let hi=mix(mix(at(vec3u(a.x,a.y,b.z)),at(vec3u(b.x,a.y,b.z)),f.x),mix(at(vec3u(a.x,b.y,b.z)),at(b),f.x),f.y);
 return mix(lo,hi,f.z);
}
fn normal(p:vec3f)->vec3f {
 let h=0.55;
 let g=vec3f(sample(p+vec3f(h,0,0))-sample(p-vec3f(h,0,0)),sample(p+vec3f(0,h,0))-sample(p-vec3f(0,h,0)),sample(p+vec3f(0,0,h))-sample(p-vec3f(0,0,h)));
 let n=(s.nx.xyz*g.x+s.ny.xyz*g.y+s.nz.xyz*g.z)*select(1.0,-1.0,s.config.x>0.0);
 if(dot(n,n)<1e-24){return vec3f(0,0,1);}return normalize(n);
}
fn world(p:vec3f)->vec3f {return s.origin.xyz+s.ax.xyz*p.x+s.ay.xyz*p.y+s.az.xyz*p.z;}
fn edge(a:vec3f,b:vec3f,va:f32,vb:f32)->vec3f {return mix(a,b,clamp((s.config.x-va)/(vb-va),0.0,1.0));}
fn triangle(a:vec3f,b:vec3f,c:vec3f){
 let pa=world(a);var pb=world(b);var pc=world(c);let face=cross(pb-pa,pc-pa);
 if(dot(face,face)<1e-19){return;}
 let start=atomicAdd(&counter,3u);
 if(s.config.y<0.5 || start+3u>u32(s.config.z)){return;}
 let na=normal(a);var nb=normal(b);var nc=normal(c);
 if(dot(face,na+nb+nc)<0.0){let tp=pb;pb=pc;pc=tp;let tn=nb;nb=nc;nc=tn;}
 let positions=array<vec3f,3>(pa,pb,pc);let normals=array<vec3f,3>(na,nb,nc);
 for(var i=0u;i<3u;i++){let k=(start+i)*6u;for(var j=0u;j<3u;j++){output[k+j]=positions[i][j];output[k+3u+j]=normals[i][j];}}
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3u){
 let d=vec3u(s.dims.xyz)-vec3u(1);let index=gid.x+gid.y*16384u;
 if(index>=d.x*d.y*d.z){return;}
 let base=vec3f(f32(index/(d.y*d.z)),f32((index/d.z)%d.y),f32(index%d.z));
 var p:array<vec3f,8>;var v:array<f32,8>;var low=3.402823e38;var high=-3.402823e38;
 for(var i=0u;i<8u;i++){p[i]=base+corners[i];v[i]=at(vec3u(p[i]));low=min(low,v[i]);high=max(high,v[i]);}
 if(s.config.x<=low || s.config.x>=high){return;}
 for(var t=0u;t<6u;t++){
  var above:array<u32,4>;var below:array<u32,4>;var n=0u;var m=0u;
  for(var j=0u;j<4u;j++){let i=tets[t][j];if(v[i]>=s.config.x){above[n]=i;n++;}else{below[m]=i;m++;}}
  if(n==0u || m==0u){continue;}
  if(n==1u || m==1u){
   var a=above[0];var others=below;if(m==1u){a=below[0];others=above;}
   triangle(edge(p[a],p[others[0]],v[a],v[others[0]]),edge(p[a],p[others[1]],v[a],v[others[1]]),edge(p[a],p[others[2]],v[a],v[others[2]]));
  }else{
   let a=above[0];let b=above[1];let c=below[0];let e=below[1];
   let ac=edge(p[a],p[c],v[a],v[c]);let ae=edge(p[a],p[e],v[a],v[e]);let bc=edge(p[b],p[c],v[b],v[c]);let be=edge(p[b],p[e],v[b],v[e]);
   triangle(ac,ae,bc);triangle(ae,be,bc);
  }
 }
}`;
async function initialize(){
 if(disabled||!globalThis.navigator?.gpu)return null;
 if(!initialization)initialization=(async()=>{
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)return null;
  const device=await adapter.requestDevice();
  device.lost.then(()=>{disabled=true;activeGrid=null;gridBuffer?.destroy();gridBuffer=null;});
  try{
   const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:device.createShaderModule({code:shader}),entryPoint:'main'}});
   return {device,pipeline};
  }catch(error){device.destroy();throw error;}
 })().catch(()=>{disabled=true;return null;});
 return initialization;
}
async function extract(g,level,center,normalColumns,isCurrent){
 if(!isCurrent())return null;
 const state=await initialize();if(!state||!isCurrent())return null;
 const {device,pipeline}=state,limit=Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize);
 if(g.data.byteLength>limit)return null;
 const buffers=[];let scope=false;
 const buffer=(size,usage)=>{const b=device.createBuffer({size:Math.max(4,size),usage});buffers.push(b);return b;};
 try{
  device.pushErrorScope('out-of-memory');device.pushErrorScope('validation');scope=true;
  if(activeGrid!==g){gridBuffer?.destroy();activeGrid=null;gridBuffer=device.createBuffer({size:g.data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(gridBuffer,0,g.data);activeGrid=g;}
  const settings=buffer(144,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
  const counter=buffer(4,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST);
  const countRead=buffer(4,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
  let output=buffer(24,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC);
  const values=new Float32Array([...g.dims,0,...g.origin.map((x,i)=>x-center[i]),0,...g.axes.flatMap(a=>[...a,0]),...normalColumns.flatMap(a=>[...a,0]),level,0,0,0]);
  const cells=g.dims.reduce((n,d)=>n*(d-1),1);
  function dispatch(target,size){
   device.queue.writeBuffer(settings,0,values);device.queue.writeBuffer(counter,0,new Uint32Array(1));
   const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[settings,gridBuffer,counter,output].map((b,binding)=>({binding,resource:{buffer:b}}))});
   const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(256,Math.ceil(cells/16384));pass.end();
   encoder.copyBufferToBuffer(size===4?counter:output,0,target,0,size);device.queue.submit([encoder.finish()]);
  }
  dispatch(countRead,4);await countRead.mapAsync(GPUMapMode.READ);const count=new Uint32Array(countRead.getMappedRange())[0];countRead.unmap();
  if(!isCurrent())return null;
  if(!count)return {empty:true};
  const bytes=count*24;if(count>2000000||bytes>limit)return null;
  output.destroy();output=buffer(bytes,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC);
  const read=buffer(bytes,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
  values[33]=1;values[34]=count;dispatch(read,bytes);
  await read.mapAsync(GPUMapMode.READ);
  if(!isCurrent()){read.unmap();return null;}
  const data=new Float32Array(read.getMappedRange()),positions=new Float32Array(count*3),normals=new Float32Array(count*3);
  for(let i=0;i<count;i++){const a=i*3,b=i*6;for(let j=0;j<3;j++){positions[a+j]=data[b+j];normals[a+j]=data[b+3+j];}}
  read.unmap();return {positions,normals};
 }catch(error){disabled=true;console.warn('GPU surface extraction unavailable; using CPU.',error);return null;}
 finally{
  if(scope){const validation=await device.popErrorScope(),memory=await device.popErrorScope();if(validation||memory){disabled=true;buffers.forEach(b=>b.destroy());throw Error((validation||memory).message);}}
  buffers.forEach(b=>b.destroy());
 }
}
window.BeeMolSurfaceGPU={extract(...args){const task=queue.then(()=>extract(...args));queue=task.catch(()=>{});return task;}};
})();
