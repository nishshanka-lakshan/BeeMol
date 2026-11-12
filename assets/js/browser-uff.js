/* JSmol's JavaScript UFF engine: runs entirely in the visitor's browser. */
(() => {
  'use strict';
  const base='https://chemapps.stolaf.edu/jmol/jsmol/';
  let ready,applet,pending=null;
  function initialize(){
    if(ready)return ready;
    ready=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=base+'JSmol.min.js';
      const timeout=setTimeout(()=>reject(Error('The browser optimizer could not load. Check your internet connection and retry.')),90000);
      script.onerror=()=>{clearTimeout(timeout);reject(Error('Could not download the browser optimizer.'));};
      script.onload=()=>{
        const host=document.createElement('div');
        host.style.cssText='position:fixed;left:-100px;top:0;width:16px;height:16px;overflow:hidden';
        host.setAttribute('aria-hidden','true');document.body.append(host);
        const info={width:16,height:16,use:'HTML5',j2sPath:base+'j2s',disableJ2SLoadMonitor:true,disableInitialConsole:true,
          readyFunction:instance=>{applet=instance;clearTimeout(timeout);resolve();},
          minimizationCallback:'BeeMolUFFProgress',script:'set frank off;set forceField "UFF";'};
        host.innerHTML=Jmol.getAppletHtml('beemolBrowserUFF',info);
      };
      document.head.append(script);
    }).catch(error=>{ready=null;throw error;});
    return ready;
  }
  function readMolecule(){
    const text=Jmol.evaluateVar(applet,'write("MOL")');
    if(typeof text!=='string')throw Error('Could not export optimized coordinates.');
    const rows=text.replace(/\r/g,'').split('\n');
    const header=rows.findIndex(row=>row.includes('V2000'));
    if(header<0)throw Error('The browser optimizer returned an unsupported molecule.');
    const count=Number(rows[header].slice(0,3)),bondCount=Number(rows[header].slice(3,6));
    const atoms=rows.slice(header+1,header+1+count).map(row=>({elem:row.slice(31,34).trim(),charge:0,x:Number(row.slice(0,10)),y:Number(row.slice(10,20)),z:Number(row.slice(20,30))}));
    if(!atoms.length||atoms.some(a=>![a.x,a.y,a.z].every(Number.isFinite)))throw Error('Could not optimize this structure.');
    const bonds=rows.slice(header+1+count,header+1+count+bondCount).map(row=>({a:Number(row.slice(0,3))-1,b:Number(row.slice(3,6))-1,order:Number(row.slice(6,9))}));
    const info=Jmol.getPropertyAsArray(applet,'atomInfo');
    if(Array.isArray(info)&&info.length===atoms.length){
      info.forEach((a,i)=>Object.assign(atoms[i],{charge:a.formalCharge||0,x:a.x,y:a.y,z:a.z}));
    }
    return {atoms,bonds};
  }
  window.BeeMolUFFProgress=function(_name,status,_step,energy){
    if(!pending)return;
    try{
      if(status==='running'||status==='done'){
        const atoms=Jmol.getPropertyAsArray(applet,'atomInfo');
        pending.frames.push(atoms.map(a=>[a.x,a.y,a.z]));
        if(pending.frames.length>101)pending.frames.splice(1,1);
      }
      if(status==='done')pending.finish(null,Number(Array.isArray(energy)?energy[0]:energy));
      else if(status==='failed')pending.finish(Error('UFF could not parameterize this structure. Check its bonding.'));
    }catch(error){pending.finish(error);}
  };
  window.BeeMolPreloadUFF=()=>initialize();
  window.BeeMolBrowserUFF=async function({structure,spin=0,signal,onLoading}){
    onLoading?.();await initialize();
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    return new Promise((resolve,reject)=>{
      let timer;
      const abort=()=>{Jmol.script(applet,'minimize stop');finish(new DOMException('Cancelled','AbortError'));};
      function finish(error,energy){
        if(!pending)return;
        const frames=pending.frames;pending=null;clearTimeout(timer);signal?.removeEventListener('abort',abort);
        if(error){reject(error);return;}
        try{
          const mol=readMolecule();
          const charge=mol.atoms.reduce((sum,a)=>sum+a.charge,0);
          const electrons=mol.atoms.reduce((sum,a)=>sum+window.BeeMolAtomColors.elements.indexOf(a.elem)+1,0)-charge;
          if(spin>electrons||(electrons-spin)%2)throw Error('The electron count and PySCF spin do not match. Adjust spin in the molecule settings.');
          const xyz=[String(mol.atoms.length),'BeeMol browser UFF; angstrom',...mol.atoms.map(a=>`${a.elem} ${a.x.toFixed(8)} ${a.y.toFixed(8)} ${a.z.toFixed(8)}`)].join('\n')+'\n';
          resolve({...mol,xyz,charge,spin,frames,forceField:'UFF',converged:true,energy,warnings:[]});
        }catch(error){reject(error);}
      }
      pending={frames:[],finish};
      timer=setTimeout(()=>{Jmol.script(applet,'minimize stop');finish(Error('Optimization timed out. Try a smaller structure.'));},30000);
      signal?.addEventListener('abort',abort,{once:true});
      // JSON quoting safely escapes the user-created MOL block as a Jmol string.
      Jmol.script(applet,'load inline '+JSON.stringify(structure)+';set forceField "UFF";set useMinimizationThread false;minimize ADDHYDROGENS STEPS 500;');
    });
  };
})();
