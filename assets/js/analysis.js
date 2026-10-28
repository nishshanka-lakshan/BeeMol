/* Analysis workspace.

   Autocorrelation curves and energy-based phase alignment.

   CSV time: atomic units. Plot time: femtoseconds.

*/

(function () {

  'use strict';



  const $ = id => document.getElementById(id);

  const series = [];

  const AU_TO_FS = 0.024188843265857;



  const palette = [

    '#0072B2', '#D55E00', '#009E73',

    '#CC79A7', '#E69F00', '#56B4E9'

  ];



  function esc(value) {

    return String(value).replace(/[&<>"']/g, c => ({

      '&': '&amp;',

      '<': '&lt;',

      '>': '&gt;',

      '"': '&quot;',

      "'": '&#39;'

    }[c]));

  }



  function status(message) {

    $('analysisResult').textContent = message;

  }



  // Analysis-specific implementations are kept in separate modules.
  if (!window.BeeMolAutocorrelation) {
    throw Error('Missing assets/js/analysis-tools/autocorrelation.js. Load it before analysis.js.');
  }
  let renderAnalytical = () => {};
  const phaseMode = () => $('analysisPlotType')?.value === 'autocorrelation-phase';
  const autocorrelation = window.BeeMolAutocorrelation.create({
    series, AU_TO_FS, esc, status,
    exportName: () => phaseMode() ? 'phase_alignment' : 'autocorrelation',
    redrawPhase: () => { phase.draw(); renderAnalytical(); }
  });
  if (!window.BeeMolAutocorrelationPhase) throw Error('Missing autocorrelation-phase.js.');
  const phase = window.BeeMolAutocorrelationPhase.create({ esc, status });
  const draw = () => {
    (phaseMode() ? phase : autocorrelation).draw();
    if (phaseMode()) renderAnalytical();
  };
  const { exportSVG, exportPNG } = autocorrelation;

  // ------------------------------------------------------------

  // CSV parsing

  // ------------------------------------------------------------



  function parseCSV(text) {

    text = String(text).replace(/^\uFEFF/, '');



    const first = text.split(/\r?\n/)

      .find(line => line.trim()) || '';



    const counts = { ',': 0, ';': 0, '\t': 0 };

    let quoted = false;



    for (let i = 0; i < first.length; i++) {

      const c = first[i];



      if (c === '"') {

        if (quoted && first[i + 1] === '"') {

          i++;

        } else {

          quoted = !quoted;

        }

      } else if (!quoted && c in counts) {

        counts[c]++;

      }

    }



    const delimiter = Object.keys(counts)

      .sort((a, b) => counts[b] - counts[a])[0];



    const rows = [];

    let row = [];

    let cell = '';

    quoted = false;



    for (let i = 0; i < text.length; i++) {

      const c = text[i];



      if (c === '"') {

        if (quoted && text[i + 1] === '"') {

          cell += '"';

          i++;

        } else {

          quoted = !quoted;

        }

      } else if (c === delimiter && !quoted) {

        row.push(cell.trim());

        cell = '';

      } else if ((c === '\n' || c === '\r') && !quoted) {

        if (c === '\r' && text[i + 1] === '\n') i++;



        row.push(cell.trim());

        if (row.some(Boolean)) rows.push(row);



        row = [];

        cell = '';

      } else {

        cell += c;

      }

    }



    if (quoted) throw Error('Unclosed quote in CSV.');



    row.push(cell.trim());

    if (row.some(Boolean)) rows.push(row);



    if (rows.length < 2 || rows[0].length < 2) {

      throw Error(

        'CSV needs a header, a time column and a data column.'

      );

    }



    const header = rows.shift();



    const numeric = value =>

      value !== undefined && value !== ''

        ? Number(value.replace(/[dD]/g, 'e'))

        : NaN;



    const datasets = [];



    for (let column = 1; column < header.length; column++) {

      const points = rows

        .map(values => [

          numeric(values[0]),

          numeric(values[column])

        ])

        .filter(point => point.every(Number.isFinite))

        .sort((a, b) => a[0] - b[0]);



      if (points.length >= 2) {

        datasets.push({

          label: header[column] || `Column ${column + 1}`,

          points

        });

      }

    }



    if (!datasets.length) {

      throw Error('No numeric series with two valid points.');

    }



    return datasets;

  }



  // ------------------------------------------------------------

  // Left-panel dataset controls

  // ------------------------------------------------------------



  function controls() {

    const host = $('analysisDatasets');

    host.replaceChildren();



    for (const dataset of series) {

      const box = document.createElement('div');

      box.className = 'analysis-series';



      const check = document.createElement('input');

      check.type = 'checkbox';

      check.checked = dataset.visible;



      check.onchange = () => {

        dataset.visible = check.checked;

        draw();

      };



      const title = document.createElement('label');

      title.append(

        check,

        document.createTextNode(dataset.file)

      );



      const label = document.createElement('input');

      label.value = dataset.label;

      label.setAttribute('aria-label', 'Legend label');



      label.oninput = () => {

        dataset.label = label.value;

        draw();

      };



      const color = document.createElement('input');

      color.type = 'color';

      color.value = dataset.color;

      color.setAttribute('aria-label', 'Line color');



      color.oninput = () => {

        dataset.color = color.value;

        draw();

      };



      const style = document.createElement('select');

      style.setAttribute('aria-label', 'Line style');



      for (const [value, text] of [

        ['', 'Solid'],

        ['8 4', 'Dashed'],

        ['2 4', 'Dotted']

      ]) {

        const option = document.createElement('option');

        option.value = value;

        option.textContent = text;

        style.append(option);

      }



      style.value = dataset.dash;



      style.onchange = () => {

        dataset.dash = style.value;

        draw();

      };



      box.append(title, label, color, style);

      host.append(box);

    }

  }



  // ------------------------------------------------------------

  // Initialize workspace

  // ------------------------------------------------------------



  function initialize() {

    try {

      autocorrelation.addControls();
      phase.addControls();

      const theoretical = document.createElement('section');
      theoretical.id = 'analysisTheoreticalControls';
      theoretical.hidden = true;
      theoretical.setAttribute('aria-labelledby', 'analyticalHeading');
      theoretical.innerHTML = `<header class="analytical-heading"><span>ENERGY MODEL</span><h3 id="analyticalHeading">Analytical autocorrelation</h3></header>
        <p class="analytical-formula">A(t) = (1/N) Σ exp(−i Eₙ t / ℏ)</p>
        <p class="mini-note">Equal population per state. Repeat energies for degeneracy. ℏ = 0.6582119569 eV·fs.</p>
        <p class="mini-note">Uses the energies entered in the left sidebar. End time and time step apply only to the analytical solution. Uploaded CSV curves retain their original time points and ranges.</p>
        <div class="analytical-fields">
          <label>End time (fs)<input id="analyticalEnd" type="number" min="0" value="25" step="0.1"></label>
          <label>Time step (a.u.)<input id="analyticalStep" type="number" min="0" value="0.002" step="0.001"></label>
        </div>
        <label>Minimum prominence<input id="analyticalProminence" type="number" min="0" step="0.01" value="0"></label>
        <p class="mini-note">Prominence 0 includes small local maxima and minima. Increase it to filter weaker extrema.</p>
        <label>Minimum extremum spacing (fs)<input id="analyticalPeakSpacing" type="number" min="0" step="0.05" value="0.35"></label>
        <button id="analyticalFindExtrema" type="button" hidden>Analyze</button>
        <section id="analyticalExtremaReport" class="extrema-report" hidden aria-label="Autocorrelation extrema analysis" aria-live="polite"></section>
        <div class="analytical-actions">
          <button id="analyticalCSV" type="button">Download CSV</button>
        </div>`;
      $('analysisEnergyPanel').append(theoretical);
      const datasetActions = document.createElement('div');
      datasetActions.className = 'analysis-dataset-actions';
      $('analysisClear').before(datasetActions);
      datasetActions.append($('analyticalFindExtrema'), $('analysisClear'));

      const analyticalStyle = {};
      const analyticalOptions = document.createElement('fieldset');
      analyticalOptions.className = 'analysis-individual-style';
      const analyticalOptionsHeading = document.createElement('legend');
      analyticalOptionsHeading.textContent = 'Analytical plot options';
      analyticalOptions.append(analyticalOptionsHeading);
      $('analysisEnergyPanel').append(analyticalOptions);
      // Analytical-only options must not read shared plot controls.
      for (const [id, value, checked] of [
        ['plotTransform', 'none'], ['plotTwoTone', '', false], ['plotLegend', '', true],
        ['plotXMin', ''], ['plotXMax', ''], ['plotYMin', '0'], ['plotYMax', '1'],
        ['plotBoxWidth', '1200'], ['plotBoxHeight', '300'],
        ['plotLegendPosition', 'top'], ['plotLegendX', '0'], ['plotLegendY', '0']
      ]) analyticalStyle[id] = { value, checked };
      const analyticalFields = $('analysisEnergyPanel').querySelector('.analysis-individual-style');
      for (const [id, name] of [
        ['plotXMin', 'X minimum'], ['plotXMax', 'X maximum'],
        ['plotYMin', 'Y minimum'], ['plotYMax', 'Y maximum'],
        ['plotBoxWidth', 'Plot width'], ['plotBoxHeight', 'Plot height'],
        ['plotLegendX', 'Legend horizontal offset'], ['plotLegendY', 'Legend vertical offset']
      ]) {
        const label = document.createElement('label');
        label.textContent = name;
        const input = document.createElement('input');
        Object.assign(input, { id: `analyticalStyle_${id}`, type: 'number', value: analyticalStyle[id].value, step: 'any', placeholder: 'Auto' });
        analyticalStyle[id] = input;
        input.addEventListener('input', () => renderAnalytical());
        label.append(input);
        analyticalFields.append(label);
      }
      for (const [id, name] of [['plotLegend', 'Show legend'], ['plotTwoTone', 'Two-tone line']]) {
        const label = document.createElement('label');
        label.className = 'analysis-style-bold';
        const input = document.createElement('input');
        Object.assign(input, { type: 'checkbox', checked: analyticalStyle[id].checked });
        analyticalStyle[id] = input;
        input.addEventListener('input', () => renderAnalytical());
        label.append(input, document.createTextNode(name));
        analyticalFields.append(label);
      }
      for (const id of ['phaseMovieFontTarget', 'phaseMovieFontSize']) $(id).closest('label').hidden = true;
      const analyticalPreview = document.createElement('div');
      analyticalPreview.id = 'analyticalPreview';
      analyticalPreview.hidden = true;
      $('analysisPlot').before(analyticalPreview);
      const figureArea = document.createElement('div');
      figureArea.id = 'analysisFigureArea';
      analyticalPreview.before(figureArea);
      figureArea.append(analyticalPreview, $('analysisPlot'));
      figureArea.after($('analyticalExtremaReport'));
      figureArea.setAttribute('aria-label', 'Combined figure. Pinch on the touchpad to zoom.');
      let figureZoom = 1;
      figureArea.addEventListener('wheel', event => {
        if (!phaseMode() || !event.ctrlKey) return;
        event.preventDefault();
        figureZoom = Math.max(0.5, Math.min(4, figureZoom * Math.exp(-event.deltaY * 0.01)));
        alignMovieAxes();
      }, { passive: false });
      figureArea.addEventListener('dblclick', () => {
        figureZoom = 1;
        alignMovieAxes();
      });
      let settingsFrame = 0;
      const redrawSettings = event => {
        if (!phaseMode() || !event.target.matches('input, select, textarea, button')) return;
        cancelAnimationFrame(settingsFrame);
        settingsFrame = requestAnimationFrame(draw);
      };
      for (const name of ['input', 'change', 'click']) {
        $('analysisSettingsPanel').addEventListener(name, redrawSettings);
      }
      $('phaseMoviePlotGap').addEventListener('input', () => {
        const gap = Number($('phaseMoviePlotGap').value);
        if (Number.isFinite(gap)) figureArea.style.setProperty('--movie-plot-gap', `${Math.max(0, Math.min(300, gap))}px`);
      });
      const syncMovieFont = () => {
        const source = $(`plot${$('phaseMovieFontTarget').value}FontSize`);
        $('phaseMovieFontSize').value = source.value;
      };
      $('phaseMovieFontTarget').addEventListener('change', syncMovieFont);
      $('analysisMovieTab').addEventListener('click', syncMovieFont);
      $('phaseMovieFontSize').addEventListener('input', () => {
        const size = Number($('phaseMovieFontSize').value);
        if (!Number.isFinite(size) || size < 8 || size > 48) return;
        $(`plot${$('phaseMovieFontTarget').value}FontSize`).value = String(size);
        $('plotFontTarget').dispatchEvent(new Event('change'));
        draw();
      });
      syncMovieFont();
      let selectedFigureView = 'phase';
      function alignMovieAxes() {
        const movie = phaseMode() && selectedFigureView === 'movie';
        figureArea.style.transform = movie ? `scale(${figureZoom})` : 'none';
        const setHidden = (element, hidden) => { if (element.hidden !== hidden) element.hidden = hidden; };
        if (movie) {
          setHidden(analyticalPreview, !$('phaseMovieShowAnalytical').checked || !analyticalPreview.querySelector('svg'));
          setHidden($('analysisPlot'), !$('phaseMovieShowPhase').checked);
        } else {
          const analytical = phaseMode() && selectedFigureView === 'analytical';
          setHidden($('analysisPlot'), analytical);
          setHidden(analyticalPreview, !analytical || !analyticalPreview.querySelector('svg'));
        }
        const figures = [analyticalPreview.querySelector('svg'), $('analysisPlot').querySelector('svg')];
        for (const svg of figures.filter(Boolean)) {
          let content = svg.querySelector('[data-figure-zoom]');
          if (!content) {
            content = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            content.setAttribute('data-figure-zoom', 'true');
            for (const child of Array.from(svg.children)) {
              const background = child.tagName.toLowerCase() === 'rect' && child.getAttribute('fill') === 'white';
              if (!background && child.tagName.toLowerCase() !== 'defs') content.append(child);
            }
            svg.append(content);
          }
          const zoom = phaseMode() && !movie ? figureZoom : 1;
          const { x, y } = svg.viewBox.baseVal;
          content.setAttribute('transform', `translate(${x} ${y}) scale(${zoom}) translate(${-x} ${-y})`);
        }

        const comparing = phaseMode() && !analyticalPreview.hidden && !$('analysisPlot').hidden && figures.every(Boolean);
        figureArea.classList.toggle('analysis-aligned-figures', comparing);
        const phaseFigure = figures[1];
        if (phaseFigure) {
          if (!phaseFigure.dataset.fullViewBox) phaseFigure.dataset.fullViewBox = phaseFigure.getAttribute('viewBox');
          const [x, y, width, height] = phaseFigure.dataset.fullViewBox.split(/\s+/).map(Number);
          const crop = comparing && phaseFigure.dataset.hasTitle === 'false' ? Math.max(0, Number(phaseFigure.dataset.axesTop) - 2) : 0;
          phaseFigure.setAttribute('viewBox', `${x} ${y + crop} ${width} ${height - crop}`);
        }
        if (!comparing) {
          figures.filter(Boolean).forEach(svg => {
            svg.style.width = ''; svg.style.height = ''; svg.style.marginLeft = '';
            svg.querySelectorAll('text[data-original-font-size]').forEach(text => {
              text.setAttribute('font-size', text.dataset.originalFontSize);
            });
          });
          return;
        }
        const geometry = figures.map(svg => ({
          svg, width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height,
          left: Number(svg.dataset.axesLeft) - svg.viewBox.baseVal.x, axes: Number(svg.dataset.axesWidth)
        }));
        if (geometry.some(g => !g.axes)) return;
        const left = Math.max(...geometry.map(g => g.left / g.axes));
        const right = Math.max(...geometry.map(g => (g.width - g.left - g.axes) / g.axes));
        const availableWidth = Math.max(100, figureArea.clientWidth - 40);
        const axisLength = availableWidth / (1 + left + right);
        for (const g of geometry) {
          const scale = axisLength / g.axes;
          g.svg.style.width = `${g.width * scale}px`;
          g.svg.style.height = `${g.height * scale}px`;
          g.svg.style.marginLeft = `${left * axisLength - g.left * scale}px`;
          g.svg.querySelectorAll('text').forEach(text => {
            if (!text.dataset.originalFontSize) {
              text.dataset.originalFontSize = String(parseFloat(getComputedStyle(text).fontSize));
            }
            text.setAttribute('font-size', String(Number(text.dataset.originalFontSize) / scale));
          });
        }
      }
      const movieLayoutObserver = new MutationObserver(alignMovieAxes);
      movieLayoutObserver.observe($('analysisPlot'), { childList: true });
      movieLayoutObserver.observe(analyticalPreview, { childList: true, attributes: true, attributeFilter: ['hidden'] });
      movieLayoutObserver.observe($('analysisWorkspace'), { attributes: true, attributeFilter: ['class'] });
      new ResizeObserver(alignMovieAxes).observe(figureArea);
      window.addEventListener('resize', alignMovieAxes);
      document.addEventListener('analysisfigureview', event => {
        $('analyticalExtremaReport').hidden = event.detail !== 'analysisEnergyTab' || !$('analyticalExtremaReport').hasChildNodes();
        const views = { analysisPhaseTab: 'phase', analysisEnergyTab: 'analytical', analysisMovieTab: 'movie' };
        const next = views[event.detail];
        if (!next) return;
        const leavingMovie = selectedFigureView === 'movie' && next !== 'movie';
        selectedFigureView = next;
        updateAnalyticalMarker();
        if (leavingMovie) phase.stopAnimation();
        if (next === 'movie') phase.seekMovie(Number($('phaseMovieCurrent').value));
        if (phaseMode() && (next === 'analytical' || (next === 'movie' && $('phaseMovieShowAnalytical').checked)) && !analyticalPreview.querySelector('svg')) {
          generateAnalytical();
        }
        alignMovieAxes();
      });
      for (const id of ['phaseMovieShowAnalytical', 'phaseMovieShowPhase']) {
        $(id).addEventListener('change', () => {
          if (id === 'phaseMovieShowAnalytical' && $(id).checked && !analyticalPreview.querySelector('svg')) generateAnalytical();
          alignMovieAxes();
        });
      }
      $('analysisMovieTab').addEventListener('click', () => {
        if ($('phaseMovieShowAnalytical').checked && !analyticalPreview.querySelector('svg')) generateAnalytical();
        alignMovieAxes();
      });

      function analyticalSettings() {
        const energies = window.BeeMolAutocorrelationPhase.parseEnergies($('phaseEnergies').value);
        const end = Number($('analyticalEnd').value);
        const stepAU = Number($('analyticalStep').value);
        if (energies.length > 100) throw Error('Use at most 100 energy states.');
        if (!Number.isFinite(end) || end <= 0 || !Number.isFinite(stepAU) || stepAU <= 0) {
          throw Error('End time and time step must be positive finite numbers.');
        }
        const count = Math.ceil(end / (stepAU * AU_TO_FS));
        if (count < 2 || count > 1000000) throw Error('Choose a time step giving between 2 and 1,000,000 samples.');
        return { energies, end, stepAU, count };
      }

      function analyticalSamples() {
        const { energies, stepAU, count } = analyticalSettings();
        const weights = energies.map(() => 1 / energies.length);
        return Array.from({ length: count }, (_, i) => {
          const timeAU = i * stepAU;
          const timeFS = timeAU * AU_TO_FS;
          const value = window.BeeMolAutocorrelationPhase.calculate(energies, weights, timeFS);
          return [timeAU, timeFS, value.real, value.imaginary, value.magnitude];
        });
      }

      let analyticalDataset = null;
      let analyticalCoordinates = null;
      let analyticalEnergies = [];
      let markerTime = 0;
      function updateAnalyticalMarker() {
        if (!analyticalDataset || !analyticalCoordinates || !analyticalEnergies.length) return;
        const svg = analyticalPreview.querySelector('svg');
        if (!svg) return;
        let dot = svg.querySelector('.analytical-movie-marker');
        if (!dot) {
          dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('class', 'analytical-movie-marker');
          dot.setAttribute('r', '5');
          dot.setAttribute('fill', 'black');
          dot.setAttribute('stroke', 'white');
          dot.setAttribute('stroke-width', '1');
          (svg.querySelector('[data-figure-zoom]') || svg).append(dot);
        }
        const { X, Y, xmin, xmax, ymin, ymax } = analyticalCoordinates;
        const dotSize = Number($('phaseMovieDotSize').value);
        dot.setAttribute('r', String(Math.max(1, Math.min(40, Number.isFinite(dotSize) ? dotSize : 10)) / 2));
        let magnitude = window.BeeMolAutocorrelationPhase.calculate(
          analyticalEnergies, analyticalEnergies.map(() => 1 / analyticalEnergies.length), markerTime
        ).magnitude;
        if (analyticalStyle.plotTransform.value === 'square') magnitude *= magnitude;
        const points = analyticalDataset.points;
        const inRange = markerTime >= points[0][0] * AU_TO_FS && markerTime <= points[points.length - 1][0] * AU_TO_FS;
        dot.style.display = selectedFigureView === 'movie' && inRange && markerTime >= xmin && markerTime <= xmax && magnitude >= ymin && magnitude <= ymax ? '' : 'none';
        dot.setAttribute('cx', X(markerTime));
        dot.setAttribute('cy', Y(magnitude));
        dot.setAttribute('aria-label', `Movie time ${markerTime.toFixed(6)} fs`);

      }
      document.addEventListener('phasemovietime', event => {
        markerTime = event.detail;
        updateAnalyticalMarker();
      });
      $('phaseMovieDotSize').addEventListener('input', updateAnalyticalMarker);
      renderAnalytical = () => {
        if (!phaseMode()) return;
        const datasets = [
          ...(analyticalDataset ? [analyticalDataset] : []),
          ...series
        ];
        if (!datasets.some(dataset => dataset.visible)) {
          analyticalPreview.replaceChildren();
          return;
        }
        autocorrelation.draw({
          datasets, target: analyticalPreview,
          settings: analyticalStyle,
          onCoordinates: coordinates => {
            analyticalCoordinates = coordinates;
            updateAnalyticalMarker();
          },
          title: $('analyticalFigureTitle').value, xLabel: 'Time (fs)', yLabel: '|A(t)|'
        });
        alignMovieAxes();
      };
      document.addEventListener('analyticaltitlechange', () => renderAnalytical());
      function generateAnalytical() {
        try {
          const samples = analyticalSamples();
          analyticalEnergies = analyticalSettings().energies;
          analyticalDataset = {
            label: 'Analytical |A(t)|', visible: true, color: '#008080', dash: '',
            samplesOnly: true,
            points: samples.map(row => [row[0], row[4]])
          };
          analyticalPreview.hidden = false;
          renderAnalytical();
        } catch (error) {
          analyticalDataset = null;
          analyticalCoordinates = null;
          analyticalEnergies = [];
          renderAnalytical();
          status(error.message);
        }
      };
      let analyticalSamplingFrame = 0;
      for (const id of ['analyticalEnd', 'analyticalStep', 'phaseEnergies']) {
        $(id).addEventListener('input', () => {
          cancelAnimationFrame(analyticalSamplingFrame);
          analyticalSamplingFrame = requestAnimationFrame(() => generateAnalytical());
        });
      }

      const clearAnalyticalExtrema = () => {
        $('analyticalExtremaReport').textContent = '';
        $('analyticalExtremaReport').hidden = true;
      };
      for (const id of ['analyticalEnd', 'analyticalStep', 'phaseEnergies', 'analyticalProminence', 'analyticalPeakSpacing']) {
        $(id).addEventListener('input', clearAnalyticalExtrema);
      }
      $('analyticalFindExtrema').onclick = () => {
        try {
          const samples = analyticalSamples();
          const findPeaks = sign => {
            const values = samples.map(row => sign * row[4]);
            const candidates = [];
            for (let i = 1; i < values.length - 1; i++) {
              if (values[i] <= values[i - 1]) continue;
              let end = i;
              while (end + 1 < values.length && values[end + 1] === values[i]) end++;
              if (end < values.length - 1 && values[end] > values[end + 1]) candidates.push(Math.floor((i + end) / 2));
              i = end;
            }
            return candidates;
          };
          const prominence = Number($('analyticalProminence').value);
          const spacing = Number($('analyticalPeakSpacing').value);
          if (![prominence, spacing].every(value => Number.isFinite(value) && value >= 0)) throw Error('Peak prominence and spacing must be nonnegative finite numbers.');
          // Match scipy: prioritize taller peaks for distance suppression, then test prominence.
          const filteredExtrema = sign => {
            const candidates = findPeaks(sign).sort((a, b) => sign * (samples[b][4] - samples[a][4]));
            const separated = [];
            for (const idx of candidates) {
              if (separated.every(other => Math.abs(samples[idx][1] - samples[other][1]) >= spacing)) separated.push(idx);
            }
            return separated.filter(idx => {
              const height = sign * samples[idx][4];
              let left = height, right = height;
              for (let k = idx - 1; k >= 0 && sign * samples[k][4] <= height; k--) left = Math.min(left, sign * samples[k][4]);
              for (let k = idx + 1; k < samples.length && sign * samples[k][4] <= height; k++) right = Math.min(right, sign * samples[k][4]);
              return height - Math.max(left, right) >= prominence;
            }).sort((a, b) => a - b);
          };
          const peaks = filteredExtrema(1), minima = filteredExtrema(-1);
          const extrema = [...peaks.map((idx, n) => ({ idx, n, type: 'Maximum' })), ...minima.map((idx, n) => ({ idx, n, type: 'Minimum' }))];
          const energies = analyticalSettings().energies;
          const format = (value, digits = 6) => value === null ? 'undefined' : value.toFixed(digits);
          const details = extrema.map(({ idx, n, type }) => {
            const result = window.BeeMolAutocorrelationPhase.complexAnalysis(energies, samples[idx][1]);
            const lines = result.rows.map(row => '<tr>' + [row.energy.toFixed(8), format(row.phase, 3), format(row.real), format(row.imaginary), format(row.abs), format(row.signedPercent, 2), format(row.magnitudeContribution)].map(value => `<td>${esc(value)}</td>`).join('') + '</tr>');
            return `<article class="extrema-reference-result">
              <h3>AUTOCORRELATION ${type === 'Maximum' ? 'MAXIMA' : 'MINIMA'}</h3>
              <p>${type === 'Maximum' ? 'Peak' : 'Minimum'} ${n + 1} | Time = ${result.time.toFixed(6)} fs</p>
              <table class="extrema-reference-table" aria-label="${type} ${n + 1} complex contributions">
                <thead><tr>${['Energy (eV)', 'Phase (deg)', 'Real', 'Imag', 'Abs', 'Signed (%)', 'Mag. contrib.'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead>
                <tbody>${lines.join('')}</tbody>
                <tfoot><tr><th scope="row">TOTAL</th><td></td><td>${format(result.real)}</td><td>${format(result.imaginary)}</td><td>${format(result.magnitude)}</td><td></td><td></td></tr></tfoot>
              </table>
            </article>`;
          });
          $('phaseMaxima').innerHTML = extrema.length ? '<option value="">Select a maximum or minimum</option>' + extrema.map(({ idx, n, type }) => `<option value="${samples[idx][1]}">${type} ${n + 1}: ${samples[idx][1].toFixed(6)} fs · magnitude ${samples[idx][4].toFixed(6)}</option>`).join('') : '<option value="">No interior extrema found</option>';
          $('analyticalExtremaReport').innerHTML = details.length ? details.join('') : '<p>No maxima or minima meet the current criteria.</p>';
          $('analysisEnergyTab').click();
          $('analyticalExtremaReport').hidden = false;
        } catch (error) {
          clearAnalyticalExtrema();
          status(error.message);
        }
      };

      $('phaseMaxima').addEventListener('change', () => {
        if (!$('phaseMaxima').value) return;
        $('phaseTimes').value = $('phaseMaxima').value;
        phase.draw();
      });

      $('analyticalCSV').onclick = () => {
        try {
          const samples = analyticalSamples();
          const csv = 'Time (a.u.),Time (fs),Real A(t),Imag A(t),Autocorrelation\n' +
            samples.map(row => row.map(value => value.toPrecision(16)).join(',')).join('\n');
          const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'autocorrelation_theoretical.csv';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          status('Autocorrelation CSV exported.');
        } catch (error) { status(error.message); }
      };






      $('analysisPlotType').value = 'autocorrelation';



      const phaseHiddenControls = [
        'plotTitle', 'plotXLabel', 'plotYLabel'
      ].map(id => $(id)?.closest('label')).filter(Boolean);
      const savedControlDisplays = new Map(phaseHiddenControls.map(node => [node, node.style.display]));
      const plotTitles = { autocorrelation: 'Autocorrelation function', 'autocorrelation-phase': 'Relative Phase Alignment of Cationic States' };
      const plotSettingStates = new Map();
      const plotSettingInputs = () => Array.from($('analysisSettingsPanel').querySelectorAll('input[id^="plot"], select[id^="plot"]'));
      let activePlotType = 'autocorrelation';
      $('analysisPlotType').onchange = () => {
        if (!['autocorrelation', 'autocorrelation-phase'].includes($('analysisPlotType').value)) {
          $('analysisPlotType').value = activePlotType;
          status('This plot type is not implemented yet. Choose Autocorrelation or Autocorrelation phase analysis.');
          return;
        }
        plotSettingStates.set(activePlotType, plotSettingInputs().map(input => [input.id, input.value, input.checked]));
        phase.stopAnimation();
        plotTitles[activePlotType] = $('plotTitle').value;
        activePlotType = $('analysisPlotType').value;
        const incomingSettings = plotSettingStates.get(activePlotType);
        if (incomingSettings) incomingSettings.forEach(([id, value, checked]) => {
          $(id).value = value;
          $(id).checked = checked;
        });
        $('plotTitle').value = plotTitles[activePlotType];
        const isPhase = phaseMode();
        $('analysisWorkspace').classList.toggle('phase-analysis-active', isPhase);
        if (!isPhase) $('analysisWorkspace').classList.remove('analysis-movie-compare');
        theoretical.hidden = !isPhase;
        $('analyticalExtremaReport').hidden = !isPhase || $('analysisEnergyTab').getAttribute('aria-selected') !== 'true' || !$('analyticalExtremaReport').hasChildNodes();
        $('analyticalFindExtrema').hidden = !isPhase;
        analyticalPreview.hidden = !isPhase || !analyticalPreview.hasChildNodes();
        $('analysisPhaseControls').hidden = !isPhase;
        $('phaseAnnotationSettings').hidden = !isPhase;
        $('analysisMovieTab').hidden = !isPhase;
        $('analysisPhaseTab').hidden = !isPhase;
        $('analysisEnergyTab').hidden = !isPhase;
        if (!isPhase) $('analysisSettingsTab').click();
        savedControlDisplays.forEach((display, node) => { node.style.display = isPhase ? 'none' : display; });
        $('plotLegendLineWidth').closest('label').firstChild.textContent = isPhase ? 'Resultant arrow thickness ' : 'Legend line thickness ';
        document.querySelector('#analysisWorkspace > section .card-header h2').textContent = isPhase ? 'Autocorrelation phase analysis' : 'Autocorrelation';
        draw();
      };

      $('plotTitle').value = 'Autocorrelation function';

      $('plotXLabel').value = 'Time (fs)';

      $('plotYLabel').value = '|A(t)|';



      $('plotYMin').value = '0';

      $('plotYMax').value = '1';



      $('analysisOpen').onclick = () => {

        if (typeof stopOrbitalAnimation === 'function') {

          stopOrbitalAnimation();

        }



        arrangeOrbitalWorkspace(true);



        document.querySelector('main.container')

          .classList.add('hidden');



        $('orbitalWorkspace').classList.add('hidden');

        $('analysisWorkspace').classList.remove('hidden');



        draw();

      };



      for (const button of document.querySelectorAll(

        '[data-analysis-mode]'

      )) {

        button.onclick = () =>

          switchViewerMode(button.dataset.analysisMode);

      }



      if ($('analysisWater')) {

        $('analysisWater').onclick = () => $('wbOpen').click();

      }



      $('analysisFiles').onchange = async event => {

        const files = Array.from(event.target.files || []);

        const failures = [];



        for (const file of files) {

          try {

            const datasets = parseCSV(await file.text());



            for (const dataset of datasets) {

              const index = series.length;



              series.push({

                ...dataset,

                file: file.name,

                color: palette[index % palette.length],

                dash: index >= palette.length ? '8 4' : '',

                visible: true

              });

            }

          } catch (error) {

            failures.push(`${file.name}: ${error.message}`);

          }

        }



        controls();

        draw();



        if (failures.length) {

          status(failures.join(' | '));

        }



        event.target.value = '';

      };



      $('analysisClear').onclick = () => {

        series.length = 0;

        controls();

        draw();

        status('Datasets cleared.');

      };



      // All these settings currently belong to Autocorrelation.

      for (const id of [

        'plotTitle',

        'plotXLabel',

        'plotYLabel',

        'plotTransform',

        'plotXMin',

        'plotXMax',

        'plotYMin',

        'plotYMax',

        'plotWidth',

        'plotLegend',

        'plotTwoTone',

        'plotBoxWidth',

        'plotBoxHeight',

        'plotBorderWidth',

        'plotLegendLineWidth'

      ]) {

        if ($(id)) {

          $(id).oninput = draw;

        }

      }



      $('analysisSVG').onclick = exportSVG;

      $('analysisPNG').onclick = exportPNG;



      draw();



    } catch (error) {

      if ($('analysisResult')) {

        status(error.message);

      }



      console.error(error);

    }

  }



  window.BeeMolAnalysis = {
    parseCSV,

    getDatasets() {
      return series.map(dataset => ({
        file: dataset.file,
        label: dataset.label,
        visible: dataset.visible,
        timeUnit: 'atomic_unit',
        points: dataset.points.map(([time, value]) => [
          time,
          value
        ])
      }));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
