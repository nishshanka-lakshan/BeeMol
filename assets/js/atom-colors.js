/* One element palette for all molecule and orbital renderers. */
(function(){

 const symbols='H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
 // CPK/Jmol palette: https://jmol.sourceforge.net/jscolors/ (through Mt).
 // Matches every explicit CPK_COLORS entry in morbvis:
 // https://github.com/Yasuaki-Ito/morbvis/blob/master/src/components/MoleculeViewer.tsx
 // Ds–Og use display colors extended from neighboring chemical groups.
 const palette='ffffff d9ffff cc80ff c2ff00 ffb5b5 909090 3050f8 ff0d0d 90e050 b3e3f5 ab5cf2 8aff00 bfa6a6 f0c8a0 ff8000 ffff30 1ff01f 80d1e3 8f40d4 3dff00 e6e6e6 bfc2c7 a6a6ab 8a99c7 9c7ac7 e06633 f090a0 50d050 c88033 7d80b0 c28f8f 668f8f bd80e3 ffa100 a62929 5cb8d1 702eb0 00ff00 94ffff 94e0e0 73c2c9 54b5b5 3b9e9e 248f8f 0a7d8c 006985 c0c0c0 ffd98f a67573 668080 9e63b5 d47a00 940094 429eb0 57178f 00c900 70d4ff ffffc7 d9ffc7 c7ffc7 a3ffc7 8fffc7 61ffc7 45ffc7 30ffc7 1fffc7 00ff9c 00e675 00d452 00bf38 00ab24 4dc2ff 4da6ff 2194d6 267dab 266696 175487 d0d0e0 ffd123 b8b8d0 a6544d 575961 9e4fb5 ab5c00 754f45 428296 420066 007d00 70abfa 00baff 00a1ff 008fff 0080ff 006bff 545cf2 785ce3 8a4fe3 a136d4 b31fd4 b31fba b30da6 bd0d87 c70066 cc0059 d1004f d90045 e00038 e6002e eb0026 c0c0c0 ffd123 b8b8d0 a6544d 575961 9e4fb5 ab5c00 754f45 428296'.split(' ');
 const defaults=Object.fromEntries(symbols.map((symbol,i)=>[symbol,'#'+palette[i]]));
 defaults.Ghost='#ff69b4';
 const validElement=element=>element==='Ghost'||symbols.includes(element);
 const custom=new Map();
 const storageKey='beemol-atom-colors';
 const validColor=color=>typeof color==='string'&&/^#[a-f\d]{6}$/i.test(color);
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
   for(const [element,color] of Object.entries(saved))if(validElement(element)&&validColor(color))custom.set(element,color);
  }
 }catch(error){/* Colors still work when storage is unavailable or invalid. */}
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(Object.fromEntries(custom)))}catch(error){}}
 window.BeeMolAtomColors={
  elements:Object.freeze(symbols.slice()),
  export(){return Object.fromEntries(custom)},
  import(colors){custom.clear();for(const [element,color] of Object.entries(colors))if(validElement(element)&&validColor(color))custom.set(element,color);save();document.dispatchEvent(new Event('atomcolorschange'))},
  symbol(number){return Number(number)===0?'Ghost':symbols[number-1]||String(number)},
  get(element){return custom.get(element)||defaults[element]||'#ff69b4'},
  set(element,color){if(!validElement(element)||!validColor(color))return;custom.set(element,color);save();document.dispatchEvent(new Event('atomcolorschange'))},
  reset(){custom.clear();save();document.dispatchEvent(new Event('atomcolorschange'))}
 };
})();
