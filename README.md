# B3D71 Explorer

A browser-based explorer for population activity in the B3D71 recording: ** 1,346 units, 80 cue-aligned trials, and M1/M2/S1**.

## Run locally

Clone this repository, open a terminal in its directory, and run:

```sh
python3 -m http.server 8002 --bind 127.0.0.1
```

Open **http://127.0.0.1:8002/** in Chrome, Firefox, Safari, or Edge. Keep the terminal open while using the explorer; press Control-C to stop the server.

On macOS, you can also double-click `Start Neuron Visualization.command`. It chooses a free local port and opens the browser automatically.

Serve the files over HTTP rather than opening `index.html` directly: the app loads local JavaScript modules and unit records on demand. Browsing the prepared recording does not require Python scientific packages, MATLAB, a GPU, or a cloud account.

## Explore

- **Single neurons:** unit search, unit table, firing rates, waveforms, cue-response classes, functional hierarchy, correlograms, and LFADS readouts.
- **Populations:** interactions, population dynamics, behavioral alignment, and CASTLE summaries.
- **Figures:** testing views and paper-preparation panels, including the downloadable figure formats linked by the app.

The app ships with precomputed browser data, 1,346 individual unit records, local Three.js modules, and the figure assets referenced by its views. This repository contains the runnable explorer and its publication assets; local virtual environments, caches, backups, and unrelated experimental workspaces are excluded.
