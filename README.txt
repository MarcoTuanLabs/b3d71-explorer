NEURON VISUALIZATION - WORKABLE VERSION

Start the site:

1. Double-click "Start Neuron Visualization.command".
2. The Manuscript figure atlas opens in your browser.
3. Keep the Terminal window open while using the site.
4. Press Control-C in Terminal when finished.

The Manuscript figure atlas groups all 14 original analysis views into seven
paper-story figures: single-neuron measurements, functional hierarchy,
population timing, neural manifold, CASTLE phases, neuron contributions, and
the population-state atlas. It reuses the live website visualizations rather
than screenshots or replacement plots.

The Population Dynamics view contains 48 matched successful trials, 38 supplied
LFADS factors, cleaned 3D paw trajectories, and matched behavioral events. The
professor-reproduction manifold uses direct
F1/F2/F5 coordinates, the slide's fixed -0.2 to +2.5 s window, and disclosed
37.5 ms display smoothing. The upstream raw LFADS trial is 25 s long, but that
extra time was not plotted in the supplied reference figure.

New analysis sections include:

- CASTLE phases: phase recruitment and reliability summaries
- Neuron contributions: selected-unit LFADS linear-readout proxy and a
  factor-specific atlas of the units that most strongly read out F1-F38. The selected-unit mode
  also compares static loadings with phase-expressed weight x latent activity.
  Factor atlas now graphs the exact factor x weight transformation, a selected
  unit x factor profile across all CASTLE phases, a many-unit factor-to-readout
  map beside observed phase firing rates, and cumulative top-1, top-3, top-8,
  and all-38 signed readout reconstruction.
- Population interactions: a multivariate S-map table reporting all six
  directed M1/M2/S1 coefficients at the selected trial and time
- Figure reconstruction: the requested Figure 1A-C and Figure 2A-D layouts,
  rebuilt from the complete unit table, trial-averaged PSTHs, population
  heatmap, and extracellular waveforms. Downloadable SVG versions are stored
  in exports/figure1_firing_rate_population.svg and
  exports/figure2_waveform_latency.svg.

Complete spike source:

- All unit rasters and raster-dependent analyses now use the paired
  S21-S40 spike_times/spike_clusters NPY recordings at 32 kHz.
- Trial q maps to session S(21 + floor(q/4)); the four session cues occur at
  5, 35, 65, and 95 seconds. Each analysis window is cue -5 to +20 seconds.
- Those windows contain 13,292,033 spikes. The earlier browser export retained
  11,206,746 because it capped each unit/trial display at 300 events.
- PSTHs, mean rates, waveforms, and autocorrelograms were already complete and
  are preserved. Only the capped raster arrays and analyses derived from them
  were rebuilt.

The CASTLE and Neuron contributions pages are organized as exploration modes
rather than one long report. CASTLE focuses on phase-associated neuron
discovery. Neuron contributions separates the selected-unit
LFADS readout and the factor-specific population atlas.
The ordinary single-unit dashboard uses a compact overview followed by aligned
activity and spike-diagnostic panels.

Important interpretation notes:

- Outcome comparisons use the mutually exclusive 77-trial final classification:
  54 success, 23 fail, and 3 unlabeled neural trials. The older "57" export is
  event-selected reach data with overlapping and duplicated trial IDs, so it is
  not offered as a competing trial-outcome toggle.
- LFADS weights map factors to unit readouts. A high loading does not prove that a
  unit constructed or caused a latent factor.
- LFADS readout weights are fixed across CASTLE phases. The phase-varying quantity
  is factor activity and its expressed readout component, not a refitted dynamic
  weight. Observed phase firing rate is shown alongside, but is not multiplied
  into, that component.
- Dynamic contribution uses the 52 CASTLE-matched neural trials from -1 to 5 s
  at 80 Hz. Each factor is centered over that matched window. The total phase
  magnitude is mean |sum_k w_i,k (f_k - mean(f_k))|. Per-factor component
  magnitude is mean |w_i,k (f_k - mean(f_k))| within phase-labeled frames.
- The summed centered linear drive is invariant to a coordinated change of
  latent basis, but attribution to F1-F38 components depends on the stored LFADS
  basis. Factor shares are therefore descriptive, basis-specific decompositions.
- The supplied files do not include the unit bias and output nonlinearity needed
  for a true LFADS-denoised firing rate. The app labels the available quantity as
  a linear readout proxy.
- Decoder removal and S-map coefficients are descriptive model analyses, not
  causal neuron or cortical influence claims.

Rebuild the complete browser rasters first, then regenerate every dependent
analysis. Use the bundled analysis environment so NumPy/SciPy versions remain
consistent:

  ./.analysis-venv/bin/python tools/full_spike_data.py --spike-root PATH_TO_S21_S40_NPY_DIRECTORY
  ./.analysis-venv/bin/python tools/build_functional_hierarchy.py --spike-root PATH_TO_S21_S40_NPY_DIRECTORY --recompute-matrices --bootstrap-repeats 80
  ./.analysis-venv/bin/python tools/build_castle_insights.py --raw-root PATH_TO_RAW_INPUTS --spike-root PATH_TO_S21_S40_NPY_DIRECTORY
  node tools/build_analysis_assets.mjs --raw-root PATH_TO_RAW_INPUTS
  node tools/build_requested_figures.mjs
  node tools/smoke_test_requested_figures.mjs
  node tools/smoke_test_advanced_views.mjs

The requested figure builder treats trial-relative 0-5 s as the pre-cue
baseline (cue-relative -5 to 0 s) and trial-relative 0-25 s as the full trial
(cue-relative -5 to +20 s). Figure 2 peak times are recomputed from the
50 ms Gaussian-smoothed PSTH inside the requested -1 to +4 s display window.

Scientific provenance and rebuild details are in POPULATION_DYNAMICS.md.
