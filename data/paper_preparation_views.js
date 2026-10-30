(function(){
  'use strict';

  window.createPaperPreparationViews=function(api){
    const {h,state}=api;
    const VERSION='20260918figure3restore1';
    const BASE='paper_analysis/paper_preparation_20260907/';
    const figures=[
      {
        id:'figure1',number:1,title:'Recorded population and cue-response organization',
        question:'What was recorded, how does the population respond to cue onset, and how does cue modulation scale with baseline firing?',
        panels:[
          ['a','Firing-rate landscape across the recorded network','paper_figure_01a_firing_rate_landscape','Redrawn in MATLAB code from the original numeric histogram data. Common firing-rate bins summarize All, S1, M1 and M2; All is the pooled distribution.'],
          ['b','Cue-locked population responses','paper_figure_01b_cue_population_timing','Odd trials define the row order and pre-cue mean/SD; those fixed transforms are applied to even trials for the heatmaps and baseline-centered traces. Response-class labels remain the archived all-trial paired-test/BH-FDR labels.'],
          ['c','Baseline firing versus held-out cue modulation','paper_figure_01c_baseline_modulation','Each point is one neuron. The attached strip shows cue-excited, cue-suppressed and unmodulated proportions; robust sign-constrained curves summarize the two significant-response branches.']
        ],
        summary:'Figure 1 moves from recording composition to cue-locked population structure and then to an independent-half neuron-level modulation diagnostic.'
      },
      {
        id:'figure2',number:2,title:'Waveform phenotype and cue-response timing',
        question:'How are regular/broad and fast/narrow waveforms distributed across regions, and how do their cue responses differ?',
        panels:[
          ['a','Extracellular waveform classes','paper_figure_02a_waveform_classes','Normalized waveforms are paired with the continuous trough-to-peak versus post-peak/trough feature space; 0.4 ms is an operational split, not a validated cell-type boundary.'],
          ['b','Waveform composition by recording area','paper_figure_02b_waveform_composition','Four independent 100% stacked-bar facets show All, S1, M1 and M2 without y-axes. The gaps between bars are halved. All eight proportions appear inside the bars; totals appear above. Bar width, red/blue solid fills, borders and white percentage labels match Figure 2d. A 3×2 Pearson chi-square test compares S1/M1/M2; the three pairwise Fisher exact tests retain Holm correction. All is pooled and descriptive for this regional comparison.'],
          ['c','Cue-response timing by waveform class and region','paper_figure_02c_waveform_latency','Two plots: the upper graph combines six mean-rate traces on one mirrored Hz axis, regular-spiking above zero and fast-spiking below zero. The lower half is a visual reflection, not negative firing or inhibition. The lower graph combines all 1,074 cue-modulated neurons on one signed Δ firing-rate axis; color identifies area and circle/diamond identifies waveform class. Points keep their measured coordinates; no statistics are added.'],
          ['d','Cue-response composition within waveform class','paper_figure_02d_response_by_waveform','Four aligned broken-y-axis plots show All, S1, M1 and M2. Omitted intervals are 5–30%, 5–54%, 5–26% and 5–11%, respectively, with explicit axis-break marks. All 24 actual percentages appear inside the bars. The excited segment remains visually largest in every bar; suppressed and unmodulated retain their size ordering. Breaks differ by area, so compare printed percentages across scopes. There is no detail row or numerical table. Two-sided Fisher exact tests compare excited versus non-excited counts between regular and fast waveform classes in All/S1/M1/M2. Holm correction covers all four displayed tests. Bracket stars use adjusted P: * < 0.05, ** < 0.01, *** < 0.001, **** < 0.0001; ns ≥ 0.05. All pools the same regional neurons; the test concerns the excited proportion, not the full three-category composition. Neuron-level independence remains an assumption; Fisher and Holm do not correct dependence within this one mouse.']
        ],
        summary:'Figure 2 keeps waveform anatomy, regional composition, timing and response-class enrichment distinct so an extracellular waveform label is not overinterpreted as cell identity.'
      },
      {
        id:'figure3',number:3,title:'Functional hierarchy and similarity communities',
        question:'How do the recorded neurons organize by cue-response shape and full-trial similarity at the specified 5-class, 16-subtype and 8-community resolutions?',
        panels:[
          ['a','Cue-response correlation hierarchy','paper_figure_03a_cue_hierarchy','Recomputed from complete S21–S40 spikes: 1,346 neurons, 80 trials, 120 cue-aligned 50-ms bins from −1 to +5 s. Average linkage on 1−Pearson r is cut to the specified five major classes. Class names follow measured early excitation/suppression, late rise and mean rate. Profiles are in Hz. K=2–10 silhouettes show sensitivity; five is a specified resolution, not a demonstrated optimum. Correlation colors clip at the 99th percentile of absolute off-diagonal r.'],
          ['b','Subtype hierarchy and membership recovery','paper_figure_03b_subtype_recovery','Sixteen subtypes are refitted using 32-start k-means++ on standardized cue profiles, with the 5/1/3/1/6 allocation within C1–C5. No reference neuron counts or memberships are targets. Fifty bootstrap resamples redraw 20 recording blocks of four trials and refit both levels at the specified resolutions. Points show mean membership Jaccard recovery; intervals show the 2.5–97.5 percentile resampling range, not animal-level confidence intervals. Low-recovery subtypes should be treated as unstable.'],
          ['c','Subtype firing-rate prototypes','paper_figure_03c_subtype_prototypes','All sixteen subtype mean profiles and neuron counts are recomputed from actual spike samples. Every subplot shares the same physical firing-rate scale. No z-score firing-rate map is included.'],
          ['d','Full-trial spike-count hierarchy','paper_figure_03d_full_trial_hierarchy','Each neuron contributes 160,000 original 12.5-ms spike-count bins: 80 separate 25-s windows concatenated without trial averaging. The five-class cut and all rate/region summaries are recomputed. Small silhouette values indicate weak separation; a specified partition is not proof of distinct biological classes.'],
          ['e','Normalized full-trial correlation hierarchy','paper_figure_03e_normalized_hierarchy','Each 25-s trial receives a centered five-bin smooth with zero padding, followed by per-neuron within-trial standardization; constant trials contribute zeros. Pearson correlations use the concatenated traces. The matrix is neuron-by-neuron correlation, not the removed z-score firing-rate map. Mean-rate summaries return to unnormalized Hz.'],
          ['f','Full spatial functional network','paper_figure_03f_similarity_atlas','Two equally sized views show the complete original graph: functional graph by community on the left and functional graph by recorded region on the right. Each contains all 1,346 neurons and all 12,474 edges, with identical positions, connections and weighted-degree node sizes. Only node colors differ. Line shade and width encode Pearson weight in four labeled ranges. No edges are removed for display. Supplied coordinates are rotated clockwise, with deterministic 1.8-unit offsets for shared positions. Figure 3g uses this same complete graph. Similarity does not establish anatomical connectivity.'],
          ['g','Community composition and graph summaries','paper_figure_03g_graph_summaries','Community region composition, region-to-region edge budgets, hubs and bridges are recomputed from unique undirected edges. Each within-region edge contributes once on the diagonal; off-diagonal cells mirror the same cross-region budget. Hub score sums all incident weights; bridge score sums cross-region weights. Unit IDs are the actual zero-based IDs in the supplied recording.'],
        ],
        summary:'Figure 3 rebuilds all hierarchy, subtype, full-trial, graph and position summaries from complete raw spike data. The requested 5/16/8 resolutions are explicit analysis choices; memberships, neuron counts, stability and graph scores are computed rather than copied.'
      }
    ];

    function selected(){
      return figures.find(figure=>figure.id===state.prepFigure)||figures[0];
    }

    function choose(id){
      state.prepFigure=id;
      location.hash=`view=paperprep&ppfigure=${id}`;
      const event=new HashChangeEvent('hashchange');
      window.dispatchEvent(event);
    }

    function figureButton(figure){
      return h('button',{class:'testing-figure-card'+(selected().id===figure.id?' on':''),onclick:()=>choose(figure.id)},
        h('span',{},`Paper Figure ${figure.number}`),
        h('b',{},figure.title),
        h('small',{},`${figure.panels.length} independently downloadable vector panels`)
      );
    }

    function subfigure(figure,panel){
      const [letter,title,stem,caption]=panel;
      const path=BASE+stem;
      return h('article',{class:`testing-subfigure paper-preparation-subfigure paper-preparation-${figure.number}${letter}`},
        h('div',{class:'testing-subfigure-head'},
          h('div',{},h('b',{},`Figure ${figure.number}${letter}`),h('h4',{},title)),
          h('span',{},'rendered in MATLAB R2026a')
        ),
        h('a',{class:'testing-subfigure-image',href:`${path}.svg?v=${VERSION}`,target:'_blank',rel:'noreferrer','aria-label':`Open Figure ${figure.number}${letter} as full-size SVG`},
          h('img',{src:`${path}.svg?v=${VERSION}`,alt:`Figure ${figure.number}${letter}: ${title}`})
        ),
        h('div',{class:'testing-subfigure-footer'},
          h('p',{class:'testing-caption'},caption),
          h('div',{class:'testing-downloads'},
            h('a',{href:`${path}.svg?v=${VERSION}`,target:'_blank',rel:'noreferrer'},'Open SVG'),
            h('a',{href:`${path}.pdf?v=${VERSION}`,target:'_blank',rel:'noreferrer'},'Open PDF'),
            h('a',{href:`${path}.png?v=${VERSION}`,target:'_blank',rel:'noreferrer'},'Open 400-dpi PNG'),
            h('a',{href:`${path}.fig?v=${VERSION}`,download:`${stem}.fig`},'Download MATLAB FIG')
          )
        )
      );
    }

    function vPaperPreparation(main){
      const figure=selected();
      state.prepFigure=figure.id;
      main.classList.add('testing-page','paper-preparation-page',`paper-preparation-figure-${figure.number}`);
      main.append(
        h('div',{class:'head testing-head'},
          h('div',{},h('h1',{},'Paper preparation'),h('p',{class:'testing-deck'},'Paper Figures 1–3 · 14 panels drawn with MATLAB code from 1,346-neuron numeric source data.')),
          h('span',{class:'sub'},'Figures 1–3 · MATLAB FIG / SVG/PDF/400-dpi PNG')
        ),
        h('div',{class:'evidence-note warn'},'Scope: one mouse and one recording day. Neurons are not animal replicates; waveform class is an extracellular phenotype, not a validated cell type.'),
        h('nav',{class:'testing-map paper-preparation-map','aria-label':'Paper preparation figures'},...figures.map(figureButton)),
        h('section',{class:`testing-plate paper-preparation-plate paper-preparation-plate-${figure.number}`},
          h('header',{class:'testing-plate-head'},
            h('div',{},h('span',{class:'testing-number'},`Paper Figure ${figure.number}`),h('h2',{},figure.title),h('p',{},figure.question)),
            h('div',{class:'testing-status'},h('b',{},'PAPER PREPARATION'),h('span',{},'one visual system · independent vector panels'))
          ),
          h('div',{class:'testing-rationale'},
            h('div',{},h('b',{},'Figure logic'),h('span',{},figure.summary)),
            h('div',{},h('b',{},'Shared data contract'),h('span',{},'1,346 neurons · 80 trials · M1/M2/S1 · paired-trial response classes with BH-FDR')),
            h('div',{},h('b',{},'Visual contract'),h('span',{},'Figure 1 typography, line weights, white background, regional palette and aligned spacing')),
            h('div',{},h('b',{},'Reproducibility'),h('span',{},'All 14 panels rendered and verified in MATLAB R2026a Update 5; .m scripts + numeric .mat inputs; MATLAB FIG / SVG/PDF/400-dpi PNG'))
          ),
          h('div',{class:'testing-downloads'}, h('a',{href:BASE+'matlab/paper_figures_matlab.zip',download:''},'Download MATLAB code + data'), h('a',{href:BASE+'matlab/README.md',target:'_blank',rel:'noreferrer'},'Methods and run instructions'), ...(figure.number===3 ? [h('a',{href:BASE+'matlab/FIGURE3_METHODS.md',target:'_blank',rel:'noreferrer'},'Figure 3 analysis methods'),h('a',{href:BASE+'paper_figure_03_source_units.csv',download:''},'Figure 3 source units'),h('a',{href:BASE+'matlab/figure3_provenance.json',target:'_blank',rel:'noreferrer'},'Raw-data provenance')] : [])),
          h('div',{class:'testing-content paper-preparation-content'},
            h('section',{class:'testing-paper-panel testing-split-figure'},
              h('div',{class:'testing-panel-head'},h('h3',{},`Paper Figure ${figure.number} · ${figure.panels.length} subfigures`),h('span',{},'Click any panel to open the full SVG')),
              h('div',{class:'testing-subfigure-stack'},...figure.panels.map(panel=>subfigure(figure,panel)))
            )
          )
        )
      );
    }

    return {vPaperPreparation};
  };
})();
