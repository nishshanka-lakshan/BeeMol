/* Interactive molecule builder with installation-free browser UFF optimization. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const launch = document.createElement('button');
  launch.type = 'button'; launch.textContent = 'Draw molecule'; launch.id = 'drawMolecule';
  $('xyzInput').before(launch);
  const dialog = document.createElement('dialog');
  dialog.id = 'moleculeBuilder';
  dialog.innerHTML = `
    <form method="dialog" class="builder-heading"><h2>Draw a molecule</h2><button aria-label="Close molecule drawing">Close</button></form>
    <div id="builderDrawing">
      <div class="builder-tools">
        <details id="builderPeriodicPicker"><summary title="Choose an element from the periodic table">Element: <strong id="builderElementLabel">C</strong></summary><input id="builderElement" type="hidden" value="C"><div class="builder-periodic-scroll"><div id="builderPeriodicTable" role="group" aria-label="Periodic table"></div></div></details>
        <div class="builder-icon-tools" role="toolbar" aria-label="Molecule drawing tools">
          <button type="button" data-builder-tool="draw" aria-label="Draw atoms and bonds" title="Draw atoms and bonds" aria-pressed="true">✎</button>
          <button type="button" data-builder-tool="move" aria-label="Move atom" title="Move atom" aria-pressed="false">✥</button>
          <button type="button" data-builder-tool="rotate" aria-label="Rotate molecule" title="Rotate molecule" aria-pressed="false">⟳</button>
          <button type="button" data-builder-tool="edit" aria-label="Change atom: choose an element, then click an atom" title="Change atom: choose an element, then click an atom" aria-pressed="false">⚛</button>
          <button type="button" data-builder-tool="erase" aria-label="Erase atom or bond" title="Erase atom or bond" aria-pressed="false">⌫</button>
          <button type="button" id="builderLabels" aria-label="Show atom labels" title="Show atom labels" aria-pressed="false">Aa</button>
          <button type="button" id="builderNumbers" aria-label="Show atom numbers" title="Show atom numbers" aria-pressed="false">123</button>
        </div>
      </div>
      <div id="builderCanvas" aria-label="Interactive 3D molecule editor"></div>
      <div class="builder-icon-tools" role="toolbar" aria-label="Structure actions"><button id="builderUndo" type="button" aria-label="Undo last edit" title="Undo last edit">↶</button><button id="builderClear" type="button" aria-label="Clear molecule" title="Clear molecule">⌧</button><button id="builderBenzene" type="button" aria-label="Insert benzene template" title="Insert benzene template">⌬</button></div>
    </div>
    <div class="builder-icon-tools builder-run-tools" role="toolbar" aria-label="Optimization and use"><button id="builderOptimize" type="button" aria-label="Optimize molecule with UFF" title="Optimize molecule with UFF">⚡</button><button id="builderUse" type="button" aria-label="Use molecule in BeeMol and PySCF" title="Use molecule in BeeMol and PySCF" disabled>✓</button></div>
    <p id="builderStatus" role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const topTools=dialog.querySelector('[aria-label="Molecule drawing tools"]');
  ['builderUndo','builderClear','builderBenzene','builderOptimize','builderUse'].forEach(id=>topTools.append($(id)));
  dialog.querySelectorAll('[aria-label="Structure actions"],[aria-label="Optimization and use"]').forEach(el=>el.remove());
  const periods=[
    'H . . . . . . . . . . . . . . . . He',
    'Li Be . . . . . . . . . . B C N O F Ne',
    'Na Mg . . . . . . . . . . Al Si P S Cl Ar',
    'K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr',
    'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe',
    'Cs Ba La Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn',
    'Fr Ra Ac Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og',
    '. . . Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu',
    '. . . Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr'
  ];
  periods.forEach((period,row)=>period.split(' ').forEach((symbol,col)=>{
    if(symbol==='.')return;
    const number=window.BeeMolAtomColors.elements.indexOf(symbol)+1;
    const button=document.createElement('button');button.type='button';
    button.style.gridRow=row+1;button.style.gridColumn=col+1;
    button.dataset.element=symbol;button.title=`${symbol} — atomic number ${number}`;
    button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(symbol==='C'));
    button.innerHTML=`<small>${number}</small><strong>${symbol}</strong>`;
    button.onclick=()=>{
      $('builderElement').value=symbol;$('builderElementLabel').textContent=symbol;
      $('builderPeriodicTable').querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
      $('builderPeriodicPicker').open=false;
    };
    $('builderPeriodicTable').append(button);
  }));
  let atoms = [], bonds = [], selected = null, history = [], result = null, request = null;
  let activeTool = 'draw';
  dialog.querySelectorAll('[data-builder-tool]').forEach(button=>{
    button.addEventListener('click',()=>{
      activeTool=button.dataset.builderTool;
      dialog.querySelectorAll('[data-builder-tool]').forEach(tool=>tool.setAttribute('aria-pressed',String(tool===button)));
    });
  });
  let showLabels=false,showNumbers=false;
  ['builderLabels','builderNumbers'].forEach(id=>$(id).onclick=()=>{
    if(id==='builderLabels')showLabels=!showLabels;else showNumbers=!showNumbers;
    $(id).setAttribute('aria-pressed',String(id==='builderLabels'?showLabels:showNumbers));
    draw();
  });
  let editor = null;
  const editorReady = window.BeeMolBuilder3D($('builderCanvas'), {
    state:()=>({atoms,bonds,selected,showLabels,showNumbers}), busy:()=>!!request,
    tool:()=>activeTool, depth:()=>0,
    atom:()=>({elem:$('builderElement').value,charge:0}),
    order:()=>1, save,
    select:index=>{selected=index;},
    remove:removeAtom, changed:draw, message:text=>$('builderStatus').textContent=text
  }).then(view=>{editor=view;draw();return view;}).catch(error=>{
    $('builderStatus').textContent='Could not load the 3D editor. Check your connection and refresh.';
    $('builderCanvas').textContent=error.message;
  });
  function invalidate() {
    result = null; $('builderUse').disabled = true;
    $('builderStatus').textContent = '';
  }
  function save() {
    history.push(JSON.stringify({atoms, bonds, selected}));
    if (history.length > 100) history.shift();
    invalidate();
  }
  function draw() {
    editor?.rebuild();
    $('builderUndo').disabled = !history.length;
  }
  function removeAtom(index) {
    atoms.splice(index,1);
    bonds = bonds.filter(b => b.a!==index && b.b!==index).map(b=>({...b,a:b.a>index?b.a-1:b.a,b:b.b>index?b.b-1:b.b}));
    selected = null;
  }
  $('builderUndo').onclick=()=>{ if (!history.length) return; const previous=JSON.parse(history.pop()); ({atoms,bonds,selected}=previous); invalidate(); draw(); };
  $('builderClear').onclick=()=>{save();atoms=[];bonds=[];selected=null;draw();};
  $('builderBenzene').onclick=()=>{
    save(); atoms=Array.from({length:6},(_,i)=>({elem:'C',charge:0,x:360+85*Math.cos(i*Math.PI/3),y:170+85*Math.sin(i*Math.PI/3)}));
    bonds=atoms.map((a,i)=>({a:i,b:(i+1)%6,order:i%2?1:2})); selected=null; draw();
  };
  function molfile() {
    if (!atoms.length) throw Error('Draw at least one atom first.');
    const pad=n=>String(n).padStart(3,' ');
    const rows=['BeeMol sketch','  BeeMol            3D','',`${pad(atoms.length)}${pad(bonds.length)}  0  0  0  0            999 V2000`];
    atoms.forEach(a=>rows.push(`${((a.x-360)/45).toFixed(4).padStart(10)}${((170-a.y)/45).toFixed(4).padStart(10)}${(a.z||0).toFixed(4).padStart(10)} ${a.elem.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`));
    bonds.forEach(b=>rows.push(`${pad(b.a+1)}${pad(b.b+1)}${pad(b.order)}  0  0  0  0`));
    atoms.forEach((a,i)=>{if(a.charge) rows.push(`M  CHG  1${String(i+1).padStart(4)}${String(a.charge).padStart(4)}`);});
    rows.push('M  END'); return rows.join('\n');
  }
  launch.onclick=()=>{
    invalidate(); dialog.showModal(); draw(); editorReady.then(view=>view?.resize());
    window.BeeMolPreloadUFF?.().catch(()=>{});
  };
  $('builderOptimize').onclick=async()=>{
    let controls=[];
    try {
      const structure=molfile();
      const spin=Number($('spin').value);
      if ($('spin').value==='' || !Number.isInteger(spin) || spin<0) throw Error('Spin must be a nonnegative integer (2S).');
      invalidate(); request=new AbortController();
      controls=Array.from(dialog.querySelectorAll('input,select,button')).filter(el=>!el.disabled);
      controls.forEach(el=>el.disabled=true);
      $('builderStatus').textContent='Generating 3D coordinates and optimizing…';
      result=await window.BeeMolBrowserUFF({structure,spin,signal:request.signal,
        onLoading:()=>{$('builderStatus').textContent='Loading browser optimizer…';}});
      await saveOptimizedStructure(result);
      $('builderStatus').textContent=result.converged ? '' : 'UFF reached its iteration limit. Inspect the structure before use.';
    } catch(error) {
      $('builderStatus').textContent=error.name==='AbortError'?'Geometry request cancelled or timed out. Try a smaller molecule.':error instanceof TypeError?'Could not load the browser optimizer. Check your internet connection and refresh.':error.message;
    } finally {
      request=null; controls.forEach(el=>el.disabled=false); $('builderUse').disabled=!result; draw();
    }
  };
  async function saveOptimizedStructure(data) {
    history.push(JSON.stringify({atoms,bonds,selected}));
    const previous=atoms;
    const finalAtoms=data.atoms.map(a=>({elem:a.elem,charge:a.charge,x:360+a.x*45,y:170-a.y*45,z:a.z}));
    atoms=finalAtoms.map((a,i)=>previous[i]?{...a,x:previous[i].x,y:previous[i].y,z:previous[i].z||0}:{...a});
    bonds=data.bonds;selected=null;
    $('builderCanvas').scrollIntoView({block:'center',behavior:'smooth'});
    $('builderStatus').textContent='Relaxing atoms and bonds with UFF…';
    const frames=(data.frames||[]).map(frame=>frame.map(p=>({x:360+p[0]*45,y:170-p[1]*45,z:p[2]})));
    frames.push(finalAtoms);
    const startAtoms=atoms.map(a=>({...a}));
    const duration=300,started=performance.now();
    draw();
    await new Promise(resolve=>{
      let frameId,finished=false;
      const finish=()=>{
        if(finished)return;
        finished=true;cancelAnimationFrame(frameId);clearTimeout(deadline);resolve();
      };
      // Complete even when the browser throttles animation frames.
      const deadline=setTimeout(finish,1000);
      function tick() {
        if(finished)return;
        const now=performance.now();
        if(request?.signal.aborted){finish();return;}
        const progress=Math.min(1,(now-started)/duration);
        const position=progress*frames.length,index=Math.min(frames.length-1,Math.floor(position));
        const from=index===0?startAtoms:frames[index-1],to=frames[index];
        const mix=progress===1?1:position-index;
        atoms.forEach((a,i)=>{for(const key of ['x','y','z'])a[key]=from[i][key]+(to[i][key]-from[i][key])*mix;});
        try {editor?.updatePositions();}catch(error){finish();return;}
        if(progress<1)frameId=requestAnimationFrame(tick);else finish();
      }
      frameId=requestAnimationFrame(tick);
    });
    atoms=finalAtoms;draw();
  }
  $('builderUse').onclick=()=>{
    if (!result) return;
    $('xyzInput').value=result.xyz; $('charge').value=result.charge; $('spin').value=result.spin;
    $('charge').dispatchEvent(new Event('change',{bubbles:true}));
    $('spin').dispatchEvent(new Event('change',{bubbles:true}));
    $('xyzInput').dispatchEvent(new Event('change',{bubbles:true}));
    dialog.close();
  };
  dialog.addEventListener('cancel',()=>request?.abort());
  draw();
})();
