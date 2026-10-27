/* BeeMol energy-state phase diagrams and autocorrelation analysis. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const HBAR = 0.6582119569;
  const colors = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
  function numbers(text, name) {
    if (name === 'Energies') {
      const array = text.match(/(?:energies\s*=\s*)?(?:np\.array\s*\(\s*)?\[([\s\S]*?)\]/);
      if (array) text = array[1];
      text = text.replace(/#[^\n]*/g, '').trim().replace(/[,;]+$/, '');
    }
    if (/[,;]\s*[,;]/.test(text)) throw Error(`${name} contains an empty value.`);
    const tokens = text.trim().split(/[\s,;]+/);
    const values = tokens.map(Number);
    if (!text.trim() || !values.every(Number.isFinite)) throw Error(`${name} must contain finite numbers separated by commas or spaces.`);
    return values;
  }
  function calculate(energies, weights, time) {
    const phases = energies.map(energy => -energy * time / HBAR);
    if (!phases.every(Number.isFinite)) throw Error('Phase calculation exceeds the numeric range.');
    const real = phases.reduce((sum, phase, i) => sum + weights[i] * Math.cos(phase), 0);
    const imaginary = phases.reduce((sum, phase, i) => sum + weights[i] * Math.sin(phase), 0);
    return { phases, degrees: phases.map(p => Math.atan2(Math.sin(p), Math.cos(p)) * 180 / Math.PI), real, imaginary, magnitude: Math.hypot(real, imaginary) };
  }
  function complexAnalysis(energies, time) {
    const counts = new Map();
    energies.forEach(energy => counts.set(energy, (counts.get(energy) || 0) + 1));
    const rows = Array.from(counts, ([energy, count]) => {
      const phase = -energy * time / HBAR;
      const abs = count / energies.length;
      const real = abs * Math.cos(phase), imaginary = abs * Math.sin(phase);
      return { energy, count, phase: Math.atan2(imaginary, real) * 180 / Math.PI, real, imaginary, abs };
    }).sort((a, b) => a.energy - b.energy);
    const real = rows.reduce((sum, row) => sum + row.real, 0);
    const imaginary = rows.reduce((sum, row) => sum + row.imaginary, 0);
    const magnitude = Math.hypot(real, imaginary);
    rows.forEach(row => {
      const projection = row.real * real + row.imaginary * imaginary;
      row.absPercent = magnitude > 1e-12 ? 100 * row.abs / magnitude : null;
      row.signedPercent = magnitude > 1e-12 ? 100 * projection / magnitude ** 2 : null;
      row.magnitudeContribution = magnitude > 1e-12 ? projection / magnitude : null;
    });
    return { time, rows, real, imaginary, magnitude, phase: Math.atan2(imaginary, real) * 180 / Math.PI };
  }

  window.BeeMolAutocorrelationPhase = {
    calculate,
    parseEnergies: text => numbers(text, 'Energies'),
    complexAnalysis,

    create({ esc, status }) {
      let movieTime = null;
      let playback = 0;
      let recording = false;
      let cancelMovie = false;
      let savedMoviePage = null;
      function addControls() {
        const panel = document.createElement('div');
        panel.id = 'analysisPhaseControls';
        panel.hidden = true;
        panel.innerHTML = `
          <label>Energies (eV)<textarea id="phaseEnergies" rows="6">9.48597498\n9.64759866\n9.79868413\n10.11190609\n10.21071695</textarea></label>
          <label>Search start (fs)<input id="phaseSearchStart" type="number" value="0" step="0.1"></label>
          <label>Search end (fs)<input id="phaseSearchEnd" type="number" value="1000" step="0.1"></label>
          <label>Minimum prominence<input id="phaseProminence" type="number" min="0" step="0.01" value="0.04"></label>
          <label>Detected maxima<select id="phaseMaxima"><option value="">Find maxima first</option></select></label>
          <p class="mini-note">Analytical phase analysis from energies. Maxima use the equal-population model |A(t)|; repeated energies represent degeneracy.</p>
          <label>Selected times (fs)<input id="phaseTimes" value="4.036, 6.753"></label>
          <label>Figure layout<select id="phaseLayout"><option value="1">Single figure (one time)</option><option value="2" selected>2 panels (1 × 2)</option><option value="4">4 panels (2 × 2)</option><option value="6">6 panels (2 × 3)</option><option value="9">9 panels (3 × 3)</option><option value="16">16 panels (4 × 4)</option></select></label>
          <label>Times in this figure<select id="phaseFigurePage"></select></label>
          <section class="phase-player" aria-labelledby="phasePlayerHeading">
            <div class="phase-player-heading"><h3 id="phasePlayerHeading">Phase movie</h3><span>PLAYER</span></div>
            <label class="phase-player-loop"><input id="phaseMovieShowAnalytical" type="checkbox" checked> Show analytical autocorrelation</label>
            <label class="phase-player-loop"><input id="phaseMovieShowPhase" type="checkbox" checked> Show phase figure</label>
            <output id="phaseMovieReadout" class="phase-player-clock" aria-live="off">0.000000 fs</output>
            <label class="phase-player-timeline">Timeline<input id="phaseMovieTimeline" type="range" min="0" max="10000" step="1" value="0"></label>
            <div class="phase-player-transport">
              <button id="phaseMovieBack" type="button" aria-label="Previous frame" title="Previous frame">◀│</button>
              <button id="phaseMoviePlay" class="phase-player-primary" type="button">▶ Play</button>
              <button id="phaseMoviePause" type="button">Ⅱ Pause</button>
              <button id="phaseMovieForward" type="button" aria-label="Next frame" title="Next frame">│▶</button>
            </div>
            <label>Go to time (fs)<input id="phaseMovieCurrent" type="number" value="0" step="0.001"></label>
            <label>Black dot size (px)<input id="phaseMovieDotSize" type="number" min="1" max="40" step="1" value="40"></label>
            <label>Space between plots (px)<input id="phaseMoviePlotGap" type="number" min="0" max="300" step="5" value="0"></label>
            <p class="mini-note">Pinch on the figure to zoom both panels. Double-click to reset zoom.</p>
            <label>Text to resize<select id="phaseMovieFontTarget">
              <option value="Legend">State annotations / legend</option>
              <option value="XLabel">X-axis labels</option>
              <option value="YLabel">Y-axis labels</option>
              <option value="XTick">X-axis numbers</option>
              <option value="YTick">Y-axis numbers</option>
              <option value="Title">Figure titles</option>
            </select></label>
            <label>Font size (px)<input id="phaseMovieFontSize" type="number" min="8" max="48" step="1" value="20"></label>
            <div class="phase-player-fields">
              <label>Start (fs)<input id="phaseMovieStart" type="number" value="0" step="0.1"></label>
              <label>End (fs)<input id="phaseMovieEnd" type="number" value="10" step="0.1"></label>
            </div>
            <div class="phase-player-caption" id="phaseSpeedLabel">Playback speed</div>
            <input id="phaseMovieSpeed" type="hidden" value="1">
            <div class="phase-player-segments" role="group" aria-labelledby="phaseSpeedLabel">${[0.1, 0.25, 0.5, 1, 2].map(speed => `<button type="button" data-phase-speed="${speed}" aria-pressed="${speed === 1}">${speed}×</button>`).join('')}</div>
            <div class="phase-player-caption" id="phaseFPSLabel">Frames per second</div>
            <input id="phaseMovieFPS" type="hidden" value="30">
            <div class="phase-player-segments" role="group" aria-labelledby="phaseFPSLabel">${[24, 30, 60].map(fps => `<button type="button" data-phase-fps="${fps}" aria-pressed="${fps === 30}">${fps}</button>`).join('')}</div>
            <label class="phase-player-loop"><input id="phaseMovieLoop" type="checkbox"> Loop playback</label>
            <div class="phase-player-fields">
              <button id="phaseMovieRestart" type="button">↺ Restart</button>
              <button id="phaseMovieStop" type="button">Restore figure</button>
            </div>
            <button id="phaseMovieDownload" class="phase-player-download" type="button">↓ Download movie</button>
            <p class="mini-note">Drag to explore. Pause and step to inspect. At 1×, the selected range plays over two minutes. Slower speeds also apply to the downloaded movie.</p>
          </section>
          `;
        const sidebar = document.querySelector('#analysisWorkspace > aside:last-child');
        const plotPanel = sidebar.querySelector('.analysis-pad');
        plotPanel.id = 'analysisSettingsPanel';
        plotPanel.setAttribute('role', 'tabpanel');
        plotPanel.setAttribute('aria-labelledby', 'analysisSettingsTab');
        const moviePanel = document.createElement('div');
        moviePanel.id = 'analysisMoviePanel';
        moviePanel.hidden = true;
        moviePanel.setAttribute('role', 'tabpanel');
        moviePanel.setAttribute('aria-labelledby', 'analysisMovieTab');
        const player = panel.querySelector('.phase-player');
        moviePanel.append(player);
        sidebar.append(moviePanel);
        const energyPanel = document.createElement('div');
        energyPanel.id = 'analysisEnergyPanel';
        energyPanel.hidden = true;
        energyPanel.setAttribute('role', 'tabpanel');
        energyPanel.setAttribute('aria-labelledby', 'analysisEnergyTab');
        sidebar.append(energyPanel);
        const phasePanel = document.createElement('div');
        phasePanel.id = 'analysisPhasePanel';
        phasePanel.hidden = true;
        phasePanel.setAttribute('role', 'tabpanel');
        phasePanel.setAttribute('aria-labelledby', 'analysisPhaseTab');
        sidebar.append(phasePanel);
        const sharedFigureControls = document.createElement('div');
        sharedFigureControls.className = 'phase-figure-controls';
        const maximaLabel = panel.querySelector('#phaseMaxima').closest('label');
        const maximaNote = maximaLabel.nextElementSibling;
        sharedFigureControls.append(maximaLabel, maximaNote);
        for (const id of ['phaseTimes', 'phaseLayout', 'phaseFigurePage']) {
          sharedFigureControls.append(panel.querySelector(`#${id}`).closest('label'));
        }
        phasePanel.append(sharedFigureControls);
        for (const [host, id, value] of [
          [phasePanel, 'phaseFigureTitle', ''],
          [moviePanel, 'phaseMovieTitle', ''],
          [energyPanel, 'analyticalFigureTitle', '']
        ]) {
          const label = document.createElement('label');
          label.className = 'analysis-view-title';
          label.textContent = 'Figure title';
          const input = document.createElement('input');
          input.id = id;
          input.value = value;
          label.append(input);
          if (id === 'phaseMovieTitle') label.hidden = true;
          host.prepend(label);
          input.addEventListener('input', () => {
            if (id === 'analyticalFigureTitle') document.dispatchEvent(new Event('analyticaltitlechange'));
            else draw();
          });
        }
        const tabs = document.createElement('div');
        tabs.className = 'analysis-sidebar-tabs';
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Analysis controls');
        tabs.innerHTML = `<button id="analysisSettingsTab" type="button" role="tab" aria-controls="analysisSettingsPanel" aria-selected="true">Plot settings</button>
          <button id="analysisPhaseTab" type="button" role="tab" aria-controls="analysisPhasePanel" aria-selected="false" tabindex="-1" hidden>Phase</button>
          <button id="analysisMovieTab" type="button" role="tab" aria-controls="analysisMoviePanel" aria-selected="false" tabindex="-1" hidden>Movie</button>
          <button id="analysisEnergyTab" type="button" role="tab" aria-controls="analysisEnergyPanel" aria-selected="false" tabindex="-1" hidden>Analytical autocorrelation</button>`;
        sidebar.querySelector('.card-header').replaceChildren(tabs);
        const ordinarySettingsHeading = document.createElement('h2');
        ordinarySettingsHeading.className = 'ordinary-analysis-settings-heading';
        ordinarySettingsHeading.textContent = 'Plot settings';
        sidebar.querySelector('.card-header').append(ordinarySettingsHeading);
        const tabPanels = [['analysisSettingsTab', plotPanel], ['analysisPhaseTab', phasePanel], ['analysisMovieTab', moviePanel], ['analysisEnergyTab', energyPanel]];
        const activateTab = activeId => {
          $('analysisWorkspace').classList.toggle('analysis-movie-compare', activeId === 'analysisMovieTab');
          phasePanel.querySelector('.analysis-view-title').after(sharedFigureControls);
          for (const [id, content] of tabPanels) {
            const selected = id === activeId;
            content.hidden = !selected;
            $(id).setAttribute('aria-selected', String(selected));
            $(id).tabIndex = selected ? 0 : -1;
          }
          document.dispatchEvent(new CustomEvent('analysisfigureview', { detail: activeId }));
        };
        for (const [id] of tabPanels) $(id).onclick = () => activateTab(id);
        tabs.addEventListener('keydown', event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const visible = tabPanels.map(([id]) => $(id)).filter(tab => !tab.hidden);
          const current = visible.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
          const index = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 :
            (current + (event.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length;
          activateTab(visible[index].id);
          visible[index].focus();
        });
        const positions = [
          ['default', 'Default / around state arrows'], ['top', 'Top center'], ['top-left', 'Top left'],
          ['top-right', 'Top right'], ['inside-top-left', 'Inside top left'],
          ['inside-top-right', 'Inside top right'], ['bottom', 'Bottom center']
        ];
        const targets = [['Time', 'Time'], ['Phases', 'Phase angles'],
          ['Magnitude', '|A(t)|'], ['PanelLetters', 'Panel letters']];
        const settings = document.createElement('div');
        settings.id = 'phaseAnnotationSettings';
        settings.hidden = true;
        settings.innerHTML = `
          <label>Select legend / annotation<select id="phaseAnnotationTarget">${targets.map(([key, label]) =>
            `<option value="${key}">${label}</option>`).join('')}</select></label>
          <label><input id="phaseAnnotationVisible" type="checkbox" checked> Show selected annotation</label>
          <label>Position<select id="phaseAnnotationPosition">${positions.map(([key, label]) =>
            `<option value="${key}">${label}</option>`).join('')}</select></label>
          <label>Legend horizontal offset (px)<input id="phaseAnnotationX" type="number" step="5" value="0"></label>
          <label>Legend vertical offset (px)<input id="phaseAnnotationY" type="number" step="5" value="0"></label>
          <label>Panel size (px)<input id="phasePanelSize" type="number" min="360" max="900" value="560" step="20"></label>`;
        const state = document.createElement('div');
        state.hidden = true;
        state.innerHTML = targets.map(([key]) => `<input id="phaseShow${key}" type="checkbox" checked>
          <input id="phase${key}Position" value="${key === 'Phases' ? 'inside-top-left' : ['Time', 'Magnitude'].includes(key) ? 'inside-top-right' : 'default'}"><input id="phase${key}X" value="0"><input id="phase${key}Y" value="${key === 'Magnitude' ? 28 : 0}">`).join('');
        settings.append(state);
        phasePanel.append(settings);
        const exports = document.createElement('div');
        exports.className = 'analysis-actions phase-export-actions';
        exports.innerHTML = `<label>PNG resolution<select id="phaseExportScale"><option value="4">4×</option><option value="6" selected>6× (high resolution)</option><option value="8">8×</option></select></label>
          <button id="phaseExportSVG" type="button">Download phase SVG</button>
          <button id="phaseExportPNG" type="button">Download phase PNG</button>`;
        phasePanel.append(exports);
        $('phaseExportSVG').onclick = () => $('analysisSVG').click();
        $('phaseExportPNG').onclick = () => $('analysisPNG').click();
        const target = $('phaseAnnotationTarget');
        const sync = () => {
          $('phaseAnnotationVisible').checked = $(`phaseShow${target.value}`).checked;
          for (const suffix of ['Position', 'X', 'Y']) {
            $(`phaseAnnotation${suffix}`).value = $(`phase${target.value}${suffix}`).value;
          }
        };
        target.addEventListener('change', sync);
        $('phaseAnnotationVisible').addEventListener('input', () => {
          $(`phaseShow${target.value}`).checked = $('phaseAnnotationVisible').checked;
          draw();
        });
        for (const suffix of ['Position', 'X', 'Y']) {
          $(`phaseAnnotation${suffix}`).addEventListener('input', () => {
            $(`phase${target.value}${suffix}`).value = $(`phaseAnnotation${suffix}`).value;
            draw();
          });
        }
        $('phasePanelSize').addEventListener('input', draw);
        sync();
        const uploadLabel = $('analysisFiles').closest('label');
        const uploadInstructions = uploadLabel.nextElementSibling;
        const anchor = uploadInstructions?.matches('.mini-note') ? uploadInstructions : uploadLabel;
        anchor.after(panel);
        [...panel.querySelectorAll('input, textarea, select'), ...player.querySelectorAll('input, select'), ...sharedFigureControls.querySelectorAll('input, select')]
          .filter(input => !['phaseMovieTimeline', 'phaseMovieCurrent'].includes(input.id))
          .forEach(input => input.addEventListener('input', draw));
        for (const [attribute, id] of [['data-phase-speed', 'phaseMovieSpeed'], ['data-phase-fps', 'phaseMovieFPS']]) {
          player.querySelectorAll(`[${attribute}]`).forEach(button => {
            button.onclick = () => {
              $(id).value = button.getAttribute(attribute);
              player.querySelectorAll(`[${attribute}]`).forEach(other => other.setAttribute('aria-pressed', String(other === button)));
              $(id).dispatchEvent(new Event('change'));
            };
          });
        }
        $('phaseMoviePlay').onclick = playMovie;
        $('phaseMovieStop').onclick = stopAnimation;
        $('phaseMovieDownload').onclick = downloadMovie;
        $('phaseMoviePause').onclick = pauseMovie;
        $('phaseMovieBack').onclick = () => stepMovie(-1);
        $('phaseMovieForward').onclick = () => stepMovie(1);
        $('phaseMovieRestart').onclick = () => { seekMovie(Number($('phaseMovieStart').value)); };
        $('phaseMovieTimeline').oninput = () => {
          try { const { start, end } = movieSettings(); seekMovie(start + (end - start) * Number($('phaseMovieTimeline').value) / 10000); }
          catch (error) { status(error.message); }
        };
        $('phaseMovieCurrent').onchange = () => seekMovie(Number($('phaseMovieCurrent').value));
        for (const id of ['phaseMovieStart', 'phaseMovieEnd', 'phaseMovieFPS', 'phaseMovieSpeed']) {
          $(id).addEventListener('change', () => { if (playback) { pauseMovie(); playMovie(); } });
        }
        for (const id of ['phaseEnergies', 'phaseSearchStart', 'phaseSearchEnd', 'phaseProminence']) {
          $(id).addEventListener('input', () => {
            $('phaseMaxima').innerHTML = '<option value="">Find maxima first</option>';
            draw();
          });
        }
      }

      function findMaxima() {
        try {
          const start = Number($('phaseSearchStart').value);
          const end = Number($('phaseSearchEnd').value);
          if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw Error('Search start must be smaller than search end.');
          const energies = numbers($('phaseEnergies').value, 'Energies');
          if (energies.length > 100) throw Error('Use at most 100 energy groups.');
          const weights = energies.map(() => 1 / energies.length);
          const evaluate = time => calculate(energies, weights, time).magnitude;
          const points = Array.from({ length: 20001 }, (_, i) => {
            const time = start + (end - start) * i / 20000;
            return [time, evaluate(time)];
          });
          if (points.length < 3) throw Error('At least three samples are needed in the search range.');
          const prominence = Number($('phaseProminence').value);
          if (!Number.isFinite(prominence) || prominence < 0) throw Error('Prominence must be nonnegative.');
          let peaks = [];
          // Endpoints are excluded: a local maximum needs samples on both sides.
          for (let i = 1; i < points.length - 1; i++) {
            let j = i;
            while (j + 1 < points.length && points[j + 1][1] === points[i][1]) j++;
            if (j < points.length - 1 && points[i][1] > points[i - 1][1] && points[j][1] > points[j + 1][1]) {
              let time = (points[i][0] + points[j][0]) / 2;
              if (evaluate) {
                let lo = points[i - 1][0], hi = points[j + 1][0];
                for (let k = 0; k < 40; k++) {
                  const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
                  if (evaluate(a) < evaluate(b)) lo = a; else hi = b;
                }
                time = (lo + hi) / 2;
              }
              let leftMin = points[i][1], rightMin = points[j][1];
              for (let k = i - 1; k >= 0 && points[k][1] <= points[i][1]; k--) leftMin = Math.min(leftMin, points[k][1]);
              for (let k = j + 1; k < points.length && points[k][1] <= points[i][1]; k++) rightMin = Math.min(rightMin, points[k][1]);
              if (points[i][1] - Math.max(leftMin, rightMin) >= prominence) peaks.push([time, evaluate ? evaluate(time) : points[i][1]]);
            }
            i = j;
          }
          peaks.sort((a, b) => a[0] - b[0]);
          draw();
          $('phaseMaxima').innerHTML = peaks.length ? peaks.map(([time, value]) =>
            `<option value="${time}">${time.toFixed(6)} fs · magnitude ${value.toFixed(6)}</option>`).join('')
            : '<option value="">No interior maxima found</option>';
          // Use the analytical sampling settings for the shared report below the plot.
          $('analyticalFindExtrema').click();
        } catch (error) {
          status(error.message);
        }
      }

      function movieSettings() {
        const start = Number($('phaseMovieStart').value), end = Number($('phaseMovieEnd').value);
        const duration = 120, fps = Number($('phaseMovieFPS').value);
        const speed = Number($('phaseMovieSpeed').value);
        if (![start, end, fps].every(Number.isFinite) || start >= end || ![24, 30, 60].includes(fps) || ![0.1, 0.25, 0.5, 1, 2].includes(speed)) {
          throw Error('Choose increasing movie times, a supported playback speed, and 24, 30, or 60 fps.');
        }
        numbers($('phaseEnergies').value, 'Energies');
        return { start, end, duration: duration / speed, fps };
      }

      function pauseMovie() {
        if (recording) return;
        if (playback) cancelAnimationFrame(playback);
        playback = 0;
      }

      function seekMovie(time) {
        if (recording) return;
        pauseMovie();
        try {
          const { start, end } = movieSettings();
          if (!Number.isFinite(time)) throw Error('Enter a finite movie time.');
          if (savedMoviePage === null) savedMoviePage = $('phaseFigurePage').value;
          movieTime = Math.max(start, Math.min(end, time));
          draw();
        } catch (error) { status(error.message); }
      }

      function stepMovie(direction) {
        try {
          const { start, end, duration, fps } = movieSettings();
          seekMovie((movieTime === null ? start : movieTime) + direction * (end - start) / (duration * fps));
        } catch (error) { status(error.message); }
      }

      function stopAnimation() {
        if (playback) cancelAnimationFrame(playback);
        playback = 0;
        if (recording) { cancelMovie = true; return; }
        movieTime = null;
        if (savedMoviePage !== null) { $('phaseFigurePage').value = savedMoviePage; savedMoviePage = null; }
        draw();
      }

      function playMovie() {
        if (recording || playback) return;
        try {
          const { start, end, duration } = movieSettings();
          if (savedMoviePage === null) savedMoviePage = $('phaseFigurePage').value;
          if (movieTime === null || movieTime >= end || movieTime < start) movieTime = start;
          let previous = performance.now();
          function frame(now) {
            if ($('analysisPlotType').value !== 'autocorrelation-phase' || $('analysisWorkspace').classList.contains('hidden')) { stopAnimation(); return; }
            movieTime = Math.min(end, movieTime + Math.max(0, now - previous) / (duration * 1000) * (end - start));
            previous = now;
            draw();
            if (movieTime >= end && $('phaseMovieLoop').checked) movieTime = start;
            playback = movieTime < end ? requestAnimationFrame(frame) : 0;
          }
          draw();
          playback = requestAnimationFrame(frame);
        } catch (error) { pauseMovie(); status(error.message); }
      }

      function updateMovieReadout() {
        if (!$('phaseMovieReadout')) return;
        $('analysisWorkspace').classList.toggle('analysis-movie-compare', movieTime !== null || $('analysisMovieTab').getAttribute('aria-selected') === 'true');
        const start = Number($('phaseMovieStart').value), end = Number($('phaseMovieEnd').value);
        const time = movieTime === null ? start : movieTime;
        document.dispatchEvent(new CustomEvent('phasemovietime', { detail: time }));
        $('phaseMovieReadout').textContent = `${time.toFixed(6)} fs`;
        if (document.activeElement !== $('phaseMovieCurrent')) $('phaseMovieCurrent').value = time.toFixed(6);
        $('phaseMovieTimeline').value = end > start ? String(Math.round((time - start) / (end - start) * 10000)) : '0';
      }

      async function downloadMovie() {
        if (recording) return;
        stopAnimation();
        let stream, recorder, disabled = [], failure;
        try {
          const { start, end, duration, fps } = movieSettings();
          if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw Error('Movie recording is unavailable in this browser. Try Chrome.');
          const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
          if (!mime) throw Error('This browser has no supported movie recording format.');
          recording = true; cancelMovie = false;
          disabled = Array.from(document.querySelectorAll('#analysisWorkspace input, #analysisWorkspace select, #analysisWorkspace textarea, #analysisWorkspace button')).map(node => [node, node.disabled]);
          disabled.forEach(([node]) => { node.disabled = node.id !== 'phaseMovieStop'; });
          savedMoviePage = $('phaseFigurePage').value;
          movieTime = start; draw();
          const svg = $('analysisPlot').querySelector('svg');
          if (!svg) throw Error('Display a valid phase plot before recording.');
          const canvas = document.createElement('canvas');
          canvas.width = Number(svg.getAttribute('width')) * 2;
          canvas.height = Number(svg.getAttribute('height')) * 2;
          const context = canvas.getContext('2d');
          if (!context) throw Error('Could not create movie canvas.');
          async function paint() {
            const element = $('analysisPlot').querySelector('svg');
            if (!element) throw Error('Could not render movie frame.');
            const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(element)], {type:'image/svg+xml;charset=utf-8'}));
            try {
              const image = new Image();
              await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(Error('Could not load movie frame.')); image.src = url; });
              context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
              context.drawImage(image, 0, 0, canvas.width, canvas.height);
            } finally { URL.revokeObjectURL(url); }
          }
          await paint();
          stream = canvas.captureStream(fps);
          const chunks = [];
          recorder = new MediaRecorder(stream, {mimeType:mime, videoBitsPerSecond:16000000});
          const done = new Promise((resolve, reject) => {
            recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
            recorder.onstop = resolve;
            recorder.onerror = event => reject(event.error || Error('Movie recording failed.'));
          });
          // Handle recorder failure immediately while frames are being produced.
          done.catch(error => { failure = error; cancelMovie = true; });
          recorder.start();
          const began = performance.now();
          while (!cancelMovie) {
            if ($('analysisPlotType').value !== 'autocorrelation-phase' || $('analysisWorkspace').classList.contains('hidden')) { cancelMovie = true; break; }
            const fraction = Math.min(1, (performance.now() - began) / (duration * 1000));
            movieTime = start + (end - start) * fraction;
            draw(); await paint();
            status(`Recording phase movie… ${Math.round(fraction * 100)}%`);
            await new Promise(resolve => setTimeout(resolve, 1000 / fps));
            if (fraction === 1) break;
          }
          if (recorder.state !== 'inactive') recorder.stop();
          await done;
          if (failure) throw failure;
          if (!cancelMovie) {
            const blob = new Blob(chunks, {type:mime});
            if (!blob.size) throw Error('Movie recording produced no video.');
            const url = URL.createObjectURL(blob), link = document.createElement('a');
            link.href = url; link.download = `phase_evolution.${mime.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
            document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        } catch (error) { failure = error; }
        finally {
          if (recorder && recorder.state !== 'inactive') recorder.stop();
          if (stream) stream.getTracks().forEach(track => track.stop());
          disabled.forEach(([node, wasDisabled]) => { node.disabled = wasDisabled; });
          recording = false; movieTime = null;
          if (savedMoviePage !== null) { $('phaseFigurePage').value = savedMoviePage; savedMoviePage = null; }
          draw();
          status(failure ? failure.message : cancelMovie ? 'Movie recording cancelled.' : 'Phase movie downloaded.');
        }
      }

      function draw() {
        try {
          const inputEnergies = numbers($('phaseEnergies').value, 'Energies');
          const counts = new Map();
          inputEnergies.forEach(energy => counts.set(energy, (counts.get(energy) || 0) + 1));
          const energies = Array.from(counts.keys());
          const isMovieFigure = movieTime !== null || $('analysisMovieTab').getAttribute('aria-selected') === 'true';
          const times = isMovieFigure ? [movieTime ?? Number($('phaseMovieStart').value)] : numbers($('phaseTimes').value, 'Times');
          if (inputEnergies.length > 100 || times.length > 16) throw Error('Use at most 100 energy groups and 16 times.');
          const weights = energies.map(energy => counts.get(energy) / inputEnergies.length);
          const size = Number($('phasePanelSize').value);
          if (!Number.isFinite(size) || size < 360 || size > 900) throw Error('Panel size must be between 360 and 900 px.');
          const borderValue = Number($('plotBorderWidth')?.value || 2);
          if (!Number.isFinite(borderValue)) throw Error('Border thickness must be a number.');
          const border = Math.max(0.2, Math.min(4, borderValue));
          const capacity = isMovieFigure ? 1 : Number($('phaseLayout').value);
          if (![1,2,4,6,9,16].includes(capacity)) throw Error('Choose a valid figure layout.');
          const pageControl = $('phaseFigurePage');
          const pageCount = Math.ceil(times.length / capacity);
          const page = Math.max(0, Math.min(pageCount - 1, Number(pageControl.value) || 0));
          pageControl.innerHTML = Array.from({length:pageCount}, (_, i) => `<option value="${i}">${times.slice(i * capacity, (i + 1) * capacity).map(t => `${t} fs`).join(', ')}</option>`).join('');
          pageControl.value = String(page);
          const figureTimes = times.slice(page * capacity, (page + 1) * capacity);
          const columns = Math.min(figureTimes.length, capacity === 1 ? 1 : capacity <= 4 ? 2 : capacity <= 9 ? 3 : 4);
          const showTime = $('phaseShowTime').checked;
          const showPhases = $('phaseShowPhases').checked;
          const showMagnitude = $('phaseShowMagnitude').checked;
          const fontSize = (target, fallback) => {
            const value = Number($(`plot${target}FontSize`)?.value || fallback);
            return Number.isFinite(value) ? Math.max(8, Math.min(48, value)) : fallback;
          };
          const fontWeight = target => $(`plot${target}FontBold`)?.value === 'true' ? 'bold' : 'normal';
          const strokeSize = (id, fallback, max) => {
            const value = Number($(id)?.value || fallback);
            if (!Number.isFinite(value)) throw Error('Line thickness must be a number.');
            return Math.max(0.2, Math.min(max, value));
          };
          const lineWidth = strokeSize('plotWidth', 3, 8);
          const legendWidth = strokeSize('plotLegendLineWidth', 3.5, 10);
          const labelSize = fontSize('Legend', 12);
          const width = size * columns;
          const figureTitle = $(isMovieFigure ? 'phaseMovieTitle' : 'phaseFigureTitle').value;
          const headerHeight = figureTitle.trim() ? 60 : 0;
          const height = headerHeight + 10 + size * Math.ceil(figureTimes.length / columns);
          let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(figureTitle)}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" fill="#222"><text x="${width / 2}" y="30" text-anchor="middle" font-size="${fontSize('Title', 22)}" font-weight="${fontWeight('Title')}">${esc(figureTitle)}</text>`;
          figureTimes.forEach((time, index) => {
            const result = calculate(energies, weights, time);
            const left = index % columns * size;
            const top = headerHeight + Math.floor(index / columns) * size;
            const cx = left + size / 2;
            const cy = top + size * 0.51;
            const radius = size * 0.29;
            const X = x => cx + radius * x;
            const Y = y => cy - radius * y;
            // Draw annotations last so their placement also works inside the axes.
            const annotations = [];
            function placement(key, defaultX, defaultY, defaultAnchor, rows = 1) {
              const position = $(`phase${key}Position`)?.value || 'default';
              const dx = Number($(`phase${key}X`)?.value || 0);
              const dy = Number($(`phase${key}Y`)?.value || 0);
              if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw Error('Annotation offsets must be finite numbers.');
              let x = defaultX, y = defaultY, anchor = defaultAnchor;
              const right = X(1.45), leftEdge = X(-1.45);
              switch (position) {
                case 'top': x = cx; y = top + 20; anchor = 'middle'; break;
                case 'top-left': x = leftEdge; y = top + 20; anchor = 'start'; break;
                case 'top-right': x = right; y = top + 20; anchor = 'end'; break;
                case 'inside-top-left': x = leftEdge + 12; y = Y(1.45) + 22; anchor = 'start'; break;
                case 'inside-top-right': x = right - 12; y = Y(1.45) + 22; anchor = 'end'; break;
                case 'bottom': x = cx; y = top + size - 34 - (rows - 1) * (labelSize + 4); anchor = 'middle'; break;
              }
              return { x: x + dx, y: y + dy, anchor };
            }
            function annotation(key, text, defaultX, defaultY, anchor, fontSize, bold = false) {
              const pos = placement(key, defaultX, defaultY, anchor);
              return `<text x="${pos.x}" y="${pos.y}" text-anchor="${pos.anchor}" font-size="${labelSize}" font-weight="${fontWeight('Legend')}">${text}</text>`;
            }
            if ($('phaseShowPanelLetters').checked && figureTimes.length > 1) annotations.push(annotation('PanelLetters', `(${String.fromCharCode(97 + index)})`, left + 20, top + 20, 'start', 18, true));
            if (showTime) annotations.push(annotation('Time', `t = ${time.toFixed(2)} fs`, cx, top + 20, 'middle', 18, true));
            if (showMagnitude) annotations.push(annotation('Magnitude', `|A(t)| = ${result.magnitude.toFixed(4)}`, cx, top + 44, 'middle', 16));
            for (const tick of [-1, -0.5, 0, 0.5, 1]) {
              svg += `<path d="M${X(-1.45)} ${Y(tick)}H${X(1.45)} M${X(tick)} ${Y(-1.45)}V${Y(1.45)}" stroke="#ddd" stroke-width="0.6" fill="none"/>`;
              svg += `<text x="${X(tick)}" y="${Y(-1.45) + 17}" text-anchor="middle" font-size="${fontSize('XTick', 12)}" font-weight="${fontWeight('XTick')}">${tick}</text><text x="${X(-1.45) - 5}" y="${Y(tick) + 4}" text-anchor="end" font-size="${fontSize('YTick', 12)}" font-weight="${fontWeight('YTick')}">${tick}</text>`;
            }
            svg += `<path d="M${X(-1.45)} ${cy}H${X(1.45)} M${cx} ${Y(-1.45)}V${Y(1.45)}" stroke="gray" stroke-width="0.7"/><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="gray" stroke-width="1.5"/>`;
            svg += `<rect x="${X(-1.45)}" y="${Y(1.45)}" width="${radius * 2.9}" height="${radius * 2.9}" fill="none" stroke="#222" stroke-width="${border}" vector-effect="non-scaling-stroke"/>`;
            function arrow(x, y, color, thickness, head) {
              const length = Math.hypot(x, y) * radius;
              if (length < 0.000001) return '';
              const angle = Math.atan2(-y, x) * 180 / Math.PI;
              const tip = Math.min(head, length);
              return `<g transform="translate(${cx} ${cy}) rotate(${angle})"><path d="M0 0H${Math.max(0, length - tip)}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="M${length} 0L${length - tip} ${-tip / 2}L${length - tip} ${tip / 2}Z" fill="${color}"/></g>`;
            }
            const radialLabels = [];
            result.phases.forEach((phase, i) => {
              const x = Math.cos(phase), y = Math.sin(phase), color = colors[i % colors.length];
              svg += arrow(x, y, color, lineWidth, 12);
              const grouped = showPhases && ($('phasePhasesPosition')?.value || 'default') !== 'default';
              if (grouped) {
                const pos = placement('Phases', cx, top + 20, 'middle', energies.length);
                annotations.push(`<text x="${pos.x}" y="${pos.y + i * (labelSize + 4)}" text-anchor="${pos.anchor}" fill="${color}" font-size="${labelSize}" font-weight="${fontWeight('Legend')}">S${i + 1}: ${result.degrees[i].toFixed(1)}°</text>`);
              } else {
                const pos = placement('Phases', X(1.18 * x), Y(1.18 * y), 'middle');
                radialLabels.push({ ...pos, color, tipX: X(x), tipY: Y(y), text: `S${i + 1}${showPhases ? `: ${result.degrees[i].toFixed(1)}°` : ''}` });
              }
            });
            const clusters = [];
            for (const label of radialLabels) {
              const touching = clusters.filter(group => group.some(other => Math.abs(other.x - label.x) < labelSize * Math.max(other.text.length, label.text.length) * 0.65 && Math.abs(other.y - label.y) < labelSize + 6));
              const group = [label];
              for (const cluster of touching) { group.push(...cluster); clusters.splice(clusters.indexOf(cluster), 1); }
              clusters.push(group);
            }
            for (const group of clusters) {
              group.sort((a,b) => a.y - b.y);
              const centerY = group.reduce((sum,label) => sum + label.y, 0) / group.length;
              group.forEach((label,i) => {
                const y = group.length > 1 ? centerY + (i - (group.length - 1) / 2) * (labelSize + 6) : label.y;
                if (group.length > 1) annotations.push(`<path d="M${label.tipX} ${label.tipY}L${label.x} ${y}" stroke="${label.color}" stroke-width="0.7" stroke-opacity="0.5" fill="none"/>`);
                annotations.push(`<text x="${label.x}" y="${y}" text-anchor="${label.anchor}" dominant-baseline="middle" fill="${label.color}" font-size="${labelSize}" font-weight="${fontWeight('Legend')}">${label.text}</text>`);
              });
            }
            svg += arrow(result.real, result.imaginary, '#000', legendWidth, 16);
            svg += `<text x="${cx}" y="${top + size - 8}" text-anchor="middle" font-size="${fontSize('XLabel', 15)}" font-weight="${fontWeight('XLabel')}">Real</text><text transform="translate(${left + 16} ${cy}) rotate(-90)" text-anchor="middle" font-size="${fontSize('YLabel', 15)}" font-weight="${fontWeight('YLabel')}">Imaginary</text>`;
            svg += annotations.join('');
          });
          updateMovieReadout();
          $('analysisPlot').innerHTML = svg + '</g></svg>';
          const figure = $('analysisPlot').querySelector('svg');
          figure.dataset.axesLeft = size * (0.5 - 0.29 * 1.45);
          figure.dataset.axesWidth = size * 0.29 * 2.9;
          figure.dataset.axesTop = headerHeight + size * (0.51 - 0.29 * 1.45);
          figure.dataset.hasTitle = String(!!figureTitle.trim());
          status(`${energies.length} energy groups · ${figureTimes.length} of ${times.length} times · Figure ${page + 1}/${pageCount} · Absolute phase frame. Black arrow = weighted A(t).`);
        } catch (error) { $('analysisPlot').replaceChildren(); status(error.message); }
      }
      return { addControls, draw, stopAnimation, playMovie, pauseMovie, seekMovie, stepMovie };
    }
  };
})();
