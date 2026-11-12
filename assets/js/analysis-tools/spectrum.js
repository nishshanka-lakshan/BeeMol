(function () {
  'use strict';
  const HARTREE_TO_EV = 27.211386245988;
  function calculate(energies, intensities, { method, energyInput = 'hartree', broadening = 0.05, min = 0, max = 30, step = 0.01, shift = 0 } = {}) {
    if (!energies.length || !energies.every(Number.isFinite) || !intensities.every(Number.isFinite)) throw Error('Enter finite numeric energies and intensities.');
    if (method === 'qdnevpt2' && energyInput === 'hartree') energies = energies.slice(1).map(e => (e - energies[0]) * HARTREE_TO_EV);
    if (!energies.length || energies.length !== intensities.length) throw Error(method === 'qdnevpt2' && energyInput === 'hartree' ? 'Include the ground-state energy first and provide one intensity per excited transition, omitting the ground-state intensity.' : 'Provide one intensity per transition energy.');
    if (![broadening, min, max, step].every(Number.isFinite) || broadening <= 0 || step <= 0 || max <= min) throw Error('Broadening and step must be positive; omega maximum must exceed minimum.');
    if (!Number.isFinite(shift)) throw Error('Spectrum shift must be a finite number in eV.');
    energies = energies.map(energy => energy + shift);
    const count = Math.ceil((max - min) / step);
    if (count > 100000 || count * energies.length > 20000000) throw Error('Too many calculation points. Increase omega step or reduce the range.');
    const points = [];
    for (let i = 0; i < count; i++) {
      const omega = min + i * step;
      if (omega >= max) break;
      // Imaginary part of sum(I / (omega - E + i * broadening)),
      // followed by -Im(chi) / pi, as in prism.tools.spectrum.plot.
      let chiImaginary = 0;
      for (let pole = 0; pole < energies.length; pole++) {
        const delta = omega - energies[pole];
        chiImaginary += -intensities[pole] * broadening / (delta * delta + broadening * broadening);
      }
      const value = -chiImaginary / Math.PI;
      if (!Number.isFinite(value)) throw Error('Spectrum exceeds the numeric range. Check the input values.');
      points.push([omega, value]);
    }
    return points;
  }
  window.BeeMolSpectrum = { calculate, create({ renderer, status }) {
    const $ = id => document.getElementById(id);
    let panel;
    const overlays = [];
    const number = id => { if (!$(id).value.trim()) throw Error('Fill in all spectrum parameters.'); return Number($(id).value); };
    const values = id => $(id).value.trim().split(/[\s,;]+/).filter(Boolean).map(v => Number(v.replace(/[dD]/g, 'e')));
    function samples() {
      return calculate(values('spectrumEnergies'), values('spectrumIntensities'), {
        method: $('spectrumMethod').value, energyInput: $('spectrumEnergyInput').value, broadening: number('spectrumBroadening'),
        min: number('spectrumMin'), max: number('spectrumMax'), step: number('spectrumStep'), shift: number('spectrumShift')
      });
    }
    function draw() {
      try {
        const points = samples();
        if ($('spectrumPlot').checked) renderer.draw({ datasets: [...($('spectrumOverlay').checked ? overlays : []), { label: $('spectrumLegend').value.trim() || 'Spectrum', points, color: $('spectrumColor').value, visible: true }],
          title: $('spectrumTitle').value, xLabel: $('spectrumX').value, yLabel: $('spectrumY').value,
          settings: { plotTransform: { value: 'raw' }, plotXMin: { value: $('spectrumMin').value }, plotXMax: { value: $('spectrumMax').value }, plotYMin: { value: '0' }, plotYMax: { value: '' } } });
        else $('analysisPlot').replaceChildren();
        status($('spectrumPlot').checked
          ? `${points.length} spectrum samples plotted. Omega maximum is excluded, as in NumPy arange.`
          : `${points.length} spectrum samples calculated. Plotting is off. Click Calculate spectrum to display the plot, or enable Plot spectrum under Plot settings → Plot.`);
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
        <label><input id="spectrumPlot" type="checkbox" checked> Plot spectrum</label>
        <label>X label<input id="spectrumX" value="x"></label>
        <label>Y label<input id="spectrumY" value="y"></label>
        <label>Spectrum color<input id="spectrumColor" type="color" value="#0072b2"></label>
        <label><input id="spectrumOverlay" type="checkbox" checked> Show saved overlays</label>
        <button id="spectrumKeep" type="button">Keep current spectrum as overlay</button>
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
      function group(title, ids, className = '') {
        const section = document.createElement('fieldset');
        section.className = 'spectrum-settings-group ' + className;
        const legend = document.createElement('legend'); legend.textContent = title;
        section.append(legend);
        const fields = document.createElement('div'); fields.className = 'spectrum-settings-fields';
        for (const id of ids) {
          const input = $(id);
          fields.append(input.closest('label') || input);
        }
        section.append(fields); settingsPanel.append(section);
        return section;
      }
      group('Calculation', ['spectrumBroadening', 'spectrumStep', 'spectrumMin', 'spectrumMax', 'spectrumShift', 'spectrumCalculate']);
      const plotGroup = group('Plot', ['spectrumPlot', 'spectrumTitle', 'spectrumLegend', 'spectrumColor', 'spectrumOverlay', 'spectrumKeep', 'spectrumClearOverlays', 'spectrumOverlayList', 'spectrumX', 'spectrumY'], 'spectrum-plot-settings');
      $('analysisSettingsPanel').append(plotGroup);
      group('Export', ['spectrumFilename', 'spectrumDownload'], 'spectrum-export-settings');
      $('spectrumCalculate').classList.add('primary');

      function methodChanged() {
        const q = $('spectrumMethod').value === 'qdnevpt2';
        const hartree = q && $('spectrumEnergyInput').value === 'hartree';
        $('spectrumEnergyInputLabel').hidden = !q;
        $('spectrumEnergyLabel').firstChild.textContent = hartree ? 'Total energies (Hartree), ground state first' : 'Transition energies (eV)';
        $('spectrumHint').textContent = hartree ? 'Transition energy = (excited total energy − ground total energy) × 27.211386245988 eV/Hartree.' : 'Enter one transition energy in eV per intensity. Omit the ground-state energy; no conversion is applied.';
      }
      const storageKey = 'beemol.spectrum.settings.v1';
      const savedFields = ['spectrumEnergyInput', 'spectrumEnergies', 'spectrumIntensities', 'spectrumBroadening', 'spectrumMin', 'spectrumMax', 'spectrumStep', 'spectrumFilename', 'spectrumPlot', 'spectrumX', 'spectrumY', 'spectrumTitle', 'spectrumLegend', 'spectrumShift', 'spectrumColor', 'spectrumOverlay'];
      let saved = { method: 'mradc', methods: {} };
      try {
        const data = JSON.parse(localStorage.getItem(storageKey));
        if (data && ['mradc', 'qdnevpt2'].includes(data.method) && data.methods && typeof data.methods === 'object') saved = data;
      } catch (_) { /* Storage may be unavailable. Keep in-memory controls usable. */ }
      const oldMRADC = saved.methods.mradc;
      if (oldMRADC && oldMRADC.spectrumBroadening === '0.05' && oldMRADC.spectrumMin === '0' && oldMRADC.spectrumMax === '30') {
        Object.assign(oldMRADC, { spectrumBroadening: '0.5', spectrumMin: '410', spectrumMax: '415' });
        for (const [id, oldValue, newValue] of [
          ['spectrumFilename', 'spectrum', 'mr_adc'], ['spectrumX', 'x', 'Energy, eV'],
          ['spectrumY', 'y', 'Intensity'], ['spectrumTitle', 'Spectrum', 'XPS spectrum']
        ]) if (oldMRADC[id] === oldValue) oldMRADC[id] = newValue;
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
          spectrumX: 'Energy, eV', spectrumY: 'Intensity', spectrumTitle: 'UV/vis spectrum'
        } : {
          spectrumShift: '0', spectrumBroadening: '0.5', spectrumMin: '410', spectrumMax: '415', spectrumFilename: 'mr_adc',
          spectrumX: 'Energy, eV', spectrumY: 'Intensity', spectrumTitle: 'XPS spectrum'
        })) $(id).value = value;
      }
      $('spectrumMethod').value = saved.method;
      applyMethodDefaults();
      restoreMethod(saved.method);
      methodChanged();
      $('spectrumEnergyInput').addEventListener('change', () => { methodChanged(); remember(); draw(); });
      $('spectrumMethod').addEventListener('change', () => {
        applyMethodDefaults();
        $('spectrumPlot').checked = true;
        restoreMethod($('spectrumMethod').value);
        methodChanged(); remember(); draw();
      });
      const onInput = event => { if (event.target.id !== 'spectrumMethod') { remember(); draw(); } };
      panel.addEventListener('input', onInput);
      settingsPanel.addEventListener('input', onInput);
      plotGroup.addEventListener('input', onInput);
      for (const id of savedFields) $(id).addEventListener('change', remember);
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
          overlays.push({ label: $('spectrumLegend').value.trim() || `Spectrum ${overlays.length + 1}`,
            points: samples(), color: $('spectrumColor').value, visible: true });
          $('spectrumOverlay').checked = true; $('spectrumPlot').checked = true;
          renderOverlays(); remember(); draw();
          status('Spectrum saved as overlay. Change the current data, method, or parameters to compare another spectrum.');
        } catch (error) { status(error.message); }
      };
      $('spectrumClearOverlays').onclick = () => { overlays.length = 0; renderOverlays(); draw(); };
      $('spectrumCalculate').onclick = () => {
        $('spectrumPlot').checked = true;
        remember();
        draw();
      };
      $('spectrumDownload').onclick = () => {
        try {
          const text = samples().map(row => row.map(v => v.toFixed(12).padStart(20, ' ')).join('\t')).join('\n') + '\n';
          const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
          const link = document.createElement('a'); link.href = url; link.download = filename() + '.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { status(error.message); }
      };
    }
    function filename() { return ($('spectrumFilename')?.value.trim() || 'spectrum').replace(/[\\/:*?"<>|]/g, '_'); }
    return { addControls, draw, filename, setVisible(visible) { if (visible && panel.hidden) $('spectrumPlot').checked = true; panel.hidden = !visible; $('analysisSpectrumTab').hidden = !visible; $('analysisWorkspace').classList.toggle('spectrum-active', visible); } };
  } };
})();
