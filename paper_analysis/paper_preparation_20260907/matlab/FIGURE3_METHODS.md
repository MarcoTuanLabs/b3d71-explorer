# Paper Figure 3 — recomputed functional hierarchy

Figure 3 a–g covers the cue correlation hierarchy, subtype organization and recovery, sixteen prototype traces, raw and normalized full-trial hierarchies, the spatial functional network (3f), and community/edge/hub/bridge summaries (3g). The subtype-sorted **z-score firing-rate map is excluded**. A neuron-by-neuron Pearson correlation matrix remains a different analysis product.

## What is specified versus recovered

The user requested five major classes, sixteen subtypes, and eight graph communities. These numbers are **specified analysis resolutions**, not empirical findings about the number of biological cell types. No reference image, reference neuron count, reference membership vector, graph coordinate, hub rank, or stability score is used as a result. Every member assignment and plotted summary is recomputed from the supplied spike samples. Candidate K=2–10 silhouette scores remain visible so the five-class cut can be judged against alternatives.

The five cue classes are average-linkage clusters of `1 − Pearson r` between trial-mean cue profiles. Class names use measured response summaries: strongest early increase C5, strongest early decrease among the remainder C1, greatest late-minus-early rise among the remainder C3, and the remaining groups ordered by mean rate as C2/C4. This labeling changes names only. It does not guarantee that all names correspond to statistically established response types. Full-trial class labels follow dendrogram order and do not imply correspondence to cue classes.

The sixteen subtypes use the existing 5/1/3/1/6 allocation within C1–C5. Within each parent, 32 deterministic k-means++ starts fit row-standardized actual cue profiles; the minimum-inertia nonempty solution is retained. Child letters follow measured prototype peak time. The count allocation is explicit, but the number of neurons in each child is not imposed.

## Raw measurements and windows

Inputs are the 40 paired `S21`–`S40` spike-time and spike-cluster NPY files. Sample times are at 32 kHz. Each block contributes four cue times (5, 35, 65, 95 seconds) and each trial spans −5 to +20 seconds. This yields 80 trials, 1,346 units, and 160,000 12.5-ms full-trial bins per unit. The browser raster export is not used because that display export can cap spike counts. Source-file content fingerprints, software versions and recovered counts are in `figure3_provenance.json`.

Cue profiles use 120 bins of 50 ms over −1 to +5 seconds, averaged over all 80 trials. Prototype and class traces are arithmetic neuron means in Hz. Raw full-trial Pearson correlations concatenate all 80 spike-count traces without trial averaging. Normalized full-trial correlations first apply a centered five-bin moving sum with zero padding within each trial, then standardize each neuron/trial separately; constant trials contribute zeros. A moving mean gives the same standardized values because its constant factor cancels. Full-trial profile plots return to unnormalized 50-ms mean rates.

Matrix colors use symmetric limits at the 99th percentile of absolute off-diagonal correlation. Saturation, including diagonal entries, is display clipping only; clustering uses the full numerical matrix. Every dendrogram is drawn from the numerical linkage, not an imported picture.

## Membership recovery

Fifty bootstrap samples redraw 20 recording blocks, each keeping its four trials and all neurons together. Each sample refits the major hierarchy and the subtype models at the specified resolutions. Major and child labels are matched to the original fit by maximum membership overlap (Hungarian assignment). Recovery is intersection/union (Jaccard) for each reference group; a missing recovered group scores zero. The plotted interval is the 2.5–97.5 percentile of resampling recovery, not a confidence interval for a population of animals. The full bootstrap matrix is retained in `paper_figure3_data.mat`.

## Functional graph

For every neuron, select its ten strongest positive normalized full-trial Pearson neighbors, with deterministic neuron-ID tie breaking. Reciprocal selections collapse to a single undirected edge. One hundred weighted asynchronous label-propagation runs (seeds 0–99) produce pairwise coassignment frequencies. Average linkage on `1 − coassignment` is cut to exactly eight communities; ties are resolved by the linkage order. Communities are numbered by decreasing size, then minimum neuron ID. Run community counts and within-community coassignment recovery are retained for reproducibility. Figure 3f uses the supplied unit coordinates. Historical spring-layout coordinates remain in the numerical input for reproducibility but are not displayed or used for clustering or statistics.

Weighted degree sums all incident unique-edge weights. Bridge score sums incident weights to another recorded area. Diagonal regional budgets count each within-area edge once; symmetric off-diagonal entries display the same cross-area budget twice. Consequently the upper triangle (including diagonal) sums to the total graph weight. Hubs and bridges are actual unit IDs ranked by these scores, with unit ID resolving ties.

## Coordinates and interpretation

Figure 3f shows the complete functional graph in two equally sized spatial panels: community colors on the left and recorded-region colors on the right. Both contain all 1,346 neurons and all 12,474 original graph edges, without a display subset or additional threshold. Node positions, edge sets, weights and weighted-degree sizes are identical; only node colors change. Coordinates are transformed to `(unit y, −unit x)`; units sharing coordinates receive deterministic 1.8-unit ring offsets. The CSV keeps source coordinates unchanged.

Line shade and width represent four Pearson-weight bins: (0, 0.05), [0.05, 0.10), [0.10, 0.20), and [0.20, infinity). Every edge is drawn once in its bin in each panel. Marker area is `6 + 34*sqrt(weighted_degree / max_degree)` in MATLAB points squared. Community memberships, node sizes, and Figure 3g summaries all use the same complete graph. Shared legends disclose these mappings. The former separate position and overlay panels (3h and 3i) remain retired. These similarity edges do not establish anatomical connectivity.

All observations come from one mouse and recording day. Recording blocks are not independent animals. Bootstrap recovery evaluates sensitivity within this recording. Functional similarity and community membership do not establish synapses, causality, or validated cell types. Weak silhouette separation or low recovery remains visible rather than being replaced with a reference value.

## Reproduce

MATLAB R2026a, without Statistics Toolbox:

```matlab
addpath('path/to/matlab');
run_paper_figure3('path/to/output');
```

`paper_figure3_data.mat` contains numerical matrices, linkage trees, assignments, profiles, graph edges, layout/recorded coordinates and recovery samples. `plot_paper_figure3.m` creates every figure in MATLAB and exports native editable FIG, SVG, vector PDF and 400-dpi PNG through `pp_export.m`. Typography, axis styling, regional colors and line weights follow Figure 1a.

For a complete analysis rebuild, run `prepare_figure3_inputs.py` from the repository with Python + NumPy/SciPy/NetworkX and access to the original spike directory. That script performs numerical analysis only; it does not draw any panel. A source-fingerprint-matched cache can reuse Pearson matrices computed by this same script; cue profiles are independently rebuilt and checked against the cache before reuse. Remove `paper_figure_03_numeric_audit.npz` to force all matrices to be recomputed.

References: [silhouette coefficient](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_score.html), [SciPy average linkage](https://docs.scipy.org/doc/scipy/reference/generated/scipy.cluster.hierarchy.linkage.html), [weighted asynchronous label propagation](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.community.label_propagation.asyn_lpa_communities.html).
