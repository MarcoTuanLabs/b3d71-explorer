#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({window:{}});
const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

for(const file of ['data/core.js','data/population_state_atlas.js','data/population_state_atlas_views.js'])load(file);

const units=context.window.UNITS;
const atlas=context.window.POPULATION_STATE_ATLAS;
assert(units.length===1346,'Expected the complete 1,346-unit cohort');
assert(atlas.meta.nUnits===units.length,'Atlas unit count does not match core data');
assert(atlas.meta.nTrials===80&&atlas.meta.nLabeledTrials===77,'Atlas trial coverage is incorrect');
assert(atlas.observations.length===atlas.meta.nObservations&&atlas.observations.length===371,'Unexpected number of trial-event states');
assert(atlas.meta.nVariableUnits===500,'Unexpected variable-unit feature count');
assert(atlas.clusters.length>=3,'Population atlas should contain multiple Leiden communities');
assert(atlas.meta.eventBalancedAccuracy>atlas.meta.eventChance,'Held-out event decoding does not exceed chance');

const events=atlas.meta.events;
assert(events.length===5,'Expected five event-state labels');
assert(atlas.eventSimilarity.length===events.length&&atlas.eventSimilarity.every(row=>row.length===events.length),'Event similarity matrix has the wrong dimensions');
assert(atlas.eventConfusion.length===events.length&&atlas.eventConfusion.every(row=>row.length===events.length),'Event confusion matrix has the wrong dimensions');
assert(atlas.regionalSignatures.length===events.length&&atlas.regionalSignatures.every(row=>row.length===3),'Regional signature matrix has the wrong dimensions');
assert(atlas.eventConfusion.every(row=>Math.abs(row.reduce((sum,value)=>sum+value,0)-1)<1e-3),'Confusion matrix rows must sum to one');
assert(atlas.observations.every(item=>item.umap.length===2&&item.umap.every(Number.isFinite)),'UMAP coordinates contain a non-finite value');
assert(atlas.observations.every(item=>atlas.clusters.some(cluster=>cluster.id===item.cluster)),'Observation references an unknown community');

const clusterTotal=atlas.clusters.reduce((sum,cluster)=>sum+cluster.n,0);
assert(clusterTotal===atlas.observations.length,'Community sizes do not cover every observation');
for(const cluster of atlas.clusters){
  assert(Object.values(cluster.eventCounts).reduce((sum,value)=>sum+value,0)===cluster.n,`Community ${cluster.id} event counts do not sum to n`);
  assert(Object.values(cluster.outcomeCounts).reduce((sum,value)=>sum+value,0)===cluster.n,`Community ${cluster.id} outcome counts do not sum to n`);
  assert(cluster.markers.length===8,`Community ${cluster.id} does not have eight marker units`);
  assert(cluster.markers.every(marker=>units[marker.unit]&&Number.isFinite(marker.effect)),`Community ${cluster.id} has an invalid marker`);
}

class FakeNode{
  constructor(tag='div'){this.tag=tag;this.children=[];this.attributes={};this.style={};this.className='';this.nodeType=1;}
  append(...items){for(const item of items.flat(Infinity)){if(item==null||item===false)continue;this.children.push(item instanceof FakeNode?item:new FakeNode('#text'));}}
  addEventListener(){}
  setAttribute(key,value){this.attributes[key]=String(value);}
}
function h(tag,attrs,...children){const node=new FakeNode(tag);for(const [key,value] of Object.entries(attrs||{})){if(key==='class')node.className=value;else if(key==='style'&&typeof value==='object')Object.assign(node.style,value);else node.attributes[key]=value;}node.append(...children);return node;}
function s(tag,attrs={}){const node=new FakeNode(tag);node.attributes={...attrs};return node;}
function stext(x,y,value,attrs={}){const node=s('text',{x,y,...attrs});node.append(value);return node;}
function svgEl(width,height){return s('svg',{viewBox:`0 0 ${width} ${height}`});}
function assertTree(node,label){
  for(const [key,value] of Object.entries(node.attributes||{}))assert(!/NaN|Infinity/.test(String(value)),`${label} contains ${key}=${value}`);
  node.children.forEach(child=>assertTree(child,label));
}

const state={atlasColor:'event',atlasCluster:atlas.clusters[0].id};
const views=context.window.createPopulationStateAtlas({
  h,s,stext,svgEl,showTip:()=>{},on:node=>node,
  AC:{M2:'#3f7fbf',M1:'#4a9d5b',S1:'#c0504d'},UNITS:units,state,render:()=>{},selectUnit:()=>{}
});
assert(views&&typeof views.vAtlas==='function','Population-state atlas plugin did not initialize');
const main=new FakeNode('main');
views.vAtlas(main);
assert(main.children.length>=6,'Population-state atlas rendered too little content');
assertTree(main,'population-state atlas');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const token of ['data/population_state_atlas.js','data/population_state_atlas_views.js',"['stateatlas','Population-state atlas'",'stateatlas:STATEATLAS?STATEATLAS.vAtlas'])assert(html.includes(token),`Website is missing ${token}`);
assert(!html.includes('PROFVIEW.appendPopulationAudit'),'Deleted professor audit is still called by the website');

console.log(`population-state atlas smoke test passed: ${atlas.observations.length} states, ${atlas.clusters.length} communities, ${(100*atlas.meta.eventBalancedAccuracy).toFixed(1)}% balanced accuracy`);
