/* Restore MO appearance before the renderers initialize. */
(function(){
 const key='beemol-orbital-colors'; // Retain existing saved color choices.
 const colors=['orbitalNegativeColor','orbitalPositiveColor'];
 const checks=['orbitalFlipPhase','autoOrbitalIso','showOrbitalAtoms'];
 const numbers=['orbitalDepth','orbitalGloss','orbitalTranslucency','orbitalCutoff'];
 const ids=[...colors,...checks,...numbers];
 const $=id=>document.getElementById(id);
 const validColor=value=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value);
 function valid(id,value){
  if(colors.includes(id))return validColor(value);
  if(checks.includes(id))return typeof value==='boolean';
  return typeof value==='number'&&Number.isFinite(value)&&value>=Number($(id).min)&&value<=Number($(id).max);
 }
 function values(){
  const result={};
  for(const id of ids){
   const input=$(id),value=checks.includes(id)?input.checked:numbers.includes(id)?Number(input.value):input.value;
   if((!numbers.includes(id)||input.value.trim())&&valid(id,value))result[id]=value;
  }
  return result;
 }
 function apply(saved){
  for(const id of ids)if(valid(id,saved[id])){
   if(checks.includes(id))$(id).checked=saved[id];else $(id).value=saved[id];
  }
 }
 const status=$('orbitalStyleStatus');
 function save(){
  try{localStorage.setItem(key,JSON.stringify(values()))}
  catch(error){status.textContent='Browser storage is unavailable. Save a style file to keep your settings.'}
 }
 try{
  const saved=JSON.parse(localStorage.getItem(key));
  if(saved&&typeof saved==='object')apply(saved);
 }catch(error){/* Keep defaults if saved preferences are unavailable or invalid. */}
 for(const id of ids){
  // Wait until the renderer has handled input (e.g. disabling auto isovalue).
  for(const event of ['input','change'])$(id).addEventListener(event,()=>queueMicrotask(save));
 }
 $('saveOrbitalStyle').addEventListener('click',()=>{
  const preset={format:'beemol-style',version:1,orbital:values(),atomColors:window.BeeMolAtomColors.export()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(preset,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='beemol-style.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Style file saved, including MO appearance and atom colors.';
 });
 const fileInput=$('orbitalStyleFile');
 $('loadOrbitalStyle').addEventListener('click',()=>fileInput.click());
 fileInput.addEventListener('change',async()=>{
  const file=fileInput.files[0];if(!file)return;
  try{
   if(file.size>100000)throw new Error('Style file is too large.');
   const preset=JSON.parse(await file.text());
   if(!preset||preset.format!=='beemol-style'||preset.version!==1||!preset.orbital||typeof preset.orbital!=='object'||Array.isArray(preset.orbital)||!ids.every(id=>valid(id,preset.orbital[id]))||!preset.atomColors||typeof preset.atomColors!=='object'||Array.isArray(preset.atomColors)||!Object.values(preset.atomColors).every(validColor))throw new Error('Choose a valid BeeMol style file.');
   apply(preset.orbital);
   window.BeeMolAtomColors.import(preset.atomColors);
   save();
   // One change event refreshes the surface using all restored controls.
   $('orbitalPositiveColor').dispatchEvent(new Event('change',{bubbles:true}));
   status.textContent='Style loaded and saved for future visits.';
  }catch(error){status.textContent=error.message||'Could not load style file.'}
  finally{fileInput.value=''}
 });
})();
