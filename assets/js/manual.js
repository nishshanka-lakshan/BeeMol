(() => {
  'use strict';

  // Populate the shared feature guide before about.js binds its navigation.

  document.querySelector('.about-sidebar a[href="#aboutWaterBox"]').insertAdjacentHTML('beforebegin', String.raw`
        <a data-manual-only href="#manualOrbitals">Orbitals</a>
  `);

  document.querySelector('.about-sidebar a[href="#aboutAI"]').insertAdjacentHTML('beforebegin', String.raw`
        <a data-manual-only href="#manualAnalysis">Analysis</a>
  `);

  document.querySelector('#aboutMolecule > [data-about-only]').insertAdjacentHTML('beforebegin', String.raw`
          <h3 data-manual-only>Draw molecule</h3>
          <ul class="builder-icon-tools manual-draw-tools" aria-label="Draw molecule controls" data-no-tooltips data-manual-only>
            <li><button type="button" aria-disabled="true">Element: <strong>C</strong></button><span><strong>Element.</strong> Choose an element from the periodic table.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Draw atoms and bonds" aria-pressed="true">✎</button><span><strong>Draw atoms and bonds.</strong> Click to place an atom. Drag from an atom to create a bond. Click a bond to increase its order.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Move atom">✥</button><span><strong>Move atom.</strong> Drag an atom in the current viewing plane.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Rotate molecule">⟳</button><span><strong>Rotate molecule.</strong> Drag to rotate the view. Scroll to zoom.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Change atom: choose an element, then click an atom">⚛</button><span><strong>Change atom.</strong> Click an atom to replace its element with the selected one.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Erase atom or bond">⌫</button><span><strong>Erase atom or bond.</strong> Click an atom or bond to remove it.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Show atom labels">Aa</button><span><strong>Show atom labels.</strong> Toggle element symbols.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Show atom numbers">123</button><span><strong>Show atom numbers.</strong> Toggle atom numbers.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Undo last edit">↶</button><span><strong>Undo last edit.</strong> Restore the structure before the last edit.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Clear molecule">⌧</button><span><strong>Clear molecule.</strong> Remove all atoms and bonds from the editor.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Insert benzene template">⌬</button><span><strong>Insert benzene template.</strong> Replace the current drawing with a benzene ring.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Optimize molecule with UFF">⚡</button><span><strong>Optimize molecule with UFF.</strong> Add missing hydrogens and relax the geometry.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Use molecule in BeeMol and PySCF">✓</button><span><strong>Use molecule in BeeMol and PySCF.</strong> Apply the optimized structure to BeeMol and the PySCF input.</span></li>
            <li><button type="button" aria-disabled="true" aria-label="Close molecule drawing">Close</button><span><strong>Close.</strong> Close the editor without applying the drawing.</span></li>
          </ul>
          <h3 data-manual-only>Work with a molecule</h3>
          <ul class="manual-molecule-steps" data-manual-only data-no-tooltips>
            <li><strong>Start a drawing.</strong> In <strong>Molecule → Coordinates</strong>, click <button type="button" aria-disabled="true" tabindex="-1">Draw molecule</button>. When the drawing is ready, click <button type="button" aria-disabled="true" tabindex="-1" aria-label="Optimize molecule with UFF">⚡</button> to optimize it, then <button type="button" aria-disabled="true" tabindex="-1" aria-label="Use molecule in BeeMol and PySCF">✓</button> to load it in the main viewer.</li>
            <li><strong>Open a structure.</strong> Drop an XYZ or Molden file onto <button type="button" aria-disabled="true" tabindex="-1" class="manual-file-button">Drag &amp; drop a Molden / Cube / XYZ file</button>, or click that area to browse. To enter a structure by hand, paste XYZ text or one <code>element x y z</code> line per atom into <strong>Coordinates</strong>, then click <button type="button" aria-disabled="true" tabindex="-1" class="secondary">Update Molecule</button>.</li>
            <li><strong>Edit coordinates.</strong> Change an atom’s element or its x, y, and z values in <strong>Coordinates</strong>. Add or remove lines to change the atoms. If the XYZ text includes an atom count on its first line, update that count too. Click <button type="button" aria-disabled="true" tabindex="-1" class="secondary">Update Molecule</button> to apply the edits.</li>
            <li><strong>Orient the view.</strong> Drag to rotate and scroll to zoom. Click <button type="button" aria-disabled="true" tabindex="-1">Fit</button> to frame the structure, or use <button type="button" aria-disabled="true" tabindex="-1">Horizontal</button> and <button type="button" aria-disabled="true" tabindex="-1">Vertical</button> to align its longest axis. Choose an axis under <strong>Look along</strong> and click <button type="button" aria-disabled="true" tabindex="-1">View</button>. To set a specific magnification, enter a value in <strong>Zoom (%)</strong> and click <button type="button" aria-disabled="true" tabindex="-1">Apply zoom</button>.</li>
            <li><strong>Measure geometry.</strong> Click two atoms for a distance, three for an angle, or four for a dihedral. Select the atoms in order, with the vertex second for an angle. Click a selected atom again to deselect it.</li>
            <li><strong>Change the display.</strong> In <strong>Coordinates</strong>, choose <strong>Normal</strong>, <strong>Sticks only</strong>, or <strong>Hide atoms and bonds</strong> under <strong>Molecule display</strong>. Turn on <strong>Show atom labels</strong> or <strong>Show atom numbers</strong> to identify atoms. In <strong>Advanced</strong>, adjust <strong>Bond cutoff factor</strong> if expected bonds are missing or extra bonds appear.</li>
            <li><strong>Export PySCF input.</strong> In <strong>Basic</strong>, set <strong>Method 1</strong>, <strong>Method 2</strong>, <strong>Basis Set</strong>, <strong>Charge</strong>, and <strong>Spin = Nα − Nβ</strong>. Review <strong>Generated PySCF Input</strong>, then use <button type="button" aria-disabled="true" tabindex="-1">Copy PySCF</button> or <button type="button" aria-disabled="true" tabindex="-1" class="primary">Download .py</button> under <strong>Coordinates</strong>.</li>
          </ul>
  `);

  document.querySelector('#aboutOrbitals').insertAdjacentHTML('beforebegin', String.raw`
        <section data-manual-only id="manualOrbitals" class="about-documentation" aria-labelledby="manualOrbitalsTitle">
          <h2 id="manualOrbitalsTitle">Orbitals</h2>
          <ul class="manual-molecule-steps" data-no-tooltips>
            <li><strong>Open and select an orbital.</strong> Open the Orbitals workspace and drop a Molden or Cube file onto the viewer, or click the drop area to browse. With a Molden file, choose an entry in <strong>Molecular Orbitals</strong>, enter an <strong>Orbital number</strong>, or use <button type="button" aria-disabled="true" tabindex="-1" data-orbital-button="orbitalPrev">◀ Prev</button> and <button type="button" aria-disabled="true" tabindex="-1" data-orbital-button="orbitalNext">▶ Next</button>. A Cube file supplies its own grid.</li>
            <li><strong>Inspect the orbital.</strong> Drag to rotate and scroll to zoom. Use <button type="button" aria-disabled="true" tabindex="-1" data-orbital-button="fitOrbitalBtn">Fit</button> to frame the view or <button type="button" aria-disabled="true" tabindex="-1" aria-label="Expand MO view">⛶</button> to expand it. The viewer toolbar also controls alignment, viewing axis, background, and atom colors.</li>
          </ul>
          <h3>Appearance</h3>
          <ul class="manual-molecule-steps" data-no-tooltips>
            <li><strong>Set the surface size.</strong> Leave <strong>Auto isovalue (85%)</strong> on to choose a cutoff that encloses roughly 85% of the squared amplitude on the grid. Enter an <strong>Isovalue</strong> to set it manually. Smaller values generally show larger lobes.</li>
            <li><strong>Adjust the look.</strong> Pick <strong>Negative</strong> and <strong>Positive</strong> colors and use <strong>Flip phase colors</strong> to swap them. Adjust <strong>Surface depth (%)</strong>, <strong>Gloss (%)</strong>, and <strong>Translucency</strong> to change the surface. Adjust <strong>Bond cutoff factor</strong> to change which bonds appear.</li>
            <li><strong>Save or reuse your setup.</strong> Use <button type="button" aria-disabled="true" tabindex="-1">Save style file</button> and <button type="button" aria-disabled="true" tabindex="-1">Load style file</button> to reuse appearance settings. Click <button type="button" aria-disabled="true" tabindex="-1" data-orbital-button="downloadOrbitalFigure">Download</button> for a high-resolution PNG or <button type="button" aria-disabled="true" tabindex="-1" data-orbital-button="downloadOrbitalCube">Download orbital CUBE</button> for the orbital grid.</li>
          </ul>
          <h4>Atom display</h4>
          <ul>
            <li>Under <strong>Molecule display</strong>, choose <strong>Ball &amp; stick</strong>, <strong>Sticks only</strong>, or <strong>Hide atoms and bonds</strong>.</li>
            <li>Check an atom in the list to hide it and its bonds. You can also enable <strong>Click atoms in the 3D view to hide</strong> and pick atoms in the viewer. Uncheck an atom in the list to show it again.</li>
          </ul>
          <h4>Advanced</h4>
          <ul>
            <li>Enable <strong>Show atom labels</strong> to see element symbols or <strong>Atom shine</strong> to add highlights.</li>
            <li>For Molden files, set <strong>Grid detail (X × Y × Z)</strong> to balance resolution and calculation time. Enable <strong>GPU orbital calculation</strong> to use WebGPU when available, with CPU fallback.</li>
          </ul>
          <h4>Atomic orbital contributions</h4>
          <ul>
            <li>Load a Molden file and select a molecular orbital. Expand <strong>Atomic orbital contributions</strong> to see signed coefficients and percentage weights. Set <strong>Filter: |C| ≥</strong> to hide rows with smaller coefficient magnitudes.</li>
            <li>Check one or more boxes in the <strong>Use</strong> column to show the combined contribution of those atomic orbitals in the viewer. Clear the selections to restore the full molecular orbital.</li>
          </ul>
          <h3>Cross-section</h3>
          <ul class="manual-molecule-steps" data-no-tooltips>
            <li>Turn on <strong>Show cross-section</strong>, choose <strong>Plane</strong> (XY, XZ, or YZ), and move <strong>Position</strong> to slide through the grid. Rotate the molecule to change the slice orientation. Toggle <strong>Contour lines</strong> to mark relative amplitude levels.</li>
            <li>In the cross-section preview, click <button type="button" aria-disabled="true" tabindex="-1">PNG</button> to save the slice or <button type="button" aria-disabled="true" tabindex="-1">Movie</button> to export the same slice through the animation frames.</li>
          </ul>
          <h3>Animation</h3>
          <ul class="manual-molecule-steps" data-no-tooltips>
            <li>For a Molden sequence, set <strong>First</strong> and <strong>Last</strong> to choose the range, <strong>Frame step</strong> to skip entries, and <strong>FPS</strong> to control playback speed. Click <button type="button" aria-disabled="true" tabindex="-1" data-orbital-button="animationPlay">Play</button> to preview.</li>
            <li>Enter <strong>Time step (a.u.)</strong> and <strong>Print step</strong> to show elapsed time. Set <strong>Time legend font</strong> and <strong>Font size (px)</strong>, then drag the time legend to move it.</li>
            <li>Choose <strong>MP4 quality</strong> and click <button type="button" aria-disabled="true" tabindex="-1" data-orbital-button="animationRecord">Movie</button> to export the 3D sequence.</li>
          </ul>
        </section>
  `);

  document.querySelector('#aboutAnalysis').insertAdjacentHTML('beforebegin', String.raw`
        <section data-manual-only id="manualAnalysis" class="about-documentation" aria-labelledby="manualAnalysisTitle">
          <h2 id="manualAnalysisTitle">Analysis</h2>
          <h3>Autocorrelation</h3>
          <ul class="manual-molecule-steps" data-no-tooltips>
            <li>Choose <strong>Autocorrelation</strong> under <strong>Plot type</strong>. Use <strong>Upload CSV files</strong> to load one or more CSV, TSV, or TXT files. Include a header row, put time in atomic units in the first column, and put real-valued series in the remaining columns. The plot shows time in femtoseconds.</li>
            <li>Use the dataset controls to choose which curves to overlay and set their colors and line styles. Choose <strong>As provided</strong>, <strong>Absolute value</strong>, or <strong>Square of real value</strong> under <strong>Y values</strong>.</li>
            <li>In <strong>Plot settings</strong>, open <strong>Labels</strong>, <strong>Size</strong>, <strong>Appearance</strong>, <strong>Axis numbers</strong>, <strong>Legend</strong>, or <strong>Text</strong> to style the figure. Open <strong>Export</strong> and click <button type="button" aria-disabled="true" tabindex="-1">Download SVG</button> or <button type="button" aria-disabled="true" tabindex="-1">Download PNG</button>.</li>
          </ul>
          <h3>Autocorrelation phase analysis</h3>
          <ul class="manual-molecule-steps" data-no-tooltips>
            <li>Choose <strong>Autocorrelation phase analysis</strong> under <strong>Plot type</strong> and enter the state <strong>Energies (eV)</strong>. Repeat an energy for each degenerate state. The energy model gives each listed state equal weight.</li>
            <li>Open <strong>Phase</strong> to see the phase vectors and their resultant. Enter <strong>Selected times (fs)</strong> or pick from <strong>Detected maxima / minima</strong>. Use <strong>Figure layout</strong> and <strong>Times in this figure</strong> to arrange the panels. Save with <button type="button" aria-disabled="true" tabindex="-1">Download phase SVG</button> or <button type="button" aria-disabled="true" tabindex="-1">Download phase PNG</button>.</li>
            <li>Open <strong>Analytical autocorrelation</strong> to plot the energy-based curve. Set <strong>End time (fs)</strong> and <strong>Time step (a.u.)</strong>. Use <strong>Minimum prominence</strong> and <strong>Minimum extremum spacing (fs)</strong> to tune the peak search, then click <button type="button" aria-disabled="true" tabindex="-1">Analyze</button>. Use <button type="button" aria-disabled="true" tabindex="-1">Download current curve CSV</button> to save the data.</li>
            <li>Open <strong>Movie</strong> to play the phase figure, the analytical curve, or both. Set <strong>Start (fs)</strong>, <strong>End (fs)</strong>, playback speed, and FPS. Use the timeline to inspect a particular time, or click <button type="button" aria-disabled="true" tabindex="-1">↓ Download high-quality MP4</button> to save the animation.</li>
          </ul>
          <h3>Spectrum</h3>
          <ul class="manual-molecule-steps" data-no-tooltips>
            <li>Choose <strong>Spectrum</strong> under <strong>Plot type</strong>. In <strong>Spectrum settings</strong>, select <strong>MRADC</strong> or <strong>QDNEVPT2</strong> and enter one intensity or oscillator strength per transition. Enter transition energies in eV, or for QDNEVPT2 choose <strong>Total energies (Hartree)</strong> and list the ground state first.</li>
            <li>Set <strong>Broadening (eV)</strong>, <strong>Spectrum shift (eV)</strong>, and the <strong>Omega minimum (eV)</strong>, <strong>Omega maximum (eV)</strong>, and <strong>Omega step (eV)</strong> for the plot grid. Click <button type="button" aria-disabled="true" tabindex="-1">Calculate spectrum</button>. Use <strong>Normalize line</strong> or <strong>Show sticks</strong> to change how the spectrum appears.</li>
            <li>Use <button type="button" aria-disabled="true" tabindex="-1">Save overlay and start next spectrum</button> to compare spectra. Export the figure from <strong>Plot settings → Export</strong>, or click <button type="button" aria-disabled="true" tabindex="-1">Download spectrum .txt</button> for the sampled data.</li>
          </ul>
        </section>
  `);
})();
