/* BeeMol autocorrelation module.
 * Handles autocorrelation-specific UI, plotting and PNG/SVG export.
 * Loaded before assets/js/analysis-tools/analysis.js.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  window.BeeMolAutocorrelation = {
    create({ series, AU_TO_FS, esc, status }) {
  // ------------------------------------------------------------

  // Create and arrange controls

  // ------------------------------------------------------------



  function addControls() {

    const titleLabel = $('plotTitle')?.closest('label');

    const widthLabel = $('plotWidth')?.closest('label');

    const uploadLabel = $('analysisFiles')?.closest('label');



    if (!titleLabel || !widthLabel || !uploadLabel) {

      throw Error(

        'Required title, line-width or CSV upload controls are missing.'

      );

    }



    // Plot type belongs on the LEFT, above CSV upload.

    if (!$('analysisPlotType')) {

      const label = document.createElement('label');



      label.innerHTML = `

        Plot type

        <select id="analysisPlotType">

          <option value="autocorrelation">Autocorrelation</option>

          <option value="population">Population vs time</option>

          <option value="charge">Atomic charge vs time</option>

          <option value="dipole">Dipole moment vs time</option>

          <option value="custom">Custom XY plot</option>

        </select>

      `;



      uploadLabel.before(label);

    } else {

      const label = $('analysisPlotType').closest('label');



      if (label) {

        uploadLabel.before(label);

      }

    }



    // Autocorrelation X-axis label.

    if (!$('plotXLabel')) {

      const label = document.createElement('label');



      label.innerHTML = `

        X-axis label

        <input id="plotXLabel" value="Time (fs)">

      `;



      titleLabel.after(label);

    }



    // Autocorrelation dimensions and border settings.

    if (!$('plotBoxWidth')) {

      const box = document.createElement('div');



      box.innerHTML = `

        <label>

          Plot box width

          <input id="plotBoxWidth" type="number"

                 min="300" max="2000" step="50" value="1200">

        </label>



        <label>

          Plot box height

          <input id="plotBoxHeight" type="number"

                 min="150" max="1200" step="25" value="300">

        </label>



        <label>

          Border thickness

          <input id="plotBorderWidth" type="number"

                 min="0.2" max="4" step="0.1" value="2">

        </label>

        <label>

          Legend line thickness

          <input id="plotLegendLineWidth" type="number"

                 min="0.2" max="10" step="0.2" value="3">

        </label>

      `;



      widthLabel.after(box);

    }



    // Two controls: choose a text element, then adjust its font size.
    if (!$('plotFontTarget')) {
      const panel = document.createElement('div');
      panel.id = 'plotFontPanel';
      panel.innerHTML = `
        <label for="plotFontTarget">Select font
          <select id="plotFontTarget">
            <option value="plotLegendFontSize">Legend</option>
            <option value="plotXLabelFontSize">X-axis label</option>
            <option value="plotYLabelFontSize">Y-axis label</option>
            <option value="plotXTickFontSize">X-axis tick numbers</option>
            <option value="plotYTickFontSize">Y-axis tick numbers</option>
          </select>
        </label>
        <div>
          <label for="plotFontSizeValue">Font size (px)</label>
          <div class="plot-font-size-row">
            <button type="button" id="plotFontMinus" aria-label="Decrease selected font size">−</button>
            <input id="plotFontSizeValue" type="number" min="8" max="48" step="1" value="20">
            <button type="button" id="plotFontPlus" aria-label="Increase selected font size">+</button>
          </div>
        </div>
      `;
      for (const [id, value] of [
        ['plotLegendFontSize', 20],
        ['plotXLabelFontSize', 22],
        ['plotYLabelFontSize', 22],
        ['plotXTickFontSize', 18],
        ['plotYTickFontSize', 18]
      ]) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = id;
        input.value = String(value);
        panel.append(input);
      }
      widthLabel.after(panel);

      const target = $('plotFontTarget');
      const value = $('plotFontSizeValue');
      const selectedInput = () => $(target.value);
      const clamp = n => Math.max(8, Math.min(48, n));
      const sync = () => { value.value = selectedInput().value; };
      const update = n => {
        if (!Number.isFinite(n)) return;
        const v = clamp(n);
        selectedInput().value = String(v);
        value.value = String(v);
        draw();
      };
      target.onchange = sync;
      value.oninput = () => {
        if (value.value !== '') update(Number(value.value));
      };
      value.onchange = sync;
      $('plotFontMinus').onclick = () => update(Number(selectedInput().value) - 1);
      $('plotFontPlus').onclick = () => update(Number(selectedInput().value) + 1);
      sync();
    }

  // Compact two-column layout for the right-side Plot settings panel.
  if (!document.getElementById('beemolPlotSettingsStyle')) {
    const css = document.createElement('style');
    css.id = 'beemolPlotSettingsStyle';
    css.textContent = `
      #analysisWorkspace > aside:last-child .analysis-pad {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: end;
        gap: 10px;
      }
      #analysisWorkspace > aside:last-child .analysis-pad > label,
      #analysisWorkspace > aside:last-child .analysis-pad > div:not(.analysis-actions) {
        min-width: 0;
        margin: 0;
      }
      #analysisWorkspace > aside:last-child .analysis-pad > div:has(#plotBoxWidth) {
        display: contents;
      }
      #analysisWorkspace > aside:last-child .analysis-pad input:not([type="checkbox"]),
      #analysisWorkspace > aside:last-child .analysis-pad select {
        width: 100%;
        min-width: 0;
      }
      #analysisWorkspace > aside:last-child #plotFontPanel {
        display: contents;
      }
      #analysisWorkspace > aside:last-child .plot-font-size-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #analysisWorkspace > aside:last-child #plotFontSizeValue {
        width: 60px;
        flex: 1;
        text-align: center;
      }
      #analysisWorkspace > aside:last-child #plotFontMinus,
      #analysisWorkspace > aside:last-child #plotFontPlus {
        padding: 6px 10px;
        flex: none;
      }
      #analysisWorkspace > aside:last-child .analysis-actions {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      #analysisWorkspace > aside:last-child .analysis-actions button {
        min-width: 0;
        width: 100%;
        justify-content: center;
      }
      @media (max-width: 480px) {
        #analysisWorkspace > aside:last-child .analysis-pad {
          grid-template-columns: minmax(0, 1fr);
        }
        #analysisWorkspace > aside:last-child .analysis-actions { grid-column: 1; }
      }
    `;
    document.head.appendChild(css);
  }

  // Hide obsolete unit and multi-figure options.

    for (const id of [

      'plotInputUnit',

      'plotOutputUnit',

      'plotLayout',

      'plotColumns',

      'plotExportFigure'

    ]) {

      const control = $(id);

      if (!control) continue;



      const label = control.closest('label');

      (label || control).style.display = 'none';

    }

  }



  function setting(id, fallback, min, max) {

    const input = $(id);



    if (!input || input.value === '') {

      return fallback;

    }



    const value = Number(input.value);



    if (!Number.isFinite(value)) {

      throw Error(`Invalid value for ${id}.`);

    }



    return Math.max(min, Math.min(max, value));

  }



  // ------------------------------------------------------------

  // Autocorrelation plot

  // ------------------------------------------------------------



  function draw() {

    try {

      const transform = $('plotTransform').value;



      const shown = series

        .filter(dataset => dataset.visible)

        .map(dataset => ({

          ...dataset,

          points: dataset.points.map(([timeAU, value]) => [

            timeAU * AU_TO_FS,

            transform === 'abs'

              ? Math.abs(value)

              : transform === 'square'

                ? value * value

                : value

          ])

        }));



      if (!shown.length) {

        $('analysisPlot').innerHTML = `

          <p style="color:#333;padding:30px">

            Upload CSV files and select autocorrelation curves.

          </p>

        `;



        status('CSV time: atomic units. Plot time: fs.');

        return;

      }



      let xmin = Infinity;

      let xmax = -Infinity;

      let ymin = Infinity;

      let ymax = -Infinity;



      for (const dataset of shown) {

        for (const [x, y] of dataset.points) {

          if (!Number.isFinite(x) || !Number.isFinite(y)) {

            throw Error('A transformed value is not finite.');

          }



          xmin = Math.min(xmin, x);

          xmax = Math.max(xmax, x);

          ymin = Math.min(ymin, y);

          ymax = Math.max(ymax, y);

        }

      }



      if (xmin === xmax) {

        xmin -= 0.5;

        xmax += 0.5;

      }



      const pad = (ymax - ymin || 1) * 0.06;

      ymin -= pad;

      ymax += pad;



      for (const [id, assign] of [

        ['plotXMin', value => { xmin = value; }],

        ['plotXMax', value => { xmax = value; }],

        ['plotYMin', value => { ymin = value; }],

        ['plotYMax', value => { ymax = value; }]

      ]) {

        if ($(id).value !== '') {

          assign(Number($(id).value));

        }

      }



      if (

        ![xmin, xmax, ymin, ymax].every(Number.isFinite) ||

        xmin >= xmax ||

        ymin >= ymax

      ) {

        throw Error(

          'Axis minimum must be smaller than maximum.'

        );

      }



      const PW = setting('plotBoxWidth', 1200, 300, 2000);

      const PH = setting('plotBoxHeight', 300, 150, 1200);
    const legendFontSize = setting('plotLegendFontSize', 20, 8, 48);
      const xLabelFontSize = setting('plotXLabelFontSize', 22, 8, 48);
      const yLabelFontSize = setting('plotYLabelFontSize', 22, 8, 48);
      const xTickFontSize = setting('plotXTickFontSize', 18, 8, 48);
      const yTickFontSize = setting('plotYTickFontSize', 18, 8, 48);

      const border = setting('plotBorderWidth', 2, 0.2, 4);

      const line = setting('plotWidth', 3.0, 0.5, 8);

      const legendLineWidth = setting('plotLegendLineWidth', 3.0, 0.2, 10);



      const legend = $('plotLegend').checked;

      const twoTone = $('plotTwoTone')?.checked ?? false;



      const L = 100;

      const W = L + PW + 50;



      // Measure text to center each legend row.

      const measure = document.createElement('canvas')

        .getContext('2d');



      if (!measure) {

        throw Error('Could not measure legend text.');

      }



      measure.font = `${legendFontSize}px Arial`;



      const legendRows = [];

      let entries = [];

      let rowWidth = 0;



      if (legend) {

        for (const dataset of shown) {

          const entryWidth = 42 +

            measure.measureText(dataset.label).width;



          if (

            entries.length &&

            (

              entries.length >= 4 ||

              rowWidth + 28 + entryWidth > PW

            )

          ) {

            legendRows.push({ entries, width: rowWidth });

            entries = [];

            rowWidth = 0;

          }



          rowWidth +=

            (entries.length ? 28 : 0) + entryWidth;



          entries.push({

            dataset,

            width: entryWidth

          });

        }



        if (entries.length) {

          legendRows.push({ entries, width: rowWidth });

        }

      }



      // Title, centered legend, then plot.

      const legendRowHeight = Math.max(28, legendFontSize + 10);
    const legendStartY = Math.max(65, legendFontSize + 45);



      const T = legendRows.length

        ? legendStartY + 25 + (legendRows.length - 1) * legendRowHeight

        : 65;



      const xLabelY = T + PH + 65;

      const H = xLabelY + 30;



      const X = value =>

        L + (value - xmin) / (xmax - xmin) * PW;



      const Y = value =>

        T + PH - (value - ymin) / (ymax - ymin) * PH;



      const tick = value => {

        const text = value.toFixed(2);

        return text === '-0.00' ? '0.00' : text;

      };



      let svg = `

        <svg xmlns="http://www.w3.org/2000/svg"

             width="${W}" height="${H}"

             viewBox="0 0 ${W} ${H}"

             role="img"

             aria-label="${esc($('plotTitle').value)}">



          <rect width="100%" height="100%" fill="white"/>



          <defs>

            <clipPath id="plotClip">

              <rect x="${L}" y="${T}"

                    width="${PW}" height="${PH}"/>

            </clipPath>

          </defs>



          <g font-family="Arial, sans-serif"

             fill="#222" font-size="18">



            <text x="${L + PW / 2}" y="32"

                  text-anchor="middle" font-size="23">

              ${esc($('plotTitle').value)}

            </text>

      `;



      legendRows.forEach((row, index) => {

        let x = L + (PW - row.width) / 2;

        const y = legendStartY + index * legendRowHeight;



        for (const entry of row.entries) {

          const dataset = entry.dataset;



          svg += `

            <path d="M${x} ${y - 5}h32"

                  stroke="${dataset.color}"

                  stroke-width="${legendLineWidth}"

                  stroke-linecap="round"

                  stroke-dasharray="${dataset.dash}"

                  fill="none"/>



            <text x="${x + 42}" y="${y}" font-size="${legendFontSize}">

              ${esc(dataset.label)}

            </text>

          `;



          x += entry.width + 28;

        }

      });



      // Six X-axis ticks.

      for (let i = 0; i <= 5; i++) {

        const value = xmin + i * (xmax - xmin) / 5;

        const x = X(value);



        svg += `

          <path d="M${x} ${T + PH}v6"

                stroke="#222"

                stroke-width="${border}"

                fill="none"/>



          <text x="${x}" y="${T + PH + 28}"

                text-anchor="middle" font-size="${xTickFontSize}">${tick(value)}</text>

        `;

      }



      // Three Y-axis ticks.

      for (let i = 0; i <= 2; i++) {

        const value = ymin + i * (ymax - ymin) / 2;

        const y = Y(value);



        svg += `

          <path d="M${L - 6} ${y}h6"

                stroke="#222"

                stroke-width="${border}"

                fill="none"/>



          <text x="${L - 14}" y="${y + 6}"

                text-anchor="end" font-size="${yTickFontSize}">${tick(value)}</text>

        `;

      }



      svg += `

        <rect x="${L}" y="${T}"

              width="${PW}" height="${PH}"

              fill="none"

              stroke="#222"

              stroke-width="${border}"/>



        <text x="${L + PW / 2}" y="${xLabelY}"

              text-anchor="middle" font-size="${xLabelFontSize}">

          ${esc($('plotXLabel').value)}

        </text>



        <text transform="translate(25 ${T + PH / 2}) rotate(-90)"

              text-anchor="middle" font-size="${yLabelFontSize}">

          ${esc($('plotYLabel').value)}

        </text>



        <g clip-path="url(#plotClip)">

      `;



      for (const dataset of shown) {

        const path = dataset.points

          .map(([x, y], index) =>

            `${index ? 'L' : 'M'}${X(x).toFixed(3)} ${Y(y).toFixed(3)}`

          )

          .join(' ');



        if (twoTone) {

          svg += `

            <path d="${path}"

                  fill="none"

                  stroke="${dataset.color}"

                  stroke-opacity="0.25"

                  stroke-width="${line * 2.5}"

                  stroke-dasharray="${dataset.dash}"

                  stroke-linecap="round"

                  stroke-linejoin="round"/>

          `;

        }



        svg += `

          <path d="${path}"

                fill="none"

                stroke="${dataset.color}"

                stroke-width="${line}"

                stroke-dasharray="${dataset.dash}"

                stroke-linecap="round"

                stroke-linejoin="round"/>

        `;

      }



      svg += '</g></g></svg>';



      $('analysisPlot').innerHTML = svg;



      status(

        `${shown.length} autocorrelation curves. ` +

        `Plot box: ${PW} × ${PH}. Time in fs.`

      );



    } catch (error) {

      status(error.message);

      $('analysisPlot').replaceChildren();

    }

  }



  // ------------------------------------------------------------

  // Export

  // ------------------------------------------------------------



  function svgText() {

    const svg = $('analysisPlot').querySelector('svg');



    if (!svg) {

      throw Error('Display a plot before exporting.');

    }



    return new XMLSerializer().serializeToString(svg);

  }



  function download(blob, name) {

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');



    link.href = url;

    link.download = name;



    document.body.appendChild(link);

    link.click();

    link.remove();



    setTimeout(() => URL.revokeObjectURL(url), 1000);

  }



  function exportSVG() {

    try {

      download(

        new Blob([svgText()], {

          type: 'image/svg+xml;charset=utf-8'

        }),

        'autocorrelation.svg'

      );



      status('SVG exported.');



    } catch (error) {

      status(error.message);

    }

  }



  function exportPNG() {

    const button = $('analysisPNG');

    let url;



    try {

      const svg = $('analysisPlot').querySelector('svg');

      const text = svgText();



      const exportScale = 6;



      const width = Math.round(

        Number(svg.getAttribute('width')) * exportScale

      );



      const height = Math.round(

        Number(svg.getAttribute('height')) * exportScale

      );



      if (

        !Number.isFinite(width) ||

        !Number.isFinite(height) ||

        width <= 0 ||

        height <= 0

      ) {

        throw Error('Invalid plot dimensions.');

      }



      button.disabled = true;

      status('Exporting PNG…');



      url = URL.createObjectURL(

        new Blob([text], {

          type: 'image/svg+xml;charset=utf-8'

        })

      );



      const image = new Image();



      image.onload = () => {

        try {

          const canvas = document.createElement('canvas');



          canvas.width = width;

          canvas.height = height;



          const context = canvas.getContext('2d');



          if (!context) {

            throw Error('Could not create PNG canvas.');

          }



          context.fillStyle = '#ffffff';

          context.fillRect(0, 0, width, height);

          context.drawImage(image, 0, 0, width, height);



          canvas.toBlob(blob => {

            button.disabled = false;



            if (!blob) {

              status(

                'PNG export failed. Reduce exportScale ' +

                'or the plot dimensions.'

              );

              return;

            }



            download(

              blob,

              'autocorrelation_high_resolution.png'

            );



            status(

              `PNG exported: ${width} × ${height} pixels.`

            );

          }, 'image/png');



        } catch (error) {

          button.disabled = false;

          status(error.message);



        } finally {

          URL.revokeObjectURL(url);

        }

      };



      image.onerror = () => {

        URL.revokeObjectURL(url);

        button.disabled = false;

        status('Could not load the plot for PNG export.');

      };



      image.src = url;



    } catch (error) {

      if (url) URL.revokeObjectURL(url);

      button.disabled = false;

      status(error.message);

    }

  }




      return { addControls, draw, exportSVG, exportPNG };
    }
  };
})();
