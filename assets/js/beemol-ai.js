/* Dedicated BeeMol chat workspace. No generated HTML or automatic data storage. */
(function(){
'use strict';
function init(){
 const $=id=>document.getElementById(id);
 const workspace=document.createElement('section');
 workspace.id='aiWorkspace';workspace.className='hidden';workspace.setAttribute('aria-label','BeeMol AI chat workspace');
 workspace.innerHTML=`<aside class="ai-sidebar"><h2>BeeMol AI</h2><button id="aiNew">+ New chat</button><nav id="aiChatList" aria-label="Conversations"></nav><details><summary>Connection settings</summary><label>Backend endpoint<input id="aiEndpoint" value="http://127.0.0.1:8787/api/analyze"></label></details><p>Chats remain in memory until you close or reload this page. Download a chat to keep it.</p></aside>
 <div class="ai-main"><header class="ai-header"><div><strong>BeeMol research assistant</strong><small id="aiState">Connect your model for AI explanations</small></div><nav id="aiModes"><button data-ai-mode="molecule">Molecule</button><button data-ai-mode="orbitals">Orbitals</button><button data-ai-mode="water">Water box</button><button data-ai-mode="analysis">Analysis</button><button class="active" aria-current="page">AI</button></nav></header>
 <div id="aiMessages" role="log" aria-label="Chat messages" aria-live="polite"></div>
 <form id="aiComposer"><div class="ai-context"><label><input id="aiData" type="checkbox" checked> Visible autocorrelation datasets</label><label><input id="aiMetadata" type="checkbox"> Geometry and orbital metadata</label><span id="aiContextCount"></span></div><label class="ai-sr" for="aiQuestion">Message BeeMol AI</label><textarea id="aiQuestion" rows="3" placeholder="Ask about your molecular data or calculation results…"></textarea><div class="ai-actions"><small>Selected data is sent to the backend and its configured model. Raw plot transforms are not applied.</small><button id="aiCancel" type="button" disabled>Stop</button><button id="aiExport" type="button">Download chat</button><button id="aiSend" type="submit">Send ↑</button></div><p id="aiError" role="status"></p></form></div>`;
 document.body.append(workspace);
 const localPage=['localhost','127.0.0.1'].includes(window.location.hostname);
 // Keep the public site usable even if the separate config script is cached or unavailable.
 const defaultEndpoint=localPage?'http://127.0.0.1:8787/api/analyze':'https://beemol-ai.onrender.com/api/analyze';
 $('aiEndpoint').value=window.BEEMOL_API_ENDPOINT || defaultEndpoint;
 let chats=[],current=null,busy=false,controller=null;
 function newChat(){if(busy)return;current={id:Date.now()+'-'+Math.random(),title:'New chat',messages:[]};chats.unshift(current);render();}
 function render(){
  $('aiChatList').replaceChildren();
  for(const chat of chats){const b=document.createElement('button');b.textContent=chat.title;b.className=chat===current?'active':'';b.disabled=busy;b.onclick=()=>{current=chat;render();};$('aiChatList').append(b);}
  $('aiMessages').replaceChildren();
  if(!current.messages.length){const welcome=document.createElement('div');welcome.className='ai-welcome';welcome.innerHTML='<h1>What would you like to analyze?</h1><p>Ask about your loaded data, compare sampled autocorrelation peaks, or discuss the current molecular metadata.</p>';for(const q of ['Summarize my autocorrelation datasets.','What can these sampled maxima tell me?','Explain the limitations of this analysis.']){const b=document.createElement('button');b.textContent=q;b.onclick=()=>{$('aiQuestion').value=q;$('aiQuestion').focus();};welcome.append(b);}$('aiMessages').append(welcome);}
  for(const m of current.messages){const row=document.createElement('article');row.className='ai-message '+m.role;const title=document.createElement('strong');title.textContent=m.role==='user'?'You':'BeeMol AI';const text=document.createElement('div');text.className='ai-message-text';text.textContent=m.content;row.append(title,text);if(m.evidence){const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Computed evidence';const pre=document.createElement('pre');pre.textContent=JSON.stringify(m.evidence,null,2);details.append(summary,pre);row.append(details);}$('aiMessages').append(row);}
  $('aiMessages').scrollTop=$('aiMessages').scrollHeight;
 }
 function refreshCount(){const ds=window.BeeMolAnalysis?.getDatasets?.().filter(d=>d.visible)||[];$('aiContextCount').textContent=ds.length+' visible dataset(s)';}
 function open(){if(typeof stopOrbitalAnimation==='function')stopOrbitalAnimation();if(typeof arrangeOrbitalWorkspace==='function')arrangeOrbitalWorkspace(true);document.querySelector('main.container')?.classList.add('hidden');for(const id of ['orbitalWorkspace','analysisWorkspace','waterBoxWorkspace'])$(id)?.classList.add('hidden');workspace.classList.remove('hidden');refreshCount();$('aiQuestion').focus();}
 function close(){workspace.classList.add('hidden');document.querySelector('main.container')?.classList.remove('hidden');}
 // Add an AI control directly after every existing Analysis control.
 const anchors = [...document.querySelectorAll('button')]
  .filter(button =>
    !button.closest('#aiWorkspace') &&
    (
      button.id === 'analysisOpen' ||
      button.textContent.trim() === 'Analysis'
    )
  );
 
 for(const [i,anchor]of anchors.entries()){const b=document.createElement('button');b.type='button';b.textContent='AI';b.id=i===0?'aiOpen':'aiOpen'+i;b.onclick=open;anchor.after(b);}
 if(!anchors.length){const b=document.createElement('button');b.textContent='AI';b.onclick=open;document.querySelector('.top-actions')?.append(b);}
 $('aiModes').onclick=e=>{const mode=e.target.dataset.aiMode;if(!mode)return;close();if(mode==='analysis')$('analysisOpen')?.click();else if(mode==='water')$('wbOpen')?.click();else if(typeof switchViewerMode==='function')switchViewerMode(mode);};
 $('aiNew').onclick=newChat;
 $('aiCancel').onclick=()=>controller?.abort();
 $('aiExport').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='beemol-chat.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('aiQuestion').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('aiComposer').requestSubmit();}};
 $('aiComposer').onsubmit=async e=>{
 e.preventDefault();if(busy)return;const question=$('aiQuestion').value.trim();if(!question)return;
 let timer;const chat=current;
 try{
  if(!$('aiEndpoint').value.trim())$('aiEndpoint').value=window.BEEMOL_API_ENDPOINT || defaultEndpoint;
  const datasets=$('aiData').checked?(window.BeeMolAnalysis?.getDatasets?.().filter(d=>d.visible)||[]):[];const context={};
  if($('aiMetadata').checked){if(typeof getXYZAtoms==='function'&&$('xyzInput')?.value.trim())context.geometry={unit:'angstrom',atoms:getXYZAtoms()};if(typeof importedMolden!=='undefined'&&importedMolden){context.orbitals=importedMolden.orbitals.map((o,i)=>({number:i+1,energy:o.energy,occup:o.occup,spin:o.spin}));context.caution='Molden energies may be placeholders. Verify units and meaning from calculation provenance. No orbital coefficients supplied.';}}
  const history=chat.messages.filter(m=>!m.failed).map(m=>({role:m.role,content:m.content})).slice(-20);
  chat.messages.push({role:'user',content:question});if(chat.title==='New chat')chat.title=question.slice(0,44);$('aiQuestion').value='';
  busy=true;controller=new AbortController();timer=setTimeout(()=>controller.abort(),105000);$('aiSend').disabled=true;$('aiNew').disabled=true;$('aiCancel').disabled=false;$('aiError').textContent='';$('aiState').textContent='Analyzing…';render();
  const response=await fetch($('aiEndpoint').value.trim(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,datasets,context,history}),signal:controller.signal});const result=await response.json();
  if(!response.ok)throw Error(result.error||'Analysis request failed.');
  chat.messages.push({role:'assistant',content:result.answer||'Numerical analysis is complete. No language model is configured, so I cannot provide an AI explanation. Configure the backend model settings described in README.md.',evidence:result.evidence,mode:result.mode});$('aiState').textContent=result.mode==='model'?'Model: '+result.model:'Numerical mode • no AI model configured';
 }catch(error){const message=error.name==='AbortError'?'Request stopped or timed out. The backend may still complete its model request.':error.message;chat.messages.push({role:'assistant',content:message,failed:true});$('aiError').textContent=message;$('aiState').textContent='Request did not complete';}
 finally{clearTimeout(timer);busy=false;$('aiSend').disabled=false;$('aiNew').disabled=false;$('aiCancel').disabled=true;render();}
 };
 newChat();window.BeeMolAI={open,close};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
