/* Load the software H.264 encoder only when native MP4 recording fails. */
const mp4EncoderWorkerURL = new URL('mp4-encoder-worker.js?v=20261030-mp4threads', document.currentScript.src);
window.BeeMolMP4 = {
  async create(status) {
    status('Loading MP4 software encoder…');
    const worker = new Worker(mp4EncoderWorkerURL);
    let rejectPending = null;
    function request(message, transfers = []) {
      return new Promise((resolve, reject) => {
        rejectPending = reject;
        worker.onerror = event => { rejectPending = null; reject(Error(event.message || 'MP4 encoder worker failed.')); };
        worker.onmessage = ({data}) => {
          if (data.type === 'progress') {
            if (Number.isFinite(data.progress)) status(`Converting to MP4… ${Math.round(Math.max(0, Math.min(1, data.progress)) * 100)}%`);
          } else if (data.type === 'error') {
            rejectPending = null; reject(Error(data.message));
          } else {
            rejectPending = null; resolve(data);
          }
        };
        worker.postMessage(message, transfers);
      });
    }
    const encoder = {
      async encode(blob) {
        status('Converting movie to H.264 MP4…');
        const buffer = await blob.arrayBuffer();
        const result = await request({type: 'encode', buffer}, [buffer]);
        if (!result.buffer?.byteLength) throw Error('The MP4 encoder produced an empty movie.');
        return new Blob([result.buffer], {type: 'video/mp4'});
      },
      dispose() {
        worker.terminate();
        rejectPending?.(Error('MP4 conversion cancelled.'));
        rejectPending = null;
      }
    };
    try {
      await request({type: 'load'});
      return encoder;
    } catch (error) {
      encoder.dispose();
      throw Error(`Could not load the MP4 software encoder. Check your internet connection and retry. ${error.message}`);
    }
  }
};
