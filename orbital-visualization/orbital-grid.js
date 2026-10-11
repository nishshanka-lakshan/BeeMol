/* BeeMol extracted JavaScript: orbital-visualization/orbital-grid.js */

const BOHR_TO_ANGSTROM = 0.529177210903;

// Follow VibeMol's Molden grid convention: use primitive coefficients and

// Cartesian/spherical angular polynomials directly, without an extra AO norm.

const ANGULAR_CONSTANTS = {

  s:1, p:1, d0:1, d1:1, d2:1,

  f0:1, f1:1, f2:1, f2m:1, f3:1

};

function parseMoldenForGrid(text){

  text = String(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const linesAll = text.split("\n");
  const section = (name) => {
    const start = linesAll.findIndex(line => {
      const header = line.match(/^\s*\[([^\]]+)\]/);
      return header && header[1].trim().toLowerCase() === name.toLowerCase();
    });
    if (start < 0) throw new Error(`Missing [${name}] section`);
    let end = start + 1;
    while (end < linesAll.length && !/^\s*\[/.test(linesAll[end])) end++;
    return linesAll.slice(start + 1, end);
  };
  if (/\[(?:6d|10f|15g)\]/i.test(text)) {
    throw new Error("Cartesian d/f/g functions are not supported by this browser viewer.");
  }
  const atomLines = section("Atoms");
  const atomHeader = linesAll.find(line => /^\s*\[Atoms\]/i.test(line));
  const factor = /ang/i.test(atomHeader) ? 1 / BOHR_TO_ANGSTROM : 1;
  const numeric = value => Number(value.replace(/[dD]/g, "E"));
  const atoms = atomLines.filter(line => line.trim() && !/^\s*[#!]/.test(line)).map(line => {
    const p = line.trim().split(/\s+/);
    if (p.length < 6) throw new Error("Invalid atom row in Molden file");
    const atom = {symbol:p[0], number:Number(p[2]), x:numeric(p[3])*factor,
                  y:numeric(p[4])*factor, z:numeric(p[5])*factor};
    if (![atom.number, atom.x, atom.y, atom.z].every(Number.isFinite)) {
      throw new Error("Invalid atom coordinates in Molden file");
    }
    return atom;
  });
  if (!atoms.length) throw new Error("No atoms found in [Atoms] section");

  const shells=[];

  const lines=section("GTO");

  let atomIndex=-1;

  for(let i=0;i<lines.length;){

    const p=lines[i].trim().split(/\s+/);

    if(!p[0]){i++;continue}

    if(/^\d+$/.test(p[0])){atomIndex=Number(p[0])-1;i++;continue}

    const l="spdf".indexOf(p[0].toLowerCase());

    if(l<0)throw new Error(`Unsupported GTO shell: ${p[0]}`);

    const count=Number(p[1]),scale=Number(p[2]) || 1;

    if(!atoms[atomIndex] || !Number.isInteger(count) || count<1)throw new Error("Invalid [GTO] section");

    const primitives=[];

    for(let k=0;k<count;k++){

      const q=lines[++i]?.trim().split(/\s+/);

      const a=Number(q?.[0]?.replace(/[dD]/g,"E"));

      const c=Number(q?.[1]?.replace(/[dD]/g,"E"))*scale;

      if(!(a>0) || !Number.isFinite(c))throw new Error("Invalid Gaussian primitive");

      primitives.push({a,c});

    }

    shells.push({atom:atoms[atomIndex],l,primitives,offset:0});

    i++;

  }

  let nAO=0;

  for(const shell of shells){shell.offset=nAO;nAO+=2*shell.l+1}

  const moText=section("MO").join("\n");

  const orbitals=[];

  let current=null;

  for(const line of moText.split(/\r?\n/)){

    const ene=line.match(/^\s*Ene\s*=\s*(\S+)/i);

    if(ene){

      if(current)orbitals.push(current);

      current={energy:Number(ene[1].replace(/[dD]/g,"E")),occup:null,spin:"Alpha",coeff:new Float64Array(nAO)};

      continue;

    }

    if(!current)continue;

    const occ=line.match(/^\s*Occup\s*=\s*(\S+)/i);

    const spin=line.match(/^\s*Spin\s*=\s*(\S+)/i);

    const c=line.match(/^\s*(\d+)\s+([-+\d.eEdD]+)\s*$/);

    if(occ)current.occup=Number(occ[1].replace(/[dD]/g,"E"));

    else if(spin)current.spin=spin[1];

    else if(c){

      const idx=Number(c[1])-1;

      if(idx<0||idx>=nAO)throw new Error("Orbital coefficient index exceeds the basis size");

      current.coeff[idx]=Number(c[2].replace(/[dD]/g,"E"));

    }

  }

  if(current)orbitals.push(current);

  if(!orbitals.length || !shells.length)throw new Error("No orbitals or basis functions found");

  return {atoms,shells,orbitals,nAO};

}

function moldenOrbitalAt(model,mo,x,y,z){

  const A=ANGULAR_CONSTANTS;

  let value=0;

  for(const shell of model.shells){

    const dx=x-shell.atom.x,dy=y-shell.atom.y,dz=z-shell.atom.z;

    const xx=dx*dx,yy=dy*dy,zz=dz*dz,r2=xx+yy+zz;

    let radial=0;

    for(const p of shell.primitives){

      const t=p.a*r2;

      if(t<48)radial+=p.c*Math.exp(-t);

    }

    if(Math.abs(radial)<1e-18)continue;

    const c=mo.coeff,o=shell.offset;

    let angular=0;

    if(shell.l===0) angular=A.s*c[o];

    else if(shell.l===1) angular=A.p*(c[o]*dx+c[o+1]*dy+c[o+2]*dz);

    else if(shell.l===2) angular=

      c[o]*A.d0*(2*zz-xx-yy)+c[o+1]*A.d1*dx*dz+c[o+2]*A.d1*dy*dz+

      c[o+3]*A.d2*(xx-yy)+c[o+4]*A.d1*dx*dy;

    else angular=

      c[o]*A.f0*dz*(2*zz-3*xx-3*yy)+

      c[o+1]*A.f1*dx*(4*zz-xx-yy)+c[o+2]*A.f1*dy*(4*zz-xx-yy)+

      c[o+3]*A.f2*dz*(xx-yy)+c[o+4]*A.f2m*dx*dy*dz+

      c[o+5]*A.f3*dx*(xx-3*yy)+c[o+6]*A.f3*dy*(3*xx-yy);

    value+=radial*angular;

  }

  return value;

}

// Keep the most recently visited grids in memory without growing with every orbital.

const orbitalCubeCache=new WeakMap();

function gridDimensions(){

  return ["gridX","gridY","gridZ"].map(id=>{

    const input=document.getElementById(id);

    const value=Math.max(12,Math.min(200,Math.round(Number(input.value)||Number(input.defaultValue))));

    input.value=value;

    return value;

  });

}

async function moldenOrbitalCube(model,n,detail,onProgress,isCurrent=()=>true){

  let cache=orbitalCubeCache.get(model);

  if(!cache){cache=new Map();orbitalCubeCache.set(model,cache)}

  const key=`${n}:${detail}`;

  if(cache.has(key)){

    const cube=cache.get(key);

    cache.delete(key);cache.set(key,cube);

    return cube;

  }

  const [nx,ny,nz]=detail;

  // Allow diffuse lobes to decay before they reach any face of the cube.

  // A larger domain matters especially at small isosurface cutoffs.

  const padding=10;

  const min=["x","y","z"].map(axis=>Math.min(...model.atoms.map(a=>a[axis]))-padding);

  const max=["x","y","z"].map(axis=>Math.max(...model.atoms.map(a=>a[axis]))+padding);

  const steps=[(max[0]-min[0])/(nx-1),(max[1]-min[1])/(ny-1),(max[2]-min[2])/(nz-1)];

  const fmt=v=>v.toExponential(7);

  const rows=["Orbital value from Molden coefficients","Computed in browser",

    `${model.atoms.length} ${min.map(fmt).join(" ")}`,

    `${nx} ${fmt(steps[0])} 0 0`,`${ny} 0 ${fmt(steps[1])} 0`,`${nz} 0 0 ${fmt(steps[2])}`];

  for(const a of model.atoms)rows.push(`${a.number} 0 ${fmt(a.x)} ${fmt(a.y)} ${fmt(a.z)}`);

  const mo=model.orbitals[n-1];

  for(let ix=0;ix<nx;ix++){

    const x=min[0]+ix*steps[0];

    for(let iy=0;iy<ny;iy++){

      const y=min[1]+iy*steps[1];

      let line=[];

      for(let iz=0;iz<nz;iz++){

        line.push(fmt(moldenOrbitalAt(model,mo,x,y,min[2]+iz*steps[2])));

        if(line.length===6){rows.push(line.join(" "));line=[]}

      }

      if(line.length)rows.push(line.join(" "));

    }

    if(ix%2===0){

      if(!isCurrent())return null;

      onProgress?.(ix+1,nx);

      await new Promise(resolve=>setTimeout(resolve,0));

    }

  }

  if(!isCurrent())return null;

  const cube=rows.join("\n")+"\n";

  cache.set(key,cube);

  while(cache.size>3)cache.delete(cache.keys().next().value);

  return cube;

}

async function loadCalculatedOrbital(number){

  const model=importedMolden;

  if(!model)return;

  const n=Number(number);

  if(!Number.isInteger(n)||n<1||n>model.orbitals.length){

    setOrbitalStatus(`Choose an orbital from 1 to ${model.orbitals.length}.`,true);return;

  }

  const token=++importLoadToken;

  const detail=gridDimensions();

  setOrbitalStatus(`Calculating orbital ${n} on the ${detail} grid…`);

  try{

    const cube=await moldenOrbitalCube(model,n,detail,(done,total)=>{

      if(token===importLoadToken)setOrbitalStatus(`Calculating orbital ${n}: ${Math.round(100*done/total)}%`);

    },()=>token===importLoadToken);

    if(token!==importLoadToken)return;

    await handleCubeFile(new File([cube],`orbital_${String(n).padStart(2,"0")}.cube`,{type:"text/plain"}),true,true);

    markActiveOrbitalRow(n);

    setOrbitalStatus(`Orbital ${n} displayed from the selected Molden file.`);

    document.getElementById("animationFrame").value=n;

    document.getElementById("animationFrameLabel").textContent=`Frame ${n} of ${model.orbitals.length}`;

    return true;

  }catch(error){setOrbitalStatus(`Could not calculate orbital ${n}: ${error.message}`,true);console.error(error)}

}

async function handleMoldenFile(file){

  if(!file)return;

  setOrbitalStatus(`Reading ${file.name}…`);

  try{

    const model=parseMoldenForGrid(await file.text());

    const xyzRows=model.atoms.map(a=>`${a.symbol} ${(a.x*BOHR_TO_ANGSTROM).toFixed(9)} ${(a.y*BOHR_TO_ANGSTROM).toFixed(9)} ${(a.z*BOHR_TO_ANGSTROM).toFixed(9)}`);

    const moleculeXYZ =

      `${xyzRows.length}\n${file.name}\n${xyzRows.join("\n")}`;

    // Send Molden geometry to the Molecule section

    document.getElementById("xyzInput").value = moleculeXYZ;

    // Send the same geometry to the Water box section

    document.getElementById("wbSolute").value = moleculeXYZ;

    // Invalidate any previously generated water box

    waterBoxXYZ = null;

    document.getElementById("wbDownload").disabled = true;

    document.getElementById("wbDownloadPDB").disabled = true;

    // Switch to the orbital viewer before calculating the surface

    switchViewerMode("orbitals");

    // Update the molecular geometry while its viewer is hidden

// Load the extracted Molden geometry

loadMolecule();

// Ensure the Three.js molecule scene is refreshed

    if (viewer && viewer.ready) {

      await viewer.ready;

      viewer.zoomTo();

      viewer.resize();

      viewer.render();

    }

    importedMolden = model;   

    embeddedActive=false;

    cubeData=null;

    document.getElementById("orbitalListBody").innerHTML="";

    renderOrbitalList(model.orbitals);

    document.getElementById("orbitalNumber").value="1";

    stopOrbitalAnimation();

    const animation=document.getElementById("orbitalAnimation");

    showOrbitalPropertiesTab("appearance");

    document.getElementById("animationFrame").max=model.orbitals.length;

    document.getElementById("animationFrame").value=1;

    document.getElementById("animationStart").value=1;

    document.getElementById("animationEnd").value=model.orbitals.length;

    document.getElementById("animationEnd").max=model.orbitals.length;

    document.getElementById("animationStart").max=model.orbitals.length;

    document.getElementById("animationFrameLabel").textContent=`Frame 1 of ${model.orbitals.length}`;

    await loadCalculatedOrbital(1);

  }catch(error){setOrbitalStatus(`Could not read Molden file: ${error.message}`,true);console.error(error)}

}

function showOrbitalNumber() {

  // 1. Molecular orbitals from an imported Molden file

  if (importedMolden) {

    stopOrbitalAnimation();

    loadCalculatedOrbital(

      document.getElementById("orbitalNumber").value

    );

    return;

  }

  // 2. Embedded Molden orbitals

  if (embeddedActive) {

    loadEmbeddedOrbital(

      document.getElementById("orbitalNumber").value

    );

    return;

  }

  // 3. Molecular orbitals from CUBE files

  if (cubeData) {

    const n = Number(

      document.getElementById("orbitalNumber").value

    );

    const file = cubeFiles.get(n);

    if (file) {

      handleCubeFile(file);

    } else {

      setOrbitalStatus(

        `Select the CUBE file for orbital ${n} using Open orbital CUBE.`,

        true

      );

    }

    return;

  }

  // 4. No orbital data loaded

  setOrbitalStatus(

    "Open a Molden or CUBE file to display an orbital.",

    true

  );

}

function fitOrbitalViewer() {

  if (!window.BeeMolThree) return;

  window.BeeMolThree.fit();

  window.BeeMolThree.resize();

}

function updateOrbitalAppearance() {

  if (cubeData) {

    renderCube();

    return;

  }

  if (importedMolden) {

    loadCalculatedOrbital(

      document.getElementById("orbitalNumber").value

    );

    return;

  }

  if (embeddedActive) {

    loadEmbeddedOrbital(

      document.getElementById("orbitalNumber").value

    );

  }

}

