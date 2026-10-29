/* BeeMol's geometry-based bond-order estimates; coordinates are in angstroms.
 * XYZ/CUBE data do not specify chemical bonds. Metals retain single connections.
 */
(function(root){
'use strict';
const radii={H:.31,B:.84,C:.76,N:.71,O:.66,F:.57,Si:1.11,P:1.07,S:1.05,Cl:1.02,Br:1.2,I:1.39,Cu:1.32,Ag:1.45,Au:1.36};
const valence={H:1,B:3,C:4,N:3,O:2,F:1,Si:4,P:3,S:2,Cl:1,Br:1,I:1};
// Conservative upper lengths for double and triple bonds, keyed alphabetically.
const multiple={'C-C':[1.45,1.25],'C-N':[1.37,1.21],'C-O':[1.30,0],'C-S':[1.68,0],'N-N':[1.33,1.15],'N-O':[1.26,0],'O-O':[1.26,0]};
function infer(atoms){
 const bonds=[],used=atoms.map(()=>0),adj=atoms.map(()=>[]);
 for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){
  const a=atoms[i],b=atoms[j];if(a.model!==b.model)continue;
  const distance=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  if(!Number.isFinite(distance)||distance<.4||distance>1.25*((radii[a.elem]??.8)+(radii[b.elem]??.8)))continue;
  const edge={i,j,order:1,distance};bonds.push(edge);used[i]++;used[j]++;adj[i].push(edge);adj[j].push(edge);
 }
 const available=i=>Math.max(0,(valence[atoms[i].elem]??used[i])-used[i]);
 const promote=(edge,order)=>{const extra=Math.min(order-edge.order,available(edge.i),available(edge.j));if(extra>0){edge.order+=extra;used[edge.i]+=extra;used[edge.j]+=extra}};
 // Recognize near-planar six-carbon rings with aromatic-length edges first.
 const rings=new Set();
 function visit(path,edges){
  const last=path[path.length-1];
  for(const edge of adj[last]){
   if(edge.distance<1.30||edge.distance>1.46)continue;
   const next=edge.i===last?edge.j:edge.i;
   if(atoms[next].elem!=='C')continue;
   if(path.length===6){
    if(next!==path[0])continue;
    const key=[...path].sort((a,b)=>a-b).join(',');if(rings.has(key))continue;rings.add(key);
    const p=path.map(i=>atoms[i]),u=[p[1].x-p[0].x,p[1].y-p[0].y,p[1].z-p[0].z],v=[p[2].x-p[0].x,p[2].y-p[0].y,p[2].z-p[0].z];
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
    if(length<1e-8||p.some(a=>Math.abs((a.x-p[0].x)*n[0]+(a.y-p[0].y)*n[1]+(a.z-p[0].z)*n[2])/length>.12))continue;
    const cycle=[...edges,edge];
    for(const parity of [0,1]){const chosen=cycle.filter((e,k)=>k%2===parity);if(chosen.every(e=>available(e.i)>0&&available(e.j)>0)){chosen.forEach(e=>promote(e,2));cycle.forEach(e=>e.aromatic=true);break}}
   }else if(next>path[0]&&!path.includes(next))visit([...path,next],[...edges,edge]);
  }
 }
 atoms.forEach((a,i)=>{if(a.elem==='C')visit([i],[])});
 const candidates=bonds.filter(e=>!e.aromatic).map(edge=>{const key=[atoms[edge.i].elem,atoms[edge.j].elem].sort().join('-'),limits=multiple[key];return{edge,target:limits?(limits[1]&&edge.distance<=limits[1]?3:edge.distance<=limits[0]?2:1):1}}).filter(c=>c.target>1);
 candidates.sort((a,b)=>b.target-a.target||a.edge.distance-b.edge.distance||a.edge.i-b.edge.i||a.edge.j-b.edge.j);
 candidates.forEach(({edge,target})=>promote(edge,target));
 return bonds;
}
// Offset parallel cylinders within a neighboring bond's plane where possible.
function lanes(atoms,edge,bonds,spacing){
 const a=atoms[edge.i],b=atoms[edge.j],axis=[b.x-a.x,b.y-a.y,b.z-a.z],len=Math.hypot(...axis);axis.forEach((v,i)=>axis[i]=v/len);
 let perpendicular;
 for(const other of bonds){
  const k=other.i===edge.i?other.j:other.j===edge.i?other.i:-1;if(k<0||k===edge.j)continue;
  const c=atoms[k],v=[c.x-a.x,c.y-a.y,c.z-a.z],dot=v.reduce((s,x,i)=>s+x*axis[i],0),p=v.map((x,i)=>x-dot*axis[i]);
  if(Math.hypot(...p)>1e-6){perpendicular=p;break}
 }
 if(!perpendicular){const k=axis.map(Math.abs).indexOf(Math.min(...axis.map(Math.abs))),v=[0,0,0];v[k]=1;perpendicular=v.map((x,i)=>x-axis[k]*axis[i])}
 const norm=Math.hypot(...perpendicular);
 return Array.from({length:edge.order},(_,lane)=>{const shift=perpendicular.map(x=>x/norm*(lane-(edge.order-1)/2)*spacing);const move=p=>({x:p.x+shift[0],y:p.y+shift[1],z:p.z+shift[2]});return{start:move(a),end:move(b)}});
}
root.BeeMolBonding={infer,lanes};
if(typeof module!=='undefined')module.exports=root.BeeMolBonding;
})(typeof window==='undefined'?globalThis:window);
