/* Analysis workspace.

   Only Autocorrelation is currently implemented.

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
  const { addControls, draw, exportSVG, exportPNG } =
    window.BeeMolAutocorrelation.create({ series, AU_TO_FS, esc, status });

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

      addControls();



      $('analysisPlotType').value = 'autocorrelation';



      // Other plot types are placeholders for future work.

      $('analysisPlotType').onchange = () => {

        if ($('analysisPlotType').value !== 'autocorrelation') {

          const message =

            'This plot type is not implemented yet. ' +

            'Only Autocorrelation is currently available.';



          // Keep existing autocorrelation data and settings.

          $('analysisPlotType').value = 'autocorrelation';



          status(message);

          window.alert(message);

        }

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