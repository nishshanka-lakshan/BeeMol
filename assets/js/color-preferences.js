/* Restore appearance controls before the renderers initialize. */
(function(){
 const key='beemol-orbital-colors';
 const colors=['orbitalNegativeColor','orbitalPositiveColor'];
 const flip=document.getElementById('orbitalFlipPhase');
 try{
  const saved=JSON.parse(localStorage.getItem(key));
  if(saved&&typeof saved==='object'){
   for(const id of colors)if(typeof saved[id]==='string'&&/^#[a-f\d]{6}$/i.test(saved[id]))document.getElementById(id).value=saved[id];
   if(typeof saved.orbitalFlipPhase==='boolean')flip.checked=saved.orbitalFlipPhase;
  }
 }catch(error){/* Keep defaults if storage is unavailable or invalid. */}
 function save(){
  const values={orbitalFlipPhase:flip.checked};
  for(const id of colors)values[id]=document.getElementById(id).value;
  try{localStorage.setItem(key,JSON.stringify(values))}catch(error){}
 }
 for(const id of [...colors,'orbitalFlipPhase']){
  const input=document.getElementById(id);
  input.addEventListener('input',save);
  input.addEventListener('change',save);
 }
})();
