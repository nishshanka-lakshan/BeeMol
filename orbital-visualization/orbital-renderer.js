let savedMoldenGrid = null;
function restoreMoldenGridControls(){
 for(const [i,id] of ['gridX','gridY','gridZ'].entries()){
  const input=document.getElementById(id);
  if(savedMoldenGrid)input.value=savedMoldenGrid[i];
  input.readOnly=false;input.min='12';input.max='200';
 }
 savedMoldenGrid=null;
 document.getElementById('orbitalGridInfo').textContent='Molden calculation grid (editable).';
}
document.addEventListener('orbitalgridchange',()=>{
 const grid=window.BeeMolThree?.getGrid();if(!grid)return;
 const inputs=['gridX','gridY','gridZ'].map(id=>document.getElementById(id));
 if(!importedMolden){
  if(!savedMoldenGrid)savedMoldenGrid=inputs.map(input=>input.value);
  inputs.forEach((input,i)=>{input.min='2';input.removeAttribute('max');input.value=grid.dims[i];input.readOnly=true;});
 }
 document.getElementById('orbitalGridInfo').textContent=`${importedMolden?'Calculated':'Detected from CUBE'}: ${grid.dims.join(' × ')} · ${grid.data.length.toLocaleString()} points${importedMolden?'':' · fixed by file'}`;
});
/* File loading, orbital controls, animation, and application startup. */
let animationRunning=false, animationFixedView=null,animationToken=0,orbitalBackground='#ffffff',recording=false;
function colorMoleculeAtoms(){ /* Three.js molecule viewer uses CPK atom colors by default. */ }
function showOrbitalPropertiesTab(tab){const appearance=tab==='appearance';document.getElementById('orbitalControlsWrap').classList.toggle('hidden',!appearance);document.getElementById('orbitalAnimation').classList.toggle('hidden',appearance);for(const [id,on] of [['showOrbitalAppearance',appearance],['toggleOrbitalAnimation',!appearance]]){const el=document.getElementById(id);el.classList.toggle('active',on);el.setAttribute('aria-selected',String(on))}}
function stopOrbitalAnimation(){animationRunning=false;animationToken++;document.getElementById('animationPlay').textContent='Play'}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function downloadOrbitalFigure(){
 const button=document.getElementById('downloadOrbitalFigure');
 if(recording){setOrbitalStatus('Wait for movie recording to finish before downloading a figure.',true);return}
 stopOrbitalAnimation();
 button.disabled=true;
 try{
  const {blob,width,height}=await window.BeeMolThree.exportFigure();
  const name=(cubeData?.name||'orbital').replace(/\.(cube|cub)$/i,'');
  downloadBlob(blob,`${name}_figure.png`);
  setOrbitalStatus(`Figure downloaded as PNG (${width} × ${height} pixels).`);
 }catch(e){setOrbitalStatus(e.message,true)}finally{button.disabled=false}
}
function orbitalOptions(){const s=getOrbitalSettings(),flip=document.getElementById('orbitalFlipPhase').checked;return{iso:s.cutoff,auto:document.getElementById('autoOrbitalIso').checked,positive:flip?s.negative:s.positive,negative:flip?s.positive:s.negative,opacity:1-s.translucency,gloss:Number(document.getElementById('orbitalGloss').value),showAtoms:document.getElementById('showOrbitalAtoms').checked,depth:Number(document.getElementById('orbitalDepth').value),preserveView:true}}
async function renderCube(){if(!cubeData)return;await window.BeeMolThree.show(cubeData.text,orbitalOptions());window.BeeMolThree.background(orbitalBackground)}
async function handleCubeFile(file,fromMolden=false,preserveView=false,preloadedText=null){if(!fromMolden){stopOrbitalAnimation();importedMolden=null;embeddedActive=false;switchViewerMode('orbitals')}if(!await initOrbitalIfNeeded())throw Error('Orbital viewer failed to start');const text=preloadedText??await file.text();await window.BeeMolThree.show(text,{...orbitalOptions(),preserveView});cubeData={text,name:file.name};window.BeeMolThree.background(orbitalBackground);if(!fromMolden)setOrbitalStatus(`${file.name} loaded`)}
async function initOrbitalIfNeeded(){return orbitalViewerReady||await initOrbitalViewer()}
function frameRange(){const count=importedMolden?.orbitals.length||cubeFiles.size||1;const first=Math.max(1,Math.min(count,Number(document.getElementById('animationStart').value)||1)),last=Math.max(first,Math.min(count,Number(document.getElementById('animationEnd').value)||count)),step=Math.max(1,Number(document.getElementById('animationStep').value)||1);return {first,last,step,fps:Math.max(1,Math.min(12,Number(document.getElementById('animationFps').value)||6))}}
async function displayFrame(n){document.getElementById('orbitalNumber').value=n;if(importedMolden)await loadCalculatedOrbital(n);else if(cubeFiles.has(n))await handleCubeFile(cubeFiles.get(n),true,true);document.getElementById('animationFrame').value=n}
async function playAnimation(){if(animationRunning){stopOrbitalAnimation();return}if(!importedMolden&&!cubeFiles.size){setOrbitalStatus('Open a Molden file first.',true);return}animationRunning=true;const token=++animationToken;document.getElementById('animationPlay').textContent='Stop';const r=frameRange();try{while(animationRunning&&token===animationToken){for(let n=r.first;n<=r.last&&animationRunning&&token===animationToken;n+=r.step){const start=performance.now();await displayFrame(n);await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000/r.fps-(performance.now()-start))))}}}catch(e){setOrbitalStatus(e.message,true);stopOrbitalAnimation()}}
async function recordMovie(){if(recording)return;if(!importedMolden&&!cubeFiles.size){setOrbitalStatus('Open a Molden file first.',true);return}stopOrbitalAnimation();const canvas=window.BeeMolThree.getCanvas();if(!canvas?.captureStream||!window.MediaRecorder){setOrbitalStatus('Movie recording is unavailable in this browser.',true);return}recording=true;const button=document.getElementById('animationRecord');button.disabled=true;const r=frameRange(),types=['video/mp4;codecs=avc1.42001E','video/mp4','video/webm;codecs=vp9','video/webm'];const mime=types.find(t=>MediaRecorder.isTypeSupported(t));let recorder,stream;try{if(!mime)throw Error('No supported movie format');await displayFrame(r.first);stream=canvas.captureStream(r.fps);recorder=new MediaRecorder(stream,{mimeType:mime});const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||Error('Recording failed'))});recorder.start();for(let n=r.first;n<=r.last;n+=r.step){await displayFrame(n);setOrbitalStatus(`Recording frame ${n} of ${r.last}`);await new Promise(resolve=>setTimeout(resolve,1000/r.fps))}recorder.stop();await done;const ext=mime.startsWith('video/mp4')?'mp4':'webm';downloadBlob(new Blob(chunks,{type:mime}),`orbital_animation.${ext}`);setOrbitalStatus(`Movie downloaded as ${ext.toUpperCase()}.`)}catch(e){if(recorder?.state==='recording')recorder.stop();setOrbitalStatus(e.message,true)}finally{stream?.getTracks().forEach(t=>t.stop());recording=false;button.disabled=false}}
function bindControls(){const $=id=>document.getElementById(id),on=(id,fn)=>{if($(id))$(id).onclick=fn};
 const compute=document.createElement('div');compute.innerHTML='<label><input id="orbitalUseGPU" type="checkbox" checked> GPU orbital calculation</label><p id="orbitalComputeBackend" class="mini-note" role="status">Automatic WebGPU with CPU fallback · applies to Molden orbitals</p>';$('orbitalControlsWrap').prepend(compute);
 $('orbitalUseGPU').onchange=()=>{if(importedMolden)showOrbitalNumber()};
 $('orbitalFileInput').addEventListener('change',async e=>{stopOrbitalAnimation();try{const files=Array.from(e.target.files||[]);for(const [i,file]of files.entries()){const text=await file.text();if(/^\s*\[Molden Format\]/im.test(text)||/\[Atoms\]/i.test(text)&&/\[GTO\]/i.test(text)){await handleMoldenFile(file)}else if(/\.(cube|cub)$/i.test(file.name)){cubeFiles.set(i+1,file);await handleCubeFile(file,false,false,text)}else{const xyz=normalizeXYZ(text);$('xyzInput').value=xyz;$('wbSolute').value=xyz;selectedBondAtoms=[];switchViewerMode('molecule');loadMolecule()}}}catch(error){setOrbitalStatus(error.message,true)}finally{e.target.value=''}});
 on('showOrbitalAppearance',()=>showOrbitalPropertiesTab('appearance'));on('toggleOrbitalAnimation',()=>showOrbitalPropertiesTab('animation'));on('animationPlay',playAnimation);on('animationRecord',recordMovie);$('animationFrame').onchange=async()=>{stopOrbitalAnimation();await displayFrame(Number($('animationFrame').value))};
 $('orbitalNumber').onchange=showOrbitalNumber;for(const [id,delta]of [['orbitalPrev',-1],['orbitalNext',1]])on(id,()=>{const n=Math.max(1,Math.min(importedMolden?.orbitals.length||cubeFiles.size||1,Number($('orbitalNumber').value)+delta));$('orbitalNumber').value=n;showOrbitalNumber()});
 for(const id of ['autoOrbitalIso','orbitalNegativeColor','orbitalPositiveColor','orbitalFlipPhase','orbitalGloss','orbitalDepth','orbitalTranslucency','showOrbitalAtoms'])$(id).onchange=()=>{if(id==='orbitalCutoff')$('autoOrbitalIso').checked=false;renderCube().catch(e=>setOrbitalStatus(e.message,true))};for(const id of ['gridX','gridY','gridZ'])$(id).onchange=()=>{if(importedMolden)showOrbitalNumber()};
 let isoTimer=0;
 $('orbitalCutoff').addEventListener('input',()=>{
  clearTimeout(isoTimer);
  const value=Number($('orbitalCutoff').value);
  if(!$('orbitalCutoff').value.trim()||!Number.isFinite(value)||value<=0)return;
  $('autoOrbitalIso').checked=false;
  isoTimer=setTimeout(()=>renderCube().catch(e=>setOrbitalStatus(e.message,true)),180);
 });
 on('downloadOrbitalFigure',downloadOrbitalFigure);
 on('downloadOrbitalCube',()=>{if(cubeData)downloadBlob(new Blob([cubeData.text],{type:'text/plain'}),cubeData.name||'orbital.cube')});$('orbitalBgColorPicker').oninput=e=>{orbitalBackground=e.target.value;window.BeeMolThree.background(orbitalBackground)};
 on('applyOrbitalZoom',()=>window.BeeMolThree.zoom(Number($('orbitalZoom').value)));on('updateMol',loadMolecule);on('fitBtn',()=>{viewer.zoomTo();viewer.render()});on('styleBtn',()=>{ballStick=!ballStick;loadMolecule()});on('spinBtn',()=>{spinning=!spinning;$('spinBtn').textContent=spinning?'Stop spin':'Spin';const tick=()=>{if(!spinning)return;viewer.rotate(.5,'y');requestAnimationFrame(tick)};if(spinning)tick()});$('bgColorPicker').oninput=e=>setViewerBackground(e.target.value);
 on('applyBondLengthBtn',applySelectedBondLength);on('clearBondSelectionBtn',clearBondSelection);on('copyCode',async()=>{try{await navigator.clipboard.writeText($('codeOutput').textContent);$('codeStatus').textContent='Copied'}catch(e){$('codeStatus').textContent='Clipboard unavailable. Select and copy the code.'}});on('downloadPy',()=>downloadBlob(new Blob([$('codeOutput').textContent],{type:'text/plain'}),($('jobName').value||'calculation')+'.py'));
}
window.addEventListener('DOMContentLoaded',async()=>{bindControls();initViewer();updateConditionalUI();try{await viewer.ready;const xyz=document.getElementById('xyzInput').value.trim();if(xyz)loadMolecule();else{document.getElementById('codeOutput').textContent='# Open an XYZ or Molden file to generate input.';document.getElementById('geomStatus').textContent='Open a molecular file'}}catch(e){document.getElementById('geomStatus').textContent='Molecule viewer could not start: '+e.message} });
