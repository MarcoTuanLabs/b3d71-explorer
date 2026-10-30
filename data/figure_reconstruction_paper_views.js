(function(){
  'use strict';

  window.createFigureReconstructionPaper=function(api){
    const {h,state,views}=api;

    const figures=[
      {
        id:'single',number:'1',title:'Single-neuron measurements and response phenotypes',
        question:'What was recorded, and how do individual units differ in firing, waveform, cue response, and spike-time structure?',
        features:'Overview · unit table · selected-unit dashboard · firing rates · waveforms · functional classes · correlograms',
        status:'OBSERVED / DESCRIPTIVE',
        sources:[
          ['overview','Dataset overview'],['table','Unit table'],['dashboard','Unit dashboard'],['firing','Firing rates'],
          ['waveform','Waveform classes'],['functional','Functional classes'],['corr','Correlograms']
        ]
      },
      {
        id:'hierarchy',number:'2',title:'Functional hierarchy across 1,346 units',
        question:'Do cue-aligned and full-trial firing patterns reveal reproducible response classes, subtypes, and functional communities?',
        features:'Pearson hierarchy · 16 subtypes · z-score heatmaps · prototypes · kNN communities · position maps',
        status:'DESCRIPTIVE / STABILITY-AUDITED',sources:[['hierarchy','Functional hierarchy']]
      },
      {
        id:'population',number:'3',title:'Population timing and cross-area coordination',
        question:'How are population responses organized across trials, task epochs, and M2–M1–S1 activity?',
        features:'Population rasters · event timing · stage coactivation · regional interactions · S-map summaries',
        status:'DESCRIPTIVE / HISTORICAL',sources:[['rasters','Population rasters'],['interactions','Interactions']]
      },
      {
        id:'manifold',number:'4',title:'Neural manifold and movement trajectory',
        question:'How does the low-dimensional neural trajectory evolve with cue, reach, grasp, at-mouth timing, and paw motion?',
        features:'Cleaned paw trajectory · PC1×PC2×PC5 manifold · component dynamics · neural/paw speed',
        status:'SUPPLIED FULL-DATA REPRESENTATION',sources:[['latent','Population dynamics / manifold']]
      },
      {
        id:'castle',number:'5',title:'Behavioral phases recruit distinct neurons',
        question:'Which units are preferentially active in each CASTLE phase, and how stable is that phase preference?',
        features:'Phase recruitment · selected-neuron tuning · reliability · ranked neurons · regional summaries',
        status:'SELECTED 52-TRIAL COHORT',sources:[['castle','CASTLE phases']]
      },
      {
        id:'contrib',number:'6',title:'Single neurons read out population latent dynamics',
        question:'How does a selected neuron load onto LFADS factors, and which factors are expressed during each behavioral phase?',
        features:'Signed factor weights · dynamic contribution · observed PSTH · factor atlas · spatial readout map',
        status:'DESCRIPTIVE / BASIS-SPECIFIC',sources:[['contrib','Neuron contributions']]
      },
      {
        id:'atlas',number:'7',title:'Population-state and marker-neuron atlas',
        question:'Do trial-event population states form recurrent communities, and which recorded units mark those states?',
        features:'Trial-event UMAP · Leiden communities · held-out event decoding · regional signatures · marker units',
        status:'EXPLORATORY / TRIAL-BLOCKED DECODER',sources:[['atlas','Population-state atlas']]
      }
    ];

    function activeFigure(){
      return figures.find(item=>item.id===state.paperFigure)||figures[0];
    }

    function setSelection(figureId,sourceId){
      const figure=figures.find(item=>item.id===figureId)||figures[0];
      state.paperFigure=figure.id;
      state.paperSource=figure.sources.some(item=>item[0]===sourceId)?sourceId:figure.sources[0][0];
      location.hash=`view=reconstructionPaper&figure=${state.paperFigure}&source=${state.paperSource}`;
    }

    function figureButton(figure,active){
      return h('button',{
        class:'paper-figure-card'+(active?' on':''),
        'aria-pressed':active?'true':'false',
        onclick:()=>setSelection(figure.id,figure.sources[0][0])
      },
      h('span',{class:'paper-figure-card-number'},'Figure '+figure.number),
      h('b',{},figure.title),
      h('small',{},figure.features));
    }

    function sourceTabs(figure){
      if(figure.sources.length<2)return null;
      return h('div',{class:'paper-source-tabs','aria-label':'Panels included in this figure'},
        ...figure.sources.map(([id,label])=>h('button',{
          class:state.paperSource===id?'on':'',
          'aria-pressed':state.paperSource===id?'true':'false',
          onclick:()=>setSelection(figure.id,id)
        },label)));
    }

    function vPaper(main){
      const figure=activeFigure();
      if(!figure.sources.some(item=>item[0]===state.paperSource))state.paperSource=figure.sources[0][0];
      const source=figure.sources.find(item=>item[0]===state.paperSource)||figure.sources[0];
      const nativeView=views[source[0]];

      main.append(
        h('div',{class:'head paper-atlas-head'},
          h('div',{},h('h1',{},'Manuscript figure atlas'),
            h('p',{class:'paper-atlas-deck'},'All existing Neuron Visualization analyses, reorganized into a single paper storyline. Every panel below is the original website visualization and interaction—not a screenshot and not a newly invented substitute.')),
          h('span',{class:'sub'},'7 figure groups · 14 original analysis views')),
        h('div',{class:'paper-atlas-note'},
          h('b',{},'Reading order: '),
          'single neurons → functional hierarchy → population timing → manifold → behavioral phases → neuron contribution → population-state atlas.'),
        h('nav',{class:'paper-figure-map','aria-label':'Manuscript figure groups'},
          ...figures.map(item=>figureButton(item,item.id===figure.id))),
        h('section',{class:'paper-native-plate'},
          h('div',{class:'paper-native-head'},
            h('div',{},h('span',{class:'paper-native-number'},`Figure ${figure.number}`),h('h2',{},figure.title),h('p',{},figure.question)),
            h('div',{class:'paper-native-meta'},h('b',{},figure.status),h('span',{},'ORIGINAL WEBSITE VISUAL · NO REDRAW'))),
          sourceTabs(figure),
          h('div',{class:'paper-feature-line'},h('b',{},'Included features'),h('span',{},figure.features)),
          h('div',{class:'paper-native-content','data-paper-source':source[0]}))
      );

      const host=main.querySelector('.paper-native-content');
      if(nativeView)nativeView(host);
      else host.append(h('div',{class:'note'},`${source[1]} is unavailable in this build.`));
    }

    return {vPaper};
  };
})();
