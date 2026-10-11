/* Three.js molecule viewer with the API used by BeeMol's coordinate editor. */
(function(){
'use strict';
const moduleReady=import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
const colors={H:0xffffff,C:0x909090,N:0x3050f8,O:0xff0d0d,F:0x90e050,Cl:0x1ff01f,Br:0xa62929,I:0x940094,S:0xffff30,P:0xff8000,Cu:0xc88033,Ag:0xc0c0c0,Au:0xffd123};
// Covalent radii are used only to identify bonds.
const radii={H:.31,C:.76,N:.71,O:.66,F:.57,Cl:1.02,Br:1.2,I:1.39,S:1.05,P:1.07,Cu:1.32,Ag:1.45,Au:1.36};
// Display radii keep hydrogen spheres larger than their bond cylinders.
const displayRadii={H:1.20,C:1.70,N:1.55,O:1.52,F:1.47,Cl:1.75,Br:1.85,I:1.98,S:1.80,P:1.80,Cu:1.40,Ag:1.72,Au:1.66};
function atomDisplayRadius(atom,style){
 const scale=style.sphere?.scale??.28;
 const bondRadius=style.stick?.radius??0;
 return Math.max((displayRadii[atom.elem]||1.70)*scale,bondRadius*1.45);
}
function createViewer(id,options={}){
 const host=document.getElementById(id);let T,renderer,scene,camera,group,drag,clickable,atoms=[],lines=[],style={stick:{radius:.18},sphere:{scale:.28}},zoom=1,center=[0,0,0],extent=8,bg=options.backgroundColor||'#ffffff';
 const selectionStyles=new Map(),models=[];
 const render=()=>{if(renderer)renderer.render(scene,camera)};
 function fit(){if(!camera)return;const distance=extent/Math.tan(camera.fov*Math.PI/360)/Math.min(1,camera.aspect)/zoom;camera.position.set(0,0,Math.max(2,distance));camera.lookAt(0,0,0);camera.far=Math.max(2000,distance+extent*10);camera.updateProjectionMatrix();render()}
 function resize(){if(!renderer)return;const w=host.clientWidth||600,h=host.clientHeight||500;renderer.setSize(w,h,false);camera.aspect=w/h;fit()}
 function dispose(){if(!group)return;for(const o of [...group.children]){group.remove(o);o.geometry?.dispose();o.material?.dispose()}}
 function bond(a,b,r,color){const va=new T.Vector3(a.x-center[0],a.y-center[1],a.z-center[2]),vb=new T.Vector3(b.x-center[0],b.y-center[1],b.z-center[2]);const delta=vb.clone().sub(va),len=delta.length();if(!len)return;const mesh=new T.Mesh(new T.CylinderGeometry(r,r,len,12),new T.MeshPhongMaterial({color}));mesh.position.copy(va).add(vb).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());group.add(mesh)}
 function rebuild(){if(!T)return;dispose();for(const a of atoms){const st=selectionStyles.get(a.index)||a.style||style;const sphere=st.sphere;if(sphere){const mesh=new T.Mesh(new T.SphereGeometry(atomDisplayRadius(a,st),20,14),new T.MeshPhongMaterial({color:sphere.color||colors[a.elem]||0xff69b4}));mesh.position.set(a.x-center[0],a.y-center[1],a.z-center[2]);mesh.userData.atom=a;group.add(mesh)}}
 for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){const a=atoms[i],b=atoms[j];if(a.model!==b.model)continue;const d=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(d<.1||d>1.25*((radii[a.elem]||.8)+(radii[b.elem]||.8)))continue;const st=a.style||style,r=st.stick?.radius||(st.line?.linewidth?.02:.035);if(!st.stick&&!st.line)continue;const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2};bond(a,mid,r,colors[a.elem]||0x999999);bond(mid,b,r,colors[b.elem]||0x999999)}
 for(const l of lines){const points=[l.start,l.end].map(p=>new T.Vector3(p.x-center[0],p.y-center[1],p.z-center[2]));group.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:l.color||0x888888})))}render()}
 const api={ready:null,render,resize,setViewStyle(){},setBackgroundColor(c){bg=c;if(renderer)renderer.setClearColor(c);render()},clear(){atoms=[];lines=[];models.length=0;selectionStyles.clear();dispose();render()},
 addModel(text,format){if(format!=='xyz')throw Error('Only XYZ geometry is supported');const rows=text.trim().split(/\r?\n/),count=Number(rows[0]);if(!Number.isInteger(count)||count<1)throw Error('Invalid XYZ atom count');const model= models.length;const list=rows.slice(2,2+count).map(line=>{const p=line.trim().split(/\s+/);return{elem:p[0],x:Number(p[1]),y:Number(p[2]),z:Number(p[3]),index:0,model}});
 const base=atoms.length;list.forEach((a,i)=>a.index=base+i);atoms.push(...list);const item={setStyle(sel,st){for(const a of list)a.style=st;rebuild()}};models.push(item);rebuild();return item},
 setStyle(sel,st){if(sel.index!==undefined)selectionStyles.set(sel.index,st);else{style=st;selectionStyles.clear();for(const a of atoms)a.style=st}rebuild()},selectedAtoms(sel={}){return atoms.filter(a=>sel.index===undefined||a.index===sel.index)},setClickable(sel,enabled,callback){clickable=enabled?callback:null},
 addLine(l){lines.push(l);rebuild()},zoomTo(){const points=atoms.map(a=>[a.x,a.y,a.z]).concat(lines.flatMap(l=>[[l.start.x,l.start.y,l.start.z],[l.end.x,l.end.y,l.end.z]]));if(points.length){center=[0,1,2].map(k=>(Math.min(...points.map(p=>p[k]))+Math.max(...points.map(p=>p[k])))/2);extent=Math.max(2,...points.map(p=>Math.hypot(p[0]-center[0],p[1]-center[1],p[2]-center[2])+1));}zoom=1;rebuild();fit()},
 getView(){const q=group?.quaternion;return [...center,zoom,...(q?[q.x,q.y,q.z,q.w]:[0,0,0,1])]},setView(v){center=v.slice(0,3);zoom=v[3]||1;if(group)group.quaternion.set(...v.slice(4,8));rebuild();fit()},rotate(deg,axis){if(group){axis=axis.replace(/^-/, '');group.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),deg*Math.PI/180));render()}},zoom(factor){zoom*=factor;fit()}};
 api.ready=moduleReady.then(m=>{T=m;renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(bg);renderer.domElement.style.cssText='width:100%;height:100%;display:block';host.replaceChildren(renderer.domElement);scene=new T.Scene();camera=new T.PerspectiveCamera(42,1,.01,2000);group=new T.Group();scene.add(group);scene.add(new T.HemisphereLight(0xffffff,0x808080,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(3,5,10);scene.add(light);
 host.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};host.setPointerCapture(e.pointerId)});host.addEventListener('pointermove',e=>{if(!drag)return;api.rotate((e.clientX-drag.x)*.4,'y');api.rotate((e.clientY-drag.y)*.4,'x');drag.x=e.clientX;drag.y=e.clientY});host.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5&&clickable){const rect=host.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(group.children).find(h=>h.object.userData.atom);if(hit)clickable(hit.object.userData.atom,api,e)}drag=null});host.addEventListener('wheel',e=>{e.preventDefault();api.zoom(Math.exp(-e.deltaY*.001))},{passive:false});window.addEventListener('resize',resize);rebuild();resize();return api});return api;
}
window.BeeMolMoleculeThree={createViewer};
})();
