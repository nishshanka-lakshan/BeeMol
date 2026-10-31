/* Run with: node tests/movie-recording.cjs */
async function testMovieRecording(source) {
  const check = (condition, message) => { if (!condition) throw Error(message); };
  async function scenario(mode, slice = false) {
    const attempts = [], outputs = [], statuses = [], downloads = [], timers = [];
    let elapsed=0, lastCapture=null,converted=false,encoderDisposed=false;
    const tracks=[];
    const elements = new Map();
    const element = id => {
      if (!elements.has(id)) elements.set(id, {value: id === 'animationQuality' ? '1080' : id === 'animationFps' ? '6' : '1', disabled: false, style: {}, innerHTML: '', title: '', getAttribute() { return null; }, setAttribute() {}, removeAttribute() {}});
      return elements.get(id);
    };
    class Recorder {
      static isTypeSupported() { return true; }
      constructor(stream, options) { this.stream = stream; this.mimeType = options.mimeType; this.state = 'inactive'; attempts.push(this); }
      start() {
        this.state = 'recording';
        if (mode === 'fail' || mode === 'fallback' && this.stream.fps !== 24 || ['software','conversion-fail'].includes(mode) && this.mimeType.includes('mp4')) {
          // Model the browser reporting success at construction, then failing asynchronously.
          Promise.resolve().then(() => {
            this.state = 'inactive';
            this.onerror({error: Object.assign(Error('Encoder configuration rejected'), {name: 'EncodingError'})});
            this.onstop();
          });
        }
      }
      stop() { this.state = 'inactive'; this.ondataavailable({data: {size: 10}}); this.onstop(); }
      pause() { this.state = 'paused'; this.listeners.pause?.(); }
      resume() { this.state = 'recording'; this.listeners.resume?.(); }
      listeners = {};
      addEventListener(type, fn) { this.listeners[type] = fn; }
      removeEventListener(type) { delete this.listeners[type]; }
    }
    function createOutput(height) {
      const output = {height, width: height * 16 / 9, disposed: false, renders: 0, render() { this.renders++; }, dispose() { this.disposed = true; }, canvas: {captureStream() { throw Error('Must not capture the WebGL source'); }}};
      outputs.push(output); return output;
    }
    const env = {
      document: {documentElement: {dataset: {}}, addEventListener() {}, getElementById: element, querySelectorAll: () => [], createElement() {
        const canvas={getContext(type) { check(type==='2d','Record a 2D canvas'); return {drawImage() {}}; }, captureStream(fps) {
          lastCapture=canvas;
          const track={stopped:false,stop() { this.stopped=true; },requestFrame() {}};tracks.push(track);
          return {fps,getTracks:()=>[track],getVideoTracks:()=>[track]};
        }};return canvas;
      }},
      window: {BeeMolMP4:{async create(){return {async encode(blob){if(mode==='conversion-fail')throw Error('Conversion failed with diagnostics');check(blob.type.includes('webm'),'Encode the intermediate capture');converted=true;return {type:'video/mp4'}},dispose(){encoderDisposed=true}}}},MediaRecorder: Recorder, addEventListener() {}, BeeMolThree: {createMovieOutput: createOutput}},
      performance:{now:()=>elapsed},
      MediaRecorder: Recorder, console: {warn() {}}, importedMolden: {orbitals: [{}]}, cubeFiles: new Map(),
      setOrbitalStatus: message => statuses.push(message), orbitalActionIcon: () => '', clearTimeout() {},
      setTimeout(callback, delay) { timers.push(delay);elapsed+=Math.max(delay,0.001); callback(); },
      Blob: class {constructor(chunks, options) { this.type = options.type; }},
      displayFrame: async () => {}, downloadBlob: (blob, filename) => downloads.push({blob, filename}),
      options: slice ? {height: 2160, buttonId: 'slice', createOutput, filename: h => `slice_${h}p.mp4`} : mode==='pointer-click'?{type:'click',height:1,width:1}:{}
    };
    // Evaluate the application's real recording function against a small browser mock.
    await new Function('env', `with(env){${source}\n displayFrame=env.displayFrame; downloadBlob=env.downloadBlob; return recordMovie(env.options);}`)(env);
    check(outputs.every(output => output.disposed), 'Every renderer must be released');
    check(tracks.every(track=>track.stopped),'Stop every capture track');
    check(!element(slice ? 'slice' : 'animationRecord').disabled, 'Recording button must be restored');
    if (mode==='fail'||mode==='conversion-fail') {
      check(!downloads.length, 'Failed encoders must not produce a download');
      check(statuses.at(-1).includes(mode==='fail'?'EncodingError: Encoder configuration rejected':'Conversion failed with diagnostics'),'Keep the underlying encoder error');
      if(mode==='conversion-fail')check(encoderDisposed,'Dispose failed software encoder');
    } else {
      check(downloads.length === 1, 'Produce exactly one movie');
      check(downloads[0].filename.endsWith('.mp4'), 'Filename must match the encoded format');
      check(downloads[0].blob.type.includes('mp4'), 'Blob type must match its extension');
      check(timers.filter(delay=>delay<300).reduce((a,b)=>a+b,0)>=1000/6,'Hold each orbital for the selected playback duration');
      if(mode!=='software')check(attempts.every(attempt=>attempt.mimeType==='video/mp4;codecs=avc1'),'Use the same H.264 MIME type as analysis');
      else check(converted&&encoderDisposed&&outputs.at(-1).height<=1080,'Software fallback must produce MP4, limit resolution, and clean up');
      if(mode==='pointer-click')check(outputs[0].height===1080&&lastCapture.width===1920&&lastCapture.height===1080,'PointerEvent height must not override movie quality');
      if (mode === 'fallback') {
        check(attempts.at(-1).stream.fps===24 && outputs.at(-1).height===720,'Retry at 720p, 24 FPS with default bitrate');
      }
    }
  }
  await scenario('success');
  await scenario('pointer-click');
  await scenario('fallback', true);
  await scenario('fail');
  await scenario('software',true);
  await scenario('conversion-fail');
  return 'Movie recording checks passed (MP4, asynchronous failures, 2D capture, reduced-quality retries, software fallback, filenames, playback speed, cleanup).';
}
if (typeof module !== 'undefined') {
  testMovieRecording(require('node:fs').readFileSync(require('node:path').join(__dirname, '../orbital-visualization/orbital-renderer.js'), 'utf8'))
    .then(console.log).catch(error => { console.error(error); process.exitCode = 1; });
}
