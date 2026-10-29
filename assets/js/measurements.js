/* Geometry measurements use XYZ coordinates in angstroms. */
(function(root){
'use strict';
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
function calculate(points){
 if(points.length<2||points.length>4||points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))return null;
 const b0=sub(points[0],points[1]);
 if(points.length===2)return {value:norm(b0),unit:'Å'};
 const b1=sub(points[2],points[1]);
 if(norm(b0)<1e-10||norm(b1)<1e-10)return null;
 if(points.length===3)return {value:Math.acos(Math.max(-1,Math.min(1,dot(b0,b1)/(norm(b0)*norm(b1)))))*180/Math.PI,unit:'°'};
 const axis=b1.map(v=>v/norm(b1)),b2=sub(points[3],points[2]);
 const v=sub(b0,axis.map(x=>x*dot(b0,axis))),w=sub(b2,axis.map(x=>x*dot(b2,axis)));
 if(norm(v)<1e-10||norm(w)<1e-10)return null;
 return {value:Math.atan2(dot(cross(axis,v),w),dot(v,w))*180/Math.PI,unit:'°'};
}
root.BeeMolMeasurements={calculate};
if(typeof module!=='undefined')module.exports={calculate};
})(typeof window==='undefined'?globalThis:window);
