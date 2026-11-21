#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({window:{}});
const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

for(const file of ['data/core.js','data/pop.js','data/figure12.js','data/figure_reconstruction.js'])load(file);

const units=context.window.UNITS;
const figure=context.window.FIGURE12;
assert(units.length===1346,'Expected the complete 1,346-unit cohort');
assert(figure.meta.nUnits===units.length,'Figure metadata unit count does not match core data');
assert(JSON.stringify(figure.meta.fullTrialCueRelative)===JSON.stringify([-5,20]),'Full-trial cue-relative window must be -5 to +20 s');
assert(JSON.stringify(figure.meta.baselineCueRelative)===JSON.stringify([-5,0]),'Baseline cue-relative window must be -5 to 0 s');
assert(figure.tax.length>200&&figure.tax.every(Number.isFinite),'Figure trace axis is missing or invalid');

const scopes=['All','M2','M1','S1'];
const functions=['Cue-excited','Cue-suppressed','Unmodulated'];
for(const scope of scopes){
  const expected=scope==='All'?units.length:units.filter(unit=>unit.area===scope).length;
  const observed=functions.reduce((sum,func)=>sum+figure.classDelta[scope][func].n,0);
  assert(observed===expected,`${scope} functional traces do not partition the cohort`);
  for(const func of functions){
    const values=figure.classDelta[scope][func].values;
    assert(values.length===figure.tax.length,`${scope} ${func} trace length is misaligned`);
    assert(values.every(Number.isFinite),`${scope} ${func} trace contains a non-finite value`);
  }
}

for(const area of ['M2','M1','S1'])for(const cls of ['Broad','Fast/Narrow']){
  const expected=units.filter(unit=>unit.area===area&&unit.cls===cls).length;
  const series=figure.waveformDelta[area][cls];
  assert(series.n===expected,`${area} ${cls} waveform trace has the wrong denominator`);
  assert(series.values.length===figure.tax.length&&series.values.every(Number.isFinite),`${area} ${cls} waveform trace is invalid`);
}

assert(figure.peakTimeSec.length===units.length,'Peak-time vector must contain one value per unit');
assert(figure.peakTimeSec.every(value=>Number.isFinite(value)&&value>=-1&&value<=4),'Peak time escaped the requested -1 to +4 s window');

for(const file of ['exports/figure1_firing_rate_population.svg','exports/figure2_waveform_latency.svg']){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const coordinateSource=source.replace(/data:image\/png;base64,[^"]+/g,'');
  assert(source.startsWith('<svg')||source.startsWith('<?xml'),'Export is not an SVG: '+file);
  assert(!/NaN|Infinity/.test(coordinateSource),'Export contains a non-finite coordinate: '+file);
  assert(/>A<|>A\s*</.test(source)&&/>B<|>B\s*</.test(source),'Export is missing panel labels: '+file);
}

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pluginSource=fs.readFileSync(path.join(root,'data/figure_reconstruction.js'),'utf8');
const builderSource=fs.readFileSync(path.join(root,'tools/build_requested_figures.mjs'),'utf8');
const professorSource=fs.readFileSync(path.join(root,'data/professor_views.js'),'utf8');
for(const token of ['data/figure12.js','data/figure_reconstruction.js','Figure reconstruction'])assert(html.includes(token),`Website is missing ${token}`);
for(const token of ['figure1_firing_rate_population.svg','figure2_waveform_latency.svg'])assert(pluginSource.includes(token),`Website is missing ${token}`);
assert(!pluginSource.includes('Math.min(.9')&&!builderSource.includes('yDomain:[0,.9]'),'Waveform-ratio plot still clips the observed 2.029 outlier');
assert(html.includes('.waveform-c,.waveform-d{grid-column:1/-1}'),'Figure 2C and 2D must span the combined A+B width');
assert(pluginSource.indexOf("'Fast / narrow'" )<pluginSource.indexOf("'Slow / broad'"),'Figure 2A overlays must align fast/red on the left and broad/blue on the right');
for(const token of ['horizontal cutoff','PSTH peak-latency distribution','waveform-class-overlays'])assert(pluginSource.includes(token),`Figure plugin is missing ${token}`);
assert(builderSource.includes('latencyBandChart')&&builderSource.includes('1540,900'),'SVG Figure 2C is not the full-width class-separated latency panel');
assert(professorSource.includes('trial-by-time heatmap plus population mean')&&professorSource.includes('eventActivitySection'),'Regional activation heatmaps were not restored');

class FakeNode{
  constructor(tag='div',text=''){this.tag=tag;this.text=text;this.children=[];this.attributes={};this.style={};this.className='';this.nodeType=1;}
  append(...items){for(const item of items.flat(Infinity)){if(item==null||item===false)continue;this.children.push(item instanceof FakeNode?item:new FakeNode('#text',String(item)));}}
  addEventListener(){}
  setAttribute(key,value){this.attributes[key]=String(value);}
  get lastChild(){return this.children[this.children.length-1]||null;}
}
function h(tag,attrs,...children){const node=new FakeNode(tag);for(const [key,value] of Object.entries(attrs||{})){if(key==='class')node.className=value;else if(key==='style'&&typeof value==='object')Object.assign(node.style,value);else node.attributes[key]=value;}node.append(...children);return node;}
function s(tag,attrs={}){const node=new FakeNode(tag);node.attributes={...attrs};return node;}
function stext(x,y,value,attrs={}){const node=s('text',{x,y,...attrs});node.append(value);return node;}
function svgEl(width,height){return s('svg',{viewBox:`0 0 ${width} ${height}`});}
function axes(svg,pad,width,height,xRange,yRange){
  return{
    sx:value=>pad.l+(value-xRange[0])/((xRange[1]-xRange[0])||1)*(width-pad.l-pad.r),
    sy:value=>height-pad.b-(value-yRange[0])/((yRange[1]-yRange[0])||1)*(height-pad.t-pad.b)
  };
}
const api={
  h,s,stext,svgEl,axes,
  legend:()=>h('div'),wfOverlay:()=>h('svg'),scatterChart:()=>h('svg'),popHeatmap:()=>h('canvas'),
  showTip:()=>{},on:()=>{},selectUnit:()=>{},
  AC:{M2:'#3f7fbf',M1:'#4a9d5b',S1:'#c0504d'},
  CC:{Broad:'#4c72b0','Fast/Narrow':'#c15b7a'},
  UNITS:units,POP:context.window.POP,FIG12:figure
};
const views=context.window.createFigureReconstruction(api);
assert(views,'Figure reconstruction plugin did not initialize');

function assertTree(node,label){
  for(const [key,value] of Object.entries(node.attributes||{}))assert(!/NaN|Infinity/.test(String(value)),`${label} contains ${key}=${value}`);
  node.children.forEach(child=>assertTree(child,label));
}
for(const [name,render] of [['firing',views.vFiring],['waveform',views.vWaveform],['reconstruction',views.vReconstruction]]){
  const main=new FakeNode('main');render(main);assert(main.children.length>0,`${name} view rendered no content`);assertTree(main,name);
}
const raster=views.populationRasterPanels();
assert(raster&&raster.children.length>0,'Population raster panel rendered no content');
assertTree(raster,'population rasters');

console.log('requested Figure 1/2 smoke test passed');
