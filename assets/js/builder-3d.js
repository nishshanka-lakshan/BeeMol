/* Interactive 3D molecular editing in the drawing dialog. */
window.BeeMolBuilder3D = async function(host, hooks) {
  const T = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
  const renderer = new T.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(2);renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor('#ffffff');
  host.replaceChildren(renderer.domElement);
  const scene=new T.Scene(), group=new T.Group();scene.add(group);
  const camera=new T.OrthographicCamera(-6,6,4,-4,.01,2000);let distance=14;
  scene.add(new T.HemisphereLight(0xffffff,0x9298a3,2.1));
  for(const [intensity,pos] of [[2,[4,7,11]],[.65,[-8,-3,5]]]){const light=new T.DirectionalLight(0xffffff,intensity);light.position.set(...pos);scene.add(light);}
  const ray=new T.Raycaster();let gesture=null;
  const position=a=>new T.Vector3((a.x-360)/45,(170-a.y)/45,a.z||0);
  const stored=p=>({x:p.x*45+360,y:170-p.y*45,z:p.z});
  const render=()=>renderer.render(scene,camera);
  function resize(){const w=host.clientWidth||720,h=host.clientHeight||380;renderer.setSize(w,h,false);const halfHeight=distance*Math.tan(42*Math.PI/360);camera.left=-halfHeight*w/h;camera.right=halfHeight*w/h;camera.top=halfHeight;camera.bottom=-halfHeight;camera.position.set(0,0,200);camera.updateProjectionMatrix();render();}
  function rebuild(){
    for(const object of [...group.children]){group.remove(object);object.traverse(child=>{child.geometry?.dispose();child.material?.map?.dispose();child.material?.dispose();});}
    const {atoms,bonds,selected,showLabels,showNumbers}=hooks.state();
    atoms.forEach((a,i)=>{
      const color=window.BeeMolAtomColors.get(a.elem);
      const mesh=new T.Mesh(new T.SphereGeometry(window.BeeMolBonding.displayRadius(a.elem),48,32),new T.MeshPhongMaterial({color,shininess:document.getElementById('moleculeAtomShine')?.checked?65:0,specular:document.getElementById('moleculeAtomShine')?.checked?0x555555:0x000000}));
      mesh.position.copy(position(a));mesh.userData.atom=i;
      if(i===selected){
        const outline=new T.Mesh(new T.SphereGeometry(window.BeeMolBonding.displayRadius(a.elem)*1.12,48,32),new T.MeshBasicMaterial({color:0x2583ff,side:T.BackSide}));
        mesh.add(outline);
      }
      group.add(mesh);
      if(showLabels||showNumbers){
        const text=(showLabels?a.elem:'')+(showLabels&&showNumbers?' ':'')+(showNumbers?String(i+1):'');
        const labelCanvas=document.createElement('canvas');labelCanvas.width=192;labelCanvas.height=64;
        const ctx=labelCanvas.getContext('2d');
        ctx.font='800 36px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#000000';ctx.fillText(text,96,32);
        const label=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(labelCanvas),depthTest:false,depthWrite:false}));
        label.position.copy(position(a));label.scale.set(.9,.3,1);label.userData.labelAtom=i;label.renderOrder=10;group.add(label);
      }
    });
    bonds.forEach((b,i)=>{
      const a=position(atoms[b.a]),end=position(atoms[b.b]),delta=end.clone().sub(a),len=delta.length();if(len<.001)return;
      let side=new T.Vector3().crossVectors(delta,new T.Vector3(0,0,1));if(side.length()<.001)side.crossVectors(delta,new T.Vector3(0,1,0));side.normalize();
      for(let lane=0;lane<b.order;lane++){
        const mesh=new T.Mesh(new T.CylinderGeometry(b.order>1?.065:.095,b.order>1?.065:.095,len,24),new T.MeshPhongMaterial({color:0xadb4c1,shininess:45,specular:0x444444}));
        mesh.position.copy(a).add(end).multiplyScalar(.5).addScaledVector(side,(lane-(b.order-1)/2)*.20);
        mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());mesh.userData.bond=i;mesh.userData.lane=lane;group.add(mesh);
      }
    });render();
  }
  function updatePositions(){
    const {atoms,bonds}=hooks.state();
    for(const mesh of group.children){
      if(mesh.userData.labelAtom!==undefined){mesh.position.copy(position(atoms[mesh.userData.labelAtom]));continue;}
      if(mesh.userData.atom!==undefined){mesh.position.copy(position(atoms[mesh.userData.atom]));continue;}
      const bond=bonds[mesh.userData.bond];
      if(!bond)continue;
      const a=position(atoms[bond.a]),b=position(atoms[bond.b]),delta=b.sub(a),length=delta.length();
      const side=new T.Vector3().crossVectors(delta,new T.Vector3(0,0,1));
      if(side.length()<.001)side.crossVectors(delta,new T.Vector3(0,1,0));side.normalize();
      mesh.position.copy(a).addScaledVector(delta,.5).addScaledVector(side,(mesh.userData.lane-(bond.order-1)/2)*.20);
      mesh.scale.y=length/mesh.geometry.parameters.height;
      if(length>.001)mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
    }
    render();
  }
  function setRay(event){const r=host.getBoundingClientRect();ray.setFromCamera(new T.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);}
  function hit(event){setRay(event);return ray.intersectObjects(group.children).find(hit=>hit.object.userData.atom!==undefined||hit.object.userData.bond!==undefined)?.object.userData;}
  function point(event, anchor){
    setRay(event);group.updateMatrixWorld(true);
    const world=group.localToWorld(anchor.clone());
    const plane=new T.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()),world);
    const p=ray.ray.intersectPlane(plane,new T.Vector3());return p?group.worldToLocal(p):anchor;
  }
  function rotationCenter(){
    const points=hooks.state().atoms.map(position);
    return points.length?new T.Box3().setFromPoints(points).getCenter(new T.Vector3()):new T.Vector3();
  }
  host.addEventListener('contextmenu',e=>e.preventDefault());
  host.addEventListener('pointerdown',e=>{
    if(hooks.busy())return;
    const picked=hit(e),tool=hooks.tool();
    const source=picked?.atom;
    gesture={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,source,picked,moved:false,
      rotate:tool==='rotate'||e.button===2,move:tool==='move'&&source!==undefined,
      pivot:rotationCenter(),
      anchor:source!==undefined?position(hooks.state().atoms[source]):new T.Vector3(0,0,hooks.depth()),saved:false};
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove',e=>{
    if(!gesture)return;const g=gesture;
    if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>5)g.moved=true;
    if(!g.moved&&!g.rotate)return;
    if(g.rotate){
      // Match the Molecule viewer: world Y first, then world X, 0.4 degrees per pixel.
      group.updateMatrixWorld(true);
      const worldPivot=group.localToWorld(g.pivot.clone());
      const radiansPerPixel=.4*Math.PI/180;
      group.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),(e.clientX-g.lastX)*radiansPerPixel));
      group.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),(e.clientY-g.lastY)*radiansPerPixel));
      group.position.copy(worldPivot).sub(g.pivot.clone().applyQuaternion(group.quaternion));
      render();
    }else if(g.move){
      if(!g.saved){hooks.save();g.saved=true;}
      Object.assign(hooks.state().atoms[g.source],stored(point(e,g.anchor)));rebuild();
    }
    g.lastX=e.clientX;g.lastY=e.clientY;
  });
  host.addEventListener('pointerup',e=>{
    const g=gesture;gesture=null;if(!g||g.rotate||g.move)return;
    const state=hooks.state(),tool=hooks.tool();
    if(g.moved&&tool==='draw'&&g.source!==undefined){
      const rect=host.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
      const target=hit(e)?.atom;
      if(target===g.source)return;
      if(target===undefined&&state.atoms.length>=100)return hooks.message('Maximum 100 drawn atoms.');
      hooks.save();
      let index=target;
      if(index===undefined){index=state.atoms.length;state.atoms.push({...hooks.atom(),...stored(point(e,g.anchor))});}
      const bond=state.bonds.find(b=>(b.a===g.source&&b.b===index)||(b.b===g.source&&b.a===index));
      if(bond)bond.order=Math.min(3,bond.order+1);else state.bonds.push({a:g.source,b:index,order:hooks.order()});
      hooks.select(g.source);
    }else if(!g.moved){
      const picked=g.picked;
      if(picked?.atom!==undefined){
        const i=picked.atom;
        if(tool==='erase'){hooks.save();hooks.remove(i);}
        else if(tool==='edit'){hooks.save();Object.assign(state.atoms[i],hooks.atom());hooks.select(i);}
        else hooks.select(i===state.selected?null:i);
      }else if(picked?.bond!==undefined&&(tool==='draw'||tool==='erase')){hooks.save();if(tool==='erase')state.bonds.splice(picked.bond,1);else if(tool==='draw')state.bonds[picked.bond].order=Math.min(3,state.bonds[picked.bond].order+1);}
      else if(tool==='select'){hooks.select(null);}
      else if(tool==='draw'){
        if(state.atoms.length>=100)return hooks.message('Maximum 100 drawn atoms.');
        hooks.save();state.atoms.push({...hooks.atom(),...stored(point(e,g.anchor))});hooks.select(state.atoms.length-1);
      }
    }
    hooks.changed();rebuild();
  });
  host.addEventListener('pointercancel',()=>{gesture=null;});
  host.addEventListener('lostpointercapture',()=>{gesture=null;});
  host.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(2,Math.min(150,distance*Math.exp(e.deltaY*.001)));resize();},{passive:false});
  new ResizeObserver(resize).observe(host);
  resize();
  return {rebuild,updatePositions,resize,fit(){const {atoms}=hooks.state();distance=Math.max(6,...atoms.map(a=>position(a).length()*3+3));resize();},reset(){group.quaternion.identity();group.position.set(0,0,0);resize();}};
};
