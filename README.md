# BeeMol Three.js orbital edition

## Running

Extract the ZIP, then serve the `BeeMol_ThreeJS` directory with:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in Chrome. Internet is required for the Three.js JavaScript module, 3Dmol.js, and JSmol dependencies loaded from external services.

## Architecture

- `index.html`: application interface
- `assets/css/styles.css`: appearance
- `assets/js/`: molecule builder, PySCF UI, and water box
- `orbital-visualization/orbital-grid.js`: existing Molden and orbital grid logic
- `orbital-visualization/orbital-renderer.js`: orbital UI and Three.js integration
- `orbital-visualization/three-orbitals.js`: new independent Three.js orbital renderer

The molecular orbital viewer is implemented with Three.js. Isosurfaces use a marching-tetrahedra implementation with vertex normals (not yet VibeMol's gradient-normal marching-cubes approach). The existing 3Dmol.js engine remains for other molecular tasks.

## Limitations

- JavaScript syntax was checked with Node. Full interactive browser and scientific visualization correctness were **not** verified.
- The Three.js orbital renderer expects Gaussian CUBE scalar fields, including those produced by BeeMol's pre-existing Molden workflow. Multi-component CUBE files are not comprehensively supported.
- The existing Molden Gaussian basis evaluator is unchanged; validate orbital shapes against reference software.
- Some existing orientation and recording controls are still tied to 3Dmol.js. Full integration with Three.js and reliable movie capture require additional adaptation.
- Orbital isosurfaces are extracted on the main thread, so large grids can freeze the browser. Use moderate grids to begin.

### Smooth isosurface update
The Three.js orbital renderer now uses consistent tetrahedron edge topology for
three- and four-edge intersections, removing the artificial cutouts caused by
unordered intersection points. Vertex normals are calculated from trilinearly
interpolated scalar-field gradients in physical coordinates, rather than
per-triangle flat normals. The geometry is rendered double-sided for robust
visibility. No changes were made to the underlying Molden orbital evaluator.


## Blank orbital viewer repair
Fixed a JavaScript runtime exception in triangle winding: the two world-space triangle vertices must be mutable when reversed. If the browser displays cached files, hard-refresh (Cmd+Shift+R). Run using `python3 -m http.server 8000` and open http://localhost:8000.

## Three.js orientation control fix
Fit, Horizontal, Vertical, six Look along axis choices, and X/Y/Z rotation buttons now manipulate the visible Three.js orbital group. Shift-click reverses rotation. No orbital grid or surface extraction changes.
