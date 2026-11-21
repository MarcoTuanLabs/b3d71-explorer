#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({window:{}});
for(const file of ['data/core.js','data/population_state_atlas.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}

const atlas=context.window.POPULATION_STATE_ATLAS;
const units=context.window.UNITS;
const W=1900,H=2050;
const eventOrder=atlas.meta.events;
const labels=atlas.meta.eventLabels;
const eventColors={baseline:'#566274',cue:'#d45176',reach:'#df8b32',grasp:'#7658ad','at-mouth':'#2f978c'};
const clusterColors=['#4267ac','#df7949','#2e956c','#ad4f70','#7560ad','#b18a2f'];
const areaColors={M2:'#3f7fbf',M1:'#4a9d5b',S1:'#c0504d'};
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const mix=(a,b,t)=>a.map((value,index)=>Math.round(value+(b[index]-value)*t));
const color=values=>`rgb(${values.join(',')})`;
const sequential=value=>color(mix([247,249,252],[43,103,176],clamp(value,0,1)));
const diverging=value=>{const t=clamp((value+1)/2,0,1);return t<.5?color(mix([39,101,173],[248,248,248],t*2)):color(mix([248,248,248],[181,37,55],(t-.5)*2));};
const chunks=[];
const add=value=>chunks.push(value);
const text=(x,y,value,cls='body',extra='')=>add(`<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(value)}</text>`);
const line=(x1,y1,x2,y2,extra='')=>add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`);
const rect=(x,y,w,h,extra='')=>add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`);
const circle=(cx,cy,r,extra='')=>add(`<circle cx="${cx}" cy="${cy}" r="${r}" ${extra}/>`);
const panelTitle=(letter,x,y,title,subtitle)=>{
  text(x,y,letter,'panel-letter');
  text(x+44,y,title,'panel-title');
  if(subtitle)text(x+44,y+31,subtitle,'subtitle');
};
const legend=(items,x,y,gap=150)=>items.forEach(([labelValue,fill],index)=>{
  rect(x+index*gap,y-13,17,17,`rx="2" fill="${fill}"`);
  text(x+index*gap+27,y+1,labelValue,'legend');
});

add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
add(`<style>
  text{font-family:Arial,Helvetica,sans-serif;fill:#202936;letter-spacing:0}
  .title{font-size:34px;font-weight:750}.deck{font-size:17px;fill:#647084}.metric{font-size:18px;font-weight:750}.metric-note{font-size:14px;fill:#68758a}
  .panel-letter{font-size:28px;font-weight:800}.panel-title{font-size:23px;font-weight:750}.subtitle{font-size:14px;fill:#69768a}
  .body{font-size:15px}.small{font-size:13px;fill:#647084}.tiny{font-size:11px;fill:#647084}.axis{font-size:13px;fill:#586579}.legend{font-size:14px;font-weight:650}
  .matrix-label{font-size:13px;font-weight:650}.matrix-value{font-size:14px;font-weight:750}.cluster-label{font-size:15px;font-weight:800}
  .method{font-size:14px;fill:#536176}.rule{stroke:#c8ced8;stroke-width:1}.grid{stroke:#e7eaf0;stroke-width:1}
</style>`);
rect(0,0,W,H,'fill="#fff"');

text(70,60,'Population-state atlas of trial-event neural activity','title');
text(70,92,'A transcriptomics-inspired sample × unit view: 250 ms trial-event states are observations; recorded units are features.','deck');
line(70,113,1830,113,'class="rule"');
const metrics=[
  [atlas.meta.nObservations,'trial-event states'],[atlas.meta.nLabeledTrials,'labeled trials'],[atlas.meta.nUnits,'recorded units'],
  [atlas.meta.nVariableUnits,'variable units'],[atlas.clusters.length,'Leiden communities'],[(100*atlas.meta.eventBalancedAccuracy).toFixed(1)+'%','trial-held-out accuracy']
];
metrics.forEach(([value,labelValue],index)=>{
  const x=85+index*292;text(x,143,value,'metric');text(x,166,labelValue,'metric-note');
});

// A: UMAP state map.
const a={x:70,y:215,w:1090,h:685};
panelTitle('a',a.x,a.y,'Trial-event population-state map','UMAP is a display of the 30-PC neighbor geometry; event labels are not inputs to the embedding.');
legend(eventOrder.map(event=>[labels[event],eventColors[event]]),a.x+45,a.y+68,177);
const ap={l:a.x+75,r:a.x+a.w-22,t:a.y+105,b:a.y+a.h-55};
const xs=atlas.observations.map(item=>item.umap[0]),ys=atlas.observations.map(item=>item.umap[1]);
let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
const xmargin=(xmax-xmin)*.07,ymargin=(ymax-ymin)*.07;xmin-=xmargin;xmax+=xmargin;ymin-=ymargin;ymax+=ymargin;
const sx=value=>ap.l+(value-xmin)/(xmax-xmin)*(ap.r-ap.l);
const sy=value=>ap.b-(value-ymin)/(ymax-ymin)*(ap.b-ap.t);
line(ap.l,ap.b,ap.r,ap.b,'stroke="#aeb7c5" stroke-width="1.2"');
line(ap.l,ap.t,ap.l,ap.b,'stroke="#aeb7c5" stroke-width="1.2"');
for(const item of atlas.observations)circle(sx(item.umap[0]),sy(item.umap[1]),4.2,`fill="${eventColors[item.event]}" fill-opacity="0.74" stroke="#fff" stroke-width="0.7"`);
for(const cluster of atlas.clusters){
  circle(sx(cluster.centroid[0]),sy(cluster.centroid[1]),17,`fill="${clusterColors[cluster.id-1]}" stroke="#202936" stroke-width="1.2"`);
  text(sx(cluster.centroid[0]),sy(cluster.centroid[1])+5,'C'+cluster.id,'cluster-label','text-anchor="middle" fill="#fff"');
}
text((ap.l+ap.r)/2,a.y+a.h-17,'UMAP 1','axis','text-anchor="middle"');
text(a.x+17,(ap.t+ap.b)/2,'UMAP 2','axis',`text-anchor="middle" transform="rotate(-90 ${a.x+17} ${(ap.t+ap.b)/2})"`);

// B: Leiden community composition.
const b={x:1210,y:215,w:620,h:685};
panelTitle('b',b.x,b.y,'Community composition','Leiden on the high-dimensional fuzzy k-nearest-neighbor graph.');
const bp={l:b.x+105,r:b.x+b.w-25,t:b.y+105,b:b.y+b.h-95};
for(const tick of [0,25,50,75,100]){
  const x=bp.l+(bp.r-bp.l)*tick/100;line(x,bp.t,x,bp.b,'class="grid"');text(x,bp.b+25,tick+'%','axis','text-anchor="middle"');
}
const rowH=(bp.b-bp.t)/atlas.clusters.length;
atlas.clusters.forEach((cluster,row)=>{
  const y=bp.t+row*rowH+18;let x=bp.l;
  text(bp.l-16,y+23,'C'+cluster.id,'cluster-label',`text-anchor="end" fill="${clusterColors[cluster.id-1]}"`);
  text(bp.l-16,y+42,'n='+cluster.n,'tiny','text-anchor="end"');
  for(const event of eventOrder){
    const count=cluster.eventCounts[event],width=(bp.r-bp.l)*count/cluster.n;if(!count)continue;
    rect(x,y,width,45,`fill="${eventColors[event]}"`);
    if(width>44)text(x+width/2,y+28,Math.round(100*count/cluster.n)+'%','matrix-value','text-anchor="middle" fill="#fff"');
    x+=width;
  }
});
legend(eventOrder.map(event=>[labels[event],eventColors[event]]),b.x+45,b.y+b.h-31,108);

function matrixPanel(letter,x,y,w,h,titleValue,subtitleValue,values,rowLabels,colLabels,opts={}){
  panelTitle(letter,x,y,titleValue,subtitleValue);
  const p={l:x+103,r:x+w-30,t:y+88,b:y+h-70};
  const rows=values.length,cols=values[0].length,cw=(p.r-p.l)/cols,ch=(p.b-p.t)/rows;
  const min=opts.min??0,max=opts.max??1;
  values.forEach((row,rowIndex)=>row.forEach((value,colIndex)=>{
    const t=(value-min)/((max-min)||1),fill=opts.diverging?diverging(value):sequential(t);
    rect(p.l+colIndex*cw,p.t+rowIndex*ch,cw+.2,ch+.2,`fill="${fill}" stroke="#fff" stroke-width="1.5"`);
    const bright=opts.diverging?Math.abs(value)>.42:t>.47;
    text(p.l+(colIndex+.5)*cw,p.t+(rowIndex+.5)*ch+5,opts.format(value),'matrix-value',`text-anchor="middle" fill="${bright?'#fff':'#263143'}"`);
  }));
  rowLabels.forEach((labelValue,index)=>text(p.l-11,p.t+(index+.5)*ch+5,labelValue,'matrix-label','text-anchor="end"'));
  colLabels.forEach((labelValue,index)=>text(p.l+(index+.5)*cw,p.t-15,labelValue,'matrix-label','text-anchor="middle"'));
  if(opts.xLabel)text((p.l+p.r)/2,y+h-22,opts.xLabel,'axis','text-anchor="middle"');
  if(opts.yLabel)text(x+20,(p.t+p.b)/2,opts.yLabel,'axis',`text-anchor="middle" transform="rotate(-90 ${x+20} ${(p.t+p.b)/2})"`);
}

const y2=960,pw=550,ph=470;
matrixPanel('c',70,y2,pw,ph,'Event pseudobulk similarity','Pearson r between mean 500-unit standardized signatures.',atlas.eventSimilarity,eventOrder.map(event=>labels[event]),eventOrder.map(event=>labels[event]),{diverging:true,min:-1,max:1,format:value=>value.toFixed(2),xLabel:'event signature',yLabel:'event signature'});
matrixPanel('d',675,y2,pw,ph,'Held-out event decoding',`5-fold GroupKFold by trial; balanced accuracy ${(100*atlas.meta.eventBalancedAccuracy).toFixed(1)}%.`,atlas.eventConfusion,eventOrder.map(event=>labels[event]),eventOrder.map(event=>labels[event]),{min:0,max:1,format:value=>Math.round(value*100)+'%',xLabel:'predicted event',yLabel:'observed event'});
const regionalMax=Math.max(...atlas.regionalSignatures.flat());
matrixPanel('e',1280,y2,550,ph,'Regional signature amplitude','Mean absolute event-centroid z per selected unit.',atlas.regionalSignatures,eventOrder.map(event=>labels[event]),['M2','M1','S1'],{min:0,max:regionalMax,format:value=>value.toFixed(2),xLabel:'recording area',yLabel:'event'});

// F: marker-unit atlas.
const f={x:70,y:1510,w:1760,h:440};
panelTitle('f',f.x,f.y,'Community marker-unit atlas','Cluster-minus-rest standardized square-root firing-rate effects; marker labels are descriptive, not molecular.');
const fp={l:f.x+95,r:f.x+f.w-30,t:f.y+125,b:f.y+f.h-76};
const markerIds=atlas.markerUnitIds,markerValues=atlas.markerHeatmap;
const mcw=(fp.r-fp.l)/markerIds.length,mch=(fp.b-fp.t)/markerValues.length,limit=Math.max(1.5,...markerValues.flat().map(Math.abs));
markerIds.forEach((unitId,index)=>{
  const x=fp.l+index*mcw;
  rect(x,fp.t-31,mcw+.2,8,`fill="${areaColors[units[unitId].area]}"`);
  text(x+mcw*.62,fp.t-38,'U'+unitId,'tiny',`text-anchor="start" transform="rotate(-56 ${x+mcw*.62} ${fp.t-38})"`);
});
markerValues.forEach((row,rowIndex)=>row.forEach((value,colIndex)=>{
  rect(fp.l+colIndex*mcw,fp.t+rowIndex*mch,mcw+.3,mch+.3,`fill="${diverging(value/limit)}" stroke="#fff" stroke-width="1"`);
}));
markerValues.forEach((_,index)=>text(fp.l-17,fp.t+(index+.5)*mch+6,'C'+(index+1),'cluster-label',`text-anchor="end" fill="${clusterColors[index]}"`));
text((fp.l+fp.r)/2,f.y+f.h-25,'top five unique positive marker units per community · column strip denotes M2, M1, or S1','axis','text-anchor="middle"');
legend([['M2',areaColors.M2],['M1',areaColors.M1],['S1',areaColors.S1]],f.x+f.w-385,f.y+55,105);

line(70,1982,1830,1982,'class="rule"');
text(70,2010,'Methods: 250 ms event windows; square-root rates; 500 variable units; feature z-score; 30 PCs; UMAP (20 neighbors, min_dist 0.20); Leiden resolution 0.55.','method');
text(70,2034,'Inference boundary: this supports a within-recording atlas of recurrent population states. It does not establish molecular cell types, cross-session stability, or causal marker-unit roles.','method');
add('</svg>');

const target=path.join(root,'exports','population_state_atlas.svg');
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,chunks.join('\n'));
console.log(target);
