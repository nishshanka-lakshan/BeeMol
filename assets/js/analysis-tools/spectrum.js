(function () {
  'use strict';
  const HARTREE_TO_EV = 27.211386245988;
  const DEFAULT_STICK_COLOR = '#d55e00';
  const OVERLAY_COLORS = ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#e69f00', '#56b4e9'];
  function transitions(energies, intensities, { method, energyInput = 'hartree', shift = 0 }) {
    if (!energies.length || !energies.every(Number.isFinite) || !intensities.every(Number.isFinite)) throw Error('Enter finite numeric energies and intensities.');
    const hasGroundState = method === 'qdnevpt2' && energyInput === 'hartree';
    if (hasGroundState) energies = energies.slice(1).map(e => (e - energies[0]) * HARTREE_TO_EV);
    if (!energies.length || energies.length !== intensities.length) {
      const counts = `Found ${energies.length} transition energies and ${intensities.length} intensities.`;
      throw Error(hasGroundState
        ? `${counts} Enter the ground-state energy first and one intensity per excited state.`
        : `${counts} Enter one intensity per transition energy.`);
    }
    if (!Number.isFinite(shift)) throw Error('Spectrum shift must be a finite number in eV.');
    return energies.map((energy, index) => [energy + shift, intensities[index]]);
  }
  function broaden(sticks, { broadening = 0.05, min = 0, max = 30, step = 0.01 }) {
    if (![broadening, min, max, step].every(Number.isFinite) || broadening <= 0 || step <= 0 || max <= min) throw Error('Broadening and step must be positive; omega maximum must exceed minimum.');
    const count = Math.ceil((max - min) / step);
    if (count > 100000 || count * sticks.length > 20000000) throw Error('Too many calculation points. Increase omega step or reduce the range.');
    const points = [];
    for (let i = 0; i < count; i++) {
      const omega = min + i * step;
      if (omega >= max) break;
      // Imaginary part of sum(I / (omega - E + i * broadening)),
      // followed by -Im(chi) / pi, as in prism.tools.spectrum.plot.
      let chiImaginary = 0;
      for (const [energy, intensity] of sticks) {
        const delta = omega - energy;
        chiImaginary += -intensity * broadening / (delta * delta + broadening * broadening);
      }
      const value = -chiImaginary / Math.PI;
      if (!Number.isFinite(value)) throw Error('Spectrum exceeds the numeric range. Check the input values.');
      points.push([omega, value]);
    }
    return points;
  }
  function peakMagnitude(points) {
    return points.reduce((peak, [, intensity]) => Math.max(peak, Math.abs(intensity)), 0) || 1;
  }
  function normalize(points) {
    const peak = peakMagnitude(points);
    return points.map(([energy, intensity]) => [energy, intensity / peak]);
  }
  function calculate(energies, intensities, options = {}) {
    return broaden(transitions(energies, intensities, options), options);
  }
  window.BeeMolSpectrum = { calculate, create({ renderer, status }) {
    const $ = id => document.getElementById(id);
    let panel;
    const overlays = [];
    const number = id => { if (!$(id).value.trim()) throw Error('Fill in all spectrum parameters.'); return Number($(id).value); };
    const values = id => $(id).value.trim().split(/[\s,;\[\]]+/).filter(Boolean).map(v => Number(v.replace(/[dD]/g, 'e')));
    function samples() {
      const sticks = transitions(values('spectrumEnergies'), values('spectrumIntensities'), {
        method: $('spectrumMethod').value, energyInput: $('spectrumEnergyInput').value, shift: number('spectrumShift')
      });
      const min = number('spectrumMin');
      const max = number('spectrumMax');
      const points = broaden(sticks, { broadening: number('spectrumBroadening'), min, max, step: number('spectrumStep') });
      return { sticks, points, min, max };
    }
    function draw() {
      const matchLineColors = $('spectrumMatchStickColors').checked;
      const stickColor = $('spectrumStickColor');
      stickColor.disabled = matchLineColors;
      try {
        const curves = $('spectrumOverlay').checked ? [...overlays] : [];
        let current;
        let inputError;
        try {
          current = samples();
          curves.push({
            ...current, label: $('spectrumLegend').value.trim() || 'Spectrum', color: $('spectrumColor').value, visible: true
          });
        } catch (error) {
          if (!curves.length) throw error;
          inputError = error.message;
        }
        const automaticMin = curves.reduce((min, curve) => Math.min(min, curve.min), Infinity);
        const automaticMax = curves.reduce((max, curve) => Math.max(max, curve.max), -Infinity);
        const xMin = Number($('plotXMin').value || automaticMin);
        const xMax = Number($('plotXMax').value || automaticMax);
        if (xMin >= xMax) throw Error('X minimum must be smaller than X maximum.');
        const heightInput = $('spectrumStickHeight');
        const stickHeight = !heightInput.validity.rangeUnderflow && Number.isFinite(heightInput.valueAsNumber)
          ? heightInput.valueAsNumber : Number(heightInput.defaultValue);
        const stickDatasets = $('spectrumSticks').checked ? curves.flatMap(curve => {
          const scale = peakMagnitude(curve.sticks);
          const points = curve.sticks
            .filter(([energy]) => energy >= xMin && energy <= xMax)
            .map(([energy, intensity]) => [energy, (intensity / scale) * stickHeight]);
          return points.length ? [{
            label: curve.label, hideFromLegend: true, points, color: matchLineColors ? curve.color : stickColor.value, visible: true, verticalSticks: true
          }] : [];
        }) : [];
        const normalizeCurve = $('spectrumNormalize').checked;
        const curveDatasets = normalizeCurve ? curves.map(curve => ({ ...curve, points: normalize(curve.points) })) : curves;
        const datasets = [...stickDatasets, ...curveDatasets];
        const hasNegativeIntensity = (normalizeCurve ? datasets : stickDatasets)
          .some(dataset => dataset.points.some(([, intensity]) => intensity < 0));
        renderer.draw({ datasets,
          title: $('spectrumTitle').value, xLabel: $('spectrumX').value, yLabel: $('spectrumY').value,
          settings: {
            plotTransform: { value: 'raw' },
            plotXMin: { value: String(xMin) },
            plotXMax: { value: String(xMax) },
            plotYMin: { value: $('plotYMin').value || (hasNegativeIntensity ? '' : '0') }
          }
        });
        if (!$('analysisPlot').firstElementChild) return;
        if (inputError) {
          status(`Showing saved overlays. Current spectrum: ${inputError}`);
        } else if (!current.sticks.some(([energy]) => energy >= current.min && energy < current.max)) {
          status(`Current transitions are outside the Omega range (${current.min} to ${current.max} eV). Adjust the Omega limits in Spectrum settings.`);
        } else if (!current.sticks.some(([energy]) => energy >= xMin && energy <= xMax)) {
          status(`Current transitions are outside the displayed X range (${xMin} to ${xMax} eV). Adjust X minimum and maximum under Plot settings → Size.`);
        } else {
          const count = curves.length - 1;
          status(`${current.points.length} current spectrum samples plotted. ${count} saved ${count === 1 ? 'overlay' : 'overlays'} shown.`);
        }
      } catch (error) { $('analysisPlot').replaceChildren(); status(error.message); }
    }
    window.BeeMolSpectrumRedraw = draw;
    function addControls() {
      $('analysisPlotType').add(new Option('Spectrum', 'spectrum'));
      panel = document.createElement('section'); panel.id = 'spectrumControls'; panel.hidden = true;
      panel.innerHTML = `
        <label>Method<select id="spectrumMethod"><option value="mradc">MRADC</option><option value="qdnevpt2">QDNEVPT2</option></select></label>
        <label id="spectrumEnergyInputLabel">Energy input<select id="spectrumEnergyInput"><option value="hartree">Total energies (Hartree)</option><option value="ev">Transition energies (eV)</option></select></label>
        <p id="spectrumHint" class="mini-note"></p>
        <label id="spectrumEnergyLabel">Energies (eV)<textarea id="spectrumEnergies" rows="5" placeholder="Enter energies separated by spaces, commas, or newlines"></textarea></label>
        <label>Intensities / oscillator strengths<textarea id="spectrumIntensities" rows="5" placeholder="One value per excited transition"></textarea></label>
        <label>Broadening (eV)<input id="spectrumBroadening" type="number" min="0" step="0.01" value="0.05"></label>
        <label>Spectrum shift (eV)<input id="spectrumShift" type="number" step="0.01" value="0" title="Positive shifts peaks to higher energy; negative shifts to lower energy."></label>
        <label>Omega minimum (eV)<input id="spectrumMin" type="number" step="any" value="0"></label>
        <label>Omega maximum (eV)<input id="spectrumMax" type="number" step="any" value="30"></label>
        <label>Omega step (eV)<input id="spectrumStep" type="number" min="0" step="any" value="0.01"></label>
        <label>Filename<input id="spectrumFilename" value="spectrum"></label>
        <label><input id="spectrumNormalize" type="checkbox">Normalize line</label>
        <label><input id="spectrumSticks" type="checkbox">Show sticks</label>
        <label><input id="spectrumMatchStickColors" type="checkbox" checked>Match line colors</label>
        <input id="spectrumStickColor" type="color" value="${DEFAULT_STICK_COLOR}" aria-label="Stick color" title="Stick color">
        <label>Max stick height<input id="spectrumStickHeight" type="number" min="0" step="0.1" value="1"></label>
        <label>X label<input id="spectrumX" value="Energy (eV)"></label>
        <label>Y label<input id="spectrumY" value="Intensity"></label>
        <label>Spectrum color<input id="spectrumColor" type="color" value="#0072b2"></label>
        <label><input id="spectrumOverlay" type="checkbox" checked> Show saved overlays</label>
        <button id="spectrumKeep" type="button">Save overlay and start next spectrum</button>
        <button id="spectrumClearOverlays" type="button">Clear overlays</button>
        <div id="spectrumOverlayList"></div>
        <label>Title<input id="spectrumTitle" value="Spectrum"></label>
        <label>Legend name<input id="spectrumLegend" value="Spectrum"></label>
        <button id="spectrumCalculate" type="button">Calculate spectrum</button>
        <button id="spectrumDownload" type="button">Download spectrum .txt</button>`;
      $('analysisPlotType').closest('label').after(panel);
      const settingsPanel = $('analysisSpectrumPanel');
      const firstSetting = $('spectrumBroadening').closest('label');
      while (firstSetting.nextSibling) settingsPanel.append(firstSetting.nextSibling);
      settingsPanel.prepend(firstSetting);
      function group(title, ids, { className = '', collapsible = false } = {}) {
        const section = document.createElement(collapsible ? 'details' : 'fieldset');
        section.className = ['spectrum-settings-group', collapsible ? 'plot-disclosure' : '', className].filter(Boolean).join(' ');
        const heading = document.createElement(collapsible ? 'summary' : 'legend');
        heading.textContent = title;
        section.append(heading);
        const fields = document.createElement('div'); fields.className = 'spectrum-settings-fields';
        for (const id of ids) {
          const input = $(id);
          fields.append(input.closest('label') || input);
        }
        section.append(fields); settingsPanel.append(section);
        return section;
      }
      group('Calculation', ['spectrumBroadening', 'spectrumStep', 'spectrumMin', 'spectrumMax', 'spectrumShift', 'spectrumCalculate']);
      group('Line spectrum', ['spectrumNormalize'], { className: 'spectrum-curve-settings', collapsible: true });
      group('Stick spectrum', ['spectrumSticks', 'spectrumMatchStickColors', 'spectrumStickColor', 'spectrumStickHeight'], { className: 'spectrum-stick-settings', collapsible: true });
      const plotGroup = group('Plot', ['spectrumTitle', 'spectrumLegend', 'spectrumColor', 'spectrumOverlay', 'spectrumKeep', 'spectrumClearOverlays', 'spectrumOverlayList', 'spectrumX', 'spectrumY'], { className: 'spectrum-plot-settings' });
      $('analysisSettingsPanel').append(plotGroup);
      group('Export', ['spectrumFilename', 'spectrumDownload'], { className: 'spectrum-export-settings' });
      $('spectrumCalculate').classList.add('primary');

      function methodChanged() {
        const q = $('spectrumMethod').value === 'qdnevpt2';
        const hartree = q && $('spectrumEnergyInput').value === 'hartree';
        $('spectrumEnergyInputLabel').hidden = !q;
        $('spectrumEnergyLabel').firstChild.textContent = hartree ? 'Total energies (Hartree), ground state first' : 'Transition energies (eV)';
        $('spectrumHint').textContent = hartree ? 'Transition energy = (excited total energy − ground total energy) × 27.211386245988 eV/Hartree.' : 'Enter one transition energy in eV per intensity. Omit the ground-state energy; no conversion is applied.';
      }
      const storageKey = 'beemol.spectrum.settings.v1';
      const savedFields = ['spectrumEnergyInput', 'spectrumEnergies', 'spectrumIntensities', 'spectrumBroadening', 'spectrumMin', 'spectrumMax', 'spectrumStep', 'spectrumFilename', 'spectrumNormalize', 'spectrumSticks', 'spectrumMatchStickColors', 'spectrumStickColor', 'spectrumStickHeight', 'spectrumX', 'spectrumY', 'spectrumTitle', 'spectrumLegend', 'spectrumShift', 'spectrumColor', 'spectrumOverlay'];
      let saved = { method: 'mradc', methods: {} };
      try {
        const data = JSON.parse(localStorage.getItem(storageKey));
        if (data && ['mradc', 'qdnevpt2'].includes(data.method) && data.methods && typeof data.methods === 'object') saved = data;
      } catch (_) { /* Storage may be unavailable. Keep in-memory controls usable. */ }
      const oldMRADC = saved.methods.mradc;
      if (oldMRADC && oldMRADC.spectrumBroadening === '0.05' && oldMRADC.spectrumMin === '0' && oldMRADC.spectrumMax === '30') {
        Object.assign(oldMRADC, { spectrumBroadening: '0.5', spectrumMin: '410', spectrumMax: '415' });
        for (const [id, oldValue, newValue] of [
          ['spectrumFilename', 'spectrum', 'mr_adc'], ['spectrumTitle', 'Spectrum', 'XPS spectrum']
        ]) if (oldMRADC[id] === oldValue) oldMRADC[id] = newValue;
      }
      for (const method of ['mradc', 'qdnevpt2']) {
        const labels = saved.methods[method];
        if (!labels || typeof labels !== 'object') continue;
        if (typeof labels.spectrumX === 'string' && /^(x|energy, ev)$/i.test(labels.spectrumX.trim())) labels.spectrumX = 'Energy (eV)';
        if (typeof labels.spectrumY === 'string' && /^y$/i.test(labels.spectrumY.trim())) labels.spectrumY = 'Intensity';
      }
      function restoreMethod(method) {
        const values = saved.methods[method];
        if (!values || typeof values !== 'object') return;
        for (const id of savedFields) {
          if ($(id).type === 'checkbox') {
            if (typeof values[id] === 'boolean') $(id).checked = values[id];
          } else if (typeof values[id] === 'string') $(id).value = values[id];
        }
      }
      function remember() {
        const method = $('spectrumMethod').value;
        saved.method = method;
        saved.methods[method] = Object.fromEntries(savedFields.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value]));
        try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch (_) { /* Retain this session's settings. */ }
      }
      function applyMethodDefaults() {
        const q = $('spectrumMethod').value === 'qdnevpt2';
        for (const [id, value] of Object.entries(q ? {
          spectrumShift: '0', spectrumBroadening: '0.1', spectrumMin: '7', spectrumMax: '17', spectrumFilename: 'qdnevpt',
          spectrumX: 'Energy (eV)', spectrumY: 'Intensity', spectrumTitle: 'UV/vis spectrum'
        } : {
          spectrumShift: '0', spectrumBroadening: '0.5', spectrumMin: '410', spectrumMax: '415', spectrumFilename: 'mr_adc',
          spectrumX: 'Energy (eV)', spectrumY: 'Intensity', spectrumTitle: 'XPS spectrum'
        })) $(id).value = value;
      }
      $('spectrumMethod').value = saved.method;
      applyMethodDefaults();
      restoreMethod(saved.method);
      $('spectrumStickColor').disabled = $('spectrumMatchStickColors').checked;
      methodChanged();
      $('spectrumEnergyInput').addEventListener('change', () => { methodChanged(); remember(); draw(); });
      $('spectrumMethod').addEventListener('change', () => {
        applyMethodDefaults();
        $('spectrumNormalize').checked = false;
        $('spectrumSticks').checked = false;
        $('spectrumMatchStickColors').checked = true;
        $('spectrumStickColor').value = DEFAULT_STICK_COLOR;
        $('spectrumStickHeight').value = $('spectrumStickHeight').defaultValue;
        restoreMethod($('spectrumMethod').value);
        methodChanged(); remember(); draw();
      });
      for (const id of savedFields) {
        if (id === 'spectrumEnergyInput') continue;
        $(id).addEventListener('input', () => { remember(); draw(); });
        $(id).addEventListener('change', remember);
      }
      function renderOverlays() {
        const list = $('spectrumOverlayList'); list.replaceChildren();
        overlays.forEach((overlay, index) => {
          const row = document.createElement('div'); row.className = 'spectrum-overlay-row';
          const label = document.createElement('span'); label.textContent = overlay.label;
          const color = document.createElement('input'); color.type = 'color'; color.value = overlay.color;
          color.setAttribute('aria-label', overlay.label + ' color');
          color.oninput = () => { overlay.color = color.value; draw(); };
          const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
          remove.onclick = () => { overlays.splice(index, 1); renderOverlays(); draw(); };
          row.append(label, color, remove); list.append(row);
        });
      }
      $('spectrumKeep').onclick = () => {
        try {
          const label = $('spectrumLegend').value.trim() || `Spectrum ${overlays.length + 1}`;
          overlays.push({ label, ...samples(), color: $('spectrumColor').value, visible: true });
          $('spectrumOverlay').checked = true;
          $('spectrumEnergies').value = '';
          $('spectrumIntensities').value = '';
          let nextNumber = overlays.length + 1;
          while (overlays.some(overlay => overlay.label === `Spectrum ${nextNumber}`)) nextNumber++;
          $('spectrumLegend').value = `Spectrum ${nextNumber}`;
          const usedColors = new Set(overlays.map(overlay => overlay.color));
          $('spectrumColor').value = OVERLAY_COLORS.find(color => !usedColors.has(color))
            || OVERLAY_COLORS[overlays.length % OVERLAY_COLORS.length];
          renderOverlays(); remember(); draw();
          if ($('analysisPlot').firstElementChild) status(`Saved “${label}”. Paste the next spectrum’s energies and intensities into the empty fields.`);
          $('spectrumEnergies').focus();
        } catch (error) { status(error.message); }
      };
      $('spectrumClearOverlays').onclick = () => { overlays.length = 0; renderOverlays(); draw(); };
      $('spectrumCalculate').onclick = () => {
        remember();
        draw();
      };
      $('spectrumDownload').onclick = () => {
        try {
          const { points } = samples();
          const exportPoints = $('spectrumNormalize').checked ? normalize(points) : points;
          const text = exportPoints.map(row => row.map(v => v.toFixed(12).padStart(20, ' ')).join('\t')).join('\n') + '\n';
          const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
          const link = document.createElement('a'); link.href = url; link.download = filename() + '.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { status(error.message); }
      };
    }
    function filename() { return ($('spectrumFilename')?.value.trim() || 'spectrum').replace(/[\\/:*?"<>|]/g, '_'); }
    return { addControls, draw, filename, setVisible(visible) { panel.hidden = !visible; $('analysisSpectrumTab').hidden = !visible; $('analysisWorkspace').classList.toggle('spectrum-active', visible); } };
  } };
})();
