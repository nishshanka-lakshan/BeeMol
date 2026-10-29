(function(){
 'use strict';
 const root=document.documentElement;
 let theme='light';
 try{const saved=localStorage.getItem('beemol-theme');if(saved==='light'||saved==='dark')theme=saved}catch(error){/* Theme switching still works without storage. */}
 root.dataset.theme=theme;
 document.addEventListener('DOMContentLoaded',()=>{
  const button=document.getElementById('themeToggle');
  const icons={light:'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0',dark:'M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z'};
  function update(){
   const dark=root.dataset.theme==='dark';
   button.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[dark?'light':'dark']}"/></svg>`;
   button.title=dark?'Switch to light interface':'Switch to dark interface';
   button.setAttribute('aria-label',button.title);
   button.setAttribute('aria-pressed',String(dark));
  }
  button.addEventListener('click',()=>{
   root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
   try{localStorage.setItem('beemol-theme',root.dataset.theme)}catch(error){}
   const background=root.dataset.theme==='light'?'#ffffff':'#070d17';
   if(typeof setViewerBackground==='function')setViewerBackground(background);
   if(typeof orbitalBackground!=='undefined')orbitalBackground=background;
   window.BeeMolThree?.background(background);
   const picker=document.getElementById('orbitalBgColorPicker');
   if(picker)picker.value=background;
   update();
  });
  update();
 });
})();
