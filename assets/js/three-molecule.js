/* Three.js molecule viewer with the API used by BeeMol's coordinate editor. */
(function(){
'use strict';
const moduleReady=import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
const colors={H:0xffffff,C:0x909090,N:0x3050f8,O:0xff0d0d,F:0x90e050,Cl:0x1ff01f,Br:0xa62929,I:0x940094,S:0xffff30,P:0xff8000,Cu:0xc88033,Ag:0xc0c0c0,Au:0xffd123};
// Shared element-dependent ball-and-stick sizes.
function atomDisplayRadius(atom,style){
 const scale=style.sphere?.scale??.28;
 const bondRadius=style.stick?.radius??0;
 return Math.max(window.BeeMolBonding.displayRadius(atom.elem)*scale/.28,bondRadius*1.45);
}
function createViewer(id,options={}){
 const host=document.getElementById(id);let T,renderer,scene,camera,group,drag,clickable,atoms=[],lines=[],style={stick:{radius:.18},sphere:{scale:.28}},zoom=1,center=[0,0,0],extent=8,bg=options.backgroundColor||'#ffffff';
 const selectionStyles=new Map(),models=[];
 let measurements=[];
 const atomColor=element=>window.BeeMolAtomColors.get(element);
 const render=()=>{if(renderer)renderer.render(scene,camera)};
 function fit(){if(!camera)return;const distance=extent/Math.tan(camera.fov*Math.PI/360)/Math.min(1,camera.aspect)/zoom;camera.position.set(0,0,Math.max(2,distance));camera.lookAt(0,0,0);camera.far=Math.max(2000,distance+extent*10);camera.updateProjectionMatrix();render()}
 function resize(){if(!renderer)return;const w=host.clientWidth||600,h=host.clientHeight||500;renderer.setSize(w,h,false);camera.aspect=w/h;fit()}
 function dispose(){if(!group)return;for(const o of [...group.children]){group.remove(o);o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose()}}
 function bond(a,b,r,color,element){const va=new T.Vector3(a.x-center[0],a.y-center[1],a.z-center[2]),vb=new T.Vector3(b.x-center[0],b.y-center[1],b.z-center[2]);const delta=vb.clone().sub(va),len=delta.length();if(!len)return;const mesh=new T.Mesh(new T.CylinderGeometry(r,r,len,24),new T.MeshPhongMaterial({color}));mesh.position.copy(va).add(vb).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());mesh.userData.paletteElement=element;group.add(mesh)}
 function label(text,position){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
  const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(15,23,42,0.92)';ctx.fillRect(0,0,512,96);
  ctx.fillStyle='#ffffff';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48);
  const sprite=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),depthTest:false}));
  sprite.position.copy(position);sprite.scale.set(2.4,.45,1);sprite.renderOrder=10;group.add(sprite);
 }
 function drawMeasurements(){
  for(const measurement of measurements){
   const points=measurement.indices.map(i=>atoms[i]).filter(Boolean).map(a=>new T.Vector3(a.x-center[0],a.y-center[1],a.z-center[2]));
   if(points.length!==measurement.indices.length)continue;
   if(points.length>1){const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineDashedMaterial({color:0xf59e0b,dashSize:.15,gapSize:.08,depthTest:false}));line.computeLineDistances();line.renderOrder=9;group.add(line)}
   if(measurement.pending)points.forEach((p,i)=>label(String(i+1),p.clone().add(new T.Vector3(0,.55,0))));
   if(measurement.text){const mid=points.reduce((sum,p)=>sum.add(p),new T.Vector3()).multiplyScalar(1/points.length);mid.y+=.65;label(measurement.text,mid)}
  }
 }
 function rebuild(){if(!T)return;dispose();for(const a of atoms){const st=selectionStyles.get(a.index)||a.style||style;const sphere=st.sphere;if(sphere){const mesh=new T.Mesh(new T.SphereGeometry(atomDisplayRadius(a,st),atoms.length>300?24:48,atoms.length>300?16:32),new T.MeshPhongMaterial({color:sphere.color??atomColor(a.elem),shininess:document.getElementById('moleculeAtomShine')?.checked?65:0,specular:document.getElementById('moleculeAtomShine')?.checked?0x555555:0x000000}));mesh.position.set(a.x-center[0],a.y-center[1],a.z-center[2]);mesh.userData.atom=a;if(sphere.color===undefined)mesh.userData.paletteElement=a.elem;group.add(mesh)}else{
 // Keep atoms pickable in line style without adding visible spheres.
 const pick=new T.Mesh(new T.SphereGeometry(.25,12,8),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));
 pick.position.set(a.x-center[0],a.y-center[1],a.z-center[2]);pick.userData.atom=a;group.add(pick);
 }}
 const inferred=window.BeeMolBonding.infer(atoms,document.getElementById('moleculeBondCutoff')?.value);
 for(const edge of inferred){
  const a=atoms[edge.i],b=atoms[edge.j],st=a.style||style;
  if(!st.stick&&!st.line)continue;
  const radius=st.stick?.radius||(st.line?.linewidth?.02:.035);
  const r=edge.order>1?radius*.52:radius;
  for(const lane of window.BeeMolBonding.lanes(atoms,edge,inferred,Math.max(.19,r*2.6))){
   const mid={x:(lane.start.x+lane.end.x)/2,y:(lane.start.y+lane.end.y)/2,z:(lane.start.z+lane.end.z)/2};
   bond(lane.start,mid,r,atomColor(a.elem),a.elem);bond(mid,lane.end,r,atomColor(b.elem),b.elem);
  }
 }

 for(const l of lines){const points=[l.start,l.end].map(p=>new T.Vector3(p.x-center[0],p.y-center[1],p.z-center[2]));group.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:l.color||0x888888})))}drawMeasurements();
 if(id==='viewer'&&document.getElementById('moleculeAtomLabels')?.checked){
  for(const a of atoms)label(a.elem,new T.Vector3(a.x-center[0],a.y-center[1]+.55,a.z-center[2]));
 }
 render()}
 let colorFramePending=false;
 document.addEventListener('atomcolorschange',()=>{
  if(colorFramePending)return;
  colorFramePending=true;
  requestAnimationFrame(()=>{
   colorFramePending=false;
   if(!group)return;
   for(const mesh of group.children)if(mesh.userData.paletteElement)mesh.material.color.set(atomColor(mesh.userData.paletteElement));
   render();
  });
 });
 document.addEventListener('moleculebondcutoffchange',rebuild);
 document.addEventListener('change',event=>{
  if(event.target.id!=='moleculeAtomShine'||!group)return;
  for(const mesh of group.children)if(mesh.userData.atom&&mesh.material.isMeshPhongMaterial){
   mesh.material.shininess=event.target.checked?65:0;
   mesh.material.specular.setHex(event.target.checked?0x555555:0x000000);
  }
  render();
 });
 document.addEventListener('change',event=>{if(id==='viewer'&&event.target.id==='moleculeAtomLabels')rebuild()});
 const api={ready:null,render,resize,
 setMeasurements(items){measurements=items;rebuild()},
 getAtomColor(element){const value=atomColor(element);return typeof value==='number'?'#'+value.toString(16).padStart(6,'0'):value},
 setAtomColor(element,color){if(!/^#[a-f\d]{6}$/i.test(color))return;window.BeeMolAtomColors.set(element,color)},
 resetAtomColors(){window.BeeMolAtomColors.reset()},setViewStyle(){},setBackgroundColor(c){bg=c;if(renderer)renderer.setClearColor(c);render()},clear(){measurements=[];api.onGeometryClear?.();atoms=[];lines=[];models.length=0;selectionStyles.clear();dispose();render()},
 addModel(text,format){if(format!=='xyz')throw Error('Only XYZ geometry is supported');const rows=text.trim().split(/\r?\n/),count=Number(rows[0]);if(!Number.isInteger(count)||count<1)throw Error('Invalid XYZ atom count');const model= models.length;const list=rows.slice(2,2+count).map(line=>{const p=line.trim().split(/\s+/);return{elem:p[0],x:Number(p[1]),y:Number(p[2]),z:Number(p[3]),index:0,model}});
 const base=atoms.length;list.forEach((a,i)=>a.index=base+i);atoms.push(...list);const item={setStyle(sel,st){for(const a of list)a.style=st;rebuild()}};models.push(item);rebuild();return item},
 setStyle(sel,st){if(sel.index!==undefined)selectionStyles.set(sel.index,st);else{style=st;selectionStyles.clear();for(const a of atoms)a.style=st}rebuild()},selectedAtoms(sel={}){return atoms.filter(a=>sel.index===undefined||a.index===sel.index)},setClickable(sel,enabled,callback){clickable=enabled?callback:null},
 addLine(l){lines.push(l);rebuild()},zoomTo(){const points=atoms.map(a=>[a.x,a.y,a.z]).concat(lines.flatMap(l=>[[l.start.x,l.start.y,l.start.z],[l.end.x,l.end.y,l.end.z]]));if(points.length){center=[0,1,2].map(k=>(Math.min(...points.map(p=>p[k]))+Math.max(...points.map(p=>p[k])))/2);extent=Math.max(2,...points.map(p=>Math.hypot(p[0]-center[0],p[1]-center[1],p[2]-center[2])+1));}zoom=1;rebuild();fit()},
 getView(){const q=group?.quaternion;return [...center,zoom,...(q?[q.x,q.y,q.z,q.w]:[0,0,0,1])]},setView(v){center=v.slice(0,3);zoom=v[3]||1;if(group)group.quaternion.set(...v.slice(4,8));rebuild();fit()},rotate(deg,axis){if(group){axis=axis.replace(/^-/, '');group.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),deg*Math.PI/180));render()}},zoom(factor){zoom*=factor;fit()}};
 api.ready=moduleReady.then(m=>{T=m;renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio||1,1.5),2));renderer.setClearColor(bg);renderer.domElement.style.cssText='width:100%;height:100%;display:block';host.replaceChildren(renderer.domElement);scene=new T.Scene();camera=new T.PerspectiveCamera(42,1,.01,2000);group=new T.Group();scene.add(group);scene.add(new T.HemisphereLight(0xffffff,0x697586,1.4));const light=new T.DirectionalLight(0xffffff,2);light.position.set(3,5,10);scene.add(light);
 // Soft fill and rim lights make the round atom surfaces easier to distinguish.
 const fill=new T.DirectionalLight(0xffffff,.6);fill.position.set(-5,1,4);scene.add(fill);
 const rim=new T.DirectionalLight(0xffffff,.8);rim.position.set(2,3,-5);scene.add(rim);
 host.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};host.setPointerCapture(e.pointerId)});host.addEventListener('pointermove',e=>{if(!drag)return;api.rotate((e.clientX-drag.x)*.4,'y');api.rotate((e.clientY-drag.y)*.4,'x');drag.x=e.clientX;drag.y=e.clientY});host.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5&&clickable){const rect=host.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(group.children).find(h=>h.object.userData.atom);if(hit)clickable(hit.object.userData.atom,api,e)}drag=null});host.addEventListener('pointercancel',()=>{drag=null});host.addEventListener('wheel',e=>{e.preventDefault();api.zoom(Math.exp(-e.deltaY*.001))},{passive:false});window.addEventListener('resize',resize);rebuild();resize();return api});return api;
}
window.BeeMolMoleculeThree={createViewer};
})();
