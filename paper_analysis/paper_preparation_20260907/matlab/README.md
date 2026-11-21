# Paper Figures 1–3: MATLAB plotting source

All 14 panels are drawn from numeric arrays by `plot_paper_figure1.m`, `plot_paper_figure2.m` and `plot_paper_figure3.m`. Figure 3 uses a fresh analysis of complete S21–S40 spike files at the requested 5-major / 16-subtype / 8-community resolutions. These counts are specified settings; memberships, rates, recovery and graph summaries are recomputed. The z-score firing-rate map is omitted. See [Figure 3 methods](FIGURE3_METHODS.md). No existing plot image is copied into the new figures. Each MATLAB run exports editable native FIG, SVG, vector PDF, and 400-dpi PNG.

## Run in MATLAB

Unzip the bundle, open this directory, then run:

```matlab
addpath(pwd)
run_paper_figures(fullfile(pwd, 'output'))
```

`paper_source_data.mat` is included. Base MATLAB functions suffice: Figures 2b and 2d use direct fixed-margin enumeration for two-sided Fisher tests, followed by Holm adjustment within their stated comparison families. No Statistics Toolbox is required. `run_paper_figures.m` defaults to the parent directory when no output directory is passed.

## Execution status

MathWorks MATLAB R2026a Update 5 (26.1.0.3346908) is installed and activated at `/Applications/MATLAB_R2026a.app`. All 14 current panels were rendered by MathWorks MATLAB, with SVG, PDF and 400-dpi PNG exports. The actual runtime is recorded in `matlab_render_results.json`. Each exported PDF was checked for text overlap and clipping, and the rendered panels were visually inspected. Figures 1–2 also support GNU Octave as an optional fallback; Figure 3 exports require MathWorks MATLAB.

For the optional Octave fallback on this Mac, use the native Qt context; the Qt `offscreen` platform cannot render the figures:

```sh
QT_QPA_PLATFORM=cocoa octave --no-gui --quiet --eval "addpath(pwd); run_paper_figures(fullfile(pwd,'output'))"
```

## Figure 2c display

There are exactly two plots. The top plot contains six actual mean firing-rate traces on one shared mirrored axis: regular-spiking is plotted at +FR, fast-spiking at -FR, and tick labels report the positive Hz magnitude. A downward fast-spiking bump represents an increased firing rate reflected for display; it does not mean inhibition. The common scale preserves between-class amplitude comparisons.

The bottom plot places all 1,074 cue-modulated neurons on one signed delta-rate axis. Color identifies area; circles and dark-edged diamonds identify regular and fast waveform classes. Neither the data signs nor latency coordinates are changed. No jitter, statistical summaries, or tests are applied to 2c. Peak latency is the maximum smoothed firing rate within -1 to +4s, including for suppressed neurons; it is not suppression-trough latency.

## Composition statistics

Figure 2b shows All/S1/M1/M2 as four independent 100% stacked-bar facets without y-axes. The edge-to-edge gaps are exactly half the previous layout; physical bar width is unchanged. Every segment shows its proportion inside the bar, including the small fast-spiking fractions. Each bar shows its total neuron count above the top edge. Panels 2b and 2d share the same physical bar width, solid red/blue fills, border widths, and white percentage typography. The waveform legend in 2a uses the corresponding red/blue colors. It asks whether waveform-class proportions vary across the three regions. Its 3x2 Pearson chi-square test has all expected counts above59; Cramer's V measures association. Three pairwise two-sided Fisher exact tests are Holm corrected. All is displayed as a pooled description, not tested as a fourth area.

Figure 2d retains the existing hypothesis: does the cue-excited proportion differ between regular and fast waveform classes? Each scope uses a 2x2 table of waveform class by excited/non-excited (suppressed plus unmodulated). A two-sided Fisher exact test sums fixed-margin tables with probability no greater than the observed table. This handles sparse counts without a t approximation. Holm correction covers all four displayed tests (All/S1/M1/M2), including their overlap. Stars use adjusted P: * < 0.05, ** < 0.01, *** < 0.001, **** < 0.0001; ns >= 0.05. The CSV retains raw and adjusted P, effect sizes and group sizes. This is not a test of the full three-category distribution. The method was chosen for the categorical outcome and sparse cells, not to target a star count. The archived neuron-response classifications and their original paired-test/BH procedure remain unchanged. These tests assume independent neuronal observations conditional on the margins; neither Fisher nor Holm resolves dependence among neurons within the same mouse. Animal-level inference requires independent animals.

Figure 2d uses four aligned broken-y-axis plots, with no detail row or numerical table. Omitted intervals are All 5–30%, S1 5–54%, M1 5–26%, and M2 5–11%. Each scope uses the same break for its Regular and Fast bars, visibly marked through both bar edges and the y-axis. Both retained y ranges have the same linear scale within a scope. Cuts lie entirely inside the excited category; the continuous upper excited piece remains larger than either suppressed or unmodulated in every bar. All 24 true percentages are printed inside their retained color blocks. Breaks differ across areas: compare printed percentages across scopes, not physical heights. The rendering asserts preserved within-bar size ordering, and native FIG verification checks every label fits inside its visible patch.

All statistical observations are neurons from one mouse and one day. The tests describe this recording and do not establish across-animal effects or validated cell identity. Waveform labels remain operational extracellular phenotypes.

References: [MATLAB Fisher exact test](https://www.mathworks.com/help/stats/fishertest.html), [Pearson contingency test](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.chi2_contingency.html), [fixed-margin exact tests](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.fisher_exact.html), [Holm correction](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/p.adjust.html).

## Data provenance and reproducibility

`prepare_matlab_inputs.py` only prepares numeric arrays; it does not draw any figures. The included MAT file lets MATLAB reproduce every plot without Python. `data_provenance.json` records the source files, hashes, trials, smoothing, and group definitions.

Figure 1b now faithfully applies odd-trial baseline normalization and ordering to even-trial activity. The prior Python figure used separately normalized even-trial heatmap images and all-trial traces while its caption claimed held-out traces. The new heatmap is generated from numeric spike-raster-derived rates and the trace data are genuinely even-trial rates minus the odd-trial baseline. The response-class labels still use the archived all-trial paired-test/BH-FDR classification; this is a held-out activity display, not an independent classification validation.

The pipeline checks data dimensions and group counts before drawing. `pp_export` verifies actual output files. Statistical values are independently checked with SciPy. `pp_jsonencode` preserves tiny P values that some Octave JSON encoders round to zero. Exported PDF text geometry and rendered pages are inspected for overlaps and clipping.

## Edit native MATLAB figures

Each panel has a downloadable `.fig` file alongside its exports. Open it in MATLAB with `openfig(filename, 'new', 'visible')` to edit axes, bar patches and labels directly. The `.m` source remains the reproducible source for regenerating all panels.

Figure 3 alone can be regenerated with `run_paper_figure3(output_directory)`. Its inputs, source hashes and analysis settings are in `paper_figure3_data.mat` and `figure3_provenance.json`.

