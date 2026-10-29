/* Hover and keyboard hints, including dynamically created icon buttons. */
(function(){
 'use strict';
 const tooltip=document.createElement('div');
 tooltip.id='buttonTooltip';tooltip.className='button-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;
 document.body.append(tooltip);
 let active=null,previousDescription=null;
 const target=node=>node instanceof Element?node.closest('button,[role="button"],[data-rotate-axis]'):null;
 function hide(){
  tooltip.hidden=true;
  if(active){
   if(previousDescription===null)active.removeAttribute('aria-describedby');
   else active.setAttribute('aria-describedby',previousDescription);
  }
  active=null;
 }
 function show(button){
  if(!button||button===active)return;
  hide();
  const label=button.getAttribute('aria-label')||button.getAttribute('title')||button.textContent.trim();
  if(!label)return;
  active=button;previousDescription=button.getAttribute('aria-describedby');
  tooltip.textContent=label;tooltip.hidden=false;
  button.setAttribute('aria-describedby',[previousDescription,tooltip.id].filter(Boolean).join(' '));
  const rect=button.getBoundingClientRect(),box=tooltip.getBoundingClientRect();
  const left=Math.max(8,Math.min(innerWidth-box.width-8,rect.left+(rect.width-box.width)/2));
  const top=rect.top>=box.height+12?rect.top-box.height-8:rect.bottom+8;
  tooltip.style.left=left+'px';tooltip.style.top=Math.max(8,Math.min(innerHeight-box.height-8,top))+'px';
 }
 document.addEventListener('pointerover',event=>show(target(event.target)));
 document.addEventListener('pointerout',event=>{if(active&&target(event.relatedTarget)!==active)hide()});
 document.addEventListener('focusin',event=>show(target(event.target)));
 document.addEventListener('focusout',hide);
 document.addEventListener('click',hide);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hide()});
 document.addEventListener('scroll',hide,true);
 window.addEventListener('resize',hide);
})();
