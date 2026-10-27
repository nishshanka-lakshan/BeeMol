# BeeMol

### Molecular modeling, orbital visualization, and quantum chemistry workflows in your browser

BeeMol brings molecular structure editing, molecular orbital visualization, PySCF input preparation, water-box construction, and autocorrelation analysis into a single browser interface. It is designed to help researchers inspect structures and electronic-structure data, prepare calculations, and create figures without switching between several separate tools.

[Open BeeMol](https://nishshanka-lakshan.github.io/BeeMol/) · [Report an issue](https://github.com/nishshanka-lakshan/BeeMol/issues)

## Features

| Workspace | Capabilities |
| --- | --- |
| Molecular modeling | Import XYZ coordinates, inspect and edit molecular structures, adjust selected bond lengths, and control molecular orientation. |
| Molecular orbitals | Load Molden and Gaussian CUBE files, display positive and negative isosurfaces, adjust appearance and isovalue, export PNG figures and CUBE data, and record orbital sequences where supported by the browser. |
| PySCF input builder | Prepare downloadable Python inputs for HF and DFT calculations, with options for MP2, CCSD, CASSCF, CASCI, NEVPT2, and ADC workflows. |
| Water box | Build water environments and work with solute and water coordinates. |
| Autocorrelation analysis | Import numerical time series, overlay datasets, customize plots, and export PNG and SVG figures. See the current analysis limitation below. |
| AI assistant | Request explanations based on selected datasets and molecular or orbital metadata through a separately configured Python backend. |

BeeMol generates calculation inputs. Running electronic-structure calculations requires a separate Python environment with PySCF and any additional dependencies required by the generated script.

## Quick start

### Use the website

Open [BeeMol](https://nishshanka-lakshan.github.io/BeeMol/) in a modern browser with WebGL support. Visitors do not need to install Python to use the browser interface.

An internet connection is required for external visualization dependencies. The AI assistant additionally requires a running, configured backend.

### Run locally

Install Python 3, then clone and serve the repository:

```bash
git clone https://github.com/nishshanka-lakshan/BeeMol.git
cd BeeMol
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). If you download a ZIP instead, extract it and run the server from the folder containing `index.html`.

Use a local HTTP server rather than opening `index.html` directly. No frontend build step is required.

## Working with BeeMol

### Molecular structures and calculation inputs

1. Import an XYZ structure or prepare a molecule in the modeling workspace.
2. Inspect the geometry and make the required edits.
3. Set the calculation options, including method, basis set, charge, spin, and active-space settings where applicable.
4. Review the generated PySCF input and download the Python script.
5. Run the script in your computational environment.

Check the geometry, units, electron count, spin, and method settings before submitting a calculation.

### Molecular orbital visualization

Import a Molden file to evaluate orbitals on a numerical grid, or load a Gaussian CUBE file containing an existing scalar field. Select the orbital or frame, adjust the surface settings, and export the desired figure or sequence.

**Isovalue controls**

- **Manual mode:** an orbital amplitude threshold `c` defines surfaces at `+c` and `-c`. The colors distinguish orbital sign, not positive and negative electric charge.
- **Automatic mode:** for orbital-amplitude data, BeeMol selects a threshold intended to enclose approximately 85% of the sampled orbital weight, based on `|ψ|²`. This is an approximate grid-based criterion, not a fixed isovalue of `0.85`.

Different thresholds change the visible extent of an orbital. When comparing figures, use consistent isovalue settings and grid resolution. Interpret density or other scalar CUBE data according to the quantity stored in the file.

### Autocorrelation data

The analysis workspace accepts `.csv`, `.tsv`, and `.txt` numerical data with a header row. Put time in the first column and real numerical series in the remaining columns. Multiple files can be overlaid.

Example CSV:

```csv
Time (a.u.),Autocorrelation
0.0,1.000
0.1,0.998
0.2,0.992
```

Input times are treated as atomic units and displayed in femtoseconds:

```text
1 atomic unit of time = 0.024188843265857 fs
```

Use the plot controls to adjust labels, ranges, and appearance, then export PNG or SVG output. The square transform squares a real input value; it does not reconstruct a complex autocorrelation function from its components.

**Current limitation:** the repository references `assets/js/analysis-tools/autocorrelation-phase.js`, but that file is absent from the reviewed source. This can prevent the analysis workspace from initializing. Restore the module before relying on autocorrelation or phase-analysis controls. Other listed plot types should not be assumed to be implemented.

## Optional AI assistant

The AI assistant uses a separate Python gateway at `/api/analyze`. The frontend endpoint is configured in `assets/js/beemol-config.js`.

### Start the backend locally

On macOS, double-click `Start BeeMol.command`. The launcher prompts privately for the Gemini API key when it is not already set and does not save the entered key to a file. Keep its terminal open while using the assistant.

Alternatively, set the backend environment variables and run:

```bash
python3 ai/backend/server.py
```

Choose a model ID available to your provider account. The source includes a default model string, but model availability must be checked with the provider.

For local use, set the frontend endpoint in `assets/js/beemol-config.js`:

```javascript
window.BEEMOL_API_ENDPOINT = 'http://127.0.0.1:8787/api/analyze';
```

Serve the frontend at `http://localhost:8000`. If using another frontend origin, configure `BEEMOL_ALLOWED_ORIGIN` to match it.

### Backend configuration

| Variable | Purpose |
| --- | --- |
| `BEEMOL_MODEL_API_KEY` | Private API key used by the backend to contact the model provider. |
| `BEEMOL_MODEL` | Model ID available to your provider account. |
| `BEEMOL_MODEL_BASE_URL` | OpenAI-compatible API base URL. With a key configured, the default points to the Gemini compatibility endpoint. |
| `BEEMOL_ALLOWED_ORIGIN` | Allowed frontend origin, including scheme and hostname, without a path or trailing slash. |
| `BEEMOL_HOST` | Backend bind address. Defaults to `127.0.0.1`; hosted deployments use `0.0.0.0`. |
| `PORT` | Backend port. Defaults to `8787`. |

The backend uses the Python standard library. The Render configuration additionally installs `certifi`.

### Data and interpretation

When AI analysis is requested, the selected datasets and contextual metadata included in the request are sent to the configured backend and model provider. Keep API keys in backend environment variables. Never place them in frontend JavaScript or commit them to the repository.

AI responses require scientific review. Autocorrelation peaks alone do not establish spatial charge migration or identify its mechanism; those conclusions require supporting electronic-structure and real-space information.

## Deployment

The frontend can be hosted on GitHub Pages. The optional AI backend is deployed separately using the included Render Blueprint.

### GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages** and choose **GitHub Actions** as the source.
3. Allow the included Pages workflow to complete.
4. Open the published site URL.

### Render backend

1. Create a [Render Blueprint](https://dashboard.render.com/) connected to the repository. Render reads `render.yaml`.
2. Set `BEEMOL_MODEL` to an available model ID and `BEEMOL_MODEL_API_KEY` to your private API key.
3. Verify the backend health endpoint:

   ```text
   https://YOUR-SERVICE.onrender.com/health
   ```

   Expected response:

   ```json
   {"status":"ok"}
   ```

4. Update `assets/js/beemol-config.js`:

   ```javascript
   window.BEEMOL_API_ENDPOINT = 'https://YOUR-SERVICE.onrender.com/api/analyze';
   ```

5. Commit and push the endpoint change.

For a fork or custom domain, update `BEEMOL_ALLOWED_ORIGIN` to the exact frontend origin. For GitHub Pages, this is typically `https://YOUR-USERNAME.github.io`, without the repository path.

The included backend has no user authentication or rate limiting. CORS restricts browser access but does not prevent direct API requests. Configure provider quotas and appropriate access controls before operating a widely shared service. Free hosting instances may take time to respond after inactivity.

## Project structure

```text
BeeMol/
├── index.html                         # Application interface
├── assets/
│   ├── css/                           # Interface styles
│   └── js/
│       ├── app-core.js                # Shared application logic
│       ├── molecule-and-ui.js         # Molecular editing and PySCF input generation
│       ├── three-molecule.js          # Molecular rendering
│       ├── waterbox.js                # Water-box tools
│       ├── analysis.js                # Analysis workspace
│       ├── analysis-tools/            # Plotting modules
│       ├── beemol-ai.js               # AI assistant interface
│       └── beemol-config.js           # Backend endpoint configuration
├── orbital-visualization/
│   ├── orbital-grid.js                # Molden parsing and orbital grids
│   ├── orbital-renderer.js            # Orbital controls, exports, and animation
│   └── three-orbitals.js              # Three.js isosurface rendering
├── ai/
│   ├── backend/server.py              # Python analysis gateway
│   └── training/                      # Example data and preparation guidance
├── Start BeeMol.command               # macOS backend launcher
└── render.yaml                        # Render deployment configuration
```

Orbital surfaces are extracted with marching tetrahedra and rendered using Three.js. Surface normals are derived from interpolated scalar-field gradients in physical coordinates. The application also uses 3Dmol.js and JSmol for molecular functionality.

## Scientific and technical considerations

- Validate orbital shapes against trusted reference software, especially for unfamiliar basis conventions or Molden files.
- Gaussian CUBE scalar fields are supported; multi-component CUBE files are not comprehensively supported.
- Grid resolution and isovalue affect the appearance of surfaces. Large grids can stall the browser because extraction runs on the main thread.
- Movie recording depends on browser support. BeeMol attempts MP4 when available and falls back to WebM.
- Review generated PySCF scripts before execution. Available input options do not guarantee suitability for every molecule or computational method.
- The tools and exported figures require validation for the intended scientific application.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Blank or outdated viewer | Run through an HTTP server, verify WebGL support, and hard-refresh the page to clear cached scripts. |
| Orbital looks too small or too large | Check manual versus automatic isovalue settings, grid resolution, and the quantity represented by the file. |
| Analysis workspace does not load | Check whether `autocorrelation-phase.js` is present and inspect the browser console for script errors. |
| AI assistant cannot connect | Verify the configured endpoint, backend health, allowed origin, and provider credentials. |
| Model request fails | Confirm that the configured model ID and API endpoint are available to your account. |
| Browser becomes unresponsive | Reduce orbital grid size or work with smaller datasets. |

## Contributing

Bug reports and focused improvements are welcome through [GitHub Issues](https://github.com/nishshanka-lakshan/BeeMol/issues) and pull requests. Include the relevant workspace, reproduction steps, browser version, and a small non-sensitive example file when possible. For visualization issues, include the grid and isovalue settings and a reference image if available.

