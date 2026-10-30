(function(){
  'use strict';

  window.createTestingViews=function(api){
    const {h,s,stext,svgEl,axes,state,UNITS,THIRD_DRAFT,CASTLE,TESTING_BEHAVIOR,REFPOP,PROF,AC,views}=api;
    const scopes=['All','S1','M1','M2'];
    const scopeColor={All:'#273446',S1:AC.S1,M1:AC.M1,M2:AC.M2};
    const responseColor={'Cue-excited':'#d55e45','Cue-suppressed':'#4d6fa8',Unmodulated:'#929aa6'};
    const responseClasses=['Cue-excited','Cue-suppressed','Unmodulated'];
    const storyChapters=[
      {id:'I',range:'Figure 1',title:'Recorded population',question:'What neural population was recorded in S1, M1 and M2?'},
      {id:'II',range:'Figure 2',title:'Cue response and waveform class',question:'How are updated cue-response classes distributed across waveform classes?'},
      {id:'III',range:'Figure 3',title:'Dexterous task registration',question:'How do success and failure differ across regional event-aligned activity, and what does the archived S-map show?'},
      {id:'IV',range:'Figure 4',title:'Response organization',question:'How are cue-response motifs organized across the recorded population?'},
      {id:'V',range:'Figure 5',title:'Latent-representation audit',question:'How do MARBLE, CEBRA-behavior and newly retrained LFADS organize task progression and outcome?'}
    ];
    const archivedFigures=[
      {
        id:'rates',number:1,title:'Firing-rate landscape across the recorded network',
        question:'What neural population was recorded in S1, M1 and M2?',
        features:'1,346 clusters · common 2.5-Hz bins · exact n · one animal-day',status:'RAW-SPIKE DESCRIPTIVE ANALYSIS',
        claim:'Recorded-window firing-rate distributions have different shapes across the three sampled areas in this recording.',
        guardrail:'All is the mixture of S1, M1 and M2, not an independent group; clusters are not biological replicates.',
        references:[['Ruder et al., Nature 2021 · Extended Data Fig. 1c','https://www.nature.com/articles/s41586-020-03080-z']],
        adaptation:'The proportion-histogram grammar is borrowed; common bins and aligned All/S1/M1/M2 facets are our within-recording adaptation.',
        sources:[['result','Main figure']],
        panels:[['a','All 1,346 clusters are summarized with common 2.5-Hz bins; the final bin contains all units at or above 50 Hz. The All panel is a descriptive mixture and is not entered as a fourth independent group.'],['b','S1 contains 517 recorded clusters and has the highest median recorded-window rate among the three sampled regions (4.13 Hz).'],['c','M1 contains 418 clusters and shows the lowest regional median (2.94 Hz); this is a distributional description, not an animal-level comparison.'],['d','M2 contains 411 clusters with a median of 3.40 Hz. Exact n and a shared proportion axis keep unequal sample sizes visible. Figures 1–2 retain the legacy regional palette; compare labels rather than colors with later figures.']]
      },
      {
        id:'cue',number:2,title:'Cue-locked response sequences across the recorded network',
        question:'When do held-out cue-locked responses appear across S1, M1 and M2?',
        features:'Odd-trial order · even-trial heatmaps · 50-ms display bins from native 12.5-ms samples · cluster SEM',status:'SPLIT-HALF RESPONSE ANALYSIS',
        claim:'The odd-trial ordering remains visually apparent in the held-out even-trial cue-response heatmaps from this recording.',
        guardrail:'SEM is across clusters, not animals; even-trial activity is normalized to the odd-trial pre-cue baseline. Latency reliability and area-by-time population inference remain untested.',
        references:[['Kira et al., Nature Communications 2023 · Fig. 2c–d','https://www.nature.com/articles/s41467-023-37804-2'],['Ruder et al., Nature 2021 · Extended Data Fig. 2a–b','https://www.nature.com/articles/s41586-020-03080-z'],['Park et al., Nature Neuroscience 2025 · Extended Data Fig. 4a–c','https://www.nature.com/articles/s41593-025-01960-z']],
        adaptation:'Odd/even ordering and response-map grammar have direct precedents. ED2a uses separately fit robust curves and cross-validated RMSE rather than rank correlation; ED2b–c use conservative waveform gates and an area-stratified categorical association test.',
        sources:[['result','Main timing map'],['ed02a','ED2a · baseline/modulation'],['ed02b','ED2b · waveform anatomy'],['ed02c','ED2c · waveform/function']],
        panels:[['a','Odd trials define each cluster’s pre-cue normalization and latency order; the frozen transforms are then applied to held-out even trials. The restored high-contrast blue–yellow scale shows even-trial activity normalized to the odd-trial pre-cue baseline and is clipped at −1.5 to +2.5 z for display only.'],['b','Baseline-centered firing-rate traces are averaged across clusters within each displayed scope; ribbons are cluster SEM, replacing the previous ±1 SD. These ribbons describe recorded-cluster dispersion and are not animal-level uncertainty.']]
      },
      {
        id:'castle_states',number:3,title:'Trial-resolved CASTLE population activity across M1, M2 and S1',
        question:'How does regional population firing evolve across cue, lifting, touch-food and touch-mouth events?',
        features:'M1/M2/S1 × four events · fixed trial-ID row order · 52-trial CASTLE cohort · native 80 Hz',status:'DESCRIPTIVE TASK-REGISTRATION ANALYSIS',
        claim:'The same 52 trial rows are retained across all twelve panels, revealing regional event-locked activity without selecting example neurons.',
        guardrail:'This figure is descriptive within one animal-day. Its 52-trial CASTLE labels are not identical to Figure 4’s 63-trial cue/reach/grasp/at-mouth annotations, and no animal-level statistic is inferred.',
        references:[['Ruder et al., Nature 2021 · Extended Data Fig. 1g','https://www.nature.com/articles/s41586-020-03080-z'],['Falasconi et al., Nature 2025 · Fig. 2c','https://www.nature.com/articles/s41586-025-09066-z']],
        adaptation:'The trial-raster/PETH precedent is generalized to regional population activity. Columns follow CASTLE chronology, and a fixed trial-ID row order prevents invalid row-wise comparisons across independently sorted panels.',
        sources:[['result','Main CASTLE population figure']],
        panels:[['a','Cue-aligned M1, M2 and S1 heatmaps begin the CASTLE chronology.'],['b','Lifting-aligned regional activity uses the identical trial-ID row order as every other panel.'],['c','Touch-food-aligned activity preserves the common rows and pooled display scale.'],['d','Touch-mouth-aligned activity closes the displayed chronology. All 12 panels share the pooled 1st–99th percentile pre-cue-z range and event-relative time axis.']]
      },
      {
        id:'state_space',number:4,title:'Cross-area population mappings show movement-event–specific predictability within one recording session',
        question:'Does a model fitted around one movement event generalize equally well to cue, reach, grasp and at-mouth activity?',
        features:'63 common-event trials · 705 supplied project-QC units · 1,000 coherent surrogates',status:'PRIMARY WITHIN-SESSION RESULT',
        claim:'Within this recording, conditional low-rank mappings predict held-out residual activity better around the event at which they were fitted than after transfer to another event (mean ΔR²₀=0.0352).',
        guardrail:'This is instantaneous event-specific prediction in one mouse/day—not physiological direction, anatomical communication, causal feedback or animal-level replication.',
        references:[['Semedo et al., Neuron 2019 · Figs. 2–5','https://pmc.ncbi.nlm.nih.gov/articles/PMC6449210/'],['Semedo et al., Nature Communications 2022 · Figs. 5–6','https://www.nature.com/articles/s41467-022-28552-w'],['Gonzalez et al., Nature 2026 · Fig. 1','https://www.nature.com/articles/s41586-026-10481-z'],['Veuthey et al., Nature Communications 2020 · Fig. 2','https://www.nature.com/articles/s41467-020-17902-1'],['Cu et al., Scientific Reports 2022 · stage-dependent S1–M1 analysis','https://www.nature.com/articles/s41598-022-10871-z'],['Salimian et al., eLife 2026 · tri-area reach-to-grasp figures','https://elifesciences.org/articles/109240/figures']],
        adaptation:'Cross-epoch transfer is extended to simultaneous M2–M1–S1 spiking across cue, reach, grasp and at-mouth epochs. All events use the same 63 trials, one common metric, linear adjustment for measured paw covariates and the third recorded cortical population, complete-trial validation and coherent whole-source-trial surrogates.',
        sources:[['result','Primary event-specific prediction figure']],
        panels:[['a','The common-event primary analysis uses the same 63 trials at cue, reach, grasp and at mouth; raw valid counts are 77/77/77/63.'],['b','M1 predicted from M2: train-event × test-event held-out R²₀; the outlined diagonal contains same-event models.'],['c','M1 predicted from S1 in the identical common target metric.'],['d','All six ordered predictor–target models are summarized as dot plots without physiological arrows.'],['e','Each line is one held-out temporal segment; all five same-minus-cross summaries are positive. P=1/32 is only a sign-consistency reference because training sets overlap.'],['f','The omnibus effect is compared with 1,000 coherent within-block whole-trial surrogates; the same source permutation is reused across events and targets, and every RRR is refitted.'],['g','The supported and prohibited interpretations are stated directly in the figure.']]
      },
      {
        id:'ccs',number:5,title:'Exploratory event-dependent differences in M2–M1 and S1–M1 mapping specificity',
        question:'Does the proposed M2-reach versus S1-contact weighting contrast survive in the supplied project-QC cohort?',
        features:'post hoc source × event contrast · five held-out segments · matched-neuron sensitivity',status:'POST HOC WITHIN-SESSION INTERACTION',
        claim:'No. The 705-unit project-QC primary contrast is negative, positive in only 1/5 held-out segments and nonsignificant under the coherent surrogate (P=0.732).',
        guardrail:'The contrast was selected after inspection, changes sign across reasonable cohort/window choices and uses pair-specific target residuals; it cannot support a hand-off.',
        references:[['Veuthey et al., Nature Communications 2020 · M2–M1 reach dynamics','https://www.nature.com/articles/s41467-020-17902-1'],['Cu et al., Scientific Reports 2022 · stage-dependent S1–M1 analysis','https://www.nature.com/articles/s41598-022-10871-z'],['Stage-dependent cerebrocerebellar communication, Nature Communications 2025 · Figs. 1–2','https://www.nature.com/articles/s41467-025-64592-8']],
        adaptation:'A direct source-by-event contrast is shown only as Extended Data, alongside the controls that reveal its instability.',
        sources:[['result','Post hoc source-by-event Extended Data']],
        panels:[['a','M1-from-M2 and M1-from-S1 same-minus-cross R²₀ are shown across all four events with descriptive fold SEM.'],['b','The post hoc source × event contrast is shown for every held-out segment; only 1/5 is positive.'],['c','Absolute same- and cross-event held-out R²₀ makes the modest prediction scale visible.'],['d','The primary omnibus effect remains positive across rank and ridge choices.'],['e','The primary effect remains positive while the post hoc interaction changes sign across project-QC, window, paw-quality and strict-cohort choices.'],['f','The figure explicitly rejects a hand-off interpretation.']]
      },
      {
        id:'comm_context',number:5,title:'Movement events are associated with reconfiguration of cross-cortical predictive geometry',
        question:'Are phase-specific low-rank target subspaces separated beyond finite-sample estimation noise?',
        features:'63 common-event trials · six ordered mappings · equal-half geometry · 999 phase-label refits',status:'CORE WITHIN-SESSION GEOMETRY RESULT',
        claim:'For ±250-ms windows, equal-half cross-phase target subspaces are 9.38° farther apart than same-phase split-half estimates; the gap is positive in 5/5 fold summaries and the full-data angle exceeds 999 coherent phase-label refits (P=0.001).',
        guardrail:'This is one mouse-day. Paw/task time and the third area are adjusted, not exactly matched; sample normalization does not equalize full covariance spectra. Folds are not animals, and predictive geometry is not information flow, feedback or causality.',
        references:[['Semedo et al., Neuron 2019 · communication subspaces','https://pmc.ncbi.nlm.nih.gov/articles/PMC6449210/'],['Semedo et al., Nature Communications 2022 · cross-epoch generalization','https://www.nature.com/articles/s41467-022-28552-w'],['Koh et al., Nature Neuroscience 2025 · principal-angle reliability controls','https://www.nature.com/articles/s41593-025-02093-z'],['Musall et al., Nature Neuroscience 2019 · movement confounds','https://www.nature.com/articles/s41593-019-0502-4']],
        adaptation:'All phases within an ordered edge share one training-derived target-PC metric. Target axes are mapped back as orth(diag(target scale) × standardized axes), and equal-half cross-phase angles are compared with same-phase split-half reliability before coherent whole-trial phase-label refits.',
        sources:[['result','Main · corrected ±250-ms geometry'],['ed05window','ED5a · ±125-ms sensitivity'],['ed05controls','ED5b · transfer robustness controls'],['ed05behavior','ED5c · behavior sensitivity boundary']],
        panels:[['a','Diagonal cells are same-phase split-half angles; off-diagonals are equal-half cross-phase angles in the same target coordinate system.'],['b','Thin lines show 30 edge×fold estimates, but P=1/32 is computed only from five fold-averaged omnibus differences and is a within-session sign reference.'],['c','The full-data omnibus angle is compared with 999 coherent complete-trial phase-label permutations; every RRR is refitted.'],['d','Each event-pair statistic subtracts the mean same-phase split-half angle of its two events and then averages all six ordered mappings. All six pair summaries are positive in 5/5 folds and exceed a one-sided max-T null across the six pairs (999 coherent phase-label refits; all corrected P=0.001). Cue–grasp (12.23°) and reach–mouth (11.89°) are largest; this is an omnibus predictive-geometry comparison, not an edge-specific or causal claim.'],['e','The noise-corrected gap remains positive after each residual sample vector is normalized to the training median norm; this does not match full covariance spectra.']]
      },
      {
        id:'comm_activity',number:7,title:'Fixed-model screens delimit the conditional mapping claim',
        question:'Does source activity predict future target state or paw movement beyond local history and measured kinematics?',
        features:'0–100-ms lags · 216 max-T tests · 100-ms future paw · fold dots',status:'EXTENDED DATA FIXED-MODEL SCREEN',
        claim:'The displayed fixed smoothed linear models provide no corrected evidence of improved future-target or 100-ms future-paw prediction beyond their covariates.',
        guardrail:'Because the features are symmetrically smoothed and ridge selection is fixed, these screens cannot establish absence of directional or behavioral information.',
        references:[['Sauerbrei et al., Nature 2020 · Fig. 5','https://www.nature.com/articles/s41586-019-1869-9'],['Semedo et al., Nature Communications 2022 · cross-epoch prediction','https://www.nature.com/articles/s41467-022-28552-w'],['Binish et al., Nature Neuroscience 2026 · Fig. 4','https://www.nature.com/articles/s41593-026-02290-4']],
        adaptation:'Input-driven and behavior-linked precedents motivate bounded fixed-model screens with target-history, third-area and paw controls; the null results are kept only to constrain interpretation.',
        sources:[['result','Directional and behavior controls']],
        panels:[['a','The fixed model with added M2 provides no corrected evidence of improved held-out future-M1 prediction after M1 self-history and nuisance controls.'],['b','The analogous S1 screen is shown over 0–100 ms.'],['c','The family-wise P-value screen is displayed for every ordered model × event.'],['d','Fold dots and fixed-model means show neural-added 100-ms future-paw prediction.'],['e','The positive instantaneous result is separated from these fixed-model screens.'],['f','Allowed and prohibited physiological interpretations are stated.']]
      },
      {
        id:'comm_subspace',number:6,title:'Archived regional LFADS factors provide compact cross-area readouts',
        question:'How many archived regional LFADS dimensions are sufficient for held-out cross-area readout?',
        features:'two full-width subfigures · 38 archived regional factors · 9 source→target readouts · 5 complete-trial folds · 603 strict-QC neurons',status:'SUPPORTING ARCHIVAL MODEL READOUT',
        claim:'Training-fold rank selection reaches an early plateau for cross-area readout; source-specific rank–performance curves display both cross-area targets and the same-area control.',
        guardrail:'Selected rank is bounded by the 38-factor ceiling, so comparing it statistically with rank 38 would be circular. Panel c and its n=5 paired contrasts have been removed. The archive predates these folds and cannot establish native LFADS generalization.',
        references:[['Binish et al., Nature Neuroscience 2026 · Fig. 3','https://www.nature.com/articles/s41593-026-02290-4']],
        adaptation:'Regional M1, M2 and S1 LFADS factors predict held-out strict-QC neuronal populations. The factor-to-spike maps, rank selection, PSTH removal and scaling are fit only on complete training trials; the previous behavioral-timing panel has been removed.',
        sources:[['result','LFADS communication-subspace Figure 6']],
        panels:[['a','M1–M2, M2–S1 and M1–S1 each use both directions across five folds. Their selected ranks remain on an informative 0–13 scale, while the fixed rank-38 ceiling is placed in a separate reference block; no P value is reported because the one-SE rule selects at or below that ceiling by construction.'],['b','Three enlarged source-specific plots share one outer-test R² scale and show all 38 LFADS dimensions for both other-region targets and the same-region control. Open circles mark median selected ranks; black triangles mark rank-38 models.']]
      },
      {
        id:'hierarchy',number:7,title:'Cue-response motifs and descriptive similarity organization',
        question:'How do cue-response clusters, 16 descriptive subtypes and similarity-graph communities organize the recorded clusters?',
        features:'four full-width subfigures · 1,346 clusters · 16 descriptive subtypes · cue hierarchy and heatmaps',status:'SUPPORTING DESCRIPTIVE CLUSTERING',
        claim:'A large sustained/excited response family dominates this recording, with smaller suppressed, transient and region-enriched motifs recurring across tree and graph descriptions.',
        guardrail:'Classes, subtypes and graph communities are descriptive response motifs from one recording—not validated cell types or anatomical connectivity. Several groups are very small, and full-trial solutions are highly imbalanced.',
        references:[['Planert et al., Nature Neuroscience 2026 · Fig. 3c–e and Extended Data Fig. 4','https://www.nature.com/articles/s41593-025-02134-7'],['Stringer et al., Nature Neuroscience 2025 · Fig. 1 and Fig. 3','https://www.nature.com/articles/s41593-024-01783-4'],['Kira et al., Nature Communications 2023 · Fig. 2d','https://www.nature.com/articles/s41467-023-37804-2']],
        adaptation:'Every original Functional hierarchy graph is reimplemented from the stored project data. Scientific membership/order is retained; only typography, spacing, common scales and the division into one main plus two Extended Data figures are changed.',
        sources:[['result','Main · cue hierarchy a–d'],['ed10a','ED7a · full-trial trees e–f'],['ed10b','ED7b · graph/positions g–i']],
        panels:[['a','The cue-aligned average-linkage dendrogram, class/area strips, full 1,346×1,346 Pearson matrix, five response profiles and regional compositions are shown together.'],['b','The original 16-subtype order is preserved with the subtype-sorted similarity matrix, normalized rate, n and bootstrap stability; these are descriptive clustering diagnostics, not cell types.'],['c','Smoothed firing rates are z-scored to each cluster’s −5-to-0-s baseline and shown for All, M2, M1 and S1. Major-class/subtype strips and horizontal boundaries expose the common subtype/peak-time ordering.'],['d','All 16 subtype firing-rate prototypes share one y-scale so small and large motifs can be compared without rescaling.']]
      },
      {
        id:'representation_manifolds',number:5,title:'Recomputed MARBLE, CEBRA-behavior and LFADS manifolds',
        question:'How do independently computed MARBLE, CEBRA-behavior and retrained LFADS representations organize task progression and outcome?',
        features:'75 common trials · one validation-selected LFADS model · 38 native factors · 1,346 reconstructed rates · native 80-Hz LFADS trajectories · 18 enlarged regional manifolds',status:'DIRECT NATIVE RECONSTRUCTION',
        claim:'Every LFADS point is rebuilt from the validation-selected seed-760 numerical model. Figure 5a explicitly computes 1,346 firing-rate estimates as 80·exp(Wf+b) and then applies train-only PC1–PC2; regional panels use separately train-fitted M1, M2 and S1 rate PCs from that same reconstruction. No archived LFADS coordinate, reference manifold, slide, PDF, SVG or raster image enters the build.',
        guardrail:'Latent axes are non-identifiable across separately trained models, so cross-method orientation or apparent roundness is not a performance comparison. Reciprocal-5NN is sensitive to outcome-pool density and unequal success/failure counts; its Student/Holm contrasts are within-session associations, not causal evidence.',
        references:[['Gosztolai et al., Nature Methods 2025 · MARBLE Fig. 4','https://www.nature.com/articles/s41592-024-02582-2'],['Schneider et al., Nature 2023 · CEBRA','https://www.nature.com/articles/s41586-023-06031-6'],['Pandarinath et al., Nature Methods 2018 · LFADS','https://www.nature.com/articles/s41592-018-0109-9']],
        adaptation:'MARBLE and CEBRA-behavior retain their frozen E=3 numerical embeddings and outcome-balanced display PCA. LFADS is reconstructed natively at 80 Hz: joint panels use all 1,346 exp(Wf+b)/dt rates, whereas regional panels use M1-, M2- and S1-specific rate PC1–PC2. The regional atlas is split into three large 2×3 plates so each success/failure pair remains readable and retains a one-to-one x:y scale.',
        sources:[['result','Figure 5a and 5b-i–iv']],
        panels:[['a','Columns are MARBLE, CEBRA-behavior and the retrained LFADS rate reconstruction; rows recolor identical coordinates by time, front-view paw x-position and two-view paw speed. The LFADS trajectory contains 216 native 80-Hz samples per trial and is computed as 80·exp(Wf+b) before train-only PC1–PC2.'],['b-i','Large 2×3 MARBLE plate: success and failure are adjacent for M1, M2 and S1, with shared limits and one-to-one x:y scale within each region.'],['b-ii','Large 2×3 CEBRA-behavior plate using the same success/failure and regional organization.'],['b-iii','Large 2×3 LFADS plate computed directly from the new model’s independently train-fitted M1, M2 and S1 reconstructed-rate PCs at 80 Hz; none of the six panels is duplicated or template-aligned.'],['b-iv','Nine reciprocal-5NN panels show success and failure side by side. Brackets use two-sided equal-variance Student tests and Holm correction within each method’s 12 region-by-event contrasts.']]
      },
      {
        id:'reconstruction_fidelity',number:8,title:'Population-wide LFADS reconstruction and CASTLE neuron-ranking profiles',
        question:'How well do archived LFADS factors reconstruct all neurons, and how concentrated is CASTLE phase information across neurons and regions?',
        features:'four full-width subfigures · 603 strict-QC neurons · five complete-trial folds · train-fold-only ranking · random/top/bottom neuron dropping',status:'POPULATION RECONSTRUCTION + NEURON-CONCENTRATION ANALYSIS',
        claim:'Archived-factor readouts outperform mean/PSTH baselines across the population, and training-ranked subsets preserve phase-decoding performance faster than random or bottom subsets.',
        guardrail:'The original LFADS encoder split and native rate link are unavailable, so this is a downstream held-out readout benchmark. The neuron-dropping decoder is refit at each subset, but its regularization strength is reused from the full training cohort; rankings are predictive, not causal.',
        references:[['Pandarinath et al., Nature Methods 2018 · Figs. 1–2','https://www.nature.com/articles/s41592-018-0109-9']],
        adaptation:'Pandarinath-style population reconstruction is paired with leakage-safe neuron-dropping: every ranking is learned inside the training fold, and every random/top/bottom subset decoder is retrained before held-out evaluation.',
        sources:[['result','Main population reconstruction'],['ed11a','ED8 · hidden-neuron baselines']],
        panels:[['a','Observed and archived-factor reconstructed rates are shown for all 603 neurons with identical ordering and a shared linear parula z-score scale from −2 to +4. Figure 2a uses this same color convention.'],['b','Every neuron contributes complete-trial out-of-fold firing-rate R² for mean, PSTH and archived-factor downstream readouts. A broken y-axis enlarges the central mass while retaining every neuron and the high-R² tail; diamonds mark medians.'],['c','Held-out CASTLE phase decoding compares four population representations using balanced accuracy. Dots are complete-trial folds and connecting lines preserve fold identity across representations.'],['d','Within M1, M2, S1 and all areas, random-k, training-ranked top-k and bottom-k decoders are retrained at every retained fraction; all panels share one accuracy scale and annotate the smallest neuron count reaching 90% of full performance. Former panels g–h are removed.']]
      },
      {
        id:'neural_decoding',number:9,title:'Archival paw-position decoding benchmark and recoverable factor replay',
        question:'Can the recoverable archived factors reproduce simultaneous paw position on held-out trials?',
        features:'48 successful trials · 38 archived factors · 5 contiguous trial folds',status:'ARCHIVAL REPRODUCTION WITH SCOPE LIMITS',
        claim:'A trial-held-out linear decoder from the 38 supplied factors reproduces simultaneous paw-position structure with variance-weighted R²=0.900 across 48 successful trials.',
        guardrail:'Poster bars are approximate/digitized; the original denoised-rate predictions and RNN split are unavailable. Panels c–f and all prospective-prediction claims have been removed.',
        references:[['Pandarinath et al., Nature Methods 2018 · Fig. 1 and decoding analyses','https://www.nature.com/articles/s41592-018-0109-9']],
        adaptation:'Only the recoverable simultaneous paw-position benchmark is retained. The archived 38-factor decoder is evaluated with contiguous held-out trial folds; unrecoverable poster-only quantities remain context rather than inference.',
        sources:[['result','Archival neural-decoding Figure 9']],
        panels:[['a','ARCHIVAL CONTEXT ONLY: poster-derived values are approximate/digitized and are not used for current inference. Only the recoverable 38-factor decoder is rerun; the unavailable original split is not invented.'],['b','One representative held-out success shows observed and factor-decoded simultaneous paw position. The five folds hold out complete contiguous trials.']]
      },
      {
        id:'factor_encoder_attribution',number:10,title:'Distributed whole-trial encoder sensitivity across all 38 LFADS factors',
        question:'Which strict-QC neurons does a fresh LFADS encoder depend on at the model level?',
        features:'603 neurons × 38 factors · 16 complete held-out trials · finite masking + local gradients · rate-adjusted ranking',status:'FRESH-CHECKPOINT ENCODER ATTRIBUTION',
        claim:'Across all 38 native factors, whole-trial masking and local gradients identify a distributed encoder-sensitive backbone. Phase-window top-15 analyses are exploratory model sensitivity, not phase-isolated neuronal contribution.',
        guardrail:'Each neuron is deleted for the whole trial and factor sensitivity is then measured inside phase windows; this does not isolate spikes emitted during that phase. These fixed-checkpoint attributions are not causal contributions, and n=9 phase-annotated test trials are insufficient for stable single-cell factor-selective claims.',
        references:[['Pandarinath et al., Nature Methods 2018 · Figs. 1–2','https://www.nature.com/articles/s41592-018-0109-9'],['Genkin et al., Nature Communications 2019 · Fig. 2','https://www.nature.com/articles/s41467-018-08141-6']],
        adaptation:'Complete-trial neuron omission is extended into a 603 × 38 finite-masking atlas, checked against local gradients, regional rate-stratified max-T inference and phase-window summaries. ED10b tests top-neuron reuse against area × within-area firing-rate-quintile matched nulls.',
        sources:[['result','Main encoder-attribution atlas'],['ed10factors','ED10a · all 38 trajectories'],['ed10top','ED10b · phase-wise top-unit reuse']],
        panels:[['a','Raw held-out spikes pass through the frozen fresh LFADS encoder to 38 native factors and then through a separate factor-to-neuron readout.'],['b','Every strict-QC neuron is zero-masked for the complete trial, producing a 603 × 38 atlas; no example neuron is selected.'],['c','Effective neuron number and top-10% concentration compare finite masking, local input-times-gradient attribution and factor-to-neuron readout loading.'],['d','M1, M2 and S1 all contribute to most factors; only one factor survives the firing-rate-stratified across-factor max-T regional test.'],['e','All 38 factors are summarized across five CASTLE windows using nine phase-annotated held-out trials after whole-trial neuron deletion.']]
      },
      {
        id:'reach_grasp_cross_history',number:11,title:'Recorded M2/S1 history predicts M1 at both events but is not selectively greater during grasp',
        question:'Does M2/S1 population history add more held-out prediction of the immediate future M1 state around grasp than around reach?',
        features:'75 matched trials × 5 slots/event · 603 strict-QC units · 999 refit pairing surrogates',status:'AUTHOR-STATED HYPOTHESIS ADJUDICATION',
        claim:'M2/S1 history contributes held-out M1 next-state prediction at reach and grasp relative to fully refit coherent pairing surrogates (P=0.001 each), but is not selectively greater at grasp: the frozen grasp-minus-reach increment is −0.00852 ΔR²₀ (95% CI −0.03302 to 0.01645; block P=0.7422; superblock P=0.7598; pairing-surrogate P=0.948). M1 self-history is directionally lower at grasp, but this secondary contrast is borderline after two-contrast correction (max-|T| P=0.05210).',
        guardrail:'The result distinguishes local self-predictability from the predictive contribution of the two recorded cortical populations. It does not rule out unrecorded extrinsic inputs or nonlinear dynamics, and it cannot establish anatomical input, sensory feedback, causal influence, information flow or animal-level generalization.',
        references:[['Suresh et al., eLife 2020 · reach-versus-grasp dynamics and extrinsic-input hypothesis','https://elifesciences.org/articles/58848']],
        adaptation:'The author-proposed extrinsic-input explanation is converted into a direct, bounded prediction using simultaneous M1/M2/S1 spikes: after task, chronology, strictly past paw kinematics and M1 self-history are controlled, M2/S1 history should add more held-out immediate-future M1 prediction at grasp than reach. All transforms are outer-training-only and coherent within-block trial pairing refits test same-trial structure.',
        sources:[['result','Main · reach–grasp cross-history test']],
        panels:[['a','The frozen contrast separates M1-local predictability from the added contribution of recorded M2/S1 history.'],['b','Task-plus-paw, M1-local and full models are compared on identical trial and relative-time support. The M1-local increment is smaller during grasp.'],['c','M2/S1 history improves prediction at both events relative to coherent trial pairing, but the blockwise increment is not larger at grasp.'],['d','The planned grasp-minus-reach effect is negative and nonsignificant under block, adjacent-superblock and 999-refit structured-surrogate tests. Three/eight-dimensional and 705-unit sensitivities also do not support grasp greater than reach.']]
      }
    ].filter(figure=>!['ccs','comm_activity'].includes(figure.id));

    const archivedFigure=id=>archivedFigures.find(figure=>figure.id===id);
    const reducedFigures=[
      {
        ...archivedFigure('castle_states'),id:'castle_states',number:1,chapter:0,
        title:'Simultaneous M2–M1–S1 spikes across a dexterous movement sequence',
        question:'What was recorded, and how are cue, reach, grasp and at-mouth registered within the same trials?',
        features:'one mouse-day · simultaneous M2/M1/S1 spikes · event-registered paw behavior',
        status:'DATASET AND TASK REGISTRATION',
        claim:'This recording contains simultaneous M2, M1 and S1 spike populations and trial-resolved behavioral events suitable for within-sequence held-out mapping tests.',
        guardrail:'The event-aligned activity is descriptive and the four events occur in a fixed order; it does not itself establish event-specific cross-area mapping.',
        sources:[['result','Event-registered activity'],['overview_rates','Recorded populations'],['overview_cue','Held-out cue responses']]
      },
      {
        ...archivedFigure('state_space'),number:2,chapter:1,
        title:'Conditional cross-area mappings are movement-event specific',
        status:'PRIMARY WITHIN-SESSION DISCOVERY'
      },
      {
        id:'mapping_controls',number:3,chapter:2,
        title:'A shared cross-area architecture dominates event-specific flexibility',
        question:'Does the same-event advantage require rotating axes, or can small gain changes on frozen axes explain it?',
        features:'covariance-matched transfer · frozen-axis gains · nested recurrent models',
        status:'CONFIRMATORY CONTROLS AND MODEL BOUNDARY',
        claim:'Same-event maps outperform wrong-event maps, but covariance-matched geometry does not rotate and freely event-specific axes add no held-out benefit. Frozen-axis event gains add only 0.00077 R²₀ and do not survive covariance matching; a shared low-dimensional architecture dominates.',
        guardrail:'The result supports predictive non-exchangeability and a stable predictive backbone—not invariant anatomy, causal routing, direct information flow or animal-level generalization. The small gain effect is exploratory.',
        references:[['Semedo et al., Neuron 2019 · residual RRR and fixed-subspace routing','https://pmc.ncbi.nlm.nih.gov/articles/PMC6449210/'],['MICs 2026 · decomposing modulatory interactions','https://pmc.ncbi.nlm.nih.gov/articles/PMC13228498/'],['Ehrlich et al., Nature Communications 2024 · reliability-calibrated subspace angles','https://www.nature.com/articles/s41467-024-50501-y'],['CURBD, Neuron 2026 · activity-only recurrent inference boundary','https://doi.org/10.1016/j.neuron.2026.07.016']],
        adaptation:'Training-only covariance whitening/recoloring, split-half reliability and pooled-shared held-out comparison adjudicate the axis claim. A constrained hierarchy then freezes shared source/target axes, adds event-specific diagonal gains or within-subspace mixing, and compares them with freely rotating event maps using nested blocked cross-validation, coherent event-label nulls and matched-size synthetic recovery.',
        sources:[['result','Mapping evidence boundary'],['model_adjudication','ED · shared-map and geometry adjudication'],['frozen_axis','ED · frozen-axis reweighting test'],['recurrent_model','ED · recurrent architecture test'],['prospective_event','ED · event-stratified paw forecast']],
        panels:[['a','Same-event minus cross-event held-out prediction is positive in all five chronological summaries after covariance matching.'],['b','The noise-corrected angle gap falls from 7.39° to −0.18° after covariance matching, so axis rotation is not established.'],['c','A frozen-axis gain model adds only a tiny primary increment and the increment vanishes after covariance matching.'],['d','Freely rotating event maps do not outperform frozen axes; matched-size simulations nevertheless recover moderate rotation truth.'],['e','Other-area history improves next-state prediction, while event-gated weights add a smaller computational increment that does not establish causality.']]
      },
      {
        id:'sliding_switch',number:4,chapter:3,
        title:'Within-sequence temporal generalization of conditional mappings',
        question:'Across adjacent 100-ms windows, does a mapping predict its own time better than distant times, and is any discrete boundary resolved?',
        features:'22 disjoint 100-ms windows · train-time×test-time RRR · structured complete-trajectory null',
        status:'CONTINUOUS-TIME HELD-OUT TEST',
        claim:'A mapping predicts its own 100-ms time window better than windows at least 300 ms away (ΔR²₀=0.00870; 5/5 folds; 250-label null P=0.00398). Two adjacent cue-onset boundaries at 0 and 0.1 s survive max-T, but are not assigned to a movement event.',
        guardrail:'Temporal specificity is predictive, not a causal communication switch. Cue-relative bins also blur trial-variable reach, grasp and at-mouth times.',
        references:[['Javadzadeh & Hofer, Neuron 2022 · perturbation-defined dynamic channels','https://pmc.ncbi.nlm.nih.gov/articles/PMC9616801/'],['Kristl et al., Nature Communications 2025 · behavior-specific motor-area interactions','https://www.nature.com/articles/s41467-025-65381-z'],['Semedo et al., Neuron 2019 · RRR','https://pmc.ncbi.nlm.nih.gov/articles/PMC6449210/']],
        adaptation:'Train-time×test-time held-out RRR is applied to disjoint raw-spike windows, with training-only scaling, PCA, time means, third-area and measured-paw nuisance adjustment. Complete trajectories are relabeled together and every RRR is refitted.',
        sources:[['result','Temporal-generalization analysis']],
        panels:[['a','The train-time×test-time matrix summarizes held-out R²₀ across six ordered area pairs.'],['b','Same-time minus distant-time transfer is plotted on the primary grid and a 50-ms-shifted grid.'],['c','Adjacent-window candidate boundaries are evaluated without selecting an event boundary after viewing the result.'],['d','The omnibus and every candidate boundary are judged against complete-trajectory structured relabeling.']]
      },
      {
        id:'residual_coordination',number:5,chapter:4,
        title:'Single-trial residual coordination survives task, movement, third-area and pairing controls',
        question:'After removing event means and measured nuisance structure, do M2, M1 and S1 residuals from the same physical trial still co-fluctuate?',
        features:'705 units · 63 common trials · 999 whole-trial pairing surrogates',
        status:'SINGLE-TRIAL RESIDUAL RESULT',
        claim:'Same-trial residual cross-area prediction exceeds coherent within-block whole-trial mispairing by 0.0562 R²₀ (5/5 folds; P=0.001), with concordant wider-window and all-marker sensitivities.',
        guardrail:'This establishes conditional predictive co-fluctuation within one session, not anatomical connectivity, information flow or causal direction; it does not by itself show that residual mappings differ across events.',
        references:[['Semedo et al., Neuron 2019 · single-trial residual RRR','https://pmc.ncbi.nlm.nih.gov/articles/PMC6449210/'],['Salimian et al., eLife 2026 · stated simultaneous single-trial gap','https://pmc.ncbi.nlm.nih.gov/articles/PMC13331482/']],
        adaptation:'Training-fold event means and nuisance models remove task, paw and third-area structure before held-out RRR. Whole source trials are circularly paired within recording blocks in both train and test data, and every surrogate RRR is refitted.',
        sources:[['result','Single-trial residual coordination']],
        panels:[['a','All six ordered area pairs and four events show aligned-minus-pairing-null residual R²₀; stars use max-z family correction.'],['b','The observed omnibus is compared with 999 coherent within-block whole-trial pairing surrogates.'],['c','Event summaries are descriptive averages across the six ordered predictor-target models.'],['d','The result remains positive at ±250 ms and after including all front/side marker position, velocity and acceleration nuisance variables.']]
      }
    ];
    const retainedFigureIds=['rates','cue','castle_states','hierarchy','representation_manifolds'];
    const figures=retainedFigureIds.map((id,index)=>{
      const base=archivedFigures.find(figure=>figure.id===id);
      const common={...base,number:index+1,chapter:index};
      if(id==='cue')return {...common,
        title:'Cue-aligned population timing and waveform-class association',
        question:'Using the updated cue definition, are cue-excited neurons enriched among fast/narrow waveforms?',
        features:'−1 to +5 s · paired 80-trial tests · BH-FDR · Fisher/Holm enrichment',
        status:'UPDATED CUE-RESPONSE AND WAVEFORM ANALYSIS',
        claim:'With the updated paired-test plus BH-FDR definition, 823/1,346 neurons are cue-excited. Cue-excited membership is enriched among fast/narrow versus broad neurons overall and in M1 and S1, but not significantly in M2 after Holm correction.',
        guardrail:'This is a within-recording neuron-level association. Neurons are not animals, extracellular waveform class is not a validated cell type, and the regional tests are not independent animal replications.',
        adaptation:'Third-draft panel 1b is moved intact into Testing Figure 2a and extended to −1 to +5 s. Figure 2b retains all three recomputed functional classes and adds prespecified fast/narrow-versus-broad Fisher tests with Holm correction.',
        sources:[['result','Figure 2a–b']],
        panels:[['a','Odd trials determine neuron order and held-out even trials display cue-aligned activity from −1 to +5 s. Curves use the recomputed paired-test/BH-FDR cue classes. This panel is descriptive and contains no significance stars.'],['b','All, S1, M1 and M2 show paired 100%-normalized slow/broad and fast/narrow bars containing cue-excited, cue-suppressed and unmodulated neurons. Brackets test whether fast/narrow neurons are more likely to be cue-excited; the enrichment is significant overall, in S1 and in M1, but not M2 after Holm correction.']]
      };
      if(id==='castle_states')return {...common,
        title:'Event-aligned regional population activity and archived multivariate S-map',
        question:'How do M1, M2 and S1 population signals differ across success and failure at four movement stages, and can the archived six-direction S-map be reproduced more legibly?',
        features:'48 matched successes at 80 Hz · 24 success/failure activation panels · archived 50-trial S-map',
        status:'REFERENCE RECONSTRUCTION AND DESCRIPTIVE CONTEXT',
        claim:'The original common-success mPC plate is reproduced, the stored regional population signals are aligned into 24 paired success/failure views across M1, M2, S1 and four stages, and the exact archived S-map coefficient cube is rendered with greater within-direction contrast.',
        guardrail:'Figures 3a and 3b are descriptive population summaries. Figure 3c is a historical full-data predictive model that does not remove common task/movement structure and cannot establish connectivity, information flow or causality. Its colors are normalized within direction and therefore cannot be used to compare absolute coefficient magnitude across directions.',
        adaptation:'Panel 3a uses the original regional common-success mPC files. Panel 3b uses the stored POP.sig traces, places success directly above failure, and shares one event per column and one global z-score scale across all 24 panels. Panel 3c uses the exact archived coefficient cube but maps each direction\'s P2, median and P98 to a higher-contrast color scale; the printed slope ranges preserve absolute units.',
        sources:[['result','Figure 3a–c']],
        panels:[['a','The original 48 matched successful trials are independently aligned to cue, grasp onset, reach onset and at-mouth. Rows use the supplied common-file order; all panels display regional mPC component 1 at native 80 Hz on the original −3 to +3 scale.'],['b','For each event column, M1, M2 and S1 success and failure are adjacent, yielding 24 heatmap-plus-mean-trace panels. All heatmaps share one z-score scale. Cue, reach and grasp include 54 successes and 23 failures; at-mouth includes the 49 successes and 14 failures with a recorded timestamp.'],['c','The first 50 archived trials reproduce the six-direction S-map coefficient heatmaps. The dashed line marks cue. Direction-wise robust color normalization improves visibility without changing any coefficient; the printed P2/median/P98 values give the absolute slope range. Coefficients remain predictive and non-causal.']]
      };
      if(id==='hierarchy')return {...common,
        title:'Cue-response motifs and descriptive similarity organization',
        sources:[['result','Figure 4a–d']]
      };
      return common;
    });
    figures.push({
      id:'forward_factor_reconstruction',number:6,chapter:5,
      title:'LDR encoding and held-out paw-trajectory decoding in M1, M2 and S1',
      question:'How much of independently retrained regional LFADS-factor trajectories can paw kinematics encode, and can neural loadings decode held-out paw movement?',
      features:'48 common successful trials · −0.2 to +2.5 s · independently retrained M1/M2/S1 LFADS seed 760 · held-out trial folds',
      status:'SABATINI–KAUFMAN LDR REPLICATION',
      claim:'Linear/nonlinear LDR encoding captures median held-out factor-trajectory variance of 0.896/0.896 in M1, 0.922/0.928 in M2 and 0.834/0.813 in S1. Linear LDR decodes held-out paw position with median variance explained of 0.810, 0.678 and 0.828; direct new-LFADS decoders are generally higher.',
      guardrail:'Panel 6b is a raw-spike PSTH analysis and is LFADS-independent. Panels 6c–f use factor trajectories from three independently retrained regional LFADS models, rather than the old archived regional coordinates. The source experiment had repeated reach conditions, whereas this recording contains variation around one stereotyped dexterous sequence; shared task timing can contribute. Offline trajectory decoding does not establish online decoding, causality, rotational-plane reorientation or changing synaptic weights. Velocity R² is 0.180/−0.099/0.232 in M1/M2/S1, so panel e remains a diagnostic rather than uniformly accurate velocity reconstruction.',
      references:[['Sabatini & Kaufman, Nature Communications 2024 · reach-dependent reorientation and LDR','https://www.nature.com/articles/s41467-024-51308-7'],['Official LDR-public analysis code','https://github.com/kaufmanlab/LDR-public'],['Pandarinath et al., Nature Methods 2018 · LFADS observation model','https://www.nature.com/articles/s41592-018-0109-9']],
      adaptation:'The source panel’s b–f grammar, temporal-SVD loading factorization, nonlinear kernel model and 100-ms conventional-decoder lead are retained. The earlier cue-aligned −0.2-to-2.5-s visual recipe is kept, but panels 6c–f are rebuilt from three independently retrained regional seed-760 LFADS models.',
      sources:[['result','Figure 6b–f']],
      panels:[
        ['b','This LFADS-independent panel shows one out-of-fold display-selected raw-spike unit per area in the source panel’s three-column grammar: true 37.5-ms-smoothed PSTH, nonlinear LDR encoding and linear multi-parameter standard encoding. The four trajectory quartiles are descriptive; population inference does not use the selected units.'],
        ['c','Across held-out folds, median linear/nonlinear LDR encoding variance is 0.896/0.896 in M1, 0.922/0.928 in M2 and 0.834/0.813 in S1. Targets are the 38-dimensional trajectories from the three newly retrained regional LFADS models.'],
        ['d','For each area, all 48 measured two-coordinate paw trajectories are shown next to linear LDR decoding and the 100-ms-lead smoothed-spike OU-kernel control. Identical colors identify the same held-out trials.'],
        ['e','Measured and decoded paw velocity traces use the same −0.2-to-2.5-s cue-aligned window and held-out trials as panel d. Velocity R² is 0.180/−0.099/0.232 in M1/M2/S1, so this is a transparent diagnostic rather than uniformly strong velocity decoding.'],
        ['f','Nine decoder families compare LDR, smoothed spikes and newly retrained regional LFADS trajectories. Linear LDR reaches median paw-position variance explained of 0.810/0.678/0.828; the strongest LFADS controls reach 0.878/0.805/0.903. Two-sided paired Wilcoxon tests are used for source-style method contrasts.']
      ]
    });
    figures.push({
      id:'static_factor_readout',number:7,chapter:6,
      title:'Native LFADS factors and static weights reconstruct every recorded neuron',
      question:'How do 38 native LFADS factors combine through static weights to reconstruct population-wide and single-neuron activity?',
      features:'1,346 neurons × 38 factors · 9 enlarged subfigures · held-out spike replication · top-K native recovery · frozen 48/16/16 trial split',
      status:'CLEAN-ROOM NATIVE LFADS READOUT AUDIT',
      claim:'The native seed-760 model uses broadly shared temporal factors, while static neuron-specific weights convert them into movement-stage-selective M1, M2 and S1 responses. Figures 7c–g freeze their factor and neuron arrangement on training trials and confirm the stage pattern in untouched test-trial spikes. Median test PSTH r is 0.659/0.529/0.617 in M1/M2/S1.',
      guardrail:'All neurons are observed by the LFADS encoder at inference, so this is held-out-trial denoising rather than hidden-neuron prediction. W and b are static model parameters—not synapses, anatomical connectivity, causal importance or evidence of event-specific weights. Results describe one mouse-day.',
      references:[['Pandarinath et al., Nature Methods 2018 · LFADS observation model','https://www.nature.com/articles/s41592-018-0109-9']],
      adaptation:'The model is retrained from raw 80-Hz spikes only, with no legacy LFADS factors, weights, behavior or event labels as inputs. Three seeds share the same 48-train/16-validation/16-test split; seed 760 is selected by validation BPS alone. The native equation λₙ(t)=exp[bₙ+ΣₖWₙₖfₖ(t)] is then audited directly, without fitting time-varying or event-specific W.',
      sources:[['result','Figure 7a–i']],
      panels:[
        ['a','The selected native checkpoint contains one static 1,346 × 38 weight matrix and one learned bias per neuron. Its Poisson mean is exp(Wf+b); no intercept, gain or output link is estimated after training.'],
        ['b','Observed and native-rate PSTHs for all 1,346 neurons are shown on the untouched 16-test-trial block. The common row order and z-score reference use training trials only; the former test-PSTH similarity stripe is omitted so the activity patterns can be compared directly.'],
        ['c','All 38 native factors are grouped by the cue, reach, grasp or at-mouth event that produces their largest absolute training response. Preferred-direction orientation is used only for display; train-to-test event-fingerprint correlation is 0.993.'],
        ['d','Each factor’s RMS readout weight is measured separately in M1, M2 and S1 and normalized across regions. Median normalized regional entropy is 1.000, showing that the native factors are broadly shared rather than confined to one region.'],
        ['e','The signed factor decomposition is shown for all 1,346 neurons. Rows are ordered by area, training-defined preferred stage, response sign and factor-mixture similarity; colors are L1-normalized within neuron and clipped only for display.'],
        ['f','Positive and suppressive preferred-stage populations are quantified separately in M1, M2 and S1. Directional replication is tested across 16 untouched test trials with one-sided Wilcoxon tests and Holm correction across 12 area × stage groups.'],
        ['g','The training-native stage-response matrix is compared directly with observed firing rates from untouched test trials using the identical frozen neuron order. Pooled train-native to test-spike correlation is 0.912.'],
        ['h','Effective factor number summarizes whether a neuron relies on one dominant factor or a distributed mixture. Regional medians are 7.8, 8.3 and 8.2 in M1, M2 and S1.'],
        ['i','Factors ranked by training contribution energy are cumulatively restored on the test block. Roughly 20 factors recover about 95% of the complete native LFADS PSTH in the regional median.']
      ]
    });
    figures.push({
      id:'wei_outcome_dynamics',number:8,chapter:7,
      title:'Grasp failures show altered turning geometry and lower-innovation dynamics',
      question:'Do held-out failure trials first depart from the success trajectory at grasp and then enter a lower-innovation neural state?',
      features:'75 strict-kinematic trials · 705 QC units · two-stage held-out failure signature · five chronological folds · 999 structured nulls',
      status:'WEI-INSPIRED HELD-OUT TRAJECTORY TEST',
      claim:'At the training-selected joint-population grasp turn, failures show larger turning-angle deviation (Δ=+0.954 training-success SD; cross-fitted AUROC=0.693; Student P=0.00152; block-structured P=0.006). At grasp +100 ms, failures have lower—not higher—success-model innovation (Δ=−0.845 SD; AUROC=0.763; Student P=0.000758; structured P=0.008; time × metric max-T P=0.035). Together these results support a temporally ordered turning-deviation followed by lower-innovation signature.',
      guardrail:'This is one mouse and one recording day, and the 100-ms neural-history result does not reproduce with 50- or 200-ms count windows. The findings are predictive within-session associations discovered during model adjudication; they do not establish that the altered turn causes failure, that failure is globally more erratic, or that the effect generalizes across animals.',
      references:[['Wei et al., Nature Communications 2019 · single-trial dynamics and error-trial generalization','https://www.nature.com/articles/s41467-018-08141-6']],
      adaptation:'Wei et al. fit a low-dimensional dynamical model to correct trials and asked whether it generalized to errors. Here the PCA coordinate system is first learned without outcome labels; success labels from each outer-training fold then define the reference trajectory, its turning point and an event-dependent forward dynamics model. Held-out trials never determine scaling, PCA, the success template, turning-point location or dynamics.',
      sources:[['result','Figure 8a']],
      panels:[
        ['a','The upper-left trace now shows success and failure angular deviation separately, using the former Figure 8b lower panel; failure trials deviate farther from the fold-owned success turn near grasp. The lower-left trace shows the subsequent lower success-model innovation at +100 ms, sign-reversed only so upward means a stronger failure-associated stereotypy signature.']
      ]
    });
    // Figures 6–8 are retained on disk for recovery but removed from the active Testing atlas.
    figures.splice(5);
    const selectedFigure=()=>figures.find(figure=>figure.id===state.testingFigure)||figures[0];
    const selectedChapter=figure=>storyChapters[figure.chapter??Math.max(0,Math.min(storyChapters.length-1,figure.number-1))];
    const cohort=scope=>scope==='All'?UNITS:UNITS.filter(unit=>unit.area===scope);
    const tag=(name,attrs)=>s(name,attrs);

    function storyStrip(figure){
      const active=selectedChapter(figure);
      return h('section',{class:'testing-story','aria-label':'Testing figure story'},...storyChapters.map(chapter=>h('div',{class:'testing-story-step'+(chapter===active?' on':'')},h('span',{},`Chapter ${chapter.id} · ${chapter.range}`),h('b',{},chapter.title),h('small',{},chapter.question))));
    }

    function setSelection(figureId,sourceId){
      const figure=figures.find(item=>item.id===figureId)||figures[0];
      state.testingFigure=figure.id;
      state.testingSource=figure.sources.some(source=>source[0]===sourceId)?sourceId:figure.sources[0][0];
      location.hash=`view=testing&tfigure=${state.testingFigure}&tsource=${state.testingSource}`;
    }

    function histogramSvg(scope){
      const list=cohort(scope),W=300,H=220,pad={l:48,r:12,t:17,b:42},bins=20,counts=Array(bins).fill(0);
      list.forEach(unit=>counts[Math.min(bins-1,Math.floor(unit.meanHz/50*bins))]++);
      const proportions=counts.map(count=>100*count/list.length),max=Math.max(...proportions)*1.12,svg=svgEl(W,H),graph=axes(svg,pad,W,H,[0,50],[0,max],{xt:[0,10,20,30,40,50],yt:[0,Math.ceil(max/2),Math.ceil(max)],xl:'recorded cue-window firing rate (Hz)',yl:'proportion of units (%)'}),width=(W-pad.l-pad.r)/bins;
      proportions.forEach((value,index)=>svg.append(tag('rect',{x:pad.l+index*width+.5,y:graph.sy(value),width:Math.max(1,width-1),height:graph.sy(0)-graph.sy(value),fill:scopeColor[scope],'fill-opacity':.86})));
      return svg;
    }

    function ratePanel(){
      return h('section',{class:'testing-paper-panel'},h('div',{class:'testing-panel-head'},h('h3',{},'a  Firing-rate distributions'),h('span',{},'Common 2.5-Hz bins · each panel integrates to 100%')),h('div',{class:'testing-four-grid'},...scopes.map(scope=>h('div',{class:'testing-scope-column',style:{'--scope-color':scopeColor[scope]}},h('h4',{},`${scope} · n=${cohort(scope).length}`),histogramSvg(scope)))),h('p',{class:'testing-caption'},'Mean firing rate in the recorded −1 to +5 s cue window is shown for all 1,346 supplied clusters and separately for S1, M1 and M2. A proportion axis permits shape comparison despite unequal regional sample sizes; exact n remains visible in every panel.'));
    }

    function pathFrom(values,times,sx,sy,stop){
      let path='';
      times.forEach((time,index)=>{if(time < -1 || time > stop)return;path+=(path?'L':'M')+sx(time).toFixed(2)+' '+sy(values[index]).toFixed(2)+' ';});
      return path;
    }

    function bandPath(mean,error,times,sx,sy,stop){
      const points=[];
      times.forEach((time,index)=>{if(time>=-1&&time<=stop)points.push([sx(time),sy(mean[index]+error[index]),sy(mean[index]-error[index])]);});
      return points.map((point,index)=>(index?'L':'M')+point[0].toFixed(2)+' '+point[1].toFixed(2)).join(' ')+' '+points.slice().reverse().map(point=>'L'+point[0].toFixed(2)+' '+point[2].toFixed(2)).join(' ')+' Z';
    }

    function heatmapSvg(scope){
      const info=THIRD_DRAFT.heatmaps[scope],W=300,H=225,pad={l:38,r:12,t:12,b:32},svg=svgEl(W,H),sx=time=>pad.l+(time+1)/3*(W-pad.l-pad.r);
      svg.append(tag('image',{x:pad.l,y:pad.t,width:W-pad.l-pad.r,height:H-pad.t-pad.b,href:info.src,preserveAspectRatio:'none'}),tag('rect',{x:pad.l,y:pad.t,width:W-pad.l-pad.r,height:H-pad.t-pad.b,fill:'none',stroke:'#aeb7c5'}),tag('line',{x1:sx(0),y1:pad.t,x2:sx(0),y2:H-pad.b,stroke:'#fff','stroke-width':1,'stroke-dasharray':'4 3'}));
      [-1,0,1,2].forEach(time=>svg.append(tag('line',{x1:sx(time),y1:H-pad.b,x2:sx(time),y2:H-pad.b+4,stroke:'#667386'}),stext(sx(time),H-pad.b+15,String(time),{'font-size':9,'text-anchor':'middle'})));
      svg.append(stext(W/2,H-3,'time from cue (s)',{'font-size':9,'text-anchor':'middle'}),stext(10,(pad.t+H-pad.b)/2,'split-half ordered clusters',{'font-size':8.5,'text-anchor':'middle',transform:`rotate(-90 10 ${(pad.t+H-pad.b)/2})`}));
      return svg;
    }

    function traceLimit(){
      let limit=.5;
      scopes.forEach(scope=>responseClasses.forEach(label=>{const trace=THIRD_DRAFT.responseTraces[scope][label];trace.mean.forEach((value,index)=>{const time=THIRD_DRAFT.tax[index];if(time>=-1&&time<=2)limit=Math.max(limit,Math.abs(value)+trace.sem[index]);});}));
      return Math.ceil(limit/2)*2;
    }

    function semTraceSvg(scope,limit){
      const W=300,H=205,pad={l:45,r:12,t:13,b:38},svg=svgEl(W,H),graph=axes(svg,pad,W,H,[-1,2],[-limit,limit],{xt:[-1,0,1,2],yt:[-limit,0,limit],xl:'time from cue (s)',yl:'baseline-centered rate (Hz)'});
      svg.append(tag('line',{x1:graph.sx(0),y1:pad.t,x2:graph.sx(0),y2:H-pad.b,stroke:'#6d7889','stroke-dasharray':'4 3'}),tag('line',{x1:pad.l,y1:graph.sy(0),x2:W-pad.r,y2:graph.sy(0),stroke:'#aeb6c2','stroke-dasharray':'3 3'}));
      responseClasses.forEach(label=>{const trace=THIRD_DRAFT.responseTraces[scope][label];svg.append(tag('path',{d:bandPath(trace.mean,trace.sem,THIRD_DRAFT.tax,graph.sx,graph.sy,2),fill:responseColor[label],'fill-opacity':.13}),tag('path',{d:pathFrom(trace.mean,THIRD_DRAFT.tax,graph.sx,graph.sy,2),fill:'none',stroke:responseColor[label],'stroke-width':1.7}));});
      return svg;
    }

    function modulationSvg(scope){
      const list=THIRD_DRAFT.metrics.filter(metric=>scope==='All'||metric.area===scope),W=300,H=205,pad={l:45,r:12,t:13,b:38},limit=Math.max(8,Math.ceil(Math.max(...list.map(metric=>Math.abs(metric.cueDelta)))/10)*10),svg=svgEl(W,H),graph=axes(svg,pad,W,H,[0,50],[-limit,limit],{xt:[0,10,20,30,40,50],yt:[-limit,0,limit],xl:'pre-cue baseline rate (Hz)',yl:'cue - baseline (Hz)'});
      svg.append(tag('line',{x1:pad.l,y1:graph.sy(0),x2:W-pad.r,y2:graph.sy(0),stroke:'#8f99a8','stroke-dasharray':'4 3'}));
      list.forEach(metric=>{if(metric.baselineHz>50||Math.abs(metric.cueDelta)>limit)return;svg.append(tag('circle',{cx:graph.sx(metric.baselineHz),cy:graph.sy(metric.cueDelta),r:1.45,fill:responseColor[metric.responseClass],'fill-opacity':.44}));});
      return svg;
    }

    function responseLegend(){
      return h('div',{class:'testing-legend'},...responseClasses.map(label=>h('span',{},h('i',{style:{'--legend-color':responseColor[label]}}),label.replace('Cue-','Cue '))));
    }

    function cuePanel(){
      const limit=traceLimit();
      return h('section',{class:'testing-paper-panel'},h('div',{class:'testing-panel-head'},h('h3',{},'a-c  Split-half response maps, response-class dynamics and single-cluster modulation'),h('span',{},'Ordering: odd trials · display: even trials · ribbons: mean ± SEM across recorded clusters')),responseLegend(),h('div',{class:'testing-four-grid'},...scopes.map(scope=>h('div',{class:'testing-scope-column',style:{'--scope-color':scopeColor[scope]}},h('h4',{},`${scope} · n=${cohort(scope).length}`),heatmapSvg(scope),semTraceSvg(scope,limit),modulationSvg(scope)))),h('p',{class:'testing-caption'},'The same four-column grammar links population timing to unit-level effect magnitude. Heatmap order is learned from odd trials and displayed on even trials. SEM replaces the previous ±1 SD ribbon as requested, but remains a descriptive cluster-level summary from one recording. The scatter uses pre-cue baseline on x, avoiding the original algebraic coupling between post-cue rate and post-cue-minus-baseline response. Functional classes use paired 80-trial tests with BH-FDR correction.'));
    }

    function diverging(value,limit){
      const t=Math.max(-1,Math.min(1,value/limit)),a=t<0?[45,104,170]:[246,247,249],b=t<0?[246,247,249]:[196,64,75],f=t<0?t+1:t;
      return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
    }

    function outsideRate(unit,phase){
      let spikes=0,seconds=0;
      unit.phaseRate.forEach((rate,index)=>{if(index!==phase){spikes+=rate*CASTLE.phaseSeconds[index];seconds+=CASTLE.phaseSeconds[index];}});
      return spikes/Math.max(seconds,1e-9);
    }

    function exampleUnits(){
      return CASTLE.phases.map((_,phase)=>CASTLE.units.filter(unit=>unit.preferred===phase&&unit.phaseConsistency>=.75&&unit.splitReliability>=.3).sort((a,b)=>((b.phaseRate[phase]-outsideRate(b,phase))*b.phaseConsistency)-((a.phaseRate[phase]-outsideRate(a,phase))*a.phaseConsistency))[0]).filter(Boolean);
    }

    function castleMatrixSvg(){
      const areaOrder={M2:0,M1:1,S1:2},ordered=CASTLE.units.slice().sort((a,b)=>a.preferred-b.preferred||areaOrder[a.area]-areaOrder[b.area]||b.phaseConsistency-a.phaseConsistency||a.id-b.id),W=1120,H=520,pad={l:94,r:30,t:55,b:58},matrixW=500,rowH=(H-pad.t-pad.b)/ordered.length,cellW=matrixW/CASTLE.phases.length,svg=svgEl(W,H),limit=2.5;
      let start=0;
      CASTLE.phases.forEach((phase,phaseIndex)=>{const count=ordered.filter(unit=>unit.preferred===phaseIndex).length,y=pad.t+start*rowH;svg.append(tag('rect',{x:pad.l-12,y,width:8,height:Math.max(1,count*rowH),fill:phase.color}),stext(pad.l+phaseIndex*cellW+cellW/2,pad.t-17,phase.name.replace('Touch ',''),{'font-size':10,'font-weight':700,'text-anchor':'middle',fill:phase.color}));start+=count;});
      ordered.forEach((unit,row)=>{svg.append(tag('rect',{x:pad.l-22,y:pad.t+row*rowH,width:7,height:Math.max(.35,rowH+.1),fill:AC[unit.area]}));unit.phaseZ.forEach((value,column)=>svg.append(tag('rect',{x:pad.l+column*cellW,y:pad.t+row*rowH,width:cellW+.15,height:Math.max(.35,rowH+.1),fill:diverging(value,limit)})));});
      svg.append(tag('rect',{x:pad.l,y:pad.t,width:matrixW,height:H-pad.t-pad.b,fill:'none',stroke:'#7d8899'}),stext(18,(pad.t+H-pad.b)/2,'clusters sorted by preferred phase, area and stability',{'font-size':10,'text-anchor':'middle',transform:`rotate(-90 18 ${(pad.t+H-pad.b)/2})`}),stext(pad.l,pad.t-35,'A',{'font-size':16,'font-weight':800,fill:'#17202b'}),stext(pad.l+25,pad.t-35,'region strip: ',{'font-size':8.5,fill:'#667386'}),stext(pad.l+83,pad.t-35,'M2',{'font-size':8.5,'font-weight':700,fill:AC.M2}),stext(pad.l+101,pad.t-35,'M1',{'font-size':8.5,'font-weight':700,fill:AC.M1}),stext(pad.l+119,pad.t-35,'S1',{'font-size':8.5,'font-weight':700,fill:AC.S1}));
      const examples=exampleUnits(),plotX=675,plotW=400,lane=plotW/CASTLE.phases.length,max=Math.max(...examples.flatMap(unit=>unit.phaseRate),1)*1.05,sy=value=>H-pad.b-value/max*(H-pad.t-pad.b);
      [0,max/2,max].forEach(value=>{const y=sy(value);svg.append(tag('line',{x1:plotX,y1:y,x2:plotX+plotW,y2:y,stroke:'#e0e5ec'}),stext(plotX-8,y+3,value.toFixed(value<10?1:0),{'font-size':9,'text-anchor':'end'}));});
      CASTLE.phases.forEach((phase,index)=>svg.append(stext(plotX+(index+.5)*lane,H-pad.b+18,phase.name.replace('Touch ',''),{'font-size':9,'font-weight':700,'text-anchor':'middle',fill:phase.color})));
      examples.forEach((unit,row)=>{const color=AC[unit.area],offset=(row-examples.length/2+.5)*3,path=unit.phaseRate.map((value,index)=>(index?'L':'M')+(plotX+(index+.5)*lane).toFixed(1)+' '+(sy(value)+offset).toFixed(1)).join(' ');svg.append(tag('path',{d:path,fill:'none',stroke:color,'stroke-width':2,'stroke-opacity':.8}));unit.phaseRate.forEach((value,index)=>svg.append(tag('circle',{cx:plotX+(index+.5)*lane,cy:sy(value)+offset,r:3,fill:CASTLE.phases[index].color,stroke:color,'stroke-width':1})));svg.append(stext(plotX+plotW-2,sy(unit.phaseRate[unit.preferred])+offset-6,`u${unit.id} ${unit.area}`,{'font-size':8.5,'text-anchor':'end',fill:color}));});
      svg.append(stext(plotX-32,pad.t-35,'B',{'font-size':16,'font-weight':800,fill:'#17202b'}),stext(plotX,pad.t-17,'One prespecified high-reliability example per preferred phase',{'font-size':10,'font-weight':700,fill:'#39475b'}),stext(plotX-42,(pad.t+H-pad.b)/2,'phase firing rate (Hz)',{'font-size':10,'text-anchor':'middle',transform:`rotate(-90 ${plotX-42} ${(pad.t+H-pad.b)/2})`}));
      return svg;
    }

    function castlePanel(){
      return h('section',{class:'testing-paper-panel'},h('div',{class:'testing-panel-head'},h('h3',{},'a-b  Population phase fingerprints and example clusters'),h('span',{},`${CASTLE.units.length} clusters · ${CASTLE.meta.castleTrials} mapped trials · five CASTLE phases`)),castleMatrixSvg(),h('p',{class:'testing-caption'},'A, Every supplied cluster is shown across the five CASTLE phases after within-cluster phase standardization, ordered by preferred phase, recording area and leave-one-trial-out stability; the adjacent strip identifies M2, M1 and S1. B, One example per preferred phase is selected by the same fixed rule: phase elevation × stability among clusters passing prespecified split-reliability thresholds. The panel visualizes multiphasic structure but does not imply that cortical firing licenses or suppresses movement.'));
    }

    function movementPanel(){
      return h('section',{class:'testing-paper-panel'},h('div',{class:'testing-panel-head'},h('h3',{},'a-g  Held-out movement encoding checkpoint'),h('span',{},'705 app-QC clusters · 68 eligible trials · five sequential-block folds')),h('img',{src:'paper_analysis/figures/figure_02_paper_visualization/figure_02_movement_encoding_paper_visualization.svg',alt:'Paper figure showing the frozen movement-encoding checkpoint',style:{display:'block',width:'100%',height:'auto'}}),h('p',{class:'testing-caption'},'This is the strongest existing real-data result in the project: a frozen checkpoint of nested task-only versus task-plus-movement Poisson prediction. It remains labelled checkpoint-not-final-release until all prespecified robustness gates and the release audit are complete.'));
    }

    function median(values){
      const finite=values.filter(Number.isFinite).sort((a,b)=>a-b),middle=Math.floor(finite.length/2);
      return finite.length?(finite.length%2?finite[middle]:(finite[middle-1]+finite[middle])/2):NaN;
    }

    function quantile(values,q){
      const finite=values.filter(Number.isFinite).sort((a,b)=>a-b);
      if(!finite.length)return NaN;
      const index=(finite.length-1)*q,lo=Math.floor(index),hi=Math.ceil(index),fraction=index-lo;
      return finite[lo]*(1-fraction)+finite[hi]*fraction;
    }

    function timeColor(t){
      const colors=[[45,74,220],[0,166,220],[0,190,140],[231,190,32]],x=Math.max(0,Math.min(1,t))*(colors.length-1),index=Math.floor(x),fraction=x-index,a=colors[index],b=colors[Math.min(colors.length-1,index+1)];
      return `rgb(${Math.round(a[0]+(b[0]-a[0])*fraction)},${Math.round(a[1]+(b[1]-a[1])*fraction)},${Math.round(a[2]+(b[2]-a[2])*fraction)})`;
    }

    function eventSummary(){
      const colors={cue:'#315fbe',reach:'#df9b2a',grasp:'#b84e55',atMouth:'#3d9b8a'};
      return ['cue','reach','grasp','atMouth'].map(key=>({key,label:key==='atMouth'?'At mouth':key[0].toUpperCase()+key.slice(1),time:median(REFPOP.events[key]),color:colors[key]}));
    }

    function nearestIndex(tax,value){
      let best=0,distance=Infinity;
      tax.forEach((time,index)=>{const next=Math.abs(time-value);if(next<distance){distance=next;best=index;}});
      return best;
    }

    function trajectorySvg(view){
      const tax=TESTING_BEHAVIOR.tax,rows=TESTING_BEHAVIOR.trajectories.map(row=>row[view].map(point=>[point[0],-point[1]])),all=rows.flat(),xs=all.map(point=>point[0]),ys=all.map(point=>point[1]),xlo=quantile(xs,.01),xhi=quantile(xs,.99),ylo=quantile(ys,.01),yhi=quantile(ys,.99),W=360,H=315,pad={l:48,r:16,t:18,b:43},svg=svgEl(W,H),graph=axes(svg,pad,W,H,[xlo,xhi],[ylo,yhi],{xt:[xlo,0,xhi],yt:[ylo,0,yhi],xl:'cue-centered camera x (px)',yl:'inverted camera y (px)'}),center=tax.map((_,time)=>[median(rows.map(row=>row[time][0])),median(rows.map(row=>row[time][1]))]);
      rows.forEach(row=>svg.append(tag('path',{d:row.map((point,index)=>(index?'L':'M')+graph.sx(point[0]).toFixed(2)+' '+graph.sy(point[1]).toFixed(2)).join(' '),fill:'none',stroke:'#667386','stroke-width':.55,'stroke-opacity':.16})));
      for(let index=1;index<center.length;index++)svg.append(tag('line',{x1:graph.sx(center[index-1][0]),y1:graph.sy(center[index-1][1]),x2:graph.sx(center[index][0]),y2:graph.sy(center[index][1]),stroke:timeColor(index/(center.length-1)),'stroke-width':2.5,'stroke-linecap':'round'}));
      eventSummary().forEach(event=>{const index=nearestIndex(tax,event.time),point=center[index];svg.append(tag('circle',{cx:graph.sx(point[0]),cy:graph.sy(point[1]),r:4.2,fill:event.color,stroke:'#fff','stroke-width':1.2}));});
      return svg;
    }

    function manifoldSvg(){
      const tax=REFPOP.tax,rows=REFPOP.factors.map(trial=>trial.map(point=>[point[0],point[1]])),all=rows.flat(),xs=all.map(point=>point[0]),ys=all.map(point=>point[1]),xlo=quantile(xs,.01),xhi=quantile(xs,.99),ylo=quantile(ys,.01),yhi=quantile(ys,.99),W=360,H=315,pad={l:48,r:16,t:18,b:43},svg=svgEl(W,H),graph=axes(svg,pad,W,H,[xlo,xhi],[ylo,yhi],{xt:[xlo,0,xhi],yt:[ylo,0,yhi],xl:'supplied component 1',yl:'supplied component 2'}),center=tax.map((_,time)=>[median(rows.map(row=>row[time][0])),median(rows.map(row=>row[time][1]))]);
      rows.forEach(row=>svg.append(tag('path',{d:row.map((point,index)=>(index?'L':'M')+graph.sx(point[0]).toFixed(2)+' '+graph.sy(point[1]).toFixed(2)).join(' '),fill:'none',stroke:'#667386','stroke-width':.55,'stroke-opacity':.14})));
      for(let index=1;index<center.length;index++)svg.append(tag('line',{x1:graph.sx(center[index-1][0]),y1:graph.sy(center[index-1][1]),x2:graph.sx(center[index][0]),y2:graph.sy(center[index][1]),stroke:timeColor(index/(center.length-1)),'stroke-width':2.5,'stroke-linecap':'round'}));
      eventSummary().forEach(event=>{const index=nearestIndex(tax,event.time),point=center[index];svg.append(tag('circle',{cx:graph.sx(point[0]),cy:graph.sy(point[1]),r:4.2,fill:event.color,stroke:'#fff','stroke-width':1.2}));});
      return svg;
    }

    function neuralSpeedSummary(){
      const tax=REFPOP.tax,dt=tax[1]-tax[0],rows=REFPOP.factors.map(trial=>trial.map((point,time)=>time?Math.sqrt(point.reduce((sum,value,dimension)=>sum+(value-trial[time-1][dimension])**2,0))/dt:0));
      return {median:tax.map((_,time)=>median(rows.map(row=>row[time]))),q25:tax.map((_,time)=>quantile(rows.map(row=>row[time]),.25)),q75:tax.map((_,time)=>quantile(rows.map(row=>row[time]),.75))};
    }

    function speedSvg(){
      const tax=TESTING_BEHAVIOR.tax,W=1120,H=315,pad={l:58,r:18,t:27,b:43},svg=svgEl(W,H),graph=axes(svg,pad,W,H,[tax[0],tax[tax.length-1]],[0,1.15],{xt:[-.2,0,.5,1,1.5,2,2.5],yt:[0,.5,1],xl:'time from cue (s)',yl:'separately normalized speed'}),neural=neuralSpeedSummary(),series=[
        {label:'front paw',color:'#d46b2f',data:TESTING_BEHAVIOR.speed.frontPaw},
        {label:'side paw',color:'#ac4f7c',data:TESTING_BEHAVIOR.speed.sidePaw},
        {label:'front face-centroid proxy',color:'#4c9a62',data:TESTING_BEHAVIOR.speed.frontFaceCentroid},
        {label:'neural state',color:'#315fbe',data:neural}
      ];
      eventSummary().forEach(event=>{svg.append(tag('line',{x1:graph.sx(event.time),y1:pad.t,x2:graph.sx(event.time),y2:H-pad.b,stroke:event.color,'stroke-width':1,'stroke-dasharray':'4 3'}),stext(graph.sx(event.time),pad.t-8,event.label,{'font-size':8.5,'text-anchor':'middle',fill:event.color}));});
      series.forEach(item=>{const scale=Math.max(1e-9,quantile(item.data.median,.95)),mean=item.data.median.map(value=>value/scale),lower=item.data.q25.map(value=>value/scale),upper=item.data.q75.map(value=>value/scale),points=tax.map((time,index)=>[graph.sx(time),graph.sy(Math.min(1.15,upper[index])),graph.sy(Math.min(1.15,lower[index]))]);svg.append(tag('path',{d:points.map((point,index)=>(index?'L':'M')+point[0].toFixed(2)+' '+point[1].toFixed(2)).join(' ')+' '+points.slice().reverse().map(point=>'L'+point[0].toFixed(2)+' '+point[2].toFixed(2)).join(' ')+' Z',fill:item.color,'fill-opacity':.09}),tag('path',{d:tax.map((time,index)=>(index?'L':'M')+graph.sx(time).toFixed(2)+' '+graph.sy(Math.min(1.15,mean[index])).toFixed(2)).join(' '),fill:'none',stroke:item.color,'stroke-width':1.9}));});
      return h('div',{},h('div',{class:'testing-legend'},...series.map(item=>h('span',{},h('i',{class:'line',style:{'--legend-color':item.color}}),item.label))),svg);
    }

    function behaviorManifoldPanel(){
      if(!TESTING_BEHAVIOR||!REFPOP||!PROF)return h('div',{class:'empty-state'},'Aligned behavior payload is unavailable.');
      return h('section',{class:'testing-paper-panel'},h('div',{class:'testing-panel-head'},h('h3',{},'a-d  Trial-matched paw geometry, movement proxy and neural manifold'),h('span',{},'Identical time colors and median cue/reach/grasp/at-mouth anchors')),h('div',{class:'testing-three-grid'},h('div',{},h('h4',{style:{textAlign:'center',margin:'0 0 4px'}},`A  Front paw · n=${TESTING_BEHAVIOR.meta.strictCommonLeftPawTrials}`),trajectorySvg('front')),h('div',{},h('h4',{style:{textAlign:'center',margin:'0 0 4px'}},`B  Side paw · n=${TESTING_BEHAVIOR.meta.strictCommonLeftPawTrials}`),trajectorySvg('side')),h('div',{},h('h4',{style:{textAlign:'center',margin:'0 0 4px'}},`C  Neural manifold · n=${TESTING_BEHAVIOR.meta.commonSuccessTrials}`),manifoldSvg())),h('div',{class:'testing-panel-head',style:{marginTop:'15px'}},h('h3',{},'d  Aligned speed profiles'),h('span',{},`face-centroid proxy n=${TESTING_BEHAVIOR.meta.strictCommonFrontFaceTrials} · paw n=${TESTING_BEHAVIOR.meta.strictCommonLeftPawTrials} · neural n=${TESTING_BEHAVIOR.meta.commonSuccessTrials}`)),speedSvg(),h('p',{class:'testing-caption'},'Thin paths are individual trials and the thick time-colored paths are pointwise medians. Front and side paw coordinates are independently cue-centered camera pixels; they are not combined into pseudo-3D. The face-centroid line is computed from the front-view centroid of the two eyes and nose and is reported as a movement proxy rather than calibrated locomotor speed. Speed curves are separately normalized by their own 95th percentile and therefore show timing, not magnitude or correlation. Neural trajectories use the supplied 48-success full-data latent representation and remain descriptive.'));
    }

    const resultAssets={
      rates:'paper_analysis/testing_new/figure_01_firing_rate_landscape',
      cue:'paper_analysis/testing_new/testing_figures_02_03_20260828/figure_02a_cue_population_and_updated_classes',
      overview_rates:'paper_analysis/testing_new/figure_01_firing_rate_landscape',
      overview_cue:'paper_analysis/testing_new/figure_02_cue_response_sequences',
      ed02a:'paper_analysis/testing_new/literature_rebuild_20260821/extended_figure_02a_baseline_modulation',
      ed02b:'paper_analysis/testing_new/literature_rebuild_20260821/extended_figure_02b_waveform_anatomy',
      ed02c:'paper_analysis/testing_new/literature_rebuild_20260821/extended_figure_02c_waveform_functional_association',
      castle_states:'paper_analysis/testing_new/testing_figures_02_03_20260828/figure_03a_event_aligned_regional_heatmaps',
      state_space:'paper_analysis/testing_new/cross_cortical_discovery_20260821/figures/figure_04_phase_specific_transfer',
      ccs:'paper_analysis/testing_new/cross_cortical_discovery_20260821/figures/figure_05_relative_handoff',
      comm_context:'paper_analysis/testing_new/revision_phase_geometry_agent/figures/phase_gated_communication_geometry_250ms',
      ed05window:'paper_analysis/testing_new/revision_phase_geometry_agent/figures/phase_gated_communication_geometry_125ms',
      ed05controls:'paper_analysis/testing_new/cross_cortical_discovery_20260821/figures/figure_06_reconfiguration_controls',
      ed05behavior:'paper_analysis/testing_new/phase_gated_geometry_20260825/behavior_sensitivity/figures/extended_data_behavior_specification_sensitivity',
      comm_activity:'paper_analysis/testing_new/cross_cortical_discovery_20260821/figures/figure_07_direction_behavior_limits',
      comm_subspace:'paper_analysis/testing_new/literature_rebuild_20260821/figure_06_lfads_communication_subspace',
      hierarchy:'paper_analysis/testing_new/literature_rebuild_20260821/figure_10_complete_functional_hierarchy',
      representation_manifolds:'paper_analysis/testing_new/figure05_restored_20260903/figure_05a',
      forward_factor_reconstruction:'paper_analysis/testing_new/figure06_ldr_kinematics_rebuild_20260830/figures_newregional_seed760_paperstyle/figure_06b_heldout_psth_encoding_rebuilt',
      static_factor_readout:'paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07a_all1346_static_contract',
      wei_outcome_dynamics:'paper_analysis/testing_new/figure08_wei_outcome_dynamics_20260903/figures/figure_08_failure_dynamics_main',
      reconstruction_fidelity:'paper_analysis/testing_new/literature_rebuild_20260821/figure_08_lfads_population_reconstruction',
      neural_decoding:'paper_analysis/testing_new/neural_decoding_upgrade_20260822/figures/figure_09_neural_decoding_upgrade',
      factor_encoder_attribution:'paper_analysis/testing_new/factor_encoder_attribution_20260823/figure_10_factor_encoder_attribution',
      mapping_controls:'paper_analysis/testing_new/gap_closure_20260826/controls/figures/figure_mapping_evidence_boundary',
      model_adjudication:'paper_analysis/testing_new/gap_closure_20260826/model_inference/figures/evidence_boundary',
      frozen_axis:'paper_analysis/testing_new/gap_closure_20260826/model_inference/figures/frozen_axis_reweighting_125ms',
      recurrent_model:'paper_analysis/testing_new/gap_closure_20260826/model_inference/figures/recurrent_architecture_comparison_50ms',
      prospective_event:'paper_analysis/testing_new/gap_closure_20260826/event_prospective/figures/event_stratified_prospective_paw',
      sliding_switch:'paper_analysis/testing_new/gap_closure_20260826/sliding_switch/figures/figure_within_sequence_temporal_generalization',
      residual_coordination:'paper_analysis/testing_new/gap_closure_20260826/residual_coordination/figures/figure_single_trial_residual_coordination',
      reach_grasp_cross_history:'paper_analysis/testing_new/reach_grasp_cross_history_20260827/figures/figure_11_reach_grasp_cross_history_primary',
      ed10factors:'paper_analysis/testing_new/factor_encoder_attribution_20260823/extended_data_10a_all_38_factor_trajectories',
      ed10top:'paper_analysis/testing_new/factor_encoder_attribution_20260823/extended_data_10b_phase_top15_overlap',
      ed11a:'paper_analysis/testing_new/literature_rebuild_20260821/extended_data_figure_11_gpfa_hidden_neuron',
      ed10a:'paper_analysis/testing_new/literature_rebuild_20260821/extended_figure_10a_full_trial_hierarchies',
      ed10b:'paper_analysis/testing_new/literature_rebuild_20260821/extended_figure_10b_functional_similarity_network'
    };

    const resultSubfigureAssets={
      cue:[
        ['a','Cue-aligned population timing and updated response classes','paper_analysis/testing_new/testing_figures_02_03_20260828/figure_02a_cue_population_and_updated_classes'],
        ['b','Updated cue-response composition by waveform class','paper_analysis/testing_new/testing_figures_02_03_20260828/figure_02b_waveform_response_composition']
      ],
      castle_states:[
        ['a','M1, M2 and S1 activity aligned to four movement events','paper_analysis/testing_new/testing_figures_02_03_20260828/figure_03a_event_aligned_regional_heatmaps'],
        ['b','Success/failure regional population activation across four events','paper_analysis/testing_new/testing_figures_02_03_20260828/figure_03b_regional_population_activation_success_failure'],
        ['c','Archived multivariate S-map across 50 common-event trials','paper_analysis/testing_new/testing_figures_02_03_20260828/figure_03c_multivariate_smap_50_trials']
      ],
      comm_subspace:[
        ['a','Compact training-selected LFADS ranks','paper_analysis/testing_new/literature_rebuild_20260821/figure_06a_selected_communication_ranks'],
        ['b','Source-specific rank–performance curves','paper_analysis/testing_new/literature_rebuild_20260821/figure_06b_rank_performance_curves']
      ],
      hierarchy:[
        ['a','Major cue-response hierarchy and regional composition','paper_analysis/testing_new/figure_04a_cue_class_hierarchy'],
        ['b','Sixteen descriptive cue-response subtypes','paper_analysis/testing_new/figure_04b_cue_subtype_hierarchy'],
        ['c','Regional cue-response heatmaps','paper_analysis/testing_new/figure_04c_regional_cue_heatmaps'],
        ['d','Cue-aligned subtype firing-rate prototypes','paper_analysis/testing_new/figure_04d_subtype_prototypes']
      ],
      representation_manifolds:[
        ['a','Behavioral content of MARBLE, CEBRA-behavior and LFADS representations','paper_analysis/testing_new/figure05_restored_20260903/figure_05a'],
        ['b','Regional success/failure manifolds and Student-tested reciprocal-5NN profiles','paper_analysis/testing_new/figure05_restored_20260903/figure_05b']
      ],
      forward_factor_reconstruction:[
        ['b','True PSTH, nonlinear LDR and linear multi-parameter encoding','paper_analysis/testing_new/figure06_ldr_kinematics_rebuild_20260830/figures_newregional_seed760_paperstyle/figure_06b_heldout_psth_encoding_rebuilt'],
        ['c','Held-out retrained-LFADS regional trajectory variance explained','paper_analysis/testing_new/figure06_ldr_kinematics_rebuild_20260830/figures_newregional_seed760_paperstyle/figure_06c_encoding_variance_rebuilt'],
        ['d','Measured and decoded single-trial paw trajectories','paper_analysis/testing_new/figure06_ldr_kinematics_rebuild_20260830/figures_newregional_seed760_paperstyle/figure_06d_paw_trajectory_decoding_rebuilt'],
        ['e','Measured and decoded paw velocity','paper_analysis/testing_new/figure06_ldr_kinematics_rebuild_20260830/figures_newregional_seed760_paperstyle/figure_06e_paw_velocity_decoding_rebuilt'],
        ['f','LDR, smoothed-spike and retrained-LFADS decoding benchmark','paper_analysis/testing_new/figure06_ldr_kinematics_rebuild_20260830/figures_newregional_seed760_paperstyle/figure_06f_decoding_benchmark_rebuilt']
      ],
      static_factor_readout:[
        ['a','All-neuron static-readout contract','paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07a_all1346_static_contract'],
        ['b','All-neuron observed and native-LFADS reconstruction atlas','paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07b_all1346_rate_similarity_atlas'],
        ['c','Native factor programs across four movement stages','paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07c_factor_stage_programs'],
        ['d','Regional sharing of native factor readouts','paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07d_factor_region_sharing'],
        ['e','All-neuron stage-arranged factor atlas','paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07e_all_neuron_factor_atlas'],
        ['f','Regional preferred-stage and response-direction composition','paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07f_region_stage_composition'],
        ['g','Held-out replication of stage-organized neural responses','paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07g_heldout_stage_replication'],
        ['h','Effective factor number per neuron','paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07h_effective_factor_number'],
        ['i','Top-K recovery of complete native LFADS output','paper_analysis/testing_new/figure07_all1346_static_readout_20260901/figures/figure_07i_topk_native_recovery']
      ],
      wei_outcome_dynamics:[
        ['a','Two-stage failure signature: altered turn followed by lower innovation','paper_analysis/testing_new/figure08_wei_outcome_dynamics_20260903/figures/figure_08_failure_dynamics_main']
      ],
      reconstruction_fidelity:[
        ['a','Observed and reconstructed population activity','paper_analysis/testing_new/literature_rebuild_20260821/figure_08a_population_reconstruction_heatmaps'],
        ['b','Population-wide reconstruction fidelity','paper_analysis/testing_new/literature_rebuild_20260821/figure_08b_population_reconstruction_fidelity'],
        ['c','CASTLE phase decoding','paper_analysis/testing_new/literature_rebuild_20260821/figure_08c_castle_phase_decoding'],
        ['d','Neuron-retention curves','paper_analysis/testing_new/literature_rebuild_20260821/figure_08d_neuron_retention_curves']
      ]
    };

    const resultCaptions={
      rates:'Recorded-window firing rates were recomputed from the archived 1,346 × 80 × 120 cue-window tensor. Its 120 time bins are 50-ms aggregates of the native 80-Hz (12.5-ms) samples; equal-width rate bins show within-group proportions and the final ≥50-Hz bin retains the high-rate tail. Figures 1–2 preserve the legacy regional palette.',
      cue:'Figure 2a moves the third-draft cue-aligned population panel into Testing and extends every display to −1 to +5 s without a significance annotation. Response classes are recomputed from 80 paired trial differences (0–3 s minus −5–0 s) with BH-FDR across all 1,346 neurons: 823 cue-excited, 251 cue-suppressed and 272 unmodulated. Figure 2b alone tests whether cue-excited membership is enriched in fast/narrow versus broad neurons. The one-sided Fisher tests are Holm-corrected across All/S1/M1/M2: All, S1 and M1 are significant; M2 is not.',
      overview_rates:'The supplied recording contains 1,346 clusters; the main conditional mapping cohort uses 705 project-QC units (M1 249, M2 267, S1 189). Rate distributions are descriptive within this recording.',
      overview_cue:'Odd trials determine cue-response ordering and held-out even trials display the frozen order. This confirms repeatable event-related population structure but does not test cross-area event specificity.',
      ed02a:'Baseline and cue modulation are estimated from non-overlapping trial halves. Sign-constrained robust curves are anchored at zero, stay on their assigned side and are evaluated by five-fold RMSE.',
      ed02b:'Trough-to-peak duration is plotted directly against post-peak/|trough| ratio. Per-template peak timing is consistent with the apparent pooled double bump arising from mixed early and late latencies; it does not by itself prove a discrete dual-peak class.',
      ed02c:'The contingency association is statistically detectable but weak and area-dependent. Five-fold multinomial deviance R² tests categorical prediction within All/M1/M2/S1; the current 250-permutation regional screen is exploratory, coarse and not multiplicity-corrected.',
      castle_states:'Figure 3a uses the original regional common-success mPC component-1 data: 48 matched trials, native 80-Hz samples, cue index 80, the supplied trial order, −1 to +2.5-s alignment and a fixed −3 to +3 scale. Figure 3b adds 24 regional population-activation panels from the stored POP.sig signals: four event columns, adjacent success/failure rows for M1, M2 and S1, and one shared global z-score scale. Cue, reach and grasp use 54 successes and 23 failures; at-mouth uses only trials with a valid timestamp (49 successes and 14 failures). Figure 3c reproduces the exact archived six-direction S-map coefficient cube for trials 0–49. Only the display is changed: within each direction, P2, median and P98 map to a higher-contrast color scale while the absolute slope range is printed. Thus colors cannot compare coefficient magnitude across directions, and the historical S-map remains predictive rather than causal.',
      state_space:'The 705-unit supplied project-QC cohort is evaluated on the same 63 common-event trials in one shared metric. The block-equal same-minus-cross advantage is 0.0352 R²₀, is positive in all five held-out temporal segments, and exceeds 1,000 coherent within-block whole-source-trial surrogates (P=0.0010).',
      ccs:'The post hoc M2-versus-S1 source-by-event contrast is negative in the 705-unit primary cohort (1/5 positive segments; coherent-surrogate P=0.732) and changes sign across controls. The proposed cortical hand-off is unsupported.',
      comm_context:'Corrected target-subspace geometry uses one training-derived target-PC metric per ordered edge and fold. Equal-half cross-phase angles exceed same-phase split-half angles by 9.38° for ±250-ms windows; the gap is positive in 5/5 fold summaries, the complete-trial phase-label refit null gives P=0.001 (999 permutations), and held-out same-minus-cross prediction is ΔR²=0.0312. Pair-specific reliability correction followed by a max-T phase-label null shows positive omnibus gaps for all six event pairs (all 5/5 folds; corrected P=0.001), largest for cue–grasp (12.23°) and reach–mouth (11.89°). Paw kinematics, elapsed task time and the third area are adjusted rather than exactly matched.',
      ed05window:'The less-overlapping ±125-ms sensitivity is concordant: noise-corrected angle gap 7.39°, held-out same-minus-cross ΔR²=0.0341, 5/5 positive fold summaries and phase-label refit P=0.001. Sample-normalized gaps remain positive, but full covariance-spectrum matching is not yet implemented.',
      ed05controls:'The transfer result is additionally audited against common scaling, absolute held-out R²₀, rank/penalty changes, strict paw trials, matched regional unit counts, narrower windows and coherent max-T surrogates.',
      ed05behavior:'A post hoc reach-latency association is shown only with its specification audit. It is positive for ±250-ms models but weakens to r=0.163, P=0.0962 at ±125 ms and to r=0.198, P=0.0903 after omitting both M1↔M2 mappings. It is therefore hypothesis-generating within this mouse-day, not evidence of behavioral benefit, flow or causality.',
      comm_activity:'The displayed fixed smoothed models provide no corrected evidence of improved future-target or 100-ms future-paw prediction. They constrain the current claim but cannot establish absence of directional or behavioral information.',
      comm_subspace:'Figure 6 is rendered as two independent full-width panels. Training-selected ranks are kept on their informative scale and rank 38 is shown only as a separate descriptive ceiling; the enlarged source-specific curves preserve every model and fold summary. The archive predates these folds, so this remains a supporting downstream readout analysis.',
      hierarchy:'Cue-response clustering, 16 descriptive subtypes, regional heatmaps and every subtype prototype are retained as reordered Figure 4a–d. Figure 4c uses the same linear parula −2 to +4 z-score color scale as Figure 2a; none of the motifs is interpreted as a validated cell type or biological hierarchy.',
      representation_manifolds:'Restored Figure 5. Panel a compares how time from cue, front-view paw position and two-view paw speed are arranged in the MARBLE, CEBRA-behavior and LFADS manifolds. Panel b shows the 18 regional manifolds formed by three representations × M1/M2/S1 × success/failure, followed by the original Student-tested reciprocal-5NN profiles. The supplied vector figures are preserved exactly.',
      forward_factor_reconstruction:'Figure 6 preserves the earlier Sabatini–Kaufman b–f visual grammar, 48 matched successful trials and cue-aligned −0.2-to-2.5-s interval. Panel 6b is a raw-spike PSTH analysis and is LFADS-independent; panels 6c–f use three independently retrained regional seed-760 LFADS models. Median linear/nonlinear LDR factor-trajectory variance is 0.896/0.896 in M1, 0.922/0.928 in M2 and 0.834/0.813 in S1. Linear LDR paw-position variance explained is 0.810/0.678/0.828. Velocity R² is 0.180/−0.099/0.232.',
      static_factor_readout:'Testing Figure 7 now contains 9 independently enlarged panels after removing the former group-average recipe panel and observed-spike top-K panel. Figure 7a defines the native observation model, Figure 7b compares observed and native-rate population PSTHs, Figures 7c–e unpack factor-to-neuron organization, Figure 7f quantifies regional stage composition, Figure 7g provides the untouched-test replication, and Figures 7h–i quantify factor mixing and cumulative native-output recovery. Every stage assignment and ordering is frozen on training trials; seed 760 is selected before opening the 16-test-trial block.',
      wei_outcome_dynamics:'Figure 8 now retains only panel a. Its upper-left axis shows success and failure angular-deviation trajectories separately, replacing the former purple failure-minus-success curve with the lower plot from the former Figure 8b. The supported result is that held-out failures are farther from the outer-training success turning pattern near grasp (Δ=+0.954 SD; structured P=0.006), followed at +100 ms by lower innovation (Δ=−0.845 SD; structured P=0.008; time × metric max-T P=0.035). Ribbons show trial-level uncertainty. This remains a predictive association from one mouse-day, not a causal failure mechanism.',
      reconstruction_fidelity:'Figure 8a–d are rendered as four independent full-width panels. All 603 neurons remain in the population heatmaps and reconstruction distributions; the broken-axis display preserves the complete high-R² tail. CASTLE decoding and random/top/bottom neuron-retention analyses retain the original complete-trial folds. Former panels g–h remain removed.',
      neural_decoding:'Only the archival simultaneous-position question is retained. Poster-derived bars are approximate context; the recoverable 38-factor decoder reaches trial-held-out variance-weighted R²=0.900 across 48 successful trials. Previous prospective panels c–f and their claims are removed.',
      factor_encoder_attribution:'A newly trained 603-neuron LFADS checkpoint is rerun after zeroing each input neuron for complete held-out trials. Across all 38 native factors, masking and local gradients agree closely and model dependence is distributed; phase panels are phase-window output sensitivity after whole-trial deletion, not phase-isolated neuronal effects.',
      mapping_controls:'The same-event held-out advantage remains positive after training-only covariance matching (ΔR²₀=0.01967; 5/5 chronological summaries), whereas the noise-corrected principal-angle gap becomes −0.18°. The robust endpoint is predictive transfer, not demonstrated axis rotation.',
      model_adjudication:'Three distinct propositions are tested rather than conflated. Same-event maps beat wrong-event maps after covariance matching (ΔR²₀=0.01967; 5/5 folds), but event-specific maps do not beat a full pooled shared map (ΔR²₀=−0.01174; 1/5 folds), and the covariance-matched split-half-corrected angle gap is −0.18°. The defensible conclusion is predictive non-exchangeability without evidence that fitted axes truly rotate.',
      frozen_axis:'Pooled rank-3 source and target axes are frozen before fitting event-specific diagonal gains. At ±125 ms, gains add only 0.000773 held-out R²₀ (4/5 folds; fold sign P=0.0938; 99 coherent training-event-label shifts, P=0.01) and the effect becomes −0.000222 after covariance matching. Freely rotating event maps underperform frozen gain by 0.00954 R²₀; at ±250 ms they are predictively equivalent within an exploratory ±0.005 margin. Matched-size simulations recover gain and moderate rotation truths in 30/30 replicates each. The conclusion is a dominant shared architecture with, at most, weak covariance-sensitive reweighting.',
      recurrent_model:'A training-only five-dimensional state is fit separately in M2, M1 and S1. At 50-ms resolution, adding other-area history beyond task/paw inputs and target-area history improves held-out next-state prediction by ΔR²₀=0.01844 (5/5 folds; 199 trial-pairing surrogates, P=0.005). Event-gated cross weights add ΔR²₀=0.00443 (4/5 folds; fold sign P=0.0625; surrogate P=0.005) and remain positive across 25–100-ms and 3–8-dimensional sensitivities. These are computational model comparisons, not causal connections.',
      prospective_event:'Frozen Figure 9 out-of-fold predictions are sliced on matched reach, grasp and at-mouth samples without refitting. Reach prediction is reliable, grasp is unstable, and the planned later-stage-minus-reach contrast is null; therefore a stronger feedback-stage prospective code is not supported.',
      sliding_switch:'Adjacent disjoint 100-ms raw-spike windows are evaluated with complete-trial held-out train-time×test-time RRR. Same-time minus ≥300-ms-distant transfer is 0.00870 R²₀ (5/5 folds; 250 complete-trajectory label surrogates, P=0.00398). Boundaries at cue onset and 0.1 s survive max-T; they are predictive transitions and are not labeled as reach, grasp or causal switches.',
      residual_coordination:'After training-fold removal of event means, third-area activity and measured movement/task covariates, same-trial residual prediction exceeds coherent within-block whole-trial mispairing by 0.05615 R²₀ (5/5 folds; 999-surrogate P=0.001).',
      reach_grasp_cross_history:'At five matched cutoffs around reach and grasp, 250 ms of M1 self-history and recorded M2/S1 history predict the immediate next 50-ms M1 latent state beyond task, chronology and strictly past two-view paw kinematics. M2/S1 history contributes at both events relative to 999 coherent pairing surrogates with full model and penalty reselection (P=0.001 each), but the frozen grasp-minus-reach increment is −0.00852 (95% CI −0.03302 to 0.01645; block P=0.7422; superblock P=0.7598; pairing P=0.948). M1 self-history is directionally lower during grasp, but that secondary contrast is borderline after correcting the two direct contrasts (max-|T| P=0.05210). This is no evidence for greater recorded M2/S1 contribution during grasp, not proof that extrinsic input is absent.',
      ed10factors:'All 38 native factor trajectories are shown as held-out trial mean ± SEM. Factors are ordered by training-fold output energy; the thin phase strip is the modal CASTLE label across the nine held-out trials with phase annotations.',
      ed10top:'Within each CASTLE phase, all 38 factors contribute a top-15 neuron set. Absolute sets test reuse of a recurrent encoder-sensitive backbone; factor-selective residual sets subtract each neuron’s within-phase mean log effect across factors. Matched nulls preserve area and within-area firing-rate quintile, while split-half analyses expose the weak reliability of factor-selective single-cell rankings.',
      ed11a:'Panel a expands target-excluded hidden-neuron prediction to n=69: all targets are jointly absent from a 534-neuron predictor pool and training-only PCA is named explicitly. Panel b keeps exact Elephant GPFA as the honest access-matched n=9 pilot.',
      ed10a:'The raw and smoothed within-trial-z-scored 25-s hierarchies are separated because they answer different similarity questions. Both preserve the original matrices, dendrograms, five-class profiles and regional compositions.',
      ed10b:'The ten-nearest-neighbor functional-similarity graph, consensus communities, regional edge budget, hubs/bridges and supplied CW90 position maps are all retained. Graph similarity is not anatomical connectivity.'
    };

    const extendedPanels={
      overview_rates:[['a','All 1,346 supplied clusters are shown with common firing-rate bins; the 705-unit project-QC cohort used for conditional mapping is reported separately.'],['b-d','Regional distributions establish sampling and heterogeneity only; clusters are not animal replicates.']],
      overview_cue:[['a','Odd trials define latency order and normalization, and held-out even trials display the frozen order.'],['b','Cluster-average cue response traces are descriptive and do not imply a fixed M2→M1→S1 hierarchy.']],
      prospective_event:[['a','Reach, grasp and at-mouth use identical matched trial-offset support and strictly-past neural features.'],['b','Reach shows reliable neural increments; grasp is unstable and at-mouth inference differs between block definitions.'],['c','Leave-one-area-out gains do not establish a feedback hand-off.'],['d','The planned mean(grasp, at-mouth) minus reach contrast is null across M1, M2, S1 and the joint model.']],
      model_adjudication:[['a','The decision table separates same-event transfer, event-specific-model necessity and fitted-axis geometry.'],['b','The raw between-event angle gap is positive, but it vanishes after training-only covariance matching and split-half correction.'],['c','Wrong-event transfer is worse, while the full pooled shared map outpredicts separate event maps; a balanced-row comparator shows that data volume and flexibility must be separated.'],['d','Fixed cross-area history and event-gated cross weights are summarized across bin-width and latent-dimension sensitivities.']],
      frozen_axis:[['a','The same five chronological outer folds compare a pooled shared map, frozen axes with event gains, frozen subspaces with event mixing and freely event-specific rotating maps.'],['b','Gain-minus-shared is consistently positive but about two orders of magnitude smaller than the original transfer effect; within-subspace mixing adds no primary benefit.'],['c','Fitted channel gains vary modestly around the pooled value, but the held-out gain disappears after covariance matching.'],['d','Matched-size simulations distinguish gain from moderate rotation truth; the absence of a rotating-model advantage is therefore interpreted only at detectable predictive scales.']],
      recurrent_model:[['a','Four nested model classes receive the same task-time, behavioral-epoch, paw-kinematic and trial-order inputs.'],['b','Every outer fold improves from common inputs to local history and then fixed cross-area history; the gated increment is smaller.'],['c','Fold-level increments show the effect scale and one slightly negative gated-minus-fixed fold at the primary 50-ms setting.'],['d','Matched-size simulations distinguish common-input, local, fixed-cross and event-gated ground truths under the simulated assumptions. The observed star is model evidence, not a recovered biological circuit.']],
      ed05window:[['a','The ±125-ms plate repeats the exact corrected common-target/equal-half geometry with a less-overlapping event window.'],['b','The fold-averaged noise-corrected gap remains positive in 5/5 fold summaries; folds share training data and are not animal replicates.'],['c','All 999 phase-label surrogates remain below the observed omnibus angle (plus-one P=0.001).'],['d','Angles are descriptive across ordered mappings; no edge-specific biological inference is made.'],['e','The sample-normalized noise-corrected gap remains positive, but covariance-spectrum matching remains outstanding.']],
      ed05controls:[['a','All six ordered models × four events are shown with the coherent-surrogate max-T screen.'],['b','Each ±250-ms transfer effect is compared with the ±125-ms sensitivity.'],['c','The family maximum from each coherent source-trial surrogate forms the corrected null.'],['d','Absolute same- and cross-event held-out R²₀ values are shown without hiding modest prediction scale.'],['e','A fixed reporting threshold is shown as descriptive, not biological.'],['f','Strict-paw, matched-unit, rank/penalty and cohort controls are listed with exact trial counts.']],
      ed05behavior:[['a','Reasonable window, paw-covariate and QC specifications change the reach-latency estimate; horizontal intervals are descriptive recording-block bootstraps.'],['b','Single-edge omissions remain positive, but removing both M1↔M2 mappings reduces the association to a nonsignificant r=0.198.'],['c','The displayed outer-held-out trial association is post hoc and is not used to claim accuracy, benefit, information flow or causality.']],
      ed02a:[['a','All, S1, M1 and M2 use the same axes. Red and blue branches follow y=±a log(1+baseline/τ), are anchored at (0,0), cannot cross and are evaluated by five-fold RMSE.']],
      ed02b:[['a','Trough-aligned class medians show an early narrow-spiking peak and a later wide-spiking peak, consistent with mixed latencies producing the pooled shoulder.'],['b','Every strict-QC cluster is positioned by trough-to-peak duration and post-peak/|trough| ratio; the descriptive gate is not treated as a biological cell-type boundary.']],
      ed02c:[['a','Stacked bars retain all three functional response classes with exact counts and proportions for n=545 wide-spiking and n=49 narrow-spiking clusters.'],['b','Five-fold multinomial deviance R² asks whether waveform shape predicts functional class in All, M1, M2 and S1; All adjusts its null for area. The 250-permutation regional P values are exploratory and not corrected across the four scopes.']],
      ed10a:[['e','Each unit vector concatenates all 80 unsmoothed 25-s single-trial traces. The raw hierarchy, 1,346×1,346 matrix, class profiles and regional compositions are preserved.'],['f','A centered five-bin smooth and separate within-trial z-score precede concatenation. The strongly imbalanced five-class solution is shown rather than hidden.']],
      ed10b:[['g','Each cluster connects to its ten strongest positive Pearson neighbors; node size is weighted degree and colors show consensus community or recorded area on identical geometry.'],['h','Community region composition, cross-region edge-strength budget and the top weighted hubs/cross-region bridges are recomputed from the same graph.'],['i','The supplied CW90 unit coordinates are colored by functional community and recording region without changing point positions.']],
      ed11a:[['a','For n=69 targets, all targets are jointly removed from the 534-neuron predictor pool. Mean, cue-PSTH, training-only PCA co-smoothing and regional-GLM bits/spike are shown without calling PCA GPFA.'],['b','The original exact Elephant GPFA remains n=9 and is compared only with its access-matched pilot baselines; paired lines preserve every target.']],
      ed10factors:[['a','Each small multiple is one fresh native factor, standardized using training-trial mean and SD and then averaged across all 16 complete test trials.'],['b','SEM is across held-out trials. The phase strip shows the modal CASTLE label for the nine phase-annotated test trials and does not redefine the factor axes.']],
      ed10top:[['a','Five 38×38 matrices show how often two factors select the same absolute top-15 neurons within each phase.'],['b','Observed within-phase reuse is compared with an area × within-area firing-rate-quintile matched null; displayed P values use max-T family-wise correction across five phases.'],['c','The most recurrent absolute top neurons are shown across all phases; each phase uses only 26–40 unique neurons and individual units can recur in all 38 factors.'],['d','For each pair of phases, the matrix reports same-factor overlap of absolute top-15 sets.'],['e','The same cross-phase comparison is repeated after subtracting each neuron’s within-phase mean log effect across factors, isolating a noisier factor-selective residual.'],['f','Same-phase split-half reliability, observed cross-phase overlap and a within-trial phase-label permutation null are compared separately for absolute and factor-selective rankings. Low factor-selective reliability prohibits stable single-cell claims.']]
    };

    function panelDescriptionBlock(figure){
      const panelData=state.testingSource==='result'?figure.panels:extendedPanels[state.testingSource];
      if(!panelData?.length)return null;
      const descriptions=panelData.map(([label,description])=>h('article',{class:'testing-panel-description'},h('b',{},label),h('p',{},description)));
      return h('section',{class:'testing-panel-descriptions','aria-label':`Figure ${figure.number} panel descriptions`},h('h4',{},'Panel-by-panel interpretation'),h('div',{class:'testing-panel-description-grid'},...descriptions));
    }

    let lfadsExplorerDecoded=null;
    function decodeTyped(base64,Type){
      const binary=atob(base64),bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      return new Type(bytes.buffer);
    }
    function lfadsData(){
      if(lfadsExplorerDecoded)return lfadsExplorerDecoded;
      const raw=window.LFADS_NEURON_EXPLORER;
      if(!raw)return null;
      lfadsExplorerDecoded={
        ...raw,
        time:decodeTyped(raw.time,Float32Array),area:decodeTyped(raw.area,Uint8Array),
        observed:decodeTyped(raw.observedRateQ,Uint16Array),native:decodeTyped(raw.nativeRateQ,Uint16Array),
        testR:decodeTyped(raw.testR,Float32Array),testR2:decodeTyped(raw.testR2,Float32Array),
        weights:decodeTyped(raw.weights,Float32Array),bias:decodeTyped(raw.bias,Float32Array),
        factorTrainMean:decodeTyped(raw.factorTrainMean,Float32Array),factorTrainSd:decodeTyped(raw.factorTrainSd,Float32Array),
        factorTestMean:decodeTyped(raw.factorTestMean,Float32Array),rasterCache:new Map()
      };
      return lfadsExplorerDecoded;
    }
    function linePath(values,sx,sy){
      let path='';
      for(let i=0;i<values.length;i++)path+=(i?'L':'M')+sx(i).toFixed(2)+' '+sy(values[i]).toFixed(2)+' ';
      return path;
    }
    function explorerRasterSvg(data,unit){
      const W=1080,H=205,p={l:55,r:18,t:18,b:35},svg=svgEl(W,H),t0=data.time[0],t1=data.time[data.nTime-1],sx=i=>p.l+(data.time[i]-t0)/(t1-t0)*(W-p.l-p.r),sy=trial=>p.t+trial/data.nTestTrials*(H-p.t-p.b);
      for(let trial=0;trial<=data.nTestTrials;trial++)svg.append(s('line',{x1:p.l,y1:sy(trial),x2:W-p.r,y2:sy(trial),stroke:trial===data.nTestTrials?'#8793a3':'#edf0f4','stroke-width':trial===data.nTestTrials?1:.55}));
      let spikes=data.rasterCache.get(unit);
      if(!spikes){spikes=decodeTyped(data.raster[unit],Uint16Array);data.rasterCache.set(unit,spikes);}
      for(let j=0;j<spikes.length;j++){
        const flat=spikes[j],trial=Math.floor(flat/data.nTime),index=flat%data.nTime,x=sx(index),y0=sy(trial)+1,y1=sy(trial+1)-1;
        svg.append(s('line',{x1:x,y1:y0,x2:x,y2:y1,stroke:'#152033','stroke-width':.72,'stroke-opacity':.78}));
      }
      const eventColors=['#e66aa5','#f28e2b','#9b1b9e','#238c95'];
      data.eventTimes.forEach((time,index)=>{const x=p.l+(time-t0)/(t1-t0)*(W-p.l-p.r);svg.append(s('line',{x1:x,y1:p.t,x2:x,y2:H-p.b,stroke:eventColors[index],'stroke-width':1,'stroke-dasharray':'4 3'}),stext(x,p.t-5,data.eventLabels[index],{'font-size':8,'text-anchor':'middle',fill:eventColors[index]}));});
      [-1,0,1,2,3,4,5].forEach(t=>{const x=p.l+(t-t0)/(t1-t0)*(W-p.l-p.r);svg.append(s('line',{x1:x,y1:H-p.b,x2:x,y2:H-p.b+4,stroke:'#263445'}),stext(x,H-12,String(t),{'font-size':8,'text-anchor':'middle',fill:'#566477'}));});
      svg.append(stext(16,p.t+(H-p.t-p.b)/2,'16 untouched test trials',{'font-size':9,'text-anchor':'middle',transform:`rotate(-90 16 ${p.t+(H-p.t-p.b)/2})`,fill:'#39485b'}),stext((p.l+W-p.r)/2,H-2,'time from cue (s)',{'font-size':9,'text-anchor':'middle',fill:'#39485b'}));
      return svg;
    }
    function explorerRateSvg(data,unit){
      const W=1080,H=330,p={l:62,r:18,t:23,b:43},n=data.nTime,q=data.rateQuantumHz,offset=unit*n,observed=new Float32Array(n),nativeRate=new Float32Array(n);
      let ymax=1;
      for(let i=0;i<n;i++){observed[i]=data.observed[offset+i]*q;nativeRate[i]=data.native[offset+i]*q;ymax=Math.max(ymax,observed[i],nativeRate[i]);}
      ymax*=1.08;
      const t0=data.time[0],t1=data.time[n-1],sx=i=>p.l+(data.time[i]-t0)/(t1-t0)*(W-p.l-p.r),sy=v=>H-p.b-v/ymax*(H-p.t-p.b),svg=svgEl(W,H);
      [0,.5,1].forEach(frac=>{const value=frac*ymax,y=sy(value);svg.append(s('line',{x1:p.l,y1:y,x2:W-p.r,y2:y,stroke:'#e3e7ec','stroke-width':.8}),stext(p.l-8,y+3,value.toFixed(value<10?1:0),{'font-size':8,'text-anchor':'end',fill:'#566477'}));});
      const eventColors=['#e66aa5','#f28e2b','#9b1b9e','#238c95'];
      data.eventTimes.forEach((time,index)=>{const x=p.l+(time-t0)/(t1-t0)*(W-p.l-p.r);svg.append(s('line',{x1:x,y1:p.t,x2:x,y2:H-p.b,stroke:eventColors[index],'stroke-width':1,'stroke-dasharray':'4 3'}));});
      svg.append(s('path',{d:linePath(observed,sx,sy),fill:'none',stroke:'#172238','stroke-width':2.15,'stroke-linejoin':'round'}),s('path',{d:linePath(nativeRate,sx,sy),fill:'none',stroke:'#2e77d0','stroke-width':2.15,'stroke-linejoin':'round'}));
      [-1,0,1,2,3,4,5].forEach(t=>{const x=p.l+(t-t0)/(t1-t0)*(W-p.l-p.r);svg.append(s('line',{x1:x,y1:H-p.b,x2:x,y2:H-p.b+4,stroke:'#263445'}),stext(x,H-16,String(t),{'font-size':8,'text-anchor':'middle',fill:'#566477'}));});
      svg.append(stext(18,p.t+(H-p.t-p.b)/2,'firing rate (Hz)',{'font-size':9,'text-anchor':'middle',transform:`rotate(-90 18 ${p.t+(H-p.t-p.b)/2})`,fill:'#39485b'}),stext((p.l+W-p.r)/2,H-3,'time from cue (s)',{'font-size':9,'text-anchor':'middle',fill:'#39485b'}));
      return h('div',{},h('div',{class:'testing-legend'},h('span',{},h('i',{class:'line',style:{'--legend-color':'#172238'}}),'Observed test PSTH'),h('span',{},h('i',{class:'line',style:{'--legend-color':'#2e77d0'}}),'Native LFADS reconstruction')),svg);
    }
    function unitFactorSummary(data,unit){
      const n=data.nTime,kCount=data.nFactors,weightOffset=unit*kCount,traces=[],scores=[];
      let baseline=data.bias[unit];
      for(let k=0;k<kCount;k++)baseline+=data.weights[weightOffset+k]*data.factorTrainMean[k];
      for(let k=0;k<kCount;k++){
        const weight=data.weights[weightOffset+k],trace=new Float32Array(n);let energy=0;
        for(let i=0;i<n;i++){const value=weight*(data.factorTestMean[k*n+i]-data.factorTrainMean[k]);trace[i]=value;energy+=value*value;}
        traces.push(trace);scores.push(Math.sqrt(energy/n));
      }
      const order=Array.from({length:kCount},(_,i)=>i).sort((a,b)=>scores[b]-scores[a]);
      return {baseline,traces,scores,order};
    }
    function explorerContributionSvg(data,unit,summary){
      const W=1080,H=340,p={l:62,r:18,t:27,b:45},n=data.nTime,colors=['#2e77d0','#d65a55','#42a66a','#a45fb5','#e49335','#238c95'],top=summary.order.slice(0,6),sum=new Float32Array(n);let ymax=.05;
      for(let k=0;k<data.nFactors;k++)for(let i=0;i<n;i++)sum[i]+=summary.traces[k][i];
      top.forEach(k=>{for(let i=0;i<n;i++)ymax=Math.max(ymax,Math.abs(summary.traces[k][i]));});
      for(let i=0;i<n;i++)ymax=Math.max(ymax,Math.abs(sum[i]));ymax*=1.08;
      const t0=data.time[0],t1=data.time[n-1],sx=i=>p.l+(data.time[i]-t0)/(t1-t0)*(W-p.l-p.r),sy=v=>p.t+(ymax-v)/(2*ymax)*(H-p.t-p.b),svg=svgEl(W,H);
      [-1,0,1].forEach(frac=>{const y=sy(frac*ymax);svg.append(s('line',{x1:p.l,y1:y,x2:W-p.r,y2:y,stroke:frac===0?'#9aa5b3':'#e5e8ed','stroke-width':frac===0?1:.7}),stext(p.l-8,y+3,(frac*ymax).toFixed(2),{'font-size':8,'text-anchor':'end',fill:'#566477'}));});
      top.forEach((k,index)=>svg.append(s('path',{d:linePath(summary.traces[k],sx,sy),fill:'none',stroke:colors[index],'stroke-width':1.45,'stroke-opacity':.9})));
      svg.append(s('path',{d:linePath(sum,sx,sy),fill:'none',stroke:'#172238','stroke-width':2.2,'stroke-dasharray':'6 3'}));
      [-1,0,1,2,3,4,5].forEach(t=>{const x=p.l+(t-t0)/(t1-t0)*(W-p.l-p.r);svg.append(s('line',{x1:x,y1:H-p.b,x2:x,y2:H-p.b+4,stroke:'#263445'}),stext(x,H-16,String(t),{'font-size':8,'text-anchor':'middle',fill:'#566477'}));});
      svg.append(stext(18,p.t+(H-p.t-p.b)/2,'centered log-count contribution',{'font-size':9,'text-anchor':'middle',transform:`rotate(-90 18 ${p.t+(H-p.t-p.b)/2})`,fill:'#39485b'}),stext((p.l+W-p.r)/2,H-3,'time from cue (s)',{'font-size':9,'text-anchor':'middle',fill:'#39485b'}));
      return h('div',{},h('div',{class:'testing-legend'},...top.map((k,index)=>h('span',{},h('i',{class:'line',style:{'--legend-color':colors[index]}}),`F${k+1}`)),h('span',{},h('i',{class:'line',style:{'--legend-color':'#172238'}}),'sum of all 38')),svg);
    }
    function explorerWeightSvg(data,unit,summary){
      const W=1080,H=260,p={l:62,r:18,t:24,b:47},kCount=data.nFactors,offset=unit*kCount,values=Array.from({length:kCount},(_,k)=>data.weights[offset+k]),ymax=Math.max(.01,...values.map(Math.abs))*1.1,sy=v=>p.t+(ymax-v)/(2*ymax)*(H-p.t-p.b),barW=(W-p.l-p.r)/kCount,svg=svgEl(W,H),top=new Set(summary.order.slice(0,6));
      svg.append(s('line',{x1:p.l,y1:sy(0),x2:W-p.r,y2:sy(0),stroke:'#657285','stroke-width':1}));
      values.forEach((value,k)=>{const x=p.l+k*barW+1,y=Math.min(sy(0),sy(value)),height=Math.abs(sy(value)-sy(0));svg.append(s('rect',{x,y,width:Math.max(1,barW-2),height,fill:top.has(k)?'#2e77d0':'#aeb8c5','fill-opacity':top.has(k)?.95:.72}));if(k%3===0)svg.append(stext(x+barW/2,H-20,`F${k+1}`,{'font-size':7,'text-anchor':'middle',fill:'#566477',transform:`rotate(-55 ${x+barW/2} ${H-20})`}));});
      svg.append(stext(18,p.t+(H-p.t-p.b)/2,'static native weight Wₙₖ',{'font-size':9,'text-anchor':'middle',transform:`rotate(-90 18 ${p.t+(H-p.t-p.b)/2})`,fill:'#39485b'}));
      return svg;
    }
    function lfadsNeuronExplorerPanel(){
      const data=lfadsData();
      if(!data)return h('article',{class:'testing-subfigure'},h('div',{class:'empty-state'},'Interactive LFADS payload is unavailable.'));
      const areaNames=['M1','M2','S1'],areaColors={M1:'#2fa24a',M2:'#2776bd',S1:'#c92b2f'};
      let unit=171,scope='All';
      const regionSelect=h('select',{class:'btn','aria-label':'Filter neurons by region'},...['All',...areaNames].map(area=>h('option',{value:area},area==='All'?'All regions':area)));
      const unitSelect=h('select',{class:'btn','aria-label':'Select neuron'});
      const previous=h('button',{class:'btn'},'← Previous'),next=h('button',{class:'btn'},'Next →');
      const metrics=h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'9px',margin:'12px 0'}});
      const rasterHost=h('div',{class:'swrap'}),rateHost=h('div',{class:'swrap'});
      const available=()=>Array.from({length:data.nUnits},(_,i)=>i).filter(i=>scope==='All'||areaNames[data.area[i]]===scope);
      function fillUnits(){const ids=available();unitSelect.innerHTML='';ids.forEach(id=>unitSelect.append(h('option',{value:id},`${areaNames[data.area[id]]} · unit ${id}`)));if(!ids.includes(unit))unit=ids[0];unitSelect.value=String(unit);}
      function refresh(){
        const area=areaNames[data.area[unit]],summary=unitFactorSummary(data,unit),baselineHz=Math.exp(summary.baseline)/data.dt;
        metrics.innerHTML='';
        [
          [`${area} · unit ${unit}`,'selected neuron',areaColors[area]],
          [data.testR[unit].toFixed(3),'test PSTH Pearson r','#24364f'],
          [data.testR2[unit].toFixed(3),'amplitude-sensitive R²','#24364f'],
          [data.bias[unit].toFixed(3),'native bias b (log count/bin)','#24364f'],
          [baselineHz.toFixed(2)+' Hz','train-mean factor baseline','#24364f'],
          ['16','untouched test trials','#24364f']
        ].forEach(([value,label,color])=>metrics.append(h('div',{style:{border:'1px solid #dfe4ea',borderRadius:'8px',padding:'10px 12px',background:'#fbfcfe'}},h('b',{style:{display:'block',fontSize:'18px',color}},value),h('span',{style:{fontSize:'11px',color:'#657285'}},label))));
        rasterHost.innerHTML='';rasterHost.append(explorerRasterSvg(data,unit));
        rateHost.innerHTML='';rateHost.append(explorerRateSvg(data,unit));
        unitSelect.value=String(unit);
      }
      regionSelect.onchange=()=>{scope=regionSelect.value;fillUnits();refresh();};
      unitSelect.onchange=()=>{unit=Number(unitSelect.value);refresh();};
      previous.onclick=()=>{const ids=available(),index=ids.indexOf(unit);unit=ids[(index-1+ids.length)%ids.length];refresh();};
      next.onclick=()=>{const ids=available(),index=ids.indexOf(unit);unit=ids[(index+1)%ids.length];refresh();};
      fillUnits();
      const panel=h('article',{class:'testing-subfigure lfads-neuron-explorer'},
        h('div',{class:'testing-subfigure-head'},h('div',{},h('b',{},'Single-neuron LFADS'),h('h4',{},'Interactive native LFADS reconstruction for all 1,346 neurons')),h('span',{},'seed 760 · 16 untouched test trials · no post-hoc calibration')),
        h('div',{class:'ctrls',style:{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center',margin:'10px 0'}},h('b',{},'Explore neuron'),regionSelect,unitSelect,previous,next),metrics,
        h('h4',{},'Raw held-out spikes'),rasterHost,
        h('h4',{},'Observed versus exact native LFADS reconstruction'),rateHost,
        h('div',{class:'testing-caption'},'The blue curve is the model’s native rate averaged across the 16 untouched test trials and smoothed identically to the observed PSTH. It is not rescaled or fitted to this neuron after training. The former population-wide Figure 7 analysis is retained in the project archive but is no longer part of the active Testing atlas.'),
        h('p',{class:'testing-caption'},'Because LFADS observes the full population at inference, this is held-out-trial denoising rather than hidden-neuron prediction.')
      );
      refresh();
      return panel;
    }

    function vLfadsNeuron(main){
      main.append(
        h('div',{class:'head testing-head'},h('div',{},h('h1',{},'Single-neuron LFADS reconstruction'),h('p',{class:'testing-deck'},'Select any of the 1,346 neurons and compare its held-out spikes with the native LFADS reconstruction.')),h('span',{class:'sub'},'interactive · M1/M2/S1')),
        h('div',{class:'evidence-note warn'},'This page contains the interactive single-neuron reconstruction. The former population-wide factor-contribution panels are retained in the project archive but removed from the active Testing atlas.'),
        lfadsNeuronExplorerPanel()
      );
    }

    const TESTING_ASSET_VERSION='20260906fig1to5';

    function resultPanel(){
      const figure=selectedFigure(),assetId=state.testingSource==='result'?figure.id:state.testingSource,stem=resultAssets[assetId];
      if(!stem)return h('div',{class:'empty-state'},'The new analysis file is not available.');
      const subfigures=resultSubfigureAssets[assetId];
      if(subfigures){
        const descriptions=Object.fromEntries(figure.panels||[]);
        return h('section',{class:`testing-paper-panel testing-split-figure testing-figure-${figure.number} testing-asset-${assetId}`},
          h('div',{class:'testing-panel-head'},h('h3',{},`Figure ${figure.number} · ${subfigures.length} ${subfigures.length===1?'subfigure':'subfigures'}`),h('span',{},'Click any panel to open the full SVG')),
          h('div',{class:'testing-subfigure-stack'},...subfigures.map(([label,title,subStem])=>h('article',{class:`testing-subfigure testing-subfigure-${String(label).replace(/[^a-z0-9]+/gi,'-').toLowerCase()}`},
            h('div',{class:'testing-subfigure-head'},h('div',{},h('b',{},`Figure ${figure.number}${label}`),h('h4',{},title)),h('span',{},'independent vector render')),
            h('a',{class:'testing-subfigure-image',href:`${subStem}.svg?v=${TESTING_ASSET_VERSION}`,target:'_blank',rel:'noreferrer','aria-label':`Open Figure ${figure.number}${label} as a full-size SVG`},h('img',{src:`${subStem}.svg?v=${TESTING_ASSET_VERSION}`,alt:`Figure ${figure.number}${label}: ${title}`})),
            h('div',{class:'testing-subfigure-footer'},
              h('p',{class:'testing-caption'},descriptions[label]||''),
              h('div',{class:'testing-downloads'},h('a',{href:`${subStem}.svg?v=${TESTING_ASSET_VERSION}`,target:'_blank',rel:'noreferrer'},'Open SVG'),h('a',{href:`${subStem}.pdf?v=${TESTING_ASSET_VERSION}`,target:'_blank',rel:'noreferrer'},'Open PDF'),h('a',{href:`${subStem}.png?v=${TESTING_ASSET_VERSION}`,target:'_blank',rel:'noreferrer'},'Open 400-dpi PNG'))
            )
          ))),
          h('p',{class:'testing-caption testing-overview-caption'},resultCaptions[assetId])
        );
      }
      return h('section',{class:`testing-paper-panel testing-figure-${figure.number} testing-asset-${assetId}`},h('div',{class:'testing-panel-head'},h('h3',{},`Figure ${figure.number} · ${state.testingSource==='result'?'main figure':'Extended Data'}`),h('span',{},'SVG vector output · reproducible vector render')),h('img',{src:`${stem}.svg?v=${TESTING_ASSET_VERSION}`,alt:`Paper figure for ${figure.title}`,style:{display:'block',width:'100%',height:'auto'}}),h('p',{class:'testing-caption'},resultCaptions[assetId]),panelDescriptionBlock(figure),h('div',{class:'testing-downloads'},h('a',{href:`${stem}.svg?v=${TESTING_ASSET_VERSION}`,target:'_blank',rel:'noreferrer'},'Open SVG'),h('a',{href:`${stem}.pdf?v=${TESTING_ASSET_VERSION}`,target:'_blank',rel:'noreferrer'},'Open PDF'),h('a',{href:`${stem}.png?v=${TESTING_ASSET_VERSION}`,target:'_blank',rel:'noreferrer'},'Open 400-dpi PNG')));
    }

    const customViews={result:host=>host.append(resultPanel())};

    function sourceTabs(figure){
      if(figure.sources.length<2)return null;
      return h('nav',{class:'testing-source-tabs','aria-label':'Testing figure source views'},...figure.sources.map(([id,label])=>h('button',{class:state.testingSource===id?'on':'','aria-pressed':state.testingSource===id?'true':'false',onclick:()=>setSelection(figure.id,id)},label)));
    }

    function figureCard(figure){
      const chapter=selectedChapter(figure);
      return h('button',{class:'testing-figure-card'+(state.testingFigure===figure.id?' on':''),onclick:()=>setSelection(figure.id,figure.sources[0][0])},h('span',{},`Figure ${figure.number} · Chapter ${chapter.id}`),h('b',{},figure.title),h('small',{},figure.features));
    }

    function vTesting(main){
      const figure=selectedFigure();
      main.classList.add('testing-page',`testing-page-figure-${figure.number}`);
      if(state.testingFigure!==figure.id)state.testingFigure=figure.id;
      if(!figure.sources.some(source=>source[0]===state.testingSource))state.testingSource=figure.sources[0][0];
      const source=figure.sources.find(item=>item[0]===state.testingSource)||figure.sources[0],nativeView=customViews[source[0]]||(resultAssets[source[0]]?host=>host.append(resultPanel()):views[source[0]]);
      const referenceLinks=figure.references.flatMap((reference,index)=>[h('a',{href:reference[1],target:'_blank',rel:'noreferrer'},reference[0]),...(index<figure.references.length-1?[h('span',{},' · ')]:[])]);
      main.append(h('div',{class:'head testing-head'},h('div',{},h('h1',{},'Testing'),h('p',{class:'testing-deck'},'Five-figure evidence atlas: recorded population → cue and task registration → response organization → latent-representation audit.')),h('span',{class:'sub'},'Figures 1–5 · SVG/PDF/PNG')),h('div',{class:'evidence-note warn'},'Testing contains Figures 1–5 from one mouse and one recording day. Trials and neurons are not animal replicates, and none of the predictive analyses establishes causality.'),storyStrip(figure),h('nav',{class:'testing-map','aria-label':'Testing figure modules'},...figures.map(figureCard)),h('section',{class:`testing-plate testing-plate-figure-${figure.number}`},h('header',{class:'testing-plate-head'},h('div',{},h('span',{class:'testing-number'},`Figure ${figure.number} · Chapter ${selectedChapter(figure).id}`),h('h2',{},figure.title),h('p',{},figure.question)),h('div',{class:'testing-status'},h('b',{},figure.status),h('span',{},figure.features))),sourceTabs(figure),h('div',{class:'testing-rationale'},h('div',{},h('b',{},'Proposed claim'),h('span',{},figure.claim)),h('div',{},h('b',{},'Non-negotiable guardrail'),h('span',{},figure.guardrail)),h('div',{},h('b',{},'Reference paper + panel'),h('span',{},...referenceLinks)),h('div',{},h('b',{},'Borrowed grammar vs our adaptation'),h('span',{},figure.adaptation))),h('div',{class:`testing-content testing-content-figure-${figure.number}`})));
      const host=main.querySelector('.testing-content');
      if(nativeView)nativeView(host);else host.append(h('div',{class:'empty-state'},'This analysis is specified but does not yet have a defensible real-data result.'));
    }

    return {vTesting,vLfadsNeuron};
  };
})();
