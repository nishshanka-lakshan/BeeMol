/* Software H.264 fallback: bound decoder, filter, and encoder thread counts. */
'use strict';
const coreURL='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js';
let core;
const logs=[];
self.onmessage=async({data})=>{
 try{
  if(data.type==='load'){
   importScripts(coreURL);
   core=await createFFmpegCore({mainScriptUrlOrBlob:`${coreURL}#${btoa(JSON.stringify({wasmURL:coreURL.replace(/\.js$/,'.wasm')}))}`});
   core.setLogger(({message})=>{logs.push(message);if(logs.length>30)logs.shift()});
   core.setProgress(({progress})=>self.postMessage({type:'progress',progress}));
   self.postMessage({type:'ready'});
  }else if(data.type==='encode'){
   logs.length=0;
   core.FS.writeFile('input.webm',new Uint8Array(data.buffer));
   // FFmpeg's automatic thread counts can exhaust WASM memory at HD/4K sizes.
   // Limit the decoder, filter graph and x264 independently.
   core.exec('-threads','1','-i','input.webm','-an','-filter_threads','1',
    '-c:v','libx264','-threads','1','-preset','ultrafast','-crf','18',
    '-pix_fmt','yuv420p','-movflags','+faststart','-y','output.mp4');
   if(core.ret!==0)throw Error(`MP4 conversion failed (FFmpeg exit ${core.ret}). ${logs.slice(-8).join(' ')}`);
   const bytes=core.FS.readFile('output.mp4');
   self.postMessage({type:'complete',buffer:bytes.buffer},[bytes.buffer]);
  }
 }catch(error){self.postMessage({type:'error',message:error.message||String(error)})}
};
