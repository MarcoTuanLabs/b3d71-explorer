#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const removedToken of ['Linked state-dependent S-map explorer','edmLinkedExplorer','data-edm-canvas','corrMatForTrials','Area-pair coupling · success vs fail','edmCoefficientHeatmap','appendSmapAtlas(m)','Directed S-map coefficient trajectories','Regional population activation']){
  if(indexSource.includes(removedToken))throw new Error(`Removed linked S-map explorer token is still present: ${removedToken}`);
}
for(const requiredToken of ['M1/M2/S1 S-map coefficients','Six cross-region coefficients','edmCoefficientTable']){
  if(!indexSource.includes(requiredToken))throw new Error(`Numeric S-map coefficient section is missing: ${requiredToken}`);
}
const context={window:{}};
vm.createContext(context);
for(const file of ['data/core.js','data/pop.js','data/castle.js','data/analysis.js','data/advanced_views.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}

class FakeNode{
  constructor(tag='div',text=''){this.tag=tag;this.text=text;this.children=[];this.parentNode=null;this.style={};this.attributes={};this.className='';this.nodeType=1;this.innerHTML='';}
  append(...items){for(const item of items.flat(Infinity)){if(item==null||item===false)continue;const child=item instanceof FakeNode?item:new FakeNode('#text',String(item));child.parentNode=this;this.children.push(child);}}
  appendChild(item){this.append(item);return item;}
  setAttribute(key,value){this.attributes[key]=String(value);}
  addEventListener(){}
  replaceWith(node){if(!this.parentNode)return;const index=this.parentNode.children.indexOf(this);if(index>=0){node.parentNode=this.parentNode;this.parentNode.children[index]=node;}}
  get lastChild(){return this.children[this.children.length-1]||null;}
  querySelector(){return new FakeNode();}
  insertBefore(node){this.append(node);return node;}
}

function h(tag,attrs,...kids){const node=new FakeNode(tag);for(const [key,value] of Object.entries(attrs||{})){if(value==null)continue;if(key==='class')node.className=value;else if(key==='style'&&typeof value==='object')Object.assign(node.style,value);else node.attributes[key]=value;}node.append(...kids);return node;}
function s(tag,attrs){const node=new FakeNode(tag);for(const [key,value] of Object.entries(attrs||{}))node.attributes[key]=value;return node;}
function stext(x,y,text,attrs){const node=s('text',{x,y,...(attrs||{})});node.append(text);return node;}
function svgEl(width,height){return s('svg',{viewBox:`0 0 ${width} ${height}`});}
function axes(svg,pad,width,height,xRange,yRange){return{sx:value=>pad.l+(value-xRange[0])/((xRange[1]-xRange[0])||1)*(width-pad.l-pad.r),sy:value=>height-pad.b-(value-yRange[0])/((yRange[1]-yRange[0])||1)*(height-pad.t-pad.b)};}
const lineChart=()=>h('div');
const legend=()=>h('div');
const areaChip=area=>h('span',{},area);
const on=(node)=>node;
const tks=(a,b,n)=>Array.from({length:n+1},(_,index)=>a+(b-a)*index/n);
const median=values=>{const sorted=values.slice().sort((a,b)=>a-b),middle=sorted.length>>1;return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const vividDiverging=value=>`rgb(${Math.round(255*value)},120,${Math.round(255*(1-value))})`;
const state={view:'castle',castleArea:'all',castleCell:'all',castlePhase:3,castleMetric:'recruitment',castleMinRate:1,castleReliability:.75,castleStat:'median',castleTransition:'probability',castlePanel:'neurons',inspectUnit:204,contribAlign:'cue',contribFactor:0,contribPhase:3,contribCount:15,contribPanel:'unit'};
const api={h,s,stext,svgEl,axes,lineChart,legend,groupedBars:()=>h('div'),areaChip,showTip:()=>{},moveTip:()=>{},hideTip:()=>{},on,tks,fmt:value=>String(value),median,viridis:()=>'',vividDiverging,AC:{M1:'#4a9d5b',M2:'#3f7fbf',S1:'#c0504d'},FC:{},CELL_COLOR:{fast:'#f02b75',slow:'#006fe6','up-down':'#e3a21a'},UNITS:context.window.UNITS,POP:context.window.POP,CASTLE:context.window.CASTLE,ANALYSIS:context.window.ANALYSIS,state,loadUnit:()=>{},selectUnit:()=>{},go:()=>{},render:()=>{}};
const views=context.window.createAdvancedViews(api);

function assertFiniteTree(node,label){
  for(const [key,value] of Object.entries(node.attributes||{})){
    if(/NaN|Infinity/.test(String(value)))throw new Error(`${label}: non-finite ${key}=${value}`);
  }
  node.children.forEach(child=>assertFiniteTree(child,label));
}

function findNode(node,predicate){
  if(predicate(node))return node;
  for(const child of node.children){const match=findNode(child,predicate);if(match)return match;}
  return null;
}

function collectText(node){
  if(node.tag==='#text')return node.text;
  return node.children.map(collectText).join(' ');
}

function serializeNode(node){
  const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  if(node.tag==='#text')return escape(node.text);
  const entries=Object.entries(node.attributes||{}).filter(([,value])=>typeof value!=='function'&&value!=null);
  if(node.className&&!entries.some(([key])=>key==='class'))entries.push(['class',node.className]);
  const style=Object.entries(node.style||{}).filter(([,value])=>value!=null&&value!=='').map(([key,value])=>`${key.replace(/[A-Z]/g,match=>'-'+match.toLowerCase())}:${value}`).join(';');
  if(style)entries.push(['style',style]);
  const attrs=entries.map(([key,value])=>` ${key}="${escape(value)}"`).join('');
  return `<${node.tag}${attrs}>${node.children.map(serializeNode).join('')}</${node.tag}>`;
}

for(const metric of ['recruitment','difference','rate','selectivity','stable']){
  for(let phase=0;phase<5;phase++){
    state.view='castle';state.castlePanel='neurons';state.castleMetric=metric;state.castlePhase=phase;
    const rootNode=new FakeNode('main');views.vCastle(rootNode);
    if(!rootNode.children.length)throw new Error(`CASTLE rendered no content for ${metric}, phase ${phase}`);
    assertFiniteTree(rootNode,`CASTLE neuron ${metric}, phase ${phase}`);
  }
}

state.view='castle';state.castlePanel='behavior';
const removedBehaviorRoot=new FakeNode('main');views.vCastle(removedBehaviorRoot);
const removedBehaviorText=collectText(removedBehaviorRoot);
if(state.castlePanel!=='neurons'||removedBehaviorText.includes('Behavior states')||removedBehaviorText.includes('Behavioral occupancy and timing')||removedBehaviorText.includes('State transitions'))throw new Error('Removed CASTLE behavior-state explorer is still reachable');

state.view='castle';state.castlePanel='compare';
const removedCompareRoot=new FakeNode('main');views.vCastle(removedCompareRoot);
const removedCompareText=collectText(removedCompareRoot);
if(state.castlePanel!=='neurons'||removedCompareText.includes('Population comparison')||removedCompareText.includes('Dynamic versus typical readout rank'))throw new Error('Removed CASTLE population comparison is still reachable');

for(const unit of [204,309]){
  for(const factor of [0,1,2,37]){
    for(const panel of ['unit','factor']){
      state.view='contrib';state.contribPanel=panel;state.inspectUnit=unit;state.contribFactor=factor;
      const rootNode=new FakeNode('main');views.vContrib(rootNode);
      if(!rootNode.children.length)throw new Error(`Contribution rendered no content for ${panel}, unit ${unit}, factor ${factor}`);
      assertFiniteTree(rootNode,`Contribution ${panel}, unit ${unit}, factor ${factor}`);
    }
  }
}

for(const unit of [204,309]){
  for(let phase=0;phase<5;phase++){
    state.view='contrib';state.contribPanel='unit';state.inspectUnit=unit;state.contribPhase=phase;
    const rootNode=new FakeNode('main');views.vContrib(rootNode);
    assertFiniteTree(rootNode,`Dynamic contribution unit ${unit}, phase ${phase}`);
    const toolbar=findNode(rootNode,node=>node.className==='analysis-toolbar');
    const toolbarText=collectText(toolbar);
    if(toolbarText.includes('Latent factor'))throw new Error('Selected-unit toolbar unexpectedly contains a latent-factor control');
    const contributionText=collectText(rootNode);
    if(!contributionText.includes('Phase drive magnitude'))throw new Error('Dynamic contribution summary is missing');
    for(const removedLabel of ['When is this unit’s latent readout expressed?','Dynamic component share across phases','Open trial-mean linear readout trace','Research reading:','Methods and availability']){
      if(contributionText.includes(removedLabel))throw new Error(`Removed contribution section is still visible: ${removedLabel}`);
    }
  }
}

state.view='contrib';state.contribPanel='factor';state.inspectUnit=204;
const factorControlRoot=new FakeNode('main');views.vContrib(factorControlRoot);
const factorToolbarText=collectText(findNode(factorControlRoot,node=>node.className==='analysis-toolbar'));
if(!factorToolbarText.includes('Latent factor')||!factorToolbarText.includes('CASTLE phase')||!factorToolbarText.includes('Units displayed'))throw new Error('Factor atlas controls are incomplete');
for(const unit of [204,309]){
  for(const factor of [0,37]){
    for(let phase=0;phase<5;phase++){
      state.view='contrib';state.contribPanel='factor';state.inspectUnit=unit;state.contribFactor=factor;state.contribPhase=phase;
      const rootNode=new FakeNode('main');views.vContrib(rootNode);
      assertFiniteTree(rootNode,`Factor atlas unit ${unit}, factor ${factor}, phase ${phase}`);
      const text=collectText(rootNode);
      if(!text.includes(context.window.CASTLE.phases[phase].name)||!text.includes('Factor activity gain')||!text.includes('Selected unit phase share'))throw new Error(`Factor atlas phase summary is incomplete for phase ${phase}`);
      if(!text.includes(`How F${factor+1} enters Unit ${unit}`)||!text.includes('Selected-factor decomposition over time')||!text.includes('Cumulative reconstruction from')||!text.includes('top 8'))throw new Error(`Factor atlas reconstruction graphs are incomplete for unit ${unit}, factor ${factor}, phase ${phase}`);
      if(!text.includes(`Observed firing and F${factor+1} phase-expressed readout map`)||!text.includes(`Unit ${unit} × F${factor+1} across CASTLE phases`)||!text.includes('fixed weight · phase-varying latent activity'))throw new Error(`Factor atlas CASTLE readout map is incomplete for unit ${unit}, factor ${factor}, phase ${phase}`);
    }
  }
}
state.contribPanel='validation';
const removedValidationRoot=new FakeNode('main');views.vContrib(removedValidationRoot);
const removedValidationText=collectText(removedValidationRoot);
if(state.contribPanel!=='unit'||removedValidationText.includes('Behavior and validation')||removedValidationText.includes('Descriptive robustness'))throw new Error('Removed contribution validation mode is still reachable');

const castle=context.window.CASTLE;
if(castle.phaseFactorAbs.length!==5||castle.phaseFactorAbs[0].length!==38||castle.phaseFactorAbsSe.length!==5||castle.phaseFactorAbsSe[0].length!==38)throw new Error('Unexpected phase-factor dynamic dimensions');
if(castle.phaseDriveAbs.length!==5||castle.phaseDriveAbs[0].length!==1346)throw new Error('Unexpected phase-drive dynamic dimensions');
const dynamicFrames=castle.phaseFactorFrames,totalDynamicFrames=dynamicFrames.reduce((sum,value)=>sum+value,0);
for(let phase=0;phase<castle.phases.length;phase++){
  if(!(dynamicFrames[phase]>0))throw new Error(`CASTLE phase ${phase} has no matched frames`);
  for(let factor=0;factor<castle.factorAbsAll.length;factor++){
    const activity=castle.phaseFactorAbs[phase][factor],se=castle.phaseFactorAbsSe[phase][factor];
    if(!Number.isFinite(activity)||activity<0||!Number.isFinite(se)||se<0)throw new Error(`Invalid factor-activity scale at phase ${phase}, factor ${factor}`);
  }
}
for(let factor=0;factor<castle.factorAbsAll.length;factor++){
  const weighted=dynamicFrames.reduce((sum,frames,phase)=>sum+frames*castle.phaseFactorAbs[phase][factor],0)/totalDynamicFrames;
  if(Math.abs(weighted-castle.factorAbsAll[factor])>2e-5)throw new Error(`All-phase factor-activity mismatch for factor ${factor}`);
}
for(let unit=0;unit<castle.units.length;unit++){
  if(castle.units[unit].phaseRate.some(value=>!Number.isFinite(value)||value<0))throw new Error(`Invalid observed phase firing rate for unit ${unit}`);
  const weighted=dynamicFrames.reduce((sum,frames,phase)=>sum+frames*castle.phaseDriveAbs[phase][unit],0)/totalDynamicFrames;
  if(Math.abs(weighted-castle.driveAbsAll[unit])>2e-5)throw new Error(`All-phase drive mismatch for unit ${unit}`);
  for(let phase=0;phase<castle.phases.length;phase++){
    const components=castle.units[unit].mpc.map((weight,factor)=>Math.abs(weight)*castle.phaseFactorAbs[phase][factor]),total=components.reduce((sum,value)=>sum+value,0);
    if(!Number.isFinite(total)||total<=0)throw new Error(`Invalid component scale for unit ${unit}, phase ${phase}`);
    const shares=components.map(value=>100*value/total),shareTotal=shares.reduce((sum,value)=>sum+value,0);
    if(shares.some(value=>!Number.isFinite(value)||value<0||value>100)||Math.abs(shareTotal-100)>1e-8)throw new Error(`Invalid component shares for unit ${unit}, phase ${phase}`);
  }
}

const edm=context.window.ANALYSIS.edm;
if(edm.coefficients.length!==80||edm.coefficients[0].length!==119||edm.coefficients[0][0].length!==6)throw new Error('Unexpected S-map coefficient dimensions');
if('localModels' in edm||'localModelLayout' in edm)throw new Error('Removed linked S-map explorer payload is still present');
if(edm.predictionSkillR.some(value=>!Number.isFinite(value)))throw new Error('Non-finite S-map forecast skill');

const mapOutputIndex=process.argv.indexOf('--map-svg');
if(mapOutputIndex>=0){
  state.view='castle';state.castlePanel='neurons';state.castleMetric='recruitment';state.castlePhase=3;
  const rootNode=new FakeNode('main');views.vCastle(rootNode);
  const mapSvg=findNode(rootNode,node=>node.tag==='svg'&&node.attributes.viewBox==='0 0 900 470');
  if(!mapSvg)throw new Error('CASTLE recruitment-map SVG was not found');
  mapSvg.attributes.xmlns='http://www.w3.org/2000/svg';mapSvg.attributes.width='900';mapSvg.attributes.height='470';
  fs.writeFileSync(process.argv[mapOutputIndex+1],serializeNode(mapSvg));
}

const previewOutputIndex=process.argv.indexOf('--preview-dir');
if(previewOutputIndex>=0){
  const destination=process.argv[previewOutputIndex+1],sourceHtml=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=sourceHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
  fs.mkdirSync(destination,{recursive:true});
  const previews=[
    ['castle-neurons','castle','neurons','recruitment',3],
    ['castle-behavior','castle','behavior','recruitment',3],
    ['contrib-unit','contrib','unit',0,204],
    ['contrib-factor','contrib','factor',0,204],
  ];
  for(const [name,view,panel,metricOrFactor,phaseOrUnit] of previews){
    const page=new FakeNode('div');page.className='page';
    if(view==='castle'){state.view='castle';state.castlePanel=panel;state.castleMetric=metricOrFactor;state.castlePhase=phaseOrUnit;views.vCastle(page);}
    else{state.view='contrib';state.contribPanel=panel;state.contribFactor=metricOrFactor;state.inspectUnit=phaseOrUnit;views.vContrib(page);}
    const html=`<!doctype html><html><head><meta charset="utf-8"><style>${css}\nbody{display:block;height:auto;overflow:auto}#main{max-width:none}.page{margin:0 auto}</style></head><body><main id="main">${serializeNode(page)}</main></body></html>`;
    fs.writeFileSync(path.join(destination,name+'.html'),html);
  }
}
console.log('advanced view smoke test passed');
