# Population dynamics methodology

## What the project brief asks for

The Marco Summer Project deck asks for a graphical link from single-neuron activity to
population dynamics, reconstruction of the time / paw-position / paw-velocity views on slides
2-4, reconstruction of the supporting views on slides 5-7, an interactive site that can use
all trials, and a clear understanding of the data structure and scientific question.

The application therefore keeps two population datasets separate instead of forcing them into
one coordinate system.

## Professor-reference cohort

The default view uses the exact matched files supplied with the project:

- `mPC_common_trials_factor_all.mat`: `38 factors x 48 trials x 480 bins`
- `mPC_common_trials_paw_pos_success_cleaned_v2.mat`: `3 axes x 48 trials x 480 bins`
- the matched reach, touch-food, and at-mouth event-index files

All 48 trials are successful common trials. The displayed window is -0.2 to +2.5 seconds at
the original 80 Hz sampling rate. Following slides 27-36 and the `mPC` source naming, the
common-trial array is interpreted as post-LFADS PCA coordinates. The default state space is
therefore labeled PC1/PC2/PC5 rather than F1/F2/F5. A display-only Gaussian filter
with sigma 37.5 ms is applied along time before the three selected axes are drawn. It changes
neither the stored coordinates nor the event times; it suppresses 80 Hz polyline jaggedness and
recovers the rounded lateral lobes and lower arc visible in the reference PowerPoint. The fixed
oblique projection was calibrated against the supplied time-, paw-position-, and paw-speed
figures, and the user can still rotate or zoom it interactively.

The upstream 80-trial LFADS pickle has 2,000 bins at 80 Hz: 25 seconds total, with cue at 5
seconds (approximately -5 to +20 seconds from cue). That full trial is not used to imitate the
professor figure. The common-success source and slide workflow specify source bins 63:280,
equivalent to -0.2 through +2.5 seconds. Extending the display to the entire raw trial would add
activity that is absent from the reference graph. The local common-success bundle contains 48
matched trials; a lecture caption mentions 30 trials but supplies no index for such a subset.
The slide-matched option therefore uses the first 30 rows in supplied file order and says so
explicitly. The complete 48-trial cohort remains selectable.

The paw panel uses camera X against inverted camera Y, matching the image coordinate convention
in the reference. Its source is already cleaned with robust Whittaker smoothing. Paw-position
colour is the cleaned camera X coordinate; paw-velocity colour is the magnitude of the centered
three-dimensional finite difference.

Rebuild this bundle with SciPy and NumPy:

```bash
python tools/build_reference_population.py
```

## Professor-method reconstruction audit

`tools/build_professor_views.py` adds analyses requested by slides 27-43 while preserving an
audit trail for incomplete inputs:

- cumulative PCA variance for full single-trial mPC samples, the -0.2 to +2.5 second window,
  the movement-window trial mean, and the site's trial-mean neuron z-rate matrix;
- independent eight-component PCA for joint, M1, M2, and S1 trajectories followed by CCA
  alignment of each regional space to the joint space;
- five-fold trial-blocked CCA correlations, so alignment quality is evaluated on held-out
  trials rather than only on the fitted samples;
- joint and regional manifolds displayed in common joint-PC coordinates;
- explicit five-nearest-neighbor behavioral-event label purity, excluding states from the
  same trial, as a documented substitute for the undefined `1/NNI` quantity on slide 37;
- teacher-style trial-by-time S-map coefficient atlases and peri-reach/peri-grasp cohort means;
- event-aligned M1/M2/S1 population heatmaps with a trial-mean trace; and
- a spatial stored-component readout map with a sign-reversal control.

The supplied common-trial M1 MAT file is zero bytes. The reconstruction recovers M1 from the
full 80-trial mPC bundle using a one-to-one whole-trajectory correlation match between common
joint trials and full joint trials. The 48 matches are unique (median correlation 0.698,
minimum 0.592), and the matched full-trial IDs are stored in `data/professor.js`.

The slide's statement that eight PCs explain 85% is not reproduced by the supplied single-trial
data. Eight components explain 61.0% over the full -5 to +20 second trial, 78.8% in the
-0.2 to +2.5 second smoothed movement window, and 99.4% after trial averaging. The site reports
that discrepancy rather than selecting preprocessing to force 85%.

Rebuild the audit asset with the spike-sorting environment that supplies SciPy:

```bash
/opt/miniconda3/envs/spikesort/bin/python tools/build_professor_views.py
```

## Full 80-trial cohort

The full cohort is rebuilt from the four supplied LFADS mPC arrays:

- `mPC_ALL_trial_base.pickle`
- `mPC_m1_trial_base.pickle`
- `mPC_m2_trial_base.pickle`
- `mPC_s1_trial_base.pickle`

Each source has shape `38 factors x 80 trials x 2000 bins`. The supplied `ALL` array is treated
as the joint M1+M2+S1 source. The standard full-cohort viewer uses PCA without CCA, while the
professor-method audit independently fits PCA and CCA across joint and regional arrays. The neural window is -0.2 to +2.5
seconds, smoothed with a fixed 37.5 ms Gaussian kernel, downsampled from 80 Hz to 40 Hz, and
projected into eight dimensions.

Two PCA bases are available:

- **All-sample PCA** is fit across all single-trial time samples.
- **Trial-mean PCA** is fit to the 80-trial mean trajectory, then all trials are projected into
  that basis.

These axes are labeled PC1-PC8, not F1-F8. The full cohort can show all 80 neural trials; three
trials without behavior labels are neutral in outcome colour mode. The older 80-trial paw
estimate is intentionally not displayed because it does not reproduce the validated cleaned
trajectory.

Rebuild this bundle with NumPy:

```bash
python tools/build_population_dynamics.py
```

## Complete spike-raster source

Raster-dependent analyses use the 40 paired files `S21_spike_times.npy` through
`S40_spike_clusters.npy`. Spike times are integer sample indices at 32 kHz and
cluster IDs are the global unit IDs 0-1345. Each session contributes four
trials with cues at 5, 35, 65, and 95 seconds. Trial `q` therefore maps to
session `S(21 + floor(q/4))`, local trial `q mod 4`, and the retained window is
cue-relative -5 to +20 seconds.

The 80 windows contain 13,292,033 spikes. The original browser-oriented unit
files retained 11,206,746 because each unit/trial raster was limited to 300
points. `tools/full_spike_data.py` restores the complete raster arrays while
preserving the already-complete PSTHs, rates, waveforms, and autocorrelograms.
The functional hierarchy reads the paired NPY files directly, not through the
browser files. CASTLE phase rates and the held-out decoder are regenerated
after the raster import.

Every rebuild stores the SHA-256 source fingerprint in its generated metadata.
The full-raster count also reproduces all 1,346 two-decimal mean rates and the
cue-aligned z-score product (`r = 0.999786` against the independent stored
heatmap), providing mapping checks that are separate from the clustering.

## Outcome-label resolution

Population outcome comparisons use the supplied `raw_inputs/behavior/everycon` classification.
It partitions 77 unique neural trials into 54 success and 23 fail trials with no overlap or
duplicate trial IDs; the remaining three of 80 neural trials are shown as unlabeled.

The separate
`raw_inputs/latent_dynamics/05062026_behavioral_labels/everycon` export is not treated as an
alternative trial-outcome definition. Although its files contain 38 success entries and 19 fail
entries, they represent event-selected reaches rather than a mutually exclusive final outcome:
only 52 trial IDs are unique, trials 1, 2, 16, and 51 in one-based display numbering occur in both
groups, and one failed entry is duplicated. Using those files as 57 independent trial labels
would therefore double-count observations and mix reach-level selection with trial-level outcome.
The interface standardizes outcome panels on the 77-trial final classification and retains the
52-trial CASTLE mapping only for analyses that explicitly require framewise CASTLE labels.

## Interpretation limits

The professor-reference manifold uses the full range of the 37.5 ms display-smoothed selected
axes. The full 80-trial PCA cohort uses 1st-99th percentile display limits. Stored source values
are never overwritten. The point cloud and its apparent loop are visualizations, not evidence by
themselves for a rotational dynamical system. This build does not run jPCA, condition shuffles,
or a rotational-significance test. CCA uses trial-blocked cross-validation, but that validation
tests cross-area alignment reproducibility rather than rotational dynamics.

The 3D view draws one coloured polyline per trial on a white background. It does not add a
trial-mean trajectory, PCA cut line, or fitted rotation. Event markers are sampled from each
trial's supplied event time. The default professor-reference axes are direct PC1/PC2/PC5 from
the supplied mPC common-trial array.

## CASTLE five-stage analysis

The CASTLE view uses these supplied sources:

- `castle-syllables-5class.npy`: `52 trials x 480 bins` after reshape
- `trial_set_240320.npy`: one-based CASTLE-to-neural trial mapping
- complete S21-S40 spike recordings mapped to the 52 neural trial IDs
- `B3D71_v4_unit_info.mat`: area and `fast`, `slow`, or `up-down` waveform label

The five source labels are On Perch, On Stage, Touch Mouth, Touch Food, and Lifting. The source
typo `Toucn Food` is corrected only for display. Labels are sampled at 80 Hz from -1 to +5
seconds around cue. A unit's phase firing rate is its total mapped spike count in that phase
divided by the exact total phase occupancy in seconds. The view does not impute unlabeled trials.

Reliability controls are descriptive safeguards:

- **LOO phase consistency** is the fraction of 52 leave-one-trial-out estimates that preserve
  the full-data preferred phase.
- **Odd/even tuning r** is the Pearson correlation between log1p phase-rate profiles from odd
  and even CASTLE trials.
- **Phase selectivity** is one minus normalized entropy across the five non-negative phase rates.

The default map requires at least 1 Hz peak phase firing and 75% LOO consistency. Fast and slow
refer only to the supplied waveform classes. They are not asserted to be interneuron, pyramidal,
inhibitory, or excitatory identities.

The reconstructed CASTLE report now keeps timing, recruitment, and reliability separate:

- Occupancy is the fraction of the 52 mapped trials assigned to each phase at each 80 Hz frame.
- Transition matrices count adjacent frame-label changes. The probability view row-normalizes
  those counts, and transition entropy summarizes how dispersed each source phase's exits are.
- Episode plots use contiguous runs of one label. They are not independent observations when
  several episodes occur in one trial, so the viewer reports distributions descriptively.
- Recruitment can be viewed as phase rate, phase-minus-outside-phase rate, entropy selectivity,
  LOO stability, or a composite display score. The composite is for ranking in the explorer,
  not a validated biological index.
- Area and waveform comparisons use medians and interquartile ranges. They do not perform
  inferential tests or adjust for unequal unit counts.

The phase-recruitment map preserves the raw metric but changes display spacing when the
distribution is highly concentrated near zero. Firing rate uses `log1p(rate)`. Non-negative
recruitment scores use `asinh(score / s)`, where `s` is the median positive score in the current
filtered cohort. Signed phase-minus-baseline differences use a symmetric asinh transform, and
entropy selectivity remains linear from 0 to 100%. Axis ticks and tooltips always show the original
metric units. This prevents a few high-scoring neurons from flattening the remaining population
without deleting, winsorizing, or changing any value.

The supplied outcome mapping covers 50 successful, one failed, and one unlabeled CASTLE trial.
The failed-trial subgroup is intentionally disabled because one failed trial cannot support a
defensible group comparison.

## Neuron-to-LFADS contribution analysis

`B3D71_v4_unit_info.mat` supplies exact `mPC_weight` and `gamma_weight` matrices with shape
`1346 units x 38 factors`. The mPC matrix is the default stored factor-to-unit readout used for
the contribution view. The supplied metadata do not define the gamma matrix semantics, so gamma
plots are explicitly exploratory.

The mean LFADS drive is the dot product of a selected unit's 38 stored weights and the trial-mean
factors from `mPC_ALL_trial_base.pickle`, cropped to -0.2 to +2.5 seconds at 80 Hz. The displayed
alignment proxy is Pearson correlation between this mPC-weighted mean drive and the unit's log1p
observed all-trial PSTH over the same window. It is in-sample and is not a held-out likelihood,
variance-explained score, causal effect, or validated neuron-ablation importance.

For a selected unit `i`, the available linear readout is

`d_i(t) = sum_k w_i,k f_k(t)`.

The complete LFADS observation model would also include the unit bias and output nonlinearity.
Those quantities were not supplied, so the app does not call `d_i(t)` a denoised firing rate and
does not silently invent the missing terms.

### CASTLE-conditioned dynamic readout

The dynamic contribution view uses the exact 52 CASTLE-to-neural trial IDs and the full -1 to
+5 second CASTLE window at 80 Hz. In the 2,000-bin LFADS source, this is indices 320:800 because
the LFADS cue index is 400 and the CASTLE cue index is 80. For each factor, the matched-window
center is

`mu_k = mean_(trial,time) f_k(trial,time)`.

Centering prevents an arbitrary constant factor offset, which could otherwise be absorbed by an
unavailable unit bias, from being labeled as phase activity. For unit `i`, factor `k`, and CASTLE
phase `p`, the displayed phase component magnitude is

`D_i,k,p = mean_(frames in p) |w_i,k (f_k(t) - mu_k)|`,

and the signed companion is

`S_i,k,p = mean_(frames in p) w_i,k (f_k(t) - mu_k)`.

The stored LFADS readout weight `w_i,k` is fixed across CASTLE phases; the application does not
fit or imply a separate dynamic weight. Phase dependence enters through the measured factor
activity `f_k(t) - mu_k`. The Factor atlas therefore labels `D_i,k,p` as a phase-expressed
readout component. It places the observed phase firing rate beside this component as a separate
empirical measurement and never multiplies firing rate into the LFADS readout equation.

The dynamic component share divides `D_i,k,p` by its sum across all 38 factors for the same unit
and phase. The point estimate is occupancy-weighted across phase frames. Its uncertainty whisker
multiplies `|w_i,k|` by a trial-cluster ratio standard error; only trials containing that phase
enter the estimate, and trials rather than frames define independent clusters. Because absolute
components do not cancel, `sum_k D_i,k,p` is a basis-specific component budget and is not equal
to the magnitude of the summed linear drive.

Total phase expression and population rank instead use

`R_i,p = mean_(frames in p) |sum_k w_i,k (f_k(t) - mu_k)|`.

The all-phase reference `R_i,all` pools all matched frames. Phase gain is `R_i,p / R_i,all`, and
dynamic rank is the percentile of `R_i,p` among all 1,346 units. Under a coordinated invertible
change of latent coordinates and readout weights, the summed linear drive and `R_i,p` are
unchanged. Attribution to individual F1-F38 terms, component shares, and their rankings are not
rotation invariant; they describe the stored LFADS basis only.

CASTLE Population comparison uses `R_i,p`, its gain, and rank shift rather than the sum of
factorwise absolute components. Waveform medians and IQRs require at least five neurons in a
cohort. These analyses are descriptive phase-conditioned readout decompositions, not significance
tests, reconstructed firing rates, retrained LFADS ablations, or causal neuron importance.

### Behavior-aligned selected-unit report

The raw raster uses the 52 CASTLE-mapped neural trials. Cue alignment uses the supplied cue at
zero; Touch Food and Lifting alignment use the first onset of the corresponding CASTLE label in
each trial. Trials without the selected onset are omitted and the valid trial count is shown.
The observed PSTH uses 50 ms bins and a normalized five-bin binomial kernel `[1, 4, 6, 4, 1]`.
The CASTLE ribbon is the majority phase among valid trials at each displayed time, so it is a
context overlay rather than a phase-conditioned firing-rate model.

The single-neuron Poisson GLM uses 50 ms spike counts with this log-rate model:

`log E[y] = beta_0 + beta_cue I(0 <= t < 0.3) + sum_p beta_p I(CASTLE phase p)`.

On Perch is the reference phase. Coefficients shown in the chart are fitted on all mapped data;
model quality is five-fold trial-blocked cross-validated deviance explained against an intercept-
only model. `exp(beta)` is a conditional rate ratio. The model has no trial random effect,
continuous movement covariate, confidence interval, or multiplicity correction, so coefficients
are descriptive associations rather than significance or causality claims.

The contribution interface uses progressive disclosure. The default Selected-unit readout mode
contains the signed 38-factor static profile, a compact readout summary, the selected-phase
dynamic component comparison, an all-phase gain profile, and a factor-by-phase share matrix. The
trial-mean linear drive is available in a collapsed detail. The Factor atlas gives an explicit
selected-unit readout bridge, `factor activity x stored weight = signed unit component`, followed
by selected-factor and cumulative signed reconstruction graphs. A five-row phase profile keeps
the selected unit and factor fixed while separately displaying factor activity, expressed
component magnitude, and observed firing rate. A population readout map then places observed
phase rates beside Fk-to-unit edges whose width is `abs(w_i,k) x A_k,p` and whose color preserves
the stored weight sign. The selected phase and factor share `A_k,p` across units, so this
cross-unit ordering is mathematically the same as ordering by `abs(w_i,k)`; phase specificity is
expressed in the component scale and each unit's within-readout component share.

The remaining atlas views include the multi-unit by factor matrix and cumulative signed
reconstructions from the phase-ranked top 1, top 3, top 8, and all 38 factors. Pearson `r` reports
alignment of each partial sum with the complete centered linear readout. These are exact readout
partial sums, not reconstructions of the latent factor itself. Raw behavior, the encoding GLM,
and fixed-decoder removal are kept in Behavior and validation so they remain available without
obscuring the LFADS readout workflow.

The factor ranking uses `abs(weight) x empirical factor standard deviation`. This reduces the
most obvious latent-scale ambiguity but remains a contribution proxy. A formal claim should use
held-out LFADS rates, neuron/group ablations, rate-matched controls, and cross-validated behavior
decoding.

The factor-specific atlas reverses the question from "which factors does this unit read out?" to
"which units most strongly read out this factor?" For factor `k`, each unit is ranked by
`abs(w_i,k x SD_k)`. Its displayed loading-energy share is

`(w_i,k x SD_k)^2 / sum_j (w_j,k x SD_k)^2`.

The denominator always includes all 1,346 units. Positive and negative signs are preserved in
the loading chart, while squared energy is used only for concentration summaries. The effective
unit count is the inverse concentration `(sum e_i)^2 / sum e_i^2`. These quantities describe the
factor-to-unit readout map; they do not identify the neurons that generated the inferred factor.

### Fixed-decoder removal proxy

The CASTLE phase decoder bins spikes at 20 Hz and assigns each bin the majority of its four
80 Hz CASTLE labels. It fits one independent Poisson rate per unit and phase in five folds,
holding complete trials together and using equal class priors. A weak Gamma-Poisson smoothing
term prevents zero-rate log likelihoods. The full population reaches 78.07% balanced accuracy
versus 20% five-class chance (73.04% raw accuracy).

For each selected unit, the pseudo-ablation subtracts that unit's fitted log-likelihood term from
the held-out population score. The decoder is not refitted. The reported change therefore asks
how much the fixed decoder's predictions depend on that term; it is not LFADS retraining,
leave-one-neuron-out model optimization, or a causal intervention.

The multi-neuron view ranks a filtered cohort by scale-adjusted loading norm, absolute LFADS-PSTH
alignment, or CASTLE phase selectivity. Its signed loading matrix uses
`a_if = weight_if x factor_SD_f`, where `i` indexes neurons and `f` indexes factors. For each
factor, the loading-energy graph reports
`sum_selected(a_if^2) / sum_filtered(a_if^2)`. This is a denominator-explicit participation share;
it is not variance explained and does not imply that a selected neuron causes the latent factor.

The neuron-by-time heatmap reports the linear readout drive
`d_i(t) = sum_f weight_if x factor_f(t)` using the trial-mean factors. All rows share one robust
signed color scale so their magnitudes remain comparable. The stacked factor-composition graph
reports `sum_i abs(weight_if x factor_f(t))` as a percentage of the corresponding sum across all
38 factors. Absolute values prevent opposite-signed neuron readouts from cancelling. CASTLE
dominant-phase ribbons are descriptive timing alignments; no phase-conditional LFADS model is fit.

Rebuild the CASTLE and contribution bundle with SciPy and NumPy:

```bash
python tools/build_castle_insights.py
```

Build the CASTLE labels, fixed-decoder removal results, and S-map bundle with Node.js:

```bash
node tools/build_analysis_assets.mjs
```

## Multivariate S-map regional interaction analysis

The Interaction Dynamics page follows the six directed coefficient layout in the Central
University Marco slides. It uses the trial-resolved M1, M2, and S1 population activation signals
stored in `POP.sig`. Each signal is z-scored across all trial-time samples. At query state
`x(t) = [M1(t), M2(t), S1(t)]`, the target is the one-step-ahead state `x(t + 50 ms)`.

For each query, the library excludes every point from the query's trial. Remaining points receive
the S-map weight

`weight_j = exp(-theta * distance(x_j, x_query) / mean_distance)`.

A locally weighted linear regression predicts all three targets from an intercept and the three
current regional signals. A small numerical ridge is added to the three slope terms. The six
cross-region slopes are displayed as `d target(t+1) / d source(t)` for M1->M2, M1->S1, M2->M1,
M2->S1, S1->M1, and S1->M2. Self-terms are fitted but not shown because the professor-reference
figure focuses on cross-region interaction.

Theta is selected from `[0, 0.5, 1, 2, 4, 8]` using a prespecified sparse grid of leave-one-trial-
out queries and mean forecast correlation across M1/M2/S1. The selected value is 4. On all
leave-one-trial-out query states, forecast correlations are 0.655 for M1, 0.587 for M2, and 0.485
for S1. These values support displaying local predictive slopes, but they do not validate a
causal network.

Academic interpretation should remain narrow: a time-varying S-map coefficient is a standardized,
state-dependent predictive slope. Strong causal claims require temporal or trial surrogates,
uncertainty intervals, validation that the state vector contains relevant causal variables, and
robustness to smoothing, embedding, lag, theta selection, and population-signal construction.

## Verification

`tools/smoke_test_advanced_views.mjs` instantiates the real analysis data with a minimal DOM and
renders every CASTLE metric across all five phases, selected Units 204 and 309 across F1, F2, F3,
and F38, and validates the 80 trials x 119 time steps x 6 S-map coefficient tensor. It catches
data-shape and synchronous renderer failures without requiring a browser.
