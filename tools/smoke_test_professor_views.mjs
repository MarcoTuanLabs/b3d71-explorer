import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const raw=read('data/professor.js').trim();
if(!raw.startsWith('window.PROF='))throw new Error('professor.js wrapper is missing');
const prof=JSON.parse(raw.slice('window.PROF='.length).replace(/;$/,''));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

assert(prof.tax.length===109,'expected 109 bins from -0.2 to +2.5 s at 40 Hz');
assert(prof.meta.commonTrialIds.length===48,'expected 48 matched common trials');
assert(prof.meta.teacherDisplayTrialIds.length===30,'expected explicit 30-row teacher display subset');
assert(new Set(prof.meta.commonTrialIds).size===48,'common-trial mapping must be one-to-one');
for(const region of ['joint','m1','m2','s1']){
  const trajectories=prof.aligned[region];
  assert(trajectories.length===80,`${region} must contain 80 trials`);
  assert(trajectories[0].length===109,`${region} must contain 109 time bins`);
  assert(trajectories[0][0].length===3,`${region} must contain three aligned display axes`);
}
for(const region of ['m1','m2','s1']){
  assert(prof.cca[region].crossValidated.length===8,`${region} must contain eight CV canonical correlations`);
  assert(prof.cca[region].crossValidated.every(Number.isFinite),`${region} CV CCA contains non-finite values`);
}
assert(prof.variance.first8.factorSingleMovement<.85,'the documented variance mismatch must remain visible');
assert(prof.variance.first8.factorTrialMeanMovement>.85,'trial-mean variance comparison is missing');
assert(prof.meta.m1CommonFileBytes===0,'M1 common-file caveat changed unexpectedly');

const html=read('index.html'),advanced=read('data/advanced_views.js'),professorViews=read('data/professor_views.js');
assert(html.includes('data/professor.js'),'professor asset is not loaded');
assert(html.includes('Professor workflow · direct PC1/PC2/PC5'),'reference manifold is not labeled as PC axes');
assert(!html.includes('S-map state-space manifold and local forecast'),'removed S-map manifold returned');
assert(!professorViews.includes('Teacher-style S-map population atlas'),'removed S-map atlas graphs returned');
assert(!professorViews.includes('S-map trajectories'),'removed peri-event S-map graphs returned');
assert(advanced.includes('Spatial readout map for stored component'),'factor spatial map is missing');

console.log('professor reconstruction smoke test passed');
