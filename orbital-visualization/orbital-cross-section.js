/* Cross-sections sampled from the original CUBE grid in the current viewer orientation. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let frame = 0;
  let movieView = null;
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => draw()); }
  document.addEventListener('DOMContentLoaded', () => {
    const controls = $('orbitalSliceControls');
    const inset = document.createElement('section');
    inset.id = 'orbitalSliceInset'; inset.hidden = true;
    inset.innerHTML = '<header><strong id="orbitalSliceTitle">MO cross-section</strong><button id="orbitalSliceDownload" type="button">PNG</button><button id="orbitalSliceMovie" type="button" title="Download a high-quality 2160 × 2160 MP4 with its plane and position fixed">MP4</button></header><canvas id="orbitalSliceCanvas" width="600" height="600" role="img" aria-label="Molecular orbital cross-section"></canvas><p id="orbitalSliceLegend"></p>';
    $('orbitalViewer').append(inset);
    controls.addEventListener('input', schedule);
    for (const id of ['orbitalPositiveColor', 'orbitalNegativeColor', 'orbitalFlipPhase']) $(id).addEventListener('input', schedule);
    $('orbitalSliceDownload').title = 'Download a 6000 × 6000 PNG for publication';
    $('orbitalSliceDownload').onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 6000;
      draw(canvas);
      canvas.toBlob(blob => {
        if (blob) download(blob, `orbital_cross_section_${$('orbitalSlicePlane').value}.png`);
        else $('orbitalSliceStatus').textContent = 'Could not encode the high-resolution PNG.';
      }, 'image/png');
    };
    $('orbitalSliceMovie').onclick = recordSliceMovie;
    for (const event of ['pointerdown', 'wheel']) inset.addEventListener(event, e => e.stopPropagation());
  });
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function recordSliceMovie() {
    if (movieView) { await recordMovie(); return; }
    if (!window.BeeMolThree?.getGrid() || !$('orbitalSliceEnabled').checked) return;
    // Freeze the physical slice and framing for the entire dynamics sequence.
    const view = draw();
    if (!view) return;
    movieView = view;
    try { await recordMovie({
      buttonId: 'orbitalSliceMovie',
      height: 2160,
      videoBitsPerSecond: 80000000,
      filename: height => `orbital_cross_section_${view.plane}_${height}p.mp4`,
      createOutput(height) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = height;
        return {
          canvas, width: height, height,
          render() { draw(canvas, view, Math.ceil(height * 528 / 600)); },
          dispose() { canvas.width = canvas.height = 0; }
        };
      }
    }); } finally { movieView = null; draw(); }
  }
  document.addEventListener('orbitalgridchange', schedule);
  document.addEventListener('orbitalviewchange', schedule);
  function draw(exportCanvas = null, fixedView = null, sampleSize = null) {
    fixedView = fixedView || movieView;
    if (!$('orbitalSliceEnabled')) return;
    const grid = window.BeeMolThree?.getGrid();
    $('orbitalSliceStatus').textContent = !grid ? 'Open a Molden file and select an MO, or load a CUBE file first.' : $('orbitalSliceEnabled').checked ? 'The plane marks the slice in the 3D viewer. Move Position to explore it.' : 'Enable Show cross-section to view the loaded orbital slice.';
    $('orbitalSliceInset').hidden = !$('orbitalSliceEnabled').checked || !grid;
    if (!grid || !$('orbitalSliceEnabled').checked) {window.BeeMolThree?.updateSlicePlane(null);return;}
    const { dims, data } = grid;
    const transform = fixedView?.transform || window.BeeMolThree?.getSliceTransform?.();
    const rotate = p => transform ? transform.rotation.map(row => row.reduce((sum,x,k)=>sum+x*p[k],0)) : p;
    // Rotate the grid basis into viewer coordinates; interpolation still uses the original data.
    const axes = grid.axes.map(rotate);
    const origin = rotate(grid.origin.map((x,k)=>x-(transform?.center[k] || 0)));
    const plane = fixedView?.plane || $('orbitalSlicePlane').value;
    const [u, v, normal] = plane === 'XY' ? [0, 1, 2] : plane === 'XZ' ? [0, 2, 1] : [1, 2, 0];
    // Invert the grid basis so rotated and skewed CUBE grids are supported.
    const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
    const cof = [cross(axes[1],axes[2]),cross(axes[2],axes[0]),cross(axes[0],axes[1])];
    const determinant = dot(axes[0],cof[0]);
    if (Math.abs(determinant) < 1e-15) {window.BeeMolThree?.updateSlicePlane(null);return;}
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    for (let corner=0;corner<8;corner++) for (let k=0;k<3;k++) {
      const p = origin[k]+axes.reduce((sum,a,i)=>sum+((corner>>i)&1)*a[k]*(dims[i]-1),0);
      min[k]=Math.min(min[k],p);max[k]=Math.max(max[k],p);
    }
    if (fixedView) for (let k=0;k<3;k++) { min[k]=fixedView.min[k]; max[k]=fixedView.max[k]; }
    const fraction = Number($('orbitalSliceOffset').value)/100;
    const position = fixedView?.position ?? (min[normal]+fraction*(max[normal]-min[normal]));
    window.BeeMolThree?.updateSlicePlane({u,v,normal,position,min,max,viewSpace:!!transform});
    $('orbitalSlicePosition').textContent = `${position.toFixed(3)} Å`;
    $('orbitalSliceTitle').textContent = `${plane} · ${'XYZ'[normal]} = ${position.toFixed(3)} Å`;
    // Resample the original grid for export rather than enlarging the preview.
    const size=sampleSize || (exportCanvas ? 1200 : 240), values=new Float64Array(size*size);
    const span=Math.max(max[u]-min[u],max[v]-min[v]);
    const centerU=(min[u]+max[u])/2, centerV=(min[v]+max[v])/2;
    let peak=0;
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const p=[0,0,0];p[u]=centerU+((x+.5)/size-.5)*span;p[v]=centerV+(.5-(y+.5)/size)*span;p[normal]=position;
      const delta=p.map((value,k)=>value-origin[k]);
      const q=cof.map(row=>dot(row,delta)/determinant);
      if(q.some((value,k)=>value<0||value>dims[k]-1)) continue;
      const low=q.map((value,k)=>Math.min(dims[k]-2,Math.floor(value))), f=q.map((value,k)=>value-low[k]);
      let value=0;
      for(let c=0;c<8;c++) {const i=low[0]+(c&1),j=low[1]+((c>>1)&1),k=low[2]+((c>>2)&1);value+=data[(i*dims[1]+j)*dims[2]+k]*f.reduce((weight,t,axis)=>weight*(((c>>axis)&1)?t:1-t),1);}
      values[y*size+x]=value;peak=Math.max(peak,Math.abs(value));
    }
    const flip=$('orbitalFlipPhase').checked;
    const rgb=id=>$(id).value.match(/[a-f\d]{2}/gi).map(s=>parseInt(s,16));
    const positive=rgb(flip?'orbitalNegativeColor':'orbitalPositiveColor'),negative=rgb(flip?'orbitalPositiveColor':'orbitalNegativeColor');
    const raster=document.createElement('canvas');raster.width=raster.height=size;
    const ctx=raster.getContext('2d'), pixels=ctx.createImageData(size,size);
    values.forEach((value,i)=>{const strength=peak?Math.sqrt(Math.abs(value)/peak):0,color=value>=0?positive:negative;for(let k=0;k<3;k++) pixels.data[4*i+k]=Math.round(255+(color[k]-255)*strength);pixels.data[4*i+3]=255;});
    ctx.putImageData(pixels,0,0);
    const canvas=exportCanvas || $('orbitalSliceCanvas'),out=canvas.getContext('2d');
    out.save();out.scale(canvas.width/600,canvas.height/600);
    out.imageSmoothingEnabled=true;out.imageSmoothingQuality='high';
    out.fillStyle='#fff';out.fillRect(0,0,600,600);out.drawImage(raster,48,24,528,528);
    if($('orbitalSliceContours').checked && peak>0) {
      out.strokeStyle='rgba(25,35,45,.55)';out.lineWidth=1;
      for(const level of [-.75,-.5,-.25,.25,.5,.75].map(t=>t*peak)) {
        out.beginPath();
        for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++) {
          const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],hits=[];
          for(let edge=0;edge<4;edge++){const a=corners[edge],b=corners[(edge+1)%4],va=values[a[1]*size+a[0]],vb=values[b[1]*size+b[0]];if((va<level)===(vb<level))continue;const t=(level-va)/(vb-va);hits.push([48+(a[0]+t*(b[0]-a[0])+.5)*528/size,24+(a[1]+t*(b[1]-a[1])+.5)*528/size]);}
          for(let i=0;i+1<hits.length;i+=2){out.moveTo(...hits[i]);out.lineTo(...hits[i+1]);}
        }out.stroke();
      }
    }
    out.strokeStyle='#64748b';out.strokeRect(48,24,528,528);out.fillStyle='#253443';out.font='18px Arial';out.textAlign='center';out.fillText(`${'XYZ'[u]} (Å)`,312,586);out.save();out.translate(20,288);out.rotate(-Math.PI/2);out.fillText(`${'XYZ'[v]} (Å)`,0,0);out.restore();
    out.font='13px Arial';out.fillText((centerU-span/2).toFixed(2),65,570);out.fillText((centerU+span/2).toFixed(2),555,570);
    out.restore();
    $('orbitalSliceLegend').textContent=`− / + phase · slice scale ±${peak.toExponential(2)} · contours at 25%, 50%, 75%`;
    return { plane, position, min, max, transform };
  }
})();
