(function(){
  'use strict';

  window.createPopulationStateAtlas=function(ctx){
    const {h,s,stext,svgEl,showTip,on,state,render,selectUnit}=ctx;
    const ATLAS=window.POPULATION_STATE_ATLAS;
    if(!ATLAS)return null;

    const eventColors={
      baseline:'#556274',cue:'#d45176',reach:'#df8b32',grasp:'#7658ad','at-mouth':'#2f978c'
    };
    const outcomeColors={success:'#3f7fbf',fail:'#c0504d'};
    const clusterColors=['#4267ac','#df7949','#2e956c','#ad4f70','#7560ad','#b18a2f','#3c8f9f'];
    const eventLabels=ATLAS.meta.eventLabels;
    const eventOrder=ATLAS.meta.events;
    const clusterColor=id=>clusterColors[(id-1)%clusterColors.length];
    const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
    const mix=(a,b,t)=>a.map((value,index)=>Math.round(value+(b[index]-value)*t));
    const rgb=values=>`rgb(${values.join(',')})`;
    const sequential=value=>rgb(mix([246,248,251],[42,103,176],clamp(value,0,1)));
    function diverging(value){
      const t=clamp((value+1)/2,0,1);
      return t<.5?rgb(mix([39,101,173],[247,247,247],t*2)):rgb(mix([247,247,247],[181,37,55],(t-.5)*2));
    }

    function legend(items){
      return h('div',{class:'legend state-atlas-legend'},...items.map(([label,color])=>h('b',{},h('i',{style:{background:color}}),label)));
    }

    function umapColor(observation,mode){
      if(mode==='community')return clusterColor(observation.cluster);
      if(mode==='outcome')return outcomeColors[observation.outcome];
      return eventColors[observation.event];
    }

    function umapLegend(mode){
      if(mode==='community')return legend(ATLAS.clusters.map(cluster=>['Community '+cluster.id,clusterColor(cluster.id)]));
      if(mode==='outcome')return legend([['Success',outcomeColors.success],['Fail',outcomeColors.fail]]);
      return legend(eventOrder.map(event=>[eventLabels[event],eventColors[event]]));
    }

    function umapPlot(mode){
      const W=820,H=570,pad={l:55,r:22,t:18,b:48},sv=svgEl(W,H),points=ATLAS.observations;
      const xs=points.map(point=>point.umap[0]),ys=points.map(point=>point.umap[1]);
      let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
      const xm=(x1-x0)*.07||1,ym=(y1-y0)*.07||1;x0-=xm;x1+=xm;y0-=ym;y1+=ym;
      const sx=value=>pad.l+(value-x0)/(x1-x0)*(W-pad.l-pad.r);
      const sy=value=>H-pad.b-(value-y0)/(y1-y0)*(H-pad.t-pad.b);
      sv.append(s('line',{x1:pad.l,y1:H-pad.b,x2:W-pad.r,y2:H-pad.b,stroke:'#bfc7d2'}),s('line',{x1:pad.l,y1:pad.t,x2:pad.l,y2:H-pad.b,stroke:'#bfc7d2'}));
      const ordered=points.slice().sort((a,b)=>(a.cluster===state.atlasCluster)-(b.cluster===state.atlasCluster));
      ordered.forEach(point=>{
        const selected=point.cluster===state.atlasCluster;
        const circle=s('circle',{cx:sx(point.umap[0]),cy:sy(point.umap[1]),r:selected?4.4:3.5,fill:umapColor(point,mode),'fill-opacity':selected?.92:.68,stroke:selected?'#1d2634':'#fff','stroke-width':selected?1.1:.55});
        on(circle,event=>showTip(event,`<b>Trial ${point.trial+1} · ${eventLabels[point.event]}</b><br>${point.outcome} · community ${point.cluster}<br>window center ${point.center.toFixed(3)} s`));
        circle.addEventListener('click',()=>{state.atlasCluster=point.cluster;render();});
        circle.style.cursor='pointer';sv.append(circle);
      });
      if(mode==='community')ATLAS.clusters.forEach(cluster=>{
        sv.append(stext(sx(cluster.centroid[0]),sy(cluster.centroid[1])+4,'C'+cluster.id,{'font-size':12,'font-weight':800,'text-anchor':'middle',fill:'#fff',stroke:'#202938','stroke-width':3,'paint-order':'stroke'}));
      });
      sv.append(stext((pad.l+W-pad.r)/2,H-7,'UMAP 1',{'font-size':11,'text-anchor':'middle',fill:'#566175'}),stext(15,(pad.t+H-pad.b)/2,'UMAP 2',{'font-size':11,'text-anchor':'middle',fill:'#566175',transform:`rotate(-90 15 ${(pad.t+H-pad.b)/2})`}));
      return h('div',{},h('div',{class:'swrap'},sv),umapLegend(mode));
    }

    function communityComposition(){
      const W=510,H=300,pad={l:72,r:18,t:25,b:42},sv=svgEl(W,H),plotW=W-pad.l-pad.r,rowH=(H-pad.t-pad.b)/ATLAS.clusters.length;
      [0,25,50,75,100].forEach(percent=>{const x=pad.l+plotW*percent/100;sv.append(s('line',{x1:x,y1:pad.t-5,x2:x,y2:H-pad.b,stroke:'#edf0f4'}),stext(x,H-16,percent+'%',{'font-size':9,'text-anchor':'middle'}));});
      ATLAS.clusters.forEach((cluster,row)=>{
        const y=pad.t+row*rowH+8,total=cluster.n;
        sv.append(stext(pad.l-10,y+16,'C'+cluster.id,{'font-size':11,'text-anchor':'end','font-weight':750,fill:clusterColor(cluster.id)}),stext(pad.l-10,y+29,'n='+total,{'font-size':8.5,'text-anchor':'end',fill:'#7b8798'}));
        let x=pad.l;
        eventOrder.forEach(event=>{
          const count=cluster.eventCounts[event],width=plotW*count/total;if(!count)return;
          const rect=s('rect',{x,y,width,height:30,fill:eventColors[event]});
          on(rect,evt=>showTip(evt,`<b>Community ${cluster.id} · ${eventLabels[event]}</b><br>${count} of ${total} states · ${(100*count/total).toFixed(1)}%`));
          rect.addEventListener('click',()=>{state.atlasCluster=cluster.id;render();});rect.style.cursor='pointer';sv.append(rect);
          if(width>34)sv.append(stext(x+width/2,y+19,Math.round(100*count/total)+'%',{'font-size':9.5,'text-anchor':'middle','font-weight':750,fill:'#fff'}));
          x+=width;
        });
        if(cluster.id===state.atlasCluster)sv.append(s('rect',{x:pad.l-.7,y:y-.7,width:plotW+1.4,height:31.4,fill:'none',stroke:'#202938','stroke-width':1.4}));
      });
      return h('div',{},h('div',{class:'swrap'},sv),legend(eventOrder.map(event=>[eventLabels[event],eventColors[event]])));
    }

    function matrixChart(values,rowLabels,colLabels,options){
      const opts=options||{},W=opts.W||470,H=opts.H||430,pad={l:92,r:20,t:66,b:62},sv=svgEl(W,H),rows=values.length,cols=values[0].length,cw=(W-pad.l-pad.r)/cols,ch=(H-pad.t-pad.b)/rows;
      values.forEach((row,rowIndex)=>row.forEach((value,colIndex)=>{
        const normalized=opts.normalized?value:(value-(opts.min||0))/(((opts.max==null?1:opts.max)-(opts.min||0))||1);
        const fill=opts.diverging?diverging(value):sequential(normalized);
        const rect=s('rect',{x:pad.l+colIndex*cw,y:pad.t+rowIndex*ch,width:cw+.2,height:ch+.2,fill,stroke:'#fff','stroke-width':1.2});
        on(rect,event=>showTip(event,`<b>${rowLabels[rowIndex]} × ${colLabels[colIndex]}</b><br>${opts.tipPrefix||''}${opts.format(value)}`));sv.append(rect);
        if(cw>42&&ch>30)sv.append(stext(pad.l+(colIndex+.5)*cw,pad.t+(rowIndex+.5)*ch+3,opts.format(value),{'font-size':9.5,'text-anchor':'middle','font-weight':700,fill:opts.diverging&&Math.abs(value)<.45?'#354052':'#fff',stroke:opts.diverging&&Math.abs(value)<.45?'none':'rgba(25,32,45,.28)','stroke-width':.7,'paint-order':'stroke'}));
      }));
      rowLabels.forEach((label,index)=>sv.append(stext(pad.l-8,pad.t+(index+.5)*ch+3,label,{'font-size':9.5,'text-anchor':'end','font-weight':650})));
      colLabels.forEach((label,index)=>sv.append(stext(pad.l+(index+.5)*cw,pad.t-10,label,{'font-size':9.5,'text-anchor':'middle','font-weight':650})));
      if(opts.xLabel)sv.append(stext((pad.l+W-pad.r)/2,H-8,opts.xLabel,{'font-size':10,'text-anchor':'middle'}));
      if(opts.yLabel)sv.append(stext(13,(pad.t+H-pad.b)/2,opts.yLabel,{'font-size':10,'text-anchor':'middle',transform:`rotate(-90 13 ${(pad.t+H-pad.b)/2})`}));
      return h('div',{class:'swrap'},sv);
    }

    function markerHeatmap(){
      const unitIds=ATLAS.markerUnitIds,values=ATLAS.markerHeatmap,W=1080,H=355,pad={l:62,r:20,t:102,b:48},sv=svgEl(W,H),cw=(W-pad.l-pad.r)/unitIds.length,ch=(H-pad.t-pad.b)/values.length,limit=Math.max(1.5,...values.flat().map(Math.abs));
      unitIds.forEach((unitId,index)=>{
        const area=ctx.UNITS[unitId].area,x=pad.l+index*cw;
        sv.append(s('rect',{x,y:pad.t-16,width:cw+.2,height:6,fill:ctx.AC[area]}));
        sv.append(stext(x+cw*.55,pad.t-23,'U'+unitId,{'font-size':8.5,'text-anchor':'start','font-weight':650,transform:`rotate(-55 ${x+cw*.55} ${pad.t-23})`}));
      });
      values.forEach((row,rowIndex)=>row.forEach((value,colIndex)=>{
        const rect=s('rect',{x:pad.l+colIndex*cw,y:pad.t+rowIndex*ch,width:cw+.25,height:ch+.25,fill:diverging(value/limit),stroke:'#fff','stroke-width':1});
        const unitId=unitIds[colIndex];
        on(rect,event=>showTip(event,`<b>Community ${rowIndex+1} · Unit ${unitId}</b><br>${ctx.UNITS[unitId].area} · mean standardized response ${value>=0?'+':''}${value.toFixed(2)}`));
        rect.addEventListener('click',()=>selectUnit(unitId));rect.style.cursor='pointer';sv.append(rect);
      }));
      values.forEach((_,row)=>sv.append(stext(pad.l-10,pad.t+(row+.5)*ch+4,'C'+(row+1),{'font-size':11,'text-anchor':'end','font-weight':750,fill:clusterColor(row+1)})));
      sv.append(stext((pad.l+W-pad.r)/2,H-9,'top community marker units · column strip = recording area',{'font-size':10,'text-anchor':'middle'}));
      return h('div',{class:'swrap'},sv);
    }

    function markerTable(){
      const cluster=ATLAS.clusters.find(item=>item.id===state.atlasCluster)||ATLAS.clusters[0],wrap=h('div',{class:'factor-table state-atlas-marker-table'}),table=h('table'),head=h('tr');
      ['Rank','Unit','Area','Effect','Waveform','Cue class'].forEach((label,index)=>head.append(h('th',{class:index<2?'l':''},label)));table.append(h('thead',{},head));
      const body=h('tbody');cluster.markers.forEach((marker,index)=>{
        const row=h('tr',{onclick:()=>selectUnit(marker.unit)});row.append(h('td',{class:'l'},''+(index+1)),h('td',{class:'l'},h('b',{},'Unit '+marker.unit)),h('td',{style:{color:ctx.AC[marker.area],fontWeight:750}},marker.area),h('td',{},(marker.effect>=0?'+':'')+marker.effect.toFixed(2)),h('td',{},marker.waveform),h('td',{},marker.functional));body.append(row);
      });table.append(body);wrap.append(table);return wrap;
    }

    function clusterSelect(){
      const select=h('select',{class:'inline','aria-label':'Selected Leiden community',onchange:event=>{state.atlasCluster=+event.target.value;render();}});
      ATLAS.clusters.forEach(cluster=>{const option=h('option',{value:cluster.id},`Community ${cluster.id} · n=${cluster.n}`);if(cluster.id===state.atlasCluster)option.selected='selected';select.append(option);});return select;
    }

    function vAtlas(main){
      if(!state.atlasColor)state.atlasColor='event';
      if(!ATLAS.clusters.some(cluster=>cluster.id===state.atlasCluster))state.atlasCluster=ATLAS.clusters[0].id;
      const meta=ATLAS.meta;
      main.append(h('div',{class:'head'},h('h1',{},'Population-state atlas'),h('span',{class:'sub'},'transcriptomics-inspired sample × unit analysis')));
      main.append(h('p',{class:'page-intro'},'Each point is one 250 ms trial-event population state. The analysis treats states as observations and recorded units as features, then uses a PCA neighbor space, Leiden communities, UMAP visualization, and descriptive marker-unit effects.'));
      main.append(h('div',{class:'summary-strip'},h('span',{},h('b',{},meta.nObservations),' trial-event states'),h('span',{},h('b',{},meta.nLabeledTrials),' labeled trials'),h('span',{},h('b',{},meta.nUnits),' recorded units'),h('span',{},h('b',{},meta.nVariableUnits),' variable units'),h('span',{},h('b',{},ATLAS.clusters.length),' Leiden communities'),h('span',{},h('b',{},(100*meta.eventBalancedAccuracy).toFixed(1)+'%'),' trial-blocked event accuracy')));
      const toolbar=h('div',{class:'analysis-toolbar state-atlas-toolbar'}),mode=h('div',{class:'seg'});
      [['event','Event'],['community','Community'],['outcome','Outcome']].forEach(([value,label])=>mode.append(h('button',{class:state.atlasColor===value?'on':'','aria-pressed':state.atlasColor===value?'true':'false',onclick:()=>{state.atlasColor=value;render();}},label)));
      toolbar.append(h('div',{class:'field wide'},h('label',{},'Color UMAP by'),mode),h('div',{class:'field wide'},h('label',{},'Marker community'),clusterSelect()));main.append(toolbar);

      const primary=h('div',{class:'state-atlas-primary'});
      primary.append(h('section',{class:'card'},h('div',{class:'chart-title'},h('h3',{},'Trial-event population-state map'),h('span',{},meta.umap)),umapPlot(state.atlasColor),h('div',{class:'cap'},'UMAP displays neighborhood geometry only. Leiden communities are estimated from the high-dimensional fuzzy neighbor graph, not from the two plotted coordinates.')));
      primary.append(h('section',{class:'card'},h('div',{class:'chart-title'},h('h3',{},'Community composition'),h('span',{},'event labels were not used for clustering')),communityComposition(),h('div',{class:'cap'},'Communities recover baseline, cue/early reach, reach/grasp, and at-mouth population regimes without supplying event identity to Leiden.')));main.append(primary);

      const diagnostics=h('div',{class:'state-atlas-diagnostics'});
      diagnostics.append(h('section',{class:'card'},h('div',{class:'chart-title'},h('h3',{},'Event pseudobulk similarity'),h('span',{},'Pearson r between mean 500-unit signatures')),matrixChart(ATLAS.eventSimilarity,eventOrder.map(event=>eventLabels[event]),eventOrder.map(event=>eventLabels[event]),{diverging:true,format:value=>value.toFixed(2),xLabel:'event signature',yLabel:'event signature'}),h('div',{class:'cap'},'A negative value means the two event-mean standardized population signatures point in opposing feature directions; it is not inhibitory coupling.')));
      diagnostics.append(h('section',{class:'card'},h('div',{class:'chart-title'},h('h3',{},'Held-out event decoding'),h('span',{},`5-fold GroupKFold by trial · chance ${(100*meta.eventChance).toFixed(0)}%`)),matrixChart(ATLAS.eventConfusion,eventOrder.map(event=>eventLabels[event]),eventOrder.map(event=>eventLabels[event]),{normalized:true,format:value=>(100*value).toFixed(0)+'%',xLabel:'predicted event',yLabel:'observed event'}),h('div',{class:'cap'},`Balanced accuracy is ${(100*meta.eventBalancedAccuracy).toFixed(1)}%. Scaling, PCA, and regularized multinomial regression are refit inside every held-out-trial fold.`)));
      const regionalMax=Math.max(...ATLAS.regionalSignatures.flat());
      diagnostics.append(h('section',{class:'card'},h('div',{class:'chart-title'},h('h3',{},'Regional signature amplitude'),h('span',{},'mean absolute event-centroid z per selected unit')),matrixChart(ATLAS.regionalSignatures,eventOrder.map(event=>eventLabels[event]),['M2','M1','S1'],{min:0,max:regionalMax,format:value=>value.toFixed(2),xLabel:'recording area',yLabel:'event'}),h('div',{class:'cap'},'Values are normalized per selected unit before regional averaging, so this panel compares response-pattern amplitude without simply rewarding the area containing more units.')));main.append(diagnostics);

      main.append(h('section',{class:'card state-atlas-markers'},h('div',{class:'chart-title'},h('h3',{},'Community marker-unit atlas'),h('span',{},'cluster minus rest · standardized square-root firing rate')),markerHeatmap(),h('div',{class:'cap'},'Columns are the top five unique positive markers contributed by each community. Click a cell to inspect that recorded unit; marker effects are descriptive and are not molecular cell-type labels.')));

      const lower=h('div',{class:'report-grid equal state-atlas-lower'}),selected=ATLAS.clusters.find(cluster=>cluster.id===state.atlasCluster);
      lower.append(h('section',{class:'card'},h('div',{class:'chart-title'},h('h3',{},`Community ${selected.id} marker units`),h('span',{},`n=${selected.n} states · effect-size ranking`)),markerTable(),h('div',{class:'cap'},meta.markerDefinition)));
      lower.append(h('section',{class:'card'},h('div',{class:'chart-title'},h('h3',{},'Interpretive boundary'),h('span',{},'what this dataset can support')),h('div',{class:'state-atlas-boundary'},h('div',{},h('b',{},'Supported'),h('p',{},'A within-recording atlas of recurrent population states, event-associated communities, trial-held-out event structure, regional signatures, and candidate marker units.')),h('div',{},h('b',{},'Not established'),h('p',{},'A molecular transcriptome, discrete biological cell types, cross-animal generalization, stable communities across sessions, or causal roles for marker units.'))),h('details',{class:'compact-details'},h('summary',{},'Methods and data availability'),h('p',{},`${meta.preprocessing}. ${meta.clustering}. All 1,346 unit rasters cover 80 trials; 77 trials have final outcome plus cue/reach/grasp labels, and 63 have finite at-mouth timing.`))));main.append(lower);
    }

    return{vAtlas};
  };
})();
