(function(){
 'use strict';
 document.addEventListener('DOMContentLoaded',()=>{
  const workspace=document.getElementById('aboutWorkspace');
  function open(){
   if(typeof stopOrbitalAnimation==='function')stopOrbitalAnimation();
   for(const selector of ['main.container','#orbitalWorkspace','#analysisWorkspace','#aiWorkspace'])document.querySelector(selector)?.classList.add('hidden');
   workspace.classList.remove('hidden');
  }
  // AI controls are created by beemol-ai.js before this callback runs.
  for(const anchor of document.querySelectorAll('.mode-tabs > button, #aiModes > button')){
   if(anchor.closest('#aboutWorkspace')||anchor.textContent.trim()!=='AI')continue;
   const button=document.createElement('button');button.type='button';button.textContent='About';button.dataset.openAbout='true';button.onclick=open;anchor.after(button);
  }
  workspace.querySelector('nav').addEventListener('click',event=>{
   const mode=event.target.closest('[data-about-mode]')?.dataset.aboutMode;if(!mode)return;
   workspace.classList.add('hidden');
   if(mode==='ai'){window.BeeMolAI?.open();return}
   if(mode==='analysis'){document.getElementById('analysisOpen').click();return}
   if(mode==='water'){document.getElementById('wbOpen').click();return}
   window.BeeMolAI?.close();switchViewerMode(mode);
  });
  document.getElementById('downloadBeeMolPNG').onclick=async event=>{
   const button=event.currentTarget,status=document.getElementById('aboutDownloadStatus');button.disabled=true;
   try{
    const image=new Image();image.src='assets/images/beemol-logo.svg?v=20261028-bee2';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=6000;canvas.height=Math.round(6000*520/1800);
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG export failed.')),'image/png'));
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='BeeMol-logo-6000px.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='';
   }catch(error){status.textContent='Could not download PNG. The SVG download is available.'}
   finally{button.disabled=false}
  };
 });
})();
