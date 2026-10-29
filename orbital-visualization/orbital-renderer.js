let savedMoldenGrid = null;
let isoTimer=0,previewTimer=0;
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
let animationRunning=false, animationFixedView=null,animationToken=0,orbitalBackground=document.documentElement.dataset.theme==='light'?'#ffffff':'#070d17',recording=false;
let stopMovieRecording=null;
function colorMoleculeAtoms(){ /* Three.js molecule viewer uses CPK atom colors by default. */ }
let orbitalPropertiesTab='appearance';
function showOrbitalPropertiesTab(tab){
 orbitalPropertiesTab=tab;
 for(const [name,button,panel] of [['appearance','showOrbitalAppearance','orbitalControlsWrap'],['slice','showOrbitalSlice','orbitalSliceControls'],['animation','toggleOrbitalAnimation','orbitalAnimation']]){
  const selected=name===tab,el=document.getElementById(button);
  document.getElementById(panel).classList.toggle('hidden',viewerMode!=='orbitals'||!selected);
  el.classList.toggle('active',selected);el.setAttribute('aria-selected',String(selected));el.tabIndex=selected?0:-1;
 }
}
function updateAnimationButton(running){
 const button=document.getElementById('animationPlay');
 button.innerHTML=orbitalActionIcon(running?'stop':'play');
 button.title=running?'Stop playback':'Play animation';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(running));
}
function stopOrbitalAnimation(){animationRunning=false;animationToken++;updateAnimationButton(false)}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function downloadOrbitalFigure(){
 const button=document.getElementById('downloadOrbitalFigure');
 if(recording){setOrbitalStatus('Wait for movie recording to finish before downloading a figure.',true);return}
 stopOrbitalAnimation();
 button.disabled=true;
 try{
  clearTimeout(isoTimer);clearTimeout(previewTimer);
  await renderCube();
  const {blob,width,height}=await window.BeeMolThree.exportFigure();
  const name=(cubeData?.name||'orbital').replace(/\.(cube|cub)$/i,'');
  downloadBlob(blob,`${name}_figure.png`);
  setOrbitalStatus(`Figure downloaded as PNG (${width} × ${height} pixels).`);
 }catch(e){setOrbitalStatus(e.message,true)}finally{button.disabled=false}
}
function orbitalOptions(){const s=getOrbitalSettings(),flip=document.getElementById('orbitalFlipPhase').checked;return{iso:s.cutoff,auto:document.getElementById('autoOrbitalIso').checked,positive:flip?s.negative:s.positive,negative:flip?s.positive:s.negative,opacity:1-s.translucency,gloss:Number(document.getElementById('orbitalGloss').value),showAtoms:document.getElementById('showOrbitalAtoms').checked,depth:Number(document.getElementById('orbitalDepth').value),preserveView:true}}
async function renderCube(options={}){if(!cubeData)return;await window.BeeMolThree.show(cubeData.text,{...orbitalOptions(),...options});window.BeeMolThree.background(orbitalBackground)}
async function handleCubeFile(file,fromMolden=false,preserveView=false,preloadedText=null){if(!fromMolden){stopOrbitalAnimation();importedMolden=null;embeddedActive=false;switchViewerMode('orbitals')}if(!await initOrbitalIfNeeded())throw Error('Orbital viewer failed to start');const text=preloadedText??await file.text();await window.BeeMolThree.show(text,{...orbitalOptions(),preserveView});cubeData={text,name:file.name};window.BeeMolThree.background(orbitalBackground);if(!fromMolden)setOrbitalStatus(`${file.name} loaded`)}
async function initOrbitalIfNeeded(){return orbitalViewerReady||await initOrbitalViewer()}
function frameRange(){const count=importedMolden?.orbitals.length||cubeFiles.size||1;const first=Math.max(1,Math.min(count,Number(document.getElementById('animationStart').value)||1)),last=Math.max(first,Math.min(count,Number(document.getElementById('animationEnd').value)||count)),step=Math.max(1,Number(document.getElementById('animationStep').value)||1);return {first,last,step,fps:Math.max(1,Math.min(12,Number(document.getElementById('animationFps').value)||6))}}
async function displayFrame(n){document.getElementById('orbitalNumber').value=n;if(importedMolden)await loadCalculatedOrbital(n);else if(cubeFiles.has(n))await handleCubeFile(cubeFiles.get(n),true,true);document.getElementById('animationFrame').value=n}
async function playAnimation(){if(recording)return;if(animationRunning){stopOrbitalAnimation();return}if(!importedMolden&&!cubeFiles.size){setOrbitalStatus('Open a Molden file first.',true);return}animationRunning=true;const token=++animationToken;updateAnimationButton(true);const r=frameRange();try{while(animationRunning&&token===animationToken){for(let n=r.first;n<=r.last&&animationRunning&&token===animationToken;n+=r.step){const start=performance.now();await displayFrame(n);await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000/r.fps-(performance.now()-start))))}}}catch(e){setOrbitalStatus(e.message,true);stopOrbitalAnimation()}}
async function recordMovie(movieOptions={}){
 if(recording){stopMovieRecording?.();return;}
 if(!importedMolden&&!cubeFiles.size){setOrbitalStatus('Open a Molden file first.',true);return}
 if(!window.MediaRecorder){setOrbitalStatus('MP4 recording is unavailable in this browser.',true);return}
 const mime=['video/mp4;codecs=avc1.640033','video/mp4;codecs=avc1.64002A','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
 if(!mime){setOrbitalStatus('This browser cannot record MP4. Open BeeMol in a browser with MP4 recording support.',true);return}
 stopOrbitalAnimation();clearTimeout(isoTimer);clearTimeout(previewTimer);recording=true;
 const button=document.getElementById(movieOptions.buttonId||'animationRecord'),r=frameRange();
 const originalButton={html:button.innerHTML,title:button.title,label:button.getAttribute('aria-label')};
 const controls=[...document.querySelectorAll('#orbitalSliceControls input, #orbitalSliceControls select, #orbitalSliceInset button, #orbitalWorkspace input, #orbitalWorkspace select, #orbitalWorkspace button:not([role="tab"]), #orbitalWorkspace summary, #orbitalListBody tr, .top-actions input, .top-actions button, .top-actions label')];
 const disabled=controls.filter(el=>el!==button).map(el=>[el,el.disabled,el.style.pointerEvents]);
 for(const [el] of disabled){el.disabled=true;el.style.pointerEvents='none'}
 button.disabled=false;
 button.innerHTML=orbitalActionIcon('stop');button.title='Stop recording';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed','true');
 let recorder,stream,output,recordingError=null,stopRequested=false;
 stopMovieRecording=()=>{
  stopRequested=true;
  if(recorder&&recorder.state!=='inactive')recorder.stop();
  setOrbitalStatus('Recording stopped. Finishing MP4 download…');
 };

 try{
  await displayFrame(r.first);
  if(stopRequested){setOrbitalStatus('Recording stopped.');return}
  const height=movieOptions.height||Number(document.getElementById('animationQuality').value)||1080;
  output=movieOptions.createOutput?movieOptions.createOutput(height):window.BeeMolThree.createMovieOutput(height);output.render();
  if(!output.canvas.captureStream)throw Error('Canvas movie recording is unavailable in this browser.');
  stream=output.canvas.captureStream(r.fps);
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:movieOptions.videoBitsPerSecond||(height===2160?40000000:16000000)});
  const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const done=new Promise(resolve=>{recorder.onstop=resolve;recorder.onerror=e=>{recordingError=e.error||Error('MP4 encoding failed.');resolve()}});
  const transition=(event,action)=>new Promise((resolve,reject)=>{
   if(recordingError){reject(recordingError);return}
   const cleanup=()=>{recorder.removeEventListener(event,success);recorder.removeEventListener('error',failure);recorder.removeEventListener('stop',success)};
   const success=()=>{cleanup();resolve()},failure=e=>{cleanup();reject(e.error||Error('MP4 encoding failed.'))};
   recorder.addEventListener(event,success,{once:true});recorder.addEventListener('error',failure,{once:true});recorder.addEventListener('stop',success,{once:true});
   try{action()}catch(error){cleanup();reject(error)}
  });
  recorder.start();
  for(let n=r.first;n<=r.last&&!stopRequested;n+=r.step){
   if(n!==r.first){
    // Exclude orbital calculation time from the recorded animation.
    await transition('pause',()=>recorder.pause());
    if(stopRequested)break;
    await displayFrame(n);
    if(stopRequested)break;
    output.render();
    await transition('resume',()=>recorder.resume());
   }
   if(stopRequested)break;
   if(recordingError)throw recordingError;
   if(!movieOptions.createOutput)output.render();
   stream.getVideoTracks()[0]?.requestFrame?.();
   setOrbitalStatus(`Recording MP4 ${output.width} × ${output.height}: frame ${n} of ${r.last}`);
   await new Promise(resolve=>setTimeout(resolve,1000/r.fps));
   if(recordingError)throw recordingError;
  }
  if(recorder.state!=='inactive')recorder.stop();await done;
  if(recordingError)throw recordingError;
  if(!chunks.length&&stopRequested){setOrbitalStatus('Recording stopped.');return}
  if(!chunks.length)throw Error('The browser produced an empty movie. Try 1080p.');
  downloadBlob(new Blob(chunks,{type:recorder.mimeType||mime}),movieOptions.filename?movieOptions.filename(height):`orbital_animation_${height}p.mp4`);
  setOrbitalStatus(`${stopRequested?'Recording stopped. ':''}MP4 downloaded (${output.width} × ${output.height}).`);
 }catch(e){if(recorder&&recorder.state!=='inactive')recorder.stop();setOrbitalStatus(e.message,true)}
 finally{
  stream?.getTracks().forEach(track=>track.stop());output?.dispose();recording=false;stopMovieRecording=null;
  for(const [el,wasDisabled,pointerEvents] of disabled){el.disabled=wasDisabled;el.style.pointerEvents=pointerEvents}
  button.disabled=false;button.innerHTML=orbitalActionIcon('movie');button.title='Download high-quality MP4 movie';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed','false');
  if(movieOptions.buttonId){button.innerHTML=originalButton.html;button.title=originalButton.title;if(originalButton.label===null)button.removeAttribute('aria-label');else button.setAttribute('aria-label',originalButton.label);}
 }
}
let viewerFilesLoading=false;
async function loadViewerFiles(fileList){
 const files=Array.from(fileList||[]);if(!files.length)return;
 const status=document.getElementById('viewerFileStatus');
 if(recording||viewerFilesLoading){status.textContent=recording?'Stop recording before opening files.':'Wait for the current files to finish loading.';return}
 viewerFilesLoading=true;document.getElementById('viewerFileBrowse').disabled=true;
 stopOrbitalAnimation();
 try{
  for(const [i,file] of files.entries()){
   status.textContent=`Opening ${file.name}…`;
   const text=await file.text();
   if(/^\s*\[Molden Format\]/im.test(text)||/\[Atoms\]/i.test(text)&&/\[GTO\]/i.test(text)){
    await handleMoldenFile(file);
   }else if(/\.(cube|cub)$/i.test(file.name)){
    cubeFiles.set(i+1,file);await handleCubeFile(file,false,false,text);
   }else{
    const xyz=normalizeXYZ(text);document.getElementById('xyzInput').value=xyz;
    document.getElementById('wbSolute').value=xyz;selectedBondAtoms=[];switchViewerMode('molecule');loadMolecule();
   }
  }
  status.textContent='';
 }catch(error){status.textContent=error.message;setOrbitalStatus(error.message,true)}
 finally{viewerFilesLoading=false;document.getElementById('viewerFileBrowse').disabled=false}
}
function bindControls(){const $=id=>document.getElementById(id),on=(id,fn)=>{if($(id))$(id).onclick=fn};
 $('orbitalUseGPU').onchange=()=>{if(importedMolden)showOrbitalNumber()};
 const fileInput=$('orbitalFileInput'),dropTarget=$('viewerStack'),browse=$('viewerFileBrowse');
 browse.title='Supported: '+fileInput.accept.split(',').join(', ');
 browse.onclick=()=>fileInput.click();
 fileInput.addEventListener('change',async e=>{try{await loadViewerFiles(e.target.files)}finally{e.target.value=''}});
 let dragDepth=0;
 const fileDrag=event=>Array.from(event.dataTransfer?.types||[]).includes('Files');
 dropTarget.addEventListener('dragenter',event=>{
  if(!fileDrag(event))return;event.preventDefault();dragDepth++;dropTarget.classList.add('file-drag-active');
 });
 dropTarget.addEventListener('dragover',event=>{
  if(!fileDrag(event))return;event.preventDefault();event.dataTransfer.dropEffect=recording||viewerFilesLoading?'none':'copy';
 });
 dropTarget.addEventListener('dragleave',event=>{
  if(!fileDrag(event))return;event.preventDefault();if(--dragDepth<=0){dragDepth=0;dropTarget.classList.remove('file-drag-active')}
 });
 dropTarget.addEventListener('drop',async event=>{
  event.preventDefault();dragDepth=0;dropTarget.classList.remove('file-drag-active');
  await loadViewerFiles(event.dataTransfer?.files);
 });
 setupCompactOrbitalControls();
 on('showOrbitalSlice',()=>showOrbitalPropertiesTab('slice'));
 on('showOrbitalAppearance',()=>showOrbitalPropertiesTab('appearance'));on('toggleOrbitalAnimation',()=>showOrbitalPropertiesTab('animation'));on('animationPlay',playAnimation);on('animationRecord',recordMovie);$('animationFrame').onchange=async()=>{stopOrbitalAnimation();await displayFrame(Number($('animationFrame').value))};
 $('orbitalNumber').onchange=showOrbitalNumber;for(const [id,delta]of [['orbitalPrev',-1],['orbitalNext',1]])on(id,()=>{const n=Math.max(1,Math.min(importedMolden?.orbitals.length||cubeFiles.size||1,Number($('orbitalNumber').value)+delta));$('orbitalNumber').value=n;showOrbitalNumber()});
 for(const id of ['autoOrbitalIso','orbitalNegativeColor','orbitalPositiveColor','orbitalFlipPhase','orbitalGloss','orbitalDepth','orbitalTranslucency','showOrbitalAtoms'])$(id).onchange=()=>{if(id==='orbitalCutoff')$('autoOrbitalIso').checked=false;renderCube().catch(e=>setOrbitalStatus(e.message,true))};for(const id of ['gridX','gridY','gridZ'])$(id).onchange=()=>{if(importedMolden)showOrbitalNumber()};
 $('orbitalCutoff').addEventListener('input',()=>{
  clearTimeout(isoTimer);clearTimeout(previewTimer);
  const value=Number($('orbitalCutoff').value);
  if(!$('orbitalCutoff').value.trim()||!Number.isFinite(value)||value<=0)return;
  $('autoOrbitalIso').checked=false;
  previewTimer=setTimeout(()=>renderCube({preview:true}).catch(e=>setOrbitalStatus(e.message,true)),60);
  isoTimer=setTimeout(()=>renderCube().catch(e=>setOrbitalStatus(e.message,true)),350);
 });
 $('orbitalCutoff').addEventListener('change',()=>{clearTimeout(isoTimer);clearTimeout(previewTimer);const value=Number($('orbitalCutoff').value);if(Number.isFinite(value)&&value>0)renderCube().catch(e=>setOrbitalStatus(e.message,true));});
 on('downloadOrbitalFigure',downloadOrbitalFigure);
 on('downloadOrbitalCube',()=>{if(cubeData)downloadBlob(new Blob([cubeData.text],{type:'text/plain'}),cubeData.name||'orbital.cube')});$('orbitalBgColorPicker').oninput=e=>{if(viewerMode==='molecule'){setViewerBackground(e.target.value);return}orbitalBackground=e.target.value;window.BeeMolThree.background(orbitalBackground)};
 on('applyOrbitalZoom',()=>window.BeeMolThree.zoom(Number($('orbitalZoom').value)));on('updateMol',loadMolecule);on('fitOrbitalBtn',()=>{if(viewerMode==='molecule'){viewer.zoomTo();viewer.render()}else window.BeeMolThree.fit()});on('styleBtn',()=>{ballStick=!ballStick;loadMolecule()});on('spinBtn',()=>{spinning=!spinning;$('spinBtn').textContent=spinning?'Stop spin':'Spin';const tick=()=>{if(!spinning)return;viewer.rotate(.5,'y');requestAnimationFrame(tick)};if(spinning)tick()});
 on('applyBondLengthBtn',applySelectedBondLength);on('clearBondSelectionBtn',clearBondSelection);on('copyCode',async()=>{try{await navigator.clipboard.writeText($('codeOutput').textContent);$('codeStatus').textContent='Copied'}catch(e){$('codeStatus').textContent='Clipboard unavailable. Select and copy the code.'}});on('downloadPy',()=>downloadBlob(new Blob([$('codeOutput').textContent],{type:'text/plain'}),($('jobName').value||'calculation')+'.py'));
}
window.addEventListener('DOMContentLoaded',async()=>{bindControls();initViewer();updateConditionalUI();try{await viewer.ready;const xyz=document.getElementById('xyzInput').value.trim();if(xyz)loadMolecule();else{document.getElementById('codeOutput').textContent='# Open an XYZ or Molden file to generate input.';document.getElementById('geomStatus').textContent='Open a molecular file'}}catch(e){document.getElementById('geomStatus').textContent='Molecule viewer could not start: '+e.message} });
