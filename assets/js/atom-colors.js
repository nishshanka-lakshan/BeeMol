/* One element palette for all molecule and orbital renderers. */
(function(){
 const defaults={H:'#ffffff',C:'#909090',N:'#3050f8',O:'#ff0d0d',F:'#90e050',Cl:'#1ff01f',Br:'#a62929',I:'#940094',S:'#ffff30',P:'#ff8000',Cu:'#c88033',Ag:'#c0c0c0',Au:'#ffd123'};
 const symbols='H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
 const custom=new Map();
 const storageKey='beemol-atom-colors';
 const validColor=color=>typeof color==='string'&&/^#[a-f\d]{6}$/i.test(color);
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
   for(const [element,color] of Object.entries(saved))if(symbols.includes(element)&&validColor(color))custom.set(element,color);
  }
 }catch(error){/* Colors still work when storage is unavailable or invalid. */}
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(Object.fromEntries(custom)))}catch(error){}}
 window.BeeMolAtomColors={
  symbol(number){return symbols[number-1]||String(number)},
  get(element){return custom.get(element)||defaults[element]||'#ff69b4'},
  set(element,color){if(!symbols.includes(element)||!validColor(color))return;custom.set(element,color);save();document.dispatchEvent(new Event('atomcolorschange'))},
  reset(){custom.clear();save();document.dispatchEvent(new Event('atomcolorschange'))}
 };
})();
