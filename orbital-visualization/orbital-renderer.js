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
 if(!window.MediaRecorder){setOrbitalStatus('Movie recording is unavailable in this browser.',true);return}
 // Match the autocorrelation phase export: H.264 MP4 from a 2D canvas.
 const nativeMime='video/mp4;codecs=avc1';
 const softwareMime=['video/webm;codecs=vp8','video/webm;codecs=vp9'].find(type=>MediaRecorder.isTypeSupported(type));
 if(!MediaRecorder.isTypeSupported(nativeMime)&&!softwareMime){setOrbitalStatus('This browser cannot capture a movie for MP4 export.',true);return}
 stopOrbitalAnimation();clearTimeout(isoTimer);clearTimeout(previewTimer);recording=true;
 const button=document.getElementById(movieOptions.buttonId||'animationRecord'),r=frameRange();
 const originalButton={html:button.innerHTML,title:button.title,label:button.getAttribute('aria-label')};
 const controls=[...document.querySelectorAll('#orbitalSliceControls input, #orbitalSliceControls select, #orbitalSliceInset button, #orbitalWorkspace input, #orbitalWorkspace select, #orbitalWorkspace button:not([role="tab"]), #orbitalWorkspace summary, #orbitalListBody tr, .top-actions input, .top-actions button, .top-actions label')];
 const disabled=controls.filter(el=>el!==button).map(el=>[el,el.disabled,el.style.pointerEvents]);
 for(const [el] of disabled){el.disabled=true;el.style.pointerEvents='none'}
 button.disabled=false;
 button.innerHTML=orbitalActionIcon('stop');button.title='Stop recording';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed','true');
 let recorder,stream,output,recordingError=null,stopRequested=false,selectedMime='',softwareEncoder=null;
 stopMovieRecording=()=>{
  stopRequested=true;
  if(recorder&&recorder.state!=='inactive')recorder.stop();
  setOrbitalStatus(`Recording stopped. Finishing MP4 download…`);
 };

 try{
  await displayFrame(r.first);
  if(stopRequested){setOrbitalStatus('Recording stopped.');return}
  // A PointerEvent also has a height (usually 1); accept only export resolutions.
  const validHeight=value=>[720,1080,1440,2160].includes(Number(value));
  const selectedHeight=Number(document.getElementById('animationQuality').value);
  const requestedHeight=validHeight(movieOptions.height)?Number(movieOptions.height):validHeight(selectedHeight)?selectedHeight:1080;
  let height=requestedHeight,done,chunks=[];
  const heights=[...new Set([requestedHeight,1440,1080,720].filter(value=>value<=requestedHeight))];
  const profiles=heights.map(height=>({height,fps:30,bitrate:height>=2160?40000000:height>=1440?20000000:height>=1080?12000000:6000000}));
  profiles.push({height:heights.at(-1),fps:24,bitrate:null});
  for(const profile of profiles)profile.mime=nativeMime;
  if(!MediaRecorder.isTypeSupported(nativeMime))profiles.length=0;
  // Bound software encoding to Full HD to keep frame buffers within WASM memory.
  if(softwareMime)profiles.push({height:Math.min(requestedHeight,1080),fps:24,bitrate:8000000,mime:softwareMime});
  let started=false,lastEncoderError=null;
  for(const profile of profiles){
   height=profile.height;
   const {bitrate,mime}=profile;
   if(stopRequested)break;
   try{
     const source=movieOptions.createOutput?movieOptions.createOutput(height):window.BeeMolThree.createMovieOutput(height);
     // Stage WebGL/slice frames onto the same kind of 2D canvas used by analysis.
     // Keep the renderer owned by output so failed attempts always release it.
     output={width:source.width,height:source.height,dispose:()=>source.dispose()};
     const canvas=document.createElement('canvas');
     canvas.width=source.width;canvas.height=source.height;
     if(canvas.width<2||canvas.height<2||canvas.width%2||canvas.height%2)throw Error(`Invalid MP4 frame dimensions: ${canvas.width} × ${canvas.height}.`);
     const context=canvas.getContext('2d');
     if(!context)throw Error('Could not create movie canvas.');
     output.canvas=canvas;
     output.paint=()=>context.drawImage(source.canvas,0,0);
     output.render=()=>{source.render();output.paint()};
     output.render();
     if(!canvas.captureStream)throw Error('Canvas movie recording is unavailable in this browser.');
     setOrbitalStatus(`Preparing MP4 ${output.width} × ${output.height} · ${profile.fps} fps…`);
     stream=canvas.captureStream(profile.fps);
     const options={mimeType:mime};if(bitrate)options.videoBitsPerSecond=bitrate;
     recorder=new MediaRecorder(stream,options);
     // Keep callbacks local to each attempt so a failed encoder cannot affect a retry.
     const attempt=recorder,attemptChunks=[];
     let attemptError=null;
     done=new Promise(resolve=>{
      attempt.ondataavailable=e=>{if(e.data.size)attemptChunks.push(e.data)};
      attempt.onstop=resolve;
      attempt.onerror=e=>{attemptError=e.error||Error('Movie encoding failed.');resolve()};
     });
     recorder.start();
     // Paint after capture starts so the encoder receives an initial frame.
     output.render();stream.getVideoTracks()[0]?.requestFrame?.();
     await Promise.race([new Promise(resolve=>setTimeout(resolve,300)),done]);
     if(attemptError)throw attemptError;
     if(stopRequested)break;
     if(recorder.state!=='recording')throw Error('Movie encoder stopped during initialization.');
     chunks=attemptChunks;selectedMime=recorder.mimeType||mime;
     // Retain asynchronous failures after initialization as well.
     recorder.addEventListener('error',e=>{recordingError=e.error||Error('Movie encoding failed.')});
     started=true;break;
    }catch(error){
     lastEncoderError=error;
     console.warn('Movie encoder attempt failed',{height,mime,bitrate},error);
     if(recorder&&recorder.state!=='inactive')recorder.stop();
     stream?.getTracks().forEach(track=>track.stop());output?.dispose();
     recorder=null;stream=null;output=null;
    }
   if(started||stopRequested)break;
  }
  if(stopRequested){setOrbitalStatus('Recording stopped.');return}
  if(!started)throw Error(`MP4 recording could not start at any supported quality. ${lastEncoderError?`${lastEncoderError.name}: ${lastEncoderError.message}`:'No encoder was available.'}`);
  const transition=(event,action)=>new Promise((resolve,reject)=>{
   if(recordingError){reject(recordingError);return}
   const cleanup=()=>{recorder.removeEventListener(event,success);recorder.removeEventListener('error',failure);recorder.removeEventListener('stop',success)};
   const success=()=>{cleanup();resolve()},failure=e=>{cleanup();reject(e.error||Error('Movie encoding failed.'))};
   recorder.addEventListener(event,success,{once:true});recorder.addEventListener('error',failure,{once:true});recorder.addEventListener('stop',success,{once:true});
   try{action()}catch(error){cleanup();reject(error)}
  });
  if(selectedMime.startsWith('video/webm')){
   await transition('pause',()=>recorder.pause());
   setOrbitalStatus('Native MP4 encoder unavailable. Preparing software MP4 export at up to 1080p…');
   softwareEncoder=await window.BeeMolMP4.create(setOrbitalStatus);
   if(!stopRequested)await transition('resume',()=>recorder.resume());
  }
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
   output.render();
   stream.getVideoTracks()[0]?.requestFrame?.();
   setOrbitalStatus(`Recording MP4 ${output.width} × ${output.height}: frame ${n} of ${r.last}`);
   // Repaint the held frame continuously, as the analysis movie does.
   // Orbital FPS still determines how long each orbital appears.
   const until=performance.now()+1000/r.fps;
   do{
    output.paint();
    await new Promise(resolve=>setTimeout(resolve,Math.min(1000/30,Math.max(0,until-performance.now()))));
   }while(!stopRequested&&!recordingError&&performance.now()<until);
   if(recordingError)throw recordingError;
  }
  if(recorder.state!=='inactive')recorder.stop();await done;
  if(recordingError)throw recordingError;
  if(!chunks.length&&stopRequested){setOrbitalStatus('Recording stopped.');return}
  if(!chunks.length)throw Error('The browser produced an empty movie. Try 1080p.');
  let movie=new Blob(chunks,{type:selectedMime});
  const dimensions=`${output.width} × ${output.height}`;
  // Free graphics resources before the software encoder allocates video buffers.
  stream.getTracks().forEach(track=>track.stop());stream=null;output.dispose();output=null;
  if(softwareEncoder){button.disabled=true;movie=await softwareEncoder.encode(movie)}
  const filename=movieOptions.filename?movieOptions.filename(height).replace(/\.(mp4|webm)$/i,'.mp4'):`orbital_animation_${height}p.mp4`;
  downloadBlob(movie,filename);
  setOrbitalStatus(`${stopRequested?'Recording stopped. ':''}MP4 downloaded (${dimensions}).`);
 }catch(e){if(recorder&&recorder.state!=='inactive')recorder.stop();setOrbitalStatus(e.message,true)}
 finally{
  softwareEncoder?.dispose();stream?.getTracks().forEach(track=>track.stop());output?.dispose();recording=false;stopMovieRecording=null;
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
 on('showOrbitalAppearance',()=>showOrbitalPropertiesTab('appearance'));on('toggleOrbitalAnimation',()=>showOrbitalPropertiesTab('animation'));on('animationPlay',playAnimation);on('animationRecord',()=>recordMovie());$('animationFrame').onchange=async()=>{stopOrbitalAnimation();await displayFrame(Number($('animationFrame').value))};
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
