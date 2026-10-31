/* BeeMol Three.js orbital surface renderer. Independent of 3Dmol's molecule editor. */

(function(){

'use strict';

let THREE, scene, camera, renderer, group, holder, running=false, bg=document.documentElement.dataset.theme==='light'?'#ffffff':'#070d17';

let drag=null, rotation={x:0,y:0}, zoom=1, baseExtent=8, lastCube=null, currentGrid=null;

let sliceViewRotation='';
let slicePlaneSpec=null,slicePlaneMesh=null,slicePlaneOutline=null,moleculeCenter=[0,0,0];
function updateSlicePlane(spec){
 slicePlaneSpec=spec;
 for(const object of [slicePlaneMesh,slicePlaneOutline]){
  if(!object)continue;group?.remove(object);object.geometry.dispose();object.material.dispose();
 }
 slicePlaneMesh=slicePlaneOutline=null;
 if(!spec||!THREE||!group||!currentGrid){draw();return}
 const {u,v,normal,position,min,max}=spec;
 const points=[[min[u],min[v]],[max[u],min[v]],[max[u],max[v]],[min[u],max[v]]].map(([a,b])=>{
  const p=[0,0,0];p[u]=a;p[v]=b;p[normal]=position;
  return spec.viewSpace
   ? new THREE.Vector3(...p).applyQuaternion(group.quaternion.clone().invert())
   : new THREE.Vector3(...p.map((value,k)=>value-moleculeCenter[k]));
 });
 const geometry=new THREE.BufferGeometry().setFromPoints(points);
 geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
 slicePlaneMesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x36a9c9,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}));
 slicePlaneOutline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x1684a6,transparent:true,opacity:.9,depthWrite:false}));
 slicePlaneMesh.renderOrder=2;slicePlaneOutline.renderOrder=3;
 group.add(slicePlaneMesh,slicePlaneOutline);draw();
}

const ANG=0.529177210903;

const el=()=>document.getElementById('orbitalViewer');

const promise=import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js').then(m=>{THREE=m;init();return true;}).catch(err=>{console.error('Three.js loading failed',err);return false;});

function init(){

 holder=el(); if(!holder)return;

 renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});

 // Supersample standard displays as well as Retina displays for crisp atom edges.
 renderer.setPixelRatio(2); renderer.setClearColor(bg);

 renderer.outputColorSpace=THREE.SRGBColorSpace;

 renderer.domElement.style.width='100%'; renderer.domElement.style.height='100%'; renderer.domElement.style.display='block';

 // Preserve overlays created while the Three.js module was loading.
 const overlay = document.getElementById('orbitalSliceInset');
 holder.replaceChildren(renderer.domElement);
 if (overlay) holder.append(overlay);

 scene=new THREE.Scene();

 camera=new THREE.PerspectiveCamera(42,1,0.05,2000);

 scene.add(new THREE.HemisphereLight(0xffffff,0x9298a3,2.1));

 let key=new THREE.DirectionalLight(0xffffff,2.0);key.position.set(4,7,11);scene.add(key);

 let fill=new THREE.DirectionalLight(0xffffff,0.65);fill.position.set(-8,-3,5);scene.add(fill);

 group=new THREE.Group();scene.add(group);

 holder.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};holder.setPointerCapture(e.pointerId)});

 holder.addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.x)*0.007,dy=(e.clientY-drag.y)*0.007;drag={x:e.clientX,y:e.clientY};group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx));group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy));draw()});

 holder.addEventListener('pointerup',()=>drag=null);

 holder.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.15,Math.min(6,zoom*Math.exp(-e.deltaY*.001)));fitCamera();},{passive:false});

 window.addEventListener('resize',resize);
 // Workspace panels can resize without a window resize; keep the drawing buffer in sync.
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(holder);

 running=true;resize();

}

function resize(){if(!renderer||!holder)return;let w=Math.max(1,holder.clientWidth||600),h=Math.max(1,holder.clientHeight||500);renderer.setSize(w,h,false);renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';camera.aspect=w/h;camera.updateProjectionMatrix();fitCamera()}

function draw(){
 if(renderer&&scene&&camera)renderer.render(scene,camera);
 if(group){
  const orientation=group.quaternion.toArray().join(',');
  if(orientation!==sliceViewRotation){sliceViewRotation=orientation;document.dispatchEvent(new Event('orbitalviewchange'));}
 }
}
function getSliceTransform(){
 if(!THREE||!group)return null;
 const matrix=new THREE.Matrix4().makeRotationFromQuaternion(group.quaternion).elements;
 return {rotation:[0,1,2].map(i=>[matrix[i],matrix[i+4],matrix[i+8]]),center:[...moleculeCenter]};
}

async function exportFigure(){
 if(!renderer||!lastCube)throw Error('Load an orbital before downloading a figure.');
 if(lastCube.options.preview)await show(lastCube.text,{...lastCube.options,preview:false,preserveView:true});
 let output;
 try{
  output=new THREE.WebGLRenderer({antialias:true,alpha:false});
  output.outputColorSpace=renderer.outputColorSpace;
  output.setClearColor(bg);
  const gl=output.getContext(),viewport=gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const limit=Math.min(6000,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),viewport[0],viewport[1]);
  const aspect=camera.aspect;
  const width=Math.max(1,Math.round(aspect>=1?limit:limit*aspect));
  const height=Math.max(1,Math.round(aspect>=1?limit/aspect:limit));
  output.setPixelRatio(1);
  output.setSize(width,height,false);
  const exportCamera=camera.clone();
  exportCamera.aspect=width/height;
  exportCamera.updateProjectionMatrix();
  output.render(scene,exportCamera);
  const blob=await new Promise((resolve,reject)=>output.domElement.toBlob(
   value=>value?resolve(value):reject(Error('Could not encode the figure as PNG.')),'image/png'));
  return {blob,width,height};
 }finally{
  if(output){output.dispose();output.forceContextLoss()}
 }
}

// Render movies independently of the on-screen canvas size.
function createMovieOutput(height=1080){
 if(!renderer||!lastCube)throw Error('Load an orbital before recording a movie.');
 let output;
 try{
  output=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  output.outputColorSpace=renderer.outputColorSpace;output.setClearColor(bg);output.setPixelRatio(1);
  const width=height===2160?3840:1920;
  const gl=output.getContext(),viewport=gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  if(width>Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),viewport[0])||height>Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),viewport[1]))throw Error('This device cannot render that movie resolution. Choose 1080p.');
  output.setSize(width,height,false);
  const movieCamera=camera.clone(),originalAspect=camera.aspect;
  movieCamera.aspect=width/height;
  // Expand the frame when necessary so the current view is never cropped.
  if(movieCamera.aspect<originalAspect)movieCamera.fov=2*Math.atan(Math.tan(camera.fov*Math.PI/360)*originalAspect/movieCamera.aspect)*180/Math.PI;
  movieCamera.updateProjectionMatrix();
  return {canvas:output.domElement,width,height,render(){output.render(scene,movieCamera)},dispose(){output.dispose();output.forceContextLoss()}};
 }catch(error){if(output){output.dispose();output.forceContextLoss()}throw error}
}

function fitCamera(){if(!camera)return;const fov=camera.fov*Math.PI/180;const aspect=Math.max(0.1,camera.aspect||1);const distance=Math.max(2,(baseExtent/2)/Math.tan(fov/2)/Math.min(1,aspect)*1.35/zoom);camera.position.set(0,0,distance);camera.lookAt(0,0,0);camera.near=Math.max(.001,distance/10000);camera.far=Math.max(100,distance+baseExtent*20);camera.updateProjectionMatrix();draw()}

function clear(){if(!group)return;for(const child of [...group.children]){group.remove(child);child.geometry?.dispose();if(child.material){if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());else {child.material.map?.dispose();child.material.dispose()}}}}

const nums=s=>s.trim().split(/\s+/).map(x=>Number(x.replace(/[dD]/g,'E')));

function parseCube(text){
 // Read only the header line by line; do not split large scalar grids into
 // millions of temporary strings and boxed numbers.
 let cursor=0;
 function line(){if(cursor>=text.length)throw Error('Incomplete CUBE header');const end=text.indexOf('\n',cursor);const row=text.slice(cursor,end<0?text.length:end);cursor=end<0?text.length:end+1;return row;}
 line();line();
 const hdr=nums(line()),count=Math.abs(hdr[0]);let origin=hdr.slice(1,4);
 if(!Number.isSafeInteger(count)||count<1||origin.length!==3||!origin.every(Number.isFinite))throw Error('Invalid CUBE header');
 const dims=[],axes=[];let angGrid=false;
 for(let i=0;i<3;i++){const row=nums(line());dims.push(Math.abs(row[0]));axes.push(row.slice(1,4));if(row[0]<0)angGrid=true;}
 if(dims.some(x=>!Number.isSafeInteger(x)||x<2)||axes.some(a=>a.length!==3||!a.every(Number.isFinite)))throw Error('CUBE dimensions invalid');
 const n=dims.reduce((a,b)=>a*b,1);
 if(!Number.isSafeInteger(n)||n>64000000)throw Error('CUBE grid exceeds the supported total of 64 million points. Export a coarser grid.');
 const factor=angGrid?1:ANG;origin=origin.map(v=>v*factor);
 const atoms=[];
 for(let i=0;i<count;i++){const a=nums(line());if(a.length<5||!a.every(Number.isFinite))throw Error('Invalid CUBE atom row');atoms.push({z:Math.round(a[0]),pos:a.slice(2,5).map(v=>v*factor)});}
 if(hdr[0]<0){const orbitals=nums(line());if(orbitals[0]!==1)throw Error('Multi-orbital CUBE files are not supported. Export one orbital per file.');if(orbitals.length<2)line();}
 if(hdr.length>4 && hdr[4]!==1)throw Error('Multi-value CUBE files are not supported. Export one field per file.');
 const data=new Float32Array(n),tokens=/\S+/g;tokens.lastIndex=cursor;
 for(let i=0;i<n;i++){
  const token=tokens.exec(text);if(!token)throw Error(`CUBE has ${i} values but requires ${n}`);
  const value=Number(token[0].replace(/[dD]/g,'E'));
  if(!Number.isFinite(value)||!Number.isFinite(Math.fround(value)))throw Error(`Invalid CUBE scalar at point ${i+1}`);
  data[i]=value;
 }
 return {dims,origin,axes:axes.map(a=>a.map(v=>v*factor)),atoms,data};
}

async function parseCubeAsync(text){
 if(typeof Worker==='undefined')return parseCube(text);
 const source=`const ANG=${ANG};const nums=${nums.toString()};${parseCube.toString()}
 self.onmessage=event=>{try{const grid=parseCube(event.data);self.postMessage({grid},[grid.data.buffer]);}catch(error){self.postMessage({error:error.message});}};`;
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 let worker;
 try{
  worker=new Worker(url);
  return await new Promise((resolve,reject)=>{
   worker.onmessage=event=>event.data.error?reject(Error(event.data.error)):resolve(event.data.grid);
   worker.onerror=()=>reject(Error('CUBE parsing worker failed.'));
   worker.postMessage(text);
  });
 }finally{worker?.terminate();URL.revokeObjectURL(url);}
}

function p3(grid,x,y,z){let a=grid.axes,o=grid.origin;return [o[0]+x*a[0][0]+y*a[1][0]+z*a[2][0],o[1]+x*a[0][1]+y*a[1][1]+z*a[2][1],o[2]+x*a[0][2]+y*a[1][2]+z*a[2][2]]}

function idx(g,x,y,z){return (x*g.dims[1]+y)*g.dims[2]+z}

function autoIso(g,f=.85){let max=0,total=0,bins=new Float64Array(512);const stride=Math.max(1,Math.ceil(g.data.length/600000));for(let i=0;i<g.data.length;i+=stride){let x=g.data[i];if(!Number.isFinite(x))continue;max=Math.max(max,Math.abs(x));total+=x*x}if(!max||!total)return .02;for(let i=0;i<g.data.length;i+=stride){let x=g.data[i],j=Math.min(511,Math.floor(Math.abs(x)/max*512));if(Number.isFinite(x))bins[j]+=x*x}let sum=0;for(let i=511;i>=0;i--){sum+=bins[i];if(sum>=total*f)return Math.max(max/512,(i+.5)*max/512)}return .02}

const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];

const TETS=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];

// Crack-free tetrahedron topology and continuous scalar-gradient normals.

// A tetrahedron with 2 positive / 2 negative vertices creates a quad;

// intersecting edges in arbitrary order previously made its triangles overlap

// or leave holes. Use the actual inside/outside vertex groups instead.

function sampleGrid(g,x,y,z){

 const [nx,ny,nz]=g.dims;

 x=Math.max(0,Math.min(nx-1,x));y=Math.max(0,Math.min(ny-1,y));z=Math.max(0,Math.min(nz-1,z));

 const x0=Math.floor(x),y0=Math.floor(y),z0=Math.floor(z);

 const x1=Math.min(nx-1,x0+1),y1=Math.min(ny-1,y0+1),z1=Math.min(nz-1,z0+1);

 const fx=x-x0,fy=y-y0,fz=z-z0;

 const v=(i,j,k)=>g.data[idx(g,i,j,k)];

 const a=v(x0,y0,z0)*(1-fx)+v(x1,y0,z0)*fx;

 const b=v(x0,y1,z0)*(1-fx)+v(x1,y1,z0)*fx;

 const c=v(x0,y0,z1)*(1-fx)+v(x1,y0,z1)*fx;

 const d=v(x0,y1,z1)*(1-fx)+v(x1,y1,z1)*fx;

 return ((a*(1-fy)+b*fy)*(1-fz)+(c*(1-fy)+d*fy)*fz);

}

// Exact block bounds: skip cells only when no corner can cross the level.
async function surfaceBlocks(g){
 if(g.blockIndex)return g.blockIndex;
 if(g.blockPromise)return g.blockPromise;
 g.blockPromise=(async()=>{
  const [nx,ny,nz]=g.dims,size=8,blocks=[];
  for(let x=0;x<nx-1;x+=size){
   await new Promise(resolve=>setTimeout(resolve,0));
   for(let y=0;y<ny-1;y+=size)for(let z=0;z<nz-1;z+=size){
    const endX=Math.min(nx-1,x+size),endY=Math.min(ny-1,y+size),endZ=Math.min(nz-1,z+size);
    let low=Infinity,high=-Infinity;
    for(let i=x;i<=endX;i++)for(let j=y;j<=endY;j++)for(let k=z;k<=endZ;k++){
     const value=g.data[(i*ny+j)*nz+k];low=Math.min(low,value);high=Math.max(high,value);
    }
    blocks.push(x,y,z,endX,endY,endZ,low,high);
   }
  }
  g.blockIndex=new Float64Array(blocks);return g.blockIndex;
 })();
 return g.blockPromise;
}

async function mesh(g,level,offset,isCurrent=()=>true){

 const [nx,ny,nz]=g.dims;

 const verts=[], normals=[],maxValues=6000000;

 const blocks=await surfaceBlocks(g);
 if(!isCurrent())return null;

 const matrix=new THREE.Matrix3().set(

  g.axes[0][0],g.axes[1][0],g.axes[2][0],

  g.axes[0][1],g.axes[1][1],g.axes[2][1],

  g.axes[0][2],g.axes[1][2],g.axes[2][2]

 );

 if(Math.abs(matrix.determinant())<1e-14)throw Error('Invalid CUBE grid axes');

 const normalMatrix=matrix.clone().invert().transpose();

 const outwardSign=level>0?-1:1;

 const gradient=(q)=>{

  const h=.55;

  let vec=new THREE.Vector3(

   sampleGrid(g,q[0]+h,q[1],q[2])-sampleGrid(g,q[0]-h,q[1],q[2]),

   sampleGrid(g,q[0],q[1]+h,q[2])-sampleGrid(g,q[0],q[1]-h,q[2]),

   sampleGrid(g,q[0],q[1],q[2]+h)-sampleGrid(g,q[0],q[1],q[2]-h)

  ).applyMatrix3(normalMatrix).multiplyScalar(outwardSign);

  if(vec.lengthSq()<1e-24)return new THREE.Vector3(0,0,1);

  return vec.normalize();

 };

 const points=new Array(8), values=new Array(8);

 const cross=(i,j)=>{

  const vi=values[i],vj=values[j];

  const t=Math.max(0,Math.min(1,(level-vi)/(vj-vi)));

  const a=points[i],b=points[j];

  return [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])];

 };

 function triangle(a,b,c){

  const na=gradient(a),nb=gradient(b),nc=gradient(c);

  const pa=p3(g,...a); let pb=p3(g,...b),pc=p3(g,...c);

  const A=new THREE.Vector3(...pa),B=new THREE.Vector3(...pb),C=new THREE.Vector3(...pc);

  const face=B.clone().sub(A).cross(C.clone().sub(A));

  if(face.lengthSq()<1e-19)return;

  const avg=na.clone().add(nb).add(nc);

  if(face.dot(avg)<0){[b,c]=[c,b];[pb,pc]=[pc,pb];}

  const nn=[na,gradient(b),gradient(c)];

  for(const [i,pos] of [pa,pb,pc].entries()){

   verts.push(pos[0]-offset[0],pos[1]-offset[1],pos[2]-offset[2]);

   normals.push(nn[i].x,nn[i].y,nn[i].z);

  }

 }

 for(let block=0;block<blocks.length;block+=8){
  if(block%1024===0){await new Promise(resolve=>setTimeout(resolve,0));if(!isCurrent())return null;}
  if(level<=blocks[block+6]||level>=blocks[block+7])continue;
  for(let x=blocks[block];x<blocks[block+3];x++)for(let y=blocks[block+1];y<blocks[block+4];y++)for(let z=blocks[block+2];z<blocks[block+5];z++){

  let low=Infinity,high=-Infinity;

  for(let c=0;c<8;c++){

   const q=CORNERS[c],gx=x+q[0],gy=y+q[1],gz=z+q[2];

   const val=g.data[idx(g,gx,gy,gz)];values[c]=val;

   points[c]=[gx,gy,gz];low=Math.min(low,val);high=Math.max(high,val);

  }

  if(level<=low||level>=high)continue;

  for(const tet of TETS){

   const above=[],below=[];

   for(const i of tet)(values[i]>=level?above:below).push(i);

   if(!above.length||!below.length)continue;

   if(above.length===1||below.length===1){

    const single=above.length===1?above[0]:below[0];

    const others=above.length===1?below:above;

    triangle(cross(single,others[0]),cross(single,others[1]),cross(single,others[2]));

   }else{

    const a=above[0],b=above[1],c=below[0],d=below[1];

    const ac=cross(a,c),ad=cross(a,d),bc=cross(b,c),bd=cross(b,d);

    triangle(ac,ad,bc);

    triangle(ad,bd,bc);

   }

  }

  if(verts.length>maxValues)throw Error('Surface too complex. Try a slightly larger isovalue or a smaller grid.');

 }

 }

 if(!verts.length)return null;

 const geometry=new THREE.BufferGeometry();

 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));

 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));

 geometry.computeBoundingSphere();

 return geometry;

}

// Surface extraction runs in a worker; retain its grid across isovalue changes.
let surfaceWorker=null, workerGrid=null, surfaceJob=0, showVersion=0;
const surfacePending=new Map();
function getSurfaceWorker(){
 if(surfaceWorker)return surfaceWorker;
 const source=`import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
 const CORNERS=${JSON.stringify(CORNERS)},TETS=${JSON.stringify(TETS)};
 ${p3.toString()}
${idx.toString()}
${sampleGrid.toString()}
${surfaceBlocks.toString()}
${mesh.toString()}
 let grid,latestVersion=0;
 self.onmessage=async event=>{const {id,level,offset,version}=event.data;if(event.data.grid){grid=event.data.grid;return;}
 latestVersion=Math.max(latestVersion,version);
 try{const geometry=await mesh(grid,level,offset,()=>version===latestVersion);if(!geometry){self.postMessage({id,empty:true});return;}
 const positions=geometry.attributes.position.array,normals=geometry.attributes.normal.array;
 self.postMessage({id,positions,normals},[positions.buffer,normals.buffer]);geometry.dispose();
 }catch(error){self.postMessage({id,error:error.message});}};`;
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 try{surfaceWorker=new Worker(url,{type:'module'});}finally{URL.revokeObjectURL(url);}
 surfaceWorker.onmessage=event=>{const pending=surfacePending.get(event.data.id);if(!pending)return;surfacePending.delete(event.data.id);event.data.error?pending.reject(Error(event.data.error)):pending.resolve(event.data);};
 surfaceWorker.onerror=()=>{for(const p of surfacePending.values())p.reject(Error('Surface worker unavailable'));surfacePending.clear();surfaceWorker?.terminate();surfaceWorker=null;workerGrid=null;};
 return surfaceWorker;
}
const surfaceCache=new WeakMap(),previewGrids=new WeakMap(),surfaceDetailHints=new WeakMap();
function previewGrid(g,limit=48){
 if(Math.max(...g.dims)<=limit)return g;
 let grids=previewGrids.get(g);if(!grids){grids=new Map();previewGrids.set(g,grids);}
 if(grids.has(limit))return grids.get(limit);
 const dims=g.dims.map(d=>Math.max(2,Math.min(limit,d)));
 const steps=dims.map((d,i)=>(g.dims[i]-1)/(d-1));
 const data=new Float32Array(dims.reduce((a,b)=>a*b,1));
 let i=0;for(let x=0;x<dims[0];x++)for(let y=0;y<dims[1];y++)for(let z=0;z<dims[2];z++)data[i++]=sampleGrid(g,x*steps[0],y*steps[1],z*steps[2]);
 const result={...g,dims,data,axes:g.axes.map((a,i)=>a.map(v=>v*steps[i])),blockIndex:null,blockPromise:null};
 grids.set(limit,result);while(grids.size>4)grids.delete(grids.keys().next().value);return result;
}
function surfaceBackend(name){const el=document.getElementById('orbitalSurfaceBackend');if(el)el.textContent=name;}

async function surfaceGeometry(g,level,center,version){
 let cache=surfaceCache.get(g);if(!cache){cache=new Map();surfaceCache.set(g,cache);}
 const key=String(level);
 if(cache.has(key)){const saved=cache.get(key);if(saved?.userData.surfaceBackend)surfaceBackend(saved.userData.surfaceBackend);return saved?.clone()||null;}
 let result;
 if(window.BeeMolSurfaceGPU){
  const matrix=new THREE.Matrix3().set(...[0,1,2].flatMap(i=>g.axes.map(a=>a[i])));
  if(Math.abs(matrix.determinant())<1e-14)throw Error('Invalid CUBE grid axes');
  const e=matrix.invert().transpose().elements;
  try{result=await window.BeeMolSurfaceGPU.extract(g,level,center,[e.slice(0,3),e.slice(3,6),e.slice(6,9)],()=>version===showVersion);}catch(error){console.warn('Using CPU surfaces.',error);}
  if(version!==showVersion)return null;
  if(result)surfaceBackend('WebGPU surface calculation');
 }
 if(!result){
 surfaceBackend('CPU surface calculation');
 if(typeof Worker==='undefined')return mesh(g,level,center,()=>version===showVersion);
 try{
  const worker=getSurfaceWorker();
  if(workerGrid!==g){worker.postMessage({grid:{dims:g.dims,origin:g.origin,axes:g.axes,atoms:g.atoms,data:g.data}});workerGrid=g;}
  const id=++surfaceJob;
  result=await new Promise((resolve,reject)=>{surfacePending.set(id,{resolve,reject});worker.postMessage({id,level,offset:center,version});});
 }catch(error){if(error.message.startsWith('Surface too complex'))throw error;return mesh(g,level,center,()=>version===showVersion);}
 }
 if(version!==showVersion)return null;
 if(result.empty){cache.set(key,null);while(cache.size>4){const oldest=cache.keys().next().value;cache.get(oldest)?.dispose();cache.delete(oldest);}return null;}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(result.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(result.normals,3));geometry.computeBoundingSphere();
 geometry.userData.surfaceBackend=document.getElementById('orbitalSurfaceBackend')?.textContent.split(' · surface detail')[0];
 cache.set(key,geometry.clone());
 while(cache.size>4){const oldest=cache.keys().next().value;cache.get(oldest)?.dispose();cache.delete(oldest);}
 return geometry;
}

let atomColorFramePending=false;
document.addEventListener('atomcolorschange',()=>{
 if(atomColorFramePending)return;
 atomColorFramePending=true;
 requestAnimationFrame(()=>{
 atomColorFramePending=false;
 if(!group)return;
 for(const mesh of group.children)if(mesh.userData.atomElement)mesh.material.color.set(window.BeeMolAtomColors.get(mesh.userData.atomElement));
 draw();
 });
});

// Camera-facing element labels, including ghost centers.
function updateAtomLabels(){
 if(!group||!THREE)return;
 for(const object of [...group.children])if(object.userData.atomLabel){
  group.remove(object);object.material.map.dispose();object.material.dispose();
 }
 if(!currentGrid||!document.getElementById('orbitalAtomLabels')?.checked||document.getElementById('showOrbitalAtoms')?.checked===false){draw();return}
 currentGrid.atoms.forEach(atom=>{
  const symbol=atom.z===0?'Ghost':window.BeeMolAtomColors.symbol(atom.z);
  const text=symbol;
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('2d');
  context.font='bold 32px sans-serif';
  canvas.width=Math.ceil(context.measureText(text).width)+24;canvas.height=56;
  context.font='bold 32px sans-serif';context.textAlign='center';context.textBaseline='middle';
  context.fillStyle='rgba(15,23,42,0.8)';context.fillRect(0,0,canvas.width,canvas.height);
  context.fillStyle='#ffffff';context.fillText(text,canvas.width/2,canvas.height/2);
  const texture=new THREE.CanvasTexture(canvas);
  const material=new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false});
  const sprite=new THREE.Sprite(material);sprite.userData.atomLabel=true;
  sprite.position.set(...atom.pos.map((value,k)=>value-moleculeCenter[k]));sprite.position.y+=.55;
  sprite.scale.set(canvas.width/canvas.height*.45,.45,1);sprite.renderOrder=20;group.add(sprite);
 });
 draw();
}
document.addEventListener('change',event=>{if(event.target.id==='orbitalAtomLabels')updateAtomLabels()});
document.addEventListener('change',event=>{
 if(event.target.id!=='orbitalAtomShine'||!group)return;
 for(const mesh of group.children)if(mesh.userData.atomElement){
  mesh.material.shininess=event.target.checked?65:0;
  mesh.material.specular.setHex(event.target.checked?0x555555:0x000000);
 }
 draw();
});

function drawAtoms(g,center){const show=document.getElementById('showOrbitalAtoms')?.checked!==false;if(!show)return;const sphere=new THREE.SphereGeometry(1,g.atoms.length>300?24:48,g.atoms.length>300?16:32);const positions=[];

 for(const a of g.atoms){const r=window.BeeMolBonding.displayRadius(window.BeeMolAtomColors.symbol(a.z));const mat=new THREE.MeshPhongMaterial({color:window.BeeMolAtomColors.get(window.BeeMolAtomColors.symbol(a.z)),shininess:document.getElementById('orbitalAtomShine')?.checked?65:0,specular:document.getElementById('orbitalAtomShine')?.checked?0x555555:0x000000});const m=new THREE.Mesh(sphere,mat);m.position.set(...a.pos.map((v,i)=>v-center[i]));m.scale.setScalar(r);m.userData.atomElement=window.BeeMolAtomColors.symbol(a.z);group.add(m);positions.push(m.position)}

 const bondmat=new THREE.MeshPhongMaterial({color:'#adb4c1',shininess:45,specular:0x444444});

 const atoms=g.atoms.map(a=>({elem:window.BeeMolAtomColors.symbol(a.z),x:a.pos[0],y:a.pos[1],z:a.pos[2]}));
 const inferred=window.BeeMolBonding.infer(atoms,document.getElementById('orbitalBondCutoff')?.value);
 for(const edge of inferred)for(const lane of window.BeeMolBonding.lanes(atoms,edge,inferred,.20)){
  const a=new THREE.Vector3(lane.start.x-center[0],lane.start.y-center[1],lane.start.z-center[2]);
  const b=new THREE.Vector3(lane.end.x-center[0],lane.end.y-center[1],lane.end.z-center[2]);
  const radius=edge.order>1?.065:.095;
  const cyl=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,a.distanceTo(b),24),bondmat);
  cyl.position.copy(a).add(b).multiplyScalar(.5);cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());group.add(cyl);
 }

}

async function show(text,options={}){if(!THREE){if(!await promise)throw Error('Cannot load Three.js. Check network connection.');}const version=++showVersion;const reuse=lastCube?.text===text&&currentGrid;const g=reuse||await parseCubeAsync(text);if(version!==showVersion)return;currentGrid=g;lastCube={text,options};if(!reuse)document.dispatchEvent(new Event('orbitalgridchange'));// Center on the molecular geometry, not the sometimes asymmetric CUBE bounding box.

let center;

if(g.atoms.length){

 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];

 for(const a of g.atoms)for(let k=0;k<3;k++){min[k]=Math.min(min[k],a.pos[k]);max[k]=Math.max(max[k],a.pos[k]);}

 center=min.map((v,k)=>(v+max[k])/2);

}else center=p3(g,(g.dims[0]-1)/2,(g.dims[1]-1)/2,(g.dims[2]-1)/2);

let level=options.auto?autoIso(g):Math.abs(options.iso||.02);if(document.getElementById('orbitalCutoff')&&options.auto)document.getElementById('orbitalCutoff').value=level.toFixed(5);

// Retry both phases at the same detail; retain the scientific grid and threshold.
let hints=surfaceDetailHints.get(g);if(!hints){hints=new Map();surfaceDetailHints.set(g,hints);}
let limit=options.preview?48:(hints.get(level)||Math.max(...g.dims));
let surfaces,surfaceGrid;
while(true){
 surfaceGrid=previewGrid(g,limit);
 const results=await Promise.allSettled([surfaceGeometry(surfaceGrid,level,center,version),surfaceGeometry(surfaceGrid,-level,center,version)]);
 const failure=results.find(result=>result.status==='rejected');
 if(version!==showVersion||failure){
  results.forEach(result=>{if(result.status==='fulfilled')result.value?.dispose();});
  if(version!==showVersion)return level;
  const fatal=results.find(result=>result.status==='rejected'&&!result.reason.message?.startsWith('Surface too complex'));
  if(fatal)throw fatal.reason;
  if(limit<=12)throw failure.reason;
  limit=Math.max(12,Math.floor(Math.min(limit,Math.max(...g.dims))*.7));
  continue;
 }
 surfaces=results.map(result=>result.value);break;
}
if(!options.preview){hints.set(level,limit);while(hints.size>4)hints.delete(hints.keys().next().value);}
if(surfaceGrid!==g&&!options.preview){
 const status=document.getElementById('orbitalSurfaceBackend');
 if(status)status.textContent=`${status.textContent.split(' · surface detail')[0]} · surface detail ${surfaceGrid.dims.join(' × ')} (reduced for complexity; isovalue unchanged)`;
}
if(version!==showVersion){surfaces.forEach(geometry=>geometry?.dispose());return level;}
clear();
slicePlaneMesh=slicePlaneOutline=null;moleculeCenter=center;
for(const [index,[sign,color]] of [[1,options.positive||'#ffbf00'],[-1,options.negative||'#1555ed']].entries()){const geometry=surfaces[index];if(!geometry)continue;const mat=new THREE.MeshPhongMaterial({color,side:THREE.DoubleSide,transparent:(options.opacity??1)<1,opacity:options.opacity??1,shininess:Math.round((options.gloss??15)*1.2),specular:0x999999,emissive:color,emissiveIntensity:0.25*(1-Math.max(0,Math.min(100,options.depth||0))/100)});const object=new THREE.Mesh(geometry,mat);group.add(object)}if(options.showAtoms!==false)drawAtoms(g,center);
updateAtomLabels();

// Fit only visible orbitals and atoms, not the full padded CUBE grid.

// Keep camera framing fixed when switching orbitals
if (!window.beeMolViewInitialized || !options.preserveView) {

    const bounds = new THREE.Box3().setFromObject(group);

    if (!bounds.isEmpty()) {
        const size = bounds.getSize(new THREE.Vector3());
        baseExtent = Math.max(2.5, size.x, size.y, size.z);
    } else {
        baseExtent = 8;
    }

    window.beeMolViewInitialized = true;
}

if (!options.preserveView) {
    rotation = {x:0,y:0};
    group.quaternion.identity();
    zoom = 1;
}

updateSlicePlane(slicePlaneSpec);
resize();
document.getElementById("viewerStack").dataset.orbitalLoaded="true";
return level}

// Orient the active Three.js orbital scene without using the 3Dmol.js camera.

function setAxisView(axis){

 if(!group||!THREE)return;

 const orientations={

  '+z':[0,0,0,1], '-z':[0,1,0,0],

  '+x':[0,-Math.SQRT1_2,0,Math.SQRT1_2],

  '-x':[0,Math.SQRT1_2,0,Math.SQRT1_2],

  '+y':[Math.SQRT1_2,0,0,Math.SQRT1_2],

  '-y':[-Math.SQRT1_2,0,0,Math.SQRT1_2]

 };

 const q=orientations[String(axis).toLowerCase()];

 if(!q)return;

 group.quaternion.set(...q).normalize();draw();

}

function turnAroundViewAxis(axis,degrees){

 if(!group||!THREE)return;

 const vectors={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)};

 const v=vectors[axis];if(!v)return;

 const radians=(Number(degrees)||0)*Math.PI/180;

 group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(v,radians));draw();

}

function alignLongAxis(axis){

 if(!group||!THREE||!currentGrid||currentGrid.atoms.length<2)return;

 const atoms=currentGrid.atoms;

 let best=-1,delta=null;

 for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){

   const a=atoms[i].pos,b=atoms[j].pos;

   const v=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);

   const d=v.lengthSq();if(d>best){best=d;delta=v;}

 }

 if(!delta||best<1e-12)return;

 const current=delta.normalize().applyQuaternion(group.quaternion);

 const target=axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);

 if(current.dot(target)<0)target.negate();

 const q=new THREE.Quaternion().setFromUnitVectors(current,target);

 group.quaternion.premultiply(q);draw();

}

window.BeeMolThree={show,exportFigure,createMovieOutput,updateSlicePlane,getSliceTransform,getGrid(){return currentGrid},ready:promise,background(c){bg=c;if(renderer){renderer.setClearColor(c);draw()}},resize,fit(){zoom=1;fitCamera()},axisView:setAxisView,align:alignLongAxis,rotateView:turnAroundViewAxis,zoom(pct){zoom=Math.max(.1,pct/100);fitCamera()},rotate(axis,deg){if(axis==='x')rotation.x+=deg*Math.PI/180;else rotation.y+=deg*Math.PI/180;if(group){group.rotation.set(rotation.x,rotation.y,0);draw()}},redraw:draw, getCanvas(){return renderer?.domElement},get isReady(){return!!renderer}};

})();
