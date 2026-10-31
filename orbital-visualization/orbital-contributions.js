/* Coefficient-based AO decomposition in the same real-harmonic order as the grid evaluator. */
function orbitalContributions(model, number) {
 const mo=model?.orbitals[number-1];
 if(!mo)return null;
 const components=[['s'],['px','py','pz'],['d0','d+1','d−1','d+2','d−2'],['f0','f+1','f−1','f+2','f−2','f+3','f−3']];
 const rows=[],counts=new Map();
 let total=0;
 for(const shell of model.shells){
  const atom=model.atoms.indexOf(shell.atom),key=`${atom}:${shell.l}`;
  const contraction=(counts.get(key)||0)+1;counts.set(key,contraction);
  components[shell.l].forEach((component,i)=>{
   const index=shell.offset+i,coefficient=mo.coeff[index];
   if(!Number.isFinite(coefficient))throw Error('Invalid AO coefficient');
   const weight=coefficient*coefficient;total+=weight;
   rows.push({index,atom,label:`${shell.atom.symbol} ${atom+1} · ${contraction}${component}`,coefficient,weight});
  });
 }
 for(const row of rows)row.percent=total>0?100*row.weight/total:0;
 return rows.sort((a,b)=>b.weight-a.weight||a.index-b.index);
}
let contributionModel=null,contributionNumber=0,contributionToken=0,aoContributionMesh=false;
function filterOrbitalContributions(){
 const input=document.getElementById('aoCoefficientFilter');
 if(!input.validity.valid||input.value==='')return;
 const threshold=Number(input.value);
 const rows=[...document.querySelectorAll('#aoContributionBody tr')];
 let visible=0;
 for(const row of rows){
  const matches=Math.abs(Number(row.dataset.coefficient))>=threshold;
  row.hidden=!matches;
  if(matches)visible++;
 }
 document.getElementById('aoCoefficientCount').textContent=`${visible} / ${rows.length}`;
 document.getElementById('aoFilterEmpty').classList.toggle('hidden',!rows.length||visible>0);
}
function renderOrbitalContributions(model,number){
 contributionToken++;aoContributionMesh=false;contributionModel=model;contributionNumber=number;
 const panel=document.getElementById('orbitalContributions');
 panel.classList.remove('hidden');
 document.getElementById('aoContributionEmpty').classList.toggle('hidden',!!model);
 const body=document.getElementById('aoContributionBody');body.replaceChildren();
 if(!model){
  document.getElementById('aoContributionTitle').textContent='Atomic orbital contributions';
  filterOrbitalContributions();
  return;
 }
 document.getElementById('aoContributionTitle').textContent=`Atomic orbital contributions · MO ${number}`;
 const rows=orbitalContributions(model,number);
 for(const row of rows){
  const tr=document.createElement('tr');tr.dataset.coefficient=row.coefficient;
  const select=document.createElement('input');select.type='checkbox';select.value=row.index;select.setAttribute('aria-label',`Include ${row.label}`);
  select.addEventListener('change',()=>{
   if(recording||animationRunning){select.checked=!select.checked;setOrbitalStatus('Stop playback or recording before displaying AO contributions.',true);return}
   showAOContributionSelection();
  });
  const cell=document.createElement('td');cell.append(select);tr.append(cell);
  for(const value of [row.label,`${row.coefficient>=0?'+':''}${row.coefficient.toFixed(3)}`,`${row.percent.toFixed(2)}%`]){const td=document.createElement('td');td.textContent=value;if(tr.children.length===2)td.className='ao-signed-coefficient';tr.append(td)}
  body.append(tr);
 }
 filterOrbitalContributions();
}
async function showAOContributionSelection(full=false){
 const model=contributionModel,n=contributionNumber;if(!model)return;
 if(recording||animationRunning){setOrbitalStatus('Stop playback or recording before displaying AO contributions.',true);return}
 const indices=[...document.querySelectorAll('#aoContributionBody input:checked')].map(input=>Number(input.value));
 if(!indices.length)full=true;
 if(full)document.querySelectorAll('#aoContributionBody input:checked').forEach(input=>{input.checked=false});
 const token=++contributionToken;
 // Invalidate pending full-MO loads before computing a partial sum.
 ++importLoadToken;++orbitalLoadToken;
 const coeff=new Float64Array(model.orbitals[n-1].coeff.length);
 for(const i of indices)coeff[i]=model.orbitals[n-1].coeff[i];
 const partial={...model,orbitals:[{...model.orbitals[n-1],coeff}]};
 try{
  setOrbitalStatus(full?`Calculating full MO ${n}…`:`Calculating ${indices.length} selected AO contributions…`);
  const cube=await moldenOrbitalCube(full?model:partial,full?n:1,gridDimensions(),null,()=>token===contributionToken);
  if(token!==contributionToken)return;
  aoContributionMesh=!full;
  await handleCubeFile(new File([cube],`orbital_${n}${full?'':'_partial'}.cube`,{type:'text/plain'}),true,true);
  setOrbitalStatus(full?`Full MO ${n} displayed.`:`MO ${n}: weighted sum of ${indices.length} selected AOs displayed (Σ cμ χμ).`);
 }catch(error){if(token===contributionToken)setOrbitalStatus(error.message,true)}
}
if(typeof module!=='undefined')module.exports={orbitalContributions};
