/* BeeMol Three.js orbital surface renderer. Independent of 3Dmol's molecule editor. */

(function(){

'use strict';

let THREE, scene, camera, renderer, group, holder, running=false, bg='#ffffff';

let drag=null, rotation={x:0,y:0}, zoom=1, baseExtent=8, lastCube=null, currentGrid=null;

const ANG=0.529177210903;

const el=()=>document.getElementById('orbitalViewer');

const promise=import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js').then(m=>{THREE=m;init();return true;}).catch(err=>{console.error('Three.js loading failed',err);return false;});

function init(){

 holder=el(); if(!holder)return;

 renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});

 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); renderer.setClearColor(bg);

 renderer.outputColorSpace=THREE.SRGBColorSpace;

 renderer.domElement.style.width='100%'; renderer.domElement.style.height='100%'; renderer.domElement.style.display='block';

 holder.replaceChildren(renderer.domElement);

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

 running=true;resize();

}

function resize(){if(!renderer||!holder)return;let w=Math.max(1,holder.clientWidth||600),h=Math.max(1,holder.clientHeight||500);renderer.setSize(w,h,false);renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';camera.aspect=w/h;camera.updateProjectionMatrix();fitCamera()}

function draw(){if(renderer&&scene&&camera)renderer.render(scene,camera)}

function fitCamera(){if(!camera)return;const fov=camera.fov*Math.PI/180;const aspect=Math.max(0.1,camera.aspect||1);const distance=Math.max(2,(baseExtent/2)/Math.tan(fov/2)/Math.min(1,aspect)*1.35/zoom);camera.position.set(0,0,distance);camera.lookAt(0,0,0);camera.near=Math.max(.001,distance/10000);camera.far=Math.max(100,distance+baseExtent*20);camera.updateProjectionMatrix();draw()}

function clear(){if(!group)return;for(const child of [...group.children]){group.remove(child);child.geometry?.dispose();if(child.material){if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());else child.material.dispose()}}}

const nums=s=>s.trim().split(/\s+/).map(x=>Number(x.replace(/[dD]/g,'E')));

function parseCube(text){

 let ls=text.split(/\r?\n/);if(ls.length<7)throw Error('Invalid CUBE file');

 let hdr=nums(ls[2]),count=Math.abs(Math.trunc(hdr[0])),origin=hdr.slice(1,4);if(!count||!origin.every(Number.isFinite))throw Error('Invalid CUBE header');

 const dims=[],axes=[];let angGrid=false;

 for(let i=0;i<3;i++){let row=nums(ls[3+i]);dims.push(Math.abs(Math.trunc(row[0])));axes.push(row.slice(1,4));if(row[0]<0)angGrid=true;}

 if(dims.some(x=>x<2||x>512))throw Error('CUBE dimensions invalid');

 let factor=angGrid?1:ANG;origin=origin.map(v=>v*factor);const scaledAxes=axes.map(a=>a.map(v=>v*factor));

 const atoms=[];

 for(let i=0;i<count;i++){const a=nums(ls[6+i]);atoms.push({z:Math.round(a[0]),pos:a.slice(2,5).map(v=>v*factor)});}

 let offset=6+count; if(hdr[0]<0){const orb=nums(ls[offset]||'');offset++;let consumed=orb.length-1;while(consumed<orb[0] && offset<ls.length){consumed+=nums(ls[offset]).length;offset++;}}

 const data=ls.slice(offset).join(' ').trim().split(/\s+/).map(x=>Number(x.replace(/[dD]/g,'E')));

 const n=dims.reduce((a,b)=>a*b,1);

 if(data.length<n)throw Error(`CUBE has ${data.length} values but requires ${n}`);

 return {dims,origin,axes:scaledAxes,atoms,data:new Float32Array(data.slice(0,n))};

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

function mesh(g,level,offset){

 const [nx,ny,nz]=g.dims;

 const verts=[], normals=[],maxValues=6000000;

 let lo=Infinity,hi=-Infinity;

 for(const value of g.data){if(value<lo)lo=value;if(value>hi)hi=value;}

 if(level<=lo||level>=hi)return null;

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

 for(let x=0;x<nx-1;x++)for(let y=0;y<ny-1;y++)for(let z=0;z<nz-1;z++){

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

 if(!verts.length)return null;

 const geometry=new THREE.BufferGeometry();

 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));

 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));

 geometry.computeBoundingSphere();

 return geometry;

}

const elementColors={1:'#ffffff',6:'#909090',7:'#3050f8',8:'#ff0d0d',9:'#90e050',15:'#ff8000',16:'#ffff30',17:'#1ff01f',29:'#c88033',35:'#a62929',47:'#c0c0c0',53:'#940094',79:'#ffd123'};

function drawAtoms(g,center){const show=document.getElementById('showOrbitalAtoms')?.checked!==false;if(!show)return;const sphere=new THREE.SphereGeometry(1,18,14);const positions=[];

 for(const a of g.atoms){const r=a.z===1?.22:.34;const mat=new THREE.MeshStandardMaterial({color:elementColors[a.z]||'#9da6ac',roughness:.35,metalness:0});const m=new THREE.Mesh(sphere,mat);m.position.set(...a.pos.map((v,i)=>v-center[i]));m.scale.setScalar(r);group.add(m);positions.push(m.position)}

 const bondmat=new THREE.MeshStandardMaterial({color:'#adb4c1',roughness:.5});const cov={1:.31,6:.76,7:.71,8:.66,9:.57,15:1.07,16:1.05,17:1.02,29:1.32,35:1.2,53:1.39};

 for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){const a=positions[i],b=positions[j],dist=a.distanceTo(b),limit=(cov[g.atoms[i].z]||1.1)+(cov[g.atoms[j].z]||1.1)+.43;if(dist>.35&&dist<limit){let cyl=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,dist,10),bondmat);cyl.position.copy(a).add(b).multiplyScalar(.5);cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());group.add(cyl)}}

}

async function show(text,options={}){if(!THREE){if(!await promise)throw Error('Cannot load Three.js. Check network connection.');}const g=parseCube(text);currentGrid=g;lastCube={text,options};// Center on the molecular geometry, not the sometimes asymmetric CUBE bounding box.

let center;

if(g.atoms.length){

 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];

 for(const a of g.atoms)for(let k=0;k<3;k++){min[k]=Math.min(min[k],a.pos[k]);max[k]=Math.max(max[k],a.pos[k]);}

 center=min.map((v,k)=>(v+max[k])/2);

}else center=p3(g,(g.dims[0]-1)/2,(g.dims[1]-1)/2,(g.dims[2]-1)/2);

clear();let level=options.auto?autoIso(g):Math.abs(options.iso||.02);if(document.getElementById('orbitalCutoff')&&options.auto)document.getElementById('orbitalCutoff').value=level.toFixed(5);

for(const [sign,color] of [[1,options.positive||'#ffbf00'],[-1,options.negative||'#1555ed']]){const geometry=mesh(g,sign*level,center);if(!geometry)continue;const mat=new THREE.MeshPhongMaterial({color,side:THREE.DoubleSide,transparent:(options.opacity??1)<1,opacity:options.opacity??1,shininess:Math.round((options.gloss??15)*1.2),specular:0x999999,emissive:color,emissiveIntensity:0.25*(1-Math.max(0,Math.min(100,options.depth||0))/100)});const object=new THREE.Mesh(geometry,mat);group.add(object)}if(options.showAtoms!==false)drawAtoms(g,center);

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

resize();
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

window.BeeMolThree={show,ready:promise,background(c){bg=c;if(renderer){renderer.setClearColor(c);draw()}},resize,fit(){zoom=1;fitCamera()},axisView:setAxisView,align:alignLongAxis,rotateView:turnAroundViewAxis,zoom(pct){zoom=Math.max(.1,pct/100);fitCamera()},rotate(axis,deg){if(axis==='x')rotation.x+=deg*Math.PI/180;else rotation.y+=deg*Math.PI/180;if(group){group.rotation.set(rotation.x,rotation.y,0);draw()}},redraw:draw, getCanvas(){return renderer?.domElement},get isReady(){return!!renderer}};

})();
