import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const assetDir=path.join(root,'assets','reconstruction_third_draft');
fs.mkdirSync(assetDir,{recursive:true});

function loadScript(file,context){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}

const context=vm.createContext({window:{}});
loadScript('data/core.js',context);
loadScript('data/reference.js',context);
loadScript('data/professor.js',context);
const units=context.window.UNITS;
const referencePopulation=context.window.REFPOP;
const professorPopulation=context.window.PROF;
const details=units.map(unit=>{
  const local=vm.createContext({window:{}});
  loadScript(`data/units/u${unit.id}.js`,local);
  const detail=local.window.UNIT_CACHE[unit.id];
  if(!detail||detail.psth.length!==1000)throw new Error(`Invalid PSTH for unit ${unit.id}`);
  return detail;
});

const N_TRIALS=80;
const BIN_SECONDS=details[0].psthDx;
const PSTH_X0=details[0].psthX0;
const BASELINE=[-5,0];
const POST_CUE=[0,20];
const RESPONSE=[0,3];
const DISPLAY=[-1,5];
const PEAK_LATENCY_WINDOW=[-1,4];
const PEAK_RESPONSE_SEARCH=[0,5];
const PEAK_RESPONSE_WIDTH_SECONDS=1;
const SMOOTH_SIGMA_BINS=2;
const SD_FLOOR_HZ=.05;
const ALPHA=.05;
const DF=N_TRIALS-1;
const T_CRITICAL_95=1.99045;
const WAVE_CLASS={Broad:'Slow / broad','Fast/Narrow':'Fast / narrow'};
const SCOPES=['All','M2','M1','S1'];
const RESPONSE_CLASSES=['Cue-excited','Cue-suppressed','Unmodulated'];
const WAVE_CLASSES=['Broad','Fast/Narrow'];
const AREAS=['M2','M1','S1'];
const EVENT_ALIGNMENT_WINDOW=[-.75,1.5];
const EVENT_KEYS=['cue','reach','grasp','atMouth'];
const EVENT_LABELS={cue:'Cue',reach:'Reach',grasp:'Grasp',atMouth:'At mouth'};
const INFERENCE_WINDOW=[0,2];
const INFERENCE_BIN_SECONDS=.1;
const FIGURE_1_WINDOW=[-1,2];

const center=index=>PSTH_X0+(index+.5)*BIN_SECONDS;
const indicesFor=([start,end])=>{
  const out=[];
  for(let index=0;index<details[0].psth.length;index++){
    const time=center(index);
    if(time>=start&&time<end)out.push(index);
  }
  return out;
};
const baselineIndices=indicesFor(BASELINE);
const postIndices=indicesFor(POST_CUE);
const responseIndices=indicesFor(RESPONSE);
const displayIndices=indicesFor(DISPLAY);
const peakLatencyIndices=indicesFor(PEAK_LATENCY_WINDOW);

function mean(values){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
}

function sampleSd(values,valueMean=mean(values)){
  if(values.length<2)return 0;
  return Math.sqrt(values.reduce((sum,value)=>sum+(value-valueMean)**2,0)/(values.length-1));
}

function rankValues(values){
  const ordered=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value||a.index-b.index);
  const ranks=new Array(values.length);
  for(let start=0;start<ordered.length;){
    let end=start+1;
    while(end<ordered.length&&ordered[end].value===ordered[start].value)end++;
    const rank=(start+end-1)/2;
    for(let index=start;index<end;index++)ranks[ordered[index].index]=rank;
    start=end;
  }
  return ranks;
}

function pearson(valuesA,valuesB){
  if(valuesA.length!==valuesB.length||valuesA.length<2)return 0;
  const meanA=mean(valuesA),meanB=mean(valuesB);
  let numerator=0,sumA=0,sumB=0;
  for(let index=0;index<valuesA.length;index++){
    const centeredA=valuesA[index]-meanA,centeredB=valuesB[index]-meanB;
    numerator+=centeredA*centeredB;
    sumA+=centeredA*centeredA;
    sumB+=centeredB*centeredB;
  }
  return sumA&&sumB?numerator/Math.sqrt(sumA*sumB):0;
}

function percentile(values,fraction){
  const sorted=[...values].sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const position=(sorted.length-1)*fraction;
  const lower=Math.floor(position),upper=Math.ceil(position),mix=position-lower;
  return sorted[lower]+(sorted[upper]-sorted[lower])*mix;
}

function logGamma(value){
  const coefficients=[
    676.5203681218851,-1259.1392167224028,771.3234287776531,
    -176.6150291621406,12.507343278686905,-.13857109526572012,
    9.984369578019572e-6,1.5056327351493116e-7
  ];
  if(value<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*value))-logGamma(1-value);
  let shifted=value-1,sum=.9999999999998099;
  coefficients.forEach((coefficient,index)=>sum+=coefficient/(shifted+index+1));
  const base=shifted+coefficients.length-.5;
  return .5*Math.log(2*Math.PI)+(shifted+.5)*Math.log(base)-base+Math.log(sum);
}

function betaContinuedFraction(a,b,x){
  const maxIterations=200,epsilon=3e-14,tiny=1e-300;
  const qab=a+b,qap=a+1,qam=a-1;
  let c=1,d=1-qab*x/qap;
  if(Math.abs(d)<tiny)d=tiny;
  d=1/d;
  let result=d;
  for(let iteration=1;iteration<=maxIterations;iteration++){
    const even=2*iteration;
    let coefficient=iteration*(b-iteration)*x/((qam+even)*(a+even));
    d=1+coefficient*d;
    if(Math.abs(d)<tiny)d=tiny;
    c=1+coefficient/c;
    if(Math.abs(c)<tiny)c=tiny;
    d=1/d;
    result*=d*c;
    coefficient=-(a+iteration)*(qab+iteration)*x/((a+even)*(qap+even));
    d=1+coefficient*d;
    if(Math.abs(d)<tiny)d=tiny;
    c=1+coefficient/c;
    if(Math.abs(c)<tiny)c=tiny;
    d=1/d;
    const delta=d*c;
    result*=delta;
    if(Math.abs(delta-1)<epsilon)break;
  }
  return result;
}

function regularizedIncompleteBeta(x,a,b){
  if(x<=0)return 0;
  if(x>=1)return 1;
  const front=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
  if(x<(a+1)/(a+b+2))return front*betaContinuedFraction(a,b,x)/a;
  return 1-front*betaContinuedFraction(b,a,1-x)/b;
}

function twoSidedStudentP(t,df){
  if(!Number.isFinite(t))return 0;
  if(t===0)return 1;
  const x=df/(df+t*t);
  return Math.max(0,Math.min(1,regularizedIncompleteBeta(x,df/2,.5)));
}

function benjaminiHochberg(values){
  const ordered=values.map((p,index)=>({p,index})).sort((a,b)=>a.p-b.p);
  const adjusted=new Array(values.length);
  let running=1;
  for(let rank=ordered.length;rank>=1;rank--){
    running=Math.min(running,ordered[rank-1].p*ordered.length/rank);
    adjusted[ordered[rank-1].index]=Math.max(0,Math.min(1,running));
  }
  return adjusted;
}

function gaussian(values,sigmaBins=SMOOTH_SIGMA_BINS){
  const radius=Math.ceil(3*sigmaBins),kernel=[];
  for(let offset=-radius;offset<=radius;offset++)kernel.push(Math.exp(-.5*(offset/sigmaBins)**2));
  return values.map((_,index)=>{
    let total=0,weight=0;
    kernel.forEach((kernelWeight,kernelIndex)=>{
      const source=index+kernelIndex-radius;
      if(source>=0&&source<values.length){
        total+=values[source]*kernelWeight;
        weight+=kernelWeight;
      }
    });
    return weight?total/weight:values[index];
  });
}

const records=units.map((unit,index)=>{
  const detail=details[index];
  const raw=details[index].psth;
  const smooth=gaussian(raw);
  const baselineSmooth=baselineIndices.map(source=>smooth[source]);
  const baselineCounts=new Array(N_TRIALS).fill(0);
  const responseCounts=new Array(N_TRIALS).fill(0);
  detail.raster.t.forEach((time,spikeIndex)=>{
    const trial=detail.raster.tr[spikeIndex];
    if(trial<0||trial>=N_TRIALS)throw new Error(`Invalid trial ${trial} for unit ${unit.id}`);
    if(time>=BASELINE[0]&&time<BASELINE[1])baselineCounts[trial]++;
    if(time>=RESPONSE[0]&&time<RESPONSE[1])responseCounts[trial]++;
  });
  const baselineRates=baselineCounts.map(count=>count/(BASELINE[1]-BASELINE[0]));
  const responseRates=responseCounts.map(count=>count/(RESPONSE[1]-RESPONSE[0]));
  const differences=responseRates.map((value,trial)=>value-baselineRates[trial]);
  const baselineHz=mean(baselineRates);
  const postHz=mean(postIndices.map(source=>raw[source]));
  const responseHz=mean(responseRates);
  const cueDelta=mean(differences);
  const differenceSd=sampleSd(differences,cueDelta);
  const standardError=differenceSd/Math.sqrt(N_TRIALS);
  const tStatistic=standardError?cueDelta/standardError:(cueDelta?Math.sign(cueDelta)*Infinity:0);
  const pValue=twoSidedStudentP(tStatistic,DF);
  const margin=T_CRITICAL_95*standardError;
  const baselineMeanSmooth=mean(baselineSmooth);
  const baselineSdSmooth=Math.max(sampleSd(baselineSmooth,baselineMeanSmooth),SD_FLOOR_HZ);
  return {
    id:unit.id,
    area:unit.area,
    wave:unit.cls,
    referenceFunc:unit.func,
    baselineHz:+baselineHz.toFixed(5),
    postHz:+postHz.toFixed(5),
    responseHz:+responseHz.toFixed(5),
    cueDelta:+cueDelta.toFixed(5),
    differenceSd:+differenceSd.toFixed(5),
    standardError:+standardError.toFixed(6),
    tStatistic:Number.isFinite(tStatistic)?+tStatistic.toFixed(6):tStatistic,
    pValue:+pValue.toPrecision(8),
    ciLowHz:+(cueDelta-margin).toFixed(5),
    ciHighHz:+(cueDelta+margin).toFixed(5),
    cohenDz:differenceSd?+(cueDelta/differenceSd).toFixed(5):0,
    nTrials:N_TRIALS,
    tAuditDifference:Number.isFinite(tStatistic)?Math.abs(tStatistic-unit.modZ):0,
    cueAuditDifference:Math.abs(cueDelta-unit.cueBase),
    smooth,
    baselineMeanSmooth,
    baselineSdSmooth,
    peakLatency:+center(peakLatencyIndices.reduce(
      (best,source)=>smooth[source]>smooth[best]?source:best,
      peakLatencyIndices[0]
    )).toFixed(4)
  };
});

const adjustedP=benjaminiHochberg(records.map(record=>record.pValue));
records.forEach((record,index)=>{
  record.qValue=+adjustedP[index].toPrecision(8);
  record.responseClass=record.qValue<ALPHA
    ?(record.cueDelta>0?'Cue-excited':'Cue-suppressed')
    :'Unmodulated';
});

const populationUnitCounts={All:units.length};
for(const area of AREAS)populationUnitCounts[area]=units.filter(unit=>unit.area===area).length;

const matchedTrialIds=professorPopulation.meta.commonTrialIds;
if(matchedTrialIds.length!==48)throw new Error(`Expected 48 matched trials, found ${matchedTrialIds.length}`);
for(const key of EVENT_KEYS){
  if(referencePopulation.events[key].length!==matchedTrialIds.length){
    throw new Error(`Event ${key} does not match the common-trial cohort`);
  }
}

const populationTrialRates=Object.fromEntries(
  SCOPES.map(scope=>[
    scope,
    Array.from({length:N_TRIALS},()=>new Float64Array(details[0].psth.length))
  ])
);
units.forEach((unit,unitIndex)=>{
  const detail=details[unitIndex];
  detail.raster.t.forEach((time,spikeIndex)=>{
    const trial=detail.raster.tr[spikeIndex];
    const bin=Math.floor((time-PSTH_X0)/BIN_SECONDS);
    if(trial<0||trial>=N_TRIALS||bin<0||bin>=detail.psth.length)return;
    populationTrialRates.All[trial][bin]++;
    populationTrialRates[unit.area][trial][bin]++;
  });
});

const inferenceBinCount=Math.round((INFERENCE_WINDOW[1]-INFERENCE_WINDOW[0])/INFERENCE_BIN_SECONDS);
const inferenceBinIndices=Array.from({length:inferenceBinCount},(_,bin)=>{
  const start=INFERENCE_WINDOW[0]+bin*INFERENCE_BIN_SECONDS;
  const indices=indicesFor([start,start+INFERENCE_BIN_SECONDS]);
  if(indices.length!==Math.round(INFERENCE_BIN_SECONDS/BIN_SECONDS)){
    throw new Error(`Inference bin ${bin} has ${indices.length} native samples`);
  }
  return indices;
});
const populationInference={
  window:INFERENCE_WINDOW,
  binSeconds:INFERENCE_BIN_SECONDS,
  tax:inferenceBinIndices.map((_,bin)=>+(INFERENCE_WINDOW[0]+(bin+.5)*INFERENCE_BIN_SECONDS).toFixed(4)),
  nTrials:matchedTrialIds.length,
  trialIds:matchedTrialIds,
  scopes:Object.fromEntries(SCOPES.map(scope=>{
    const nUnits=populationUnitCounts[scope];
    const rows=matchedTrialIds.map(trialId=>{
      const counts=populationTrialRates[scope][trialId];
      const baselineCount=baselineIndices.reduce((sum,index)=>sum+counts[index],0);
      const baselineHz=baselineCount/(nUnits*(BASELINE[1]-BASELINE[0]));
      return inferenceBinIndices.map(indices=>{
        const count=indices.reduce((sum,index)=>sum+counts[index],0);
        return +(count/(nUnits*INFERENCE_BIN_SECONDS)-baselineHz).toFixed(6);
      });
    });
    return [scope,{nUnits,rows}];
  }))
};

for(const scope of SCOPES){
  const denominator=populationUnitCounts[scope]*BIN_SECONDS;
  populationTrialRates[scope]=populationTrialRates[scope].map(counts=>{
    const rate=Array.from(counts,value=>value/denominator);
    const smooth=gaussian(rate);
    const baselineMean=mean(baselineIndices.map(index=>smooth[index]));
    return smooth.map(value=>value-baselineMean);
  });
}

function summarizeTrialValues(valueRows){
  const n=valueRows.length;
  const critical=n===N_TRIALS?T_CRITICAL_95:2.01174;
  const values=valueRows[0].map((_,index)=>{
    const samples=valueRows.map(row=>row[index]);
    const valueMean=mean(samples);
    const sd=n>1?sampleSd(samples,valueMean):0;
    return {mean:valueMean,sd,ci95:critical*sd/Math.sqrt(n)};
  });
  return {
    nTrials:n,
    mean:values.map(value=>+value.mean.toFixed(5)),
    sd:values.map(value=>+value.sd.toFixed(5)),
    ci95:values.map(value=>+value.ci95.toFixed(5))
  };
}

const populationCueTraces={};
const populationMatchedCueTraces={};
for(const scope of SCOPES){
  populationCueTraces[scope]={
    nUnits:populationUnitCounts[scope],
    ...summarizeTrialValues(
      populationTrialRates[scope].map(row=>displayIndices.map(index=>row[index]))
    )
  };
  populationMatchedCueTraces[scope]={
    nUnits:populationUnitCounts[scope],
    ...summarizeTrialValues(
      matchedTrialIds.map(trialId=>displayIndices.map(index=>populationTrialRates[scope][trialId][index]))
    )
  };
}

const eventAlignmentTax=[];
for(let time=EVENT_ALIGNMENT_WINDOW[0];time<=EVENT_ALIGNMENT_WINDOW[1]+1e-9;time+=BIN_SECONDS){
  eventAlignmentTax.push(+time.toFixed(4));
}

function interpolateTrace(trace,time){
  const position=(time-PSTH_X0)/BIN_SECONDS-.5;
  const left=Math.floor(position),right=left+1,mix=position-left;
  if(left<0||right>=trace.length)return null;
  return trace[left]+(trace[right]-trace[left])*mix;
}

const eventAlignedPopulation={};
for(const eventKey of EVENT_KEYS){
  eventAlignedPopulation[eventKey]={label:EVENT_LABELS[eventKey]};
  for(const area of AREAS){
    const rows=matchedTrialIds.map((trialId,rowIndex)=>{
      const eventTime=referencePopulation.events[eventKey][rowIndex];
      const trace=populationTrialRates[area][trialId];
      return eventAlignmentTax.map(offset=>interpolateTrace(trace,eventTime+offset));
    });
    eventAlignedPopulation[eventKey][area]={
      nUnits:populationUnitCounts[area],
      ...summarizeTrialValues(rows)
    };
  }
}

const behaviorEventTiming={
  cohort:referencePopulation.meta.cohort,
  nTrials:matchedTrialIds.length,
  trialIds:matchedTrialIds,
  events:Object.fromEntries(EVENT_KEYS.map(key=>{
    const times=referencePopulation.events[key];
    return [key,{
      label:EVENT_LABELS[key],
      median:+percentile(times,.5).toFixed(4),
      q1:+percentile(times,.25).toFixed(4),
      q3:+percentile(times,.75).toFixed(4),
      times
    }];
  }))
};

const peakResponseCandidates=[];
const peakResponseSteps=Math.round(
  (PEAK_RESPONSE_SEARCH[1]-PEAK_RESPONSE_SEARCH[0]-PEAK_RESPONSE_WIDTH_SECONDS)/BIN_SECONDS
);
for(let step=0;step<=peakResponseSteps;step++){
  const start=PEAK_RESPONSE_SEARCH[0]+step*BIN_SECONDS;
  const end=start+PEAK_RESPONSE_WIDTH_SECONDS;
  const indices=indicesFor([start,end]);
  const rates=details.map(detail=>mean(indices.map(source=>detail.psth[source])));
  const score=mean(rates.map((rate,index)=>Math.abs(rate-records[index].baselineHz)));
  peakResponseCandidates.push({start,end,indices,rates,score});
}
const peakResponse=peakResponseCandidates.reduce(
  (best,candidate)=>candidate.score>best.score?candidate:best,
  peakResponseCandidates[0]
);
records.forEach((record,index)=>{
  record.peakResponseHz=+peakResponse.rates[index].toFixed(5);
});

function scopeRecords(scope){
  return scope==='All'?records:records.filter(record=>record.area===scope);
}

function summarizeTrace(selected){
  const n=selected.length;
  const values=displayIndices.map(source=>{
    const samples=selected.map(record=>record.smooth[source]-record.baselineMeanSmooth);
    const valueMean=mean(samples);
    return {
      mean:+valueMean.toFixed(5),
      sd:+(n>1?sampleSd(samples,valueMean):0).toFixed(5),
      sem:+(n>1?sampleSd(samples,valueMean)/Math.sqrt(n):0).toFixed(5)
    };
  });
  return {
    n,
    mean:values.map(value=>value.mean),
    sd:values.map(value=>value.sd),
    sem:values.map(value=>value.sem)
  };
}

const responseTraces={};
for(const scope of SCOPES){
  responseTraces[scope]={};
  for(const responseClass of RESPONSE_CLASSES){
    responseTraces[scope][responseClass]=summarizeTrace(
      scopeRecords(scope).filter(record=>record.responseClass===responseClass)
    );
  }
}

const waveformTraces={};
for(const waveClass of WAVE_CLASSES){
  waveformTraces[waveClass]={};
  for(const area of AREAS){
    const selected=records.filter(record=>record.wave===waveClass&&record.area===area);
    waveformTraces[waveClass][area]=summarizeTrace(selected);
    const latencyPoints=selected
      .map(record=>({
        id:record.id,
        latency:record.peakLatency,
        cueDelta:record.cueDelta,
        tStatistic:record.tStatistic,
        pValue:record.pValue,
        qValue:record.qValue,
        ciLowHz:record.ciLowHz,
        ciHighHz:record.ciHighHz,
        responseClass:record.responseClass
      }));
    const latency=latencyPoints.map(point=>point.latency).sort((a,b)=>a-b);
    waveformTraces[waveClass][area].latencyN=latency.length;
    waveformTraces[waveClass][area].latencies=latency.map(value=>+value.toFixed(4));
    waveformTraces[waveClass][area].latencyPoints=latencyPoints;
    waveformTraces[waveClass][area].medianLatency=latency.length
      ? +(latency.length%2?latency[(latency.length-1)/2]:(latency[latency.length/2-1]+latency[latency.length/2])/2).toFixed(4)
      : null;
  }
}

function countClasses(scope){
  const selected=scopeRecords(scope),counts={};
  for(const responseClass of RESPONSE_CLASSES){
    counts[responseClass]=selected.filter(record=>record.responseClass===responseClass).length;
  }
  return {n:selected.length,counts};
}

const thresholdCounts={};
for(const scope of SCOPES)thresholdCounts[scope]=countClasses(scope);

const waveComposition={};
const responsiveMatrices={};
for(const scope of SCOPES){
  const selected=scopeRecords(scope);
  waveComposition[scope]={n:selected.length};
  responsiveMatrices[scope]={};
  for(const waveClass of WAVE_CLASSES){
    const waveSelected=selected.filter(record=>record.wave===waveClass);
    waveComposition[scope][waveClass]=waveSelected.length;
    responsiveMatrices[scope][waveClass]={
      'Cue-excited':waveSelected.filter(record=>record.responseClass==='Cue-excited').length,
      'Cue-suppressed':waveSelected.filter(record=>record.responseClass==='Cue-suppressed').length
    };
  }
}

const displayTax=displayIndices.map(index=>+center(index).toFixed(4));
const orderTrialParity=0;
const displayTrialParity=1;

function splitHalfHeatmapTraces(detail){
  const splitCounts=[
    new Float64Array(detail.psth.length),
    new Float64Array(detail.psth.length)
  ];
  detail.raster.t.forEach((time,spikeIndex)=>{
    const trial=detail.raster.tr[spikeIndex];
    const bin=Math.floor((time-PSTH_X0)/BIN_SECONDS);
    if(trial<0||trial>=N_TRIALS||bin<0||bin>=detail.psth.length)return;
    splitCounts[trial%2][bin]++;
  });
  return splitCounts.map(counts=>{
    const trialCount=N_TRIALS/2;
    const smooth=gaussian(Array.from(counts,value=>value/(trialCount*BIN_SECONDS)));
    const baselineMean=mean(baselineIndices.map(index=>smooth[index]));
    const baselineSd=Math.max(sampleSd(baselineIndices.map(index=>smooth[index]),baselineMean),SD_FLOOR_HZ);
    return displayIndices.map(index=>(smooth[index]-baselineMean)/baselineSd);
  });
}

const splitHalfHeatmaps=records.map((record,index)=>{
  const [orderZ,displayZ]=splitHalfHeatmapTraces(details[index]);
  const peakOf=values=>values.reduce((best,value,index)=>value>values[best]?index:best,0);
  return {
    record,
    orderZ,
    displayZ,
    orderPeak:peakOf(orderZ),
    displayPeak:peakOf(displayZ)
  };
});
const heatmapRows={};
for(const scope of SCOPES){
  const selected=splitHalfHeatmaps
    .filter(row=>scope==='All'||row.record.area===scope)
    .sort((a,b)=>a.orderPeak-b.orderPeak||a.record.id-b.record.id);
  heatmapRows[scope]=selected;
}

const crcTable=(()=>{
  const table=[];
  for(let n=0;n<256;n++){
    let value=n;
    for(let bit=0;bit<8;bit++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;
    table[n]=value>>>0;
  }
  return table;
})();
function crc32(buffer){
  let value=0xffffffff;
  for(const byte of buffer)value=crcTable[(value^byte)&255]^(value>>>8);
  return (value^0xffffffff)>>>0;
}
function pngChunk(type,data){
  const typeBuffer=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer,data])));
  return Buffer.concat([length,typeBuffer,data,crc]);
}
function pngBuffer(width,height,rgba){
  const raw=Buffer.alloc((width*4+1)*height);
  for(let row=0;row<height;row++){
    raw[row*(width*4+1)]=0;
    rgba.copy(raw,row*(width*4+1)+1,row*width*4,(row+1)*width*4);
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0);
  header.writeUInt32BE(height,4);
  header[8]=8;
  header[9]=6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR',header),
    pngChunk('IDAT',zlib.deflateSync(raw)),
    pngChunk('IEND',Buffer.alloc(0))
  ]);
}
function referenceParula(value){
  const stops=[
    [49,42,136],
    [33,65,176],
    [17,88,214],
    [9,118,212],
    [0,148,210],
    [17,166,189],
    [33,183,167],
    [78,183,137],
    [121,183,107],
    [169,184,91],
    [218,186,77],
    [234,215,41],
    [248,245,8]
  ];
  const clipped=Math.max(0,Math.min(1,value));
  const position=clipped*(stops.length-1),left=Math.floor(position),mix=position-left;
  const start=stops[left],end=stops[Math.min(stops.length-1,left+1)];
  return [
    Math.round(start[0]+(end[0]-start[0])*mix),
    Math.round(start[1]+(end[1]-start[1])*mix),
    Math.round(start[2]+(end[2]-start[2])*mix)
  ];
}
const heatmaps={};
for(const scope of SCOPES){
  const rows=heatmapRows[scope],width=displayIndices.length,height=rows.length,rgba=Buffer.alloc(width*height*4);
  rows.forEach((row,rowIndex)=>row.displayZ.forEach((value,column)=>{
    const [red,green,blue]=referenceParula((value+2)/6),offset=(rowIndex*width+column)*4;
    rgba[offset]=red;
    rgba[offset+1]=green;
    rgba[offset+2]=blue;
    rgba[offset+3]=255;
  }));
  const filename=`heatmap_${scope.toLowerCase()}.png`;
  fs.writeFileSync(path.join(assetDir,filename),pngBuffer(width,height,rgba));
  heatmaps[scope]={
    n:rows.length,
    src:`assets/reconstruction_third_draft/${filename}`,
    orderedIds:rows.map(row=>row.record.id),
    areaStrip:rows.map(row=>row.record.area),
    orderingTrials:'odd-numbered trials 1, 3, ..., 79',
    displayTrials:'even-numbered trials 2, 4, ..., 80',
    nOrderingTrials:N_TRIALS/2,
    nDisplayTrials:N_TRIALS/2,
    splitHalfPeakSpearmanR:+pearson(
      rankValues(rows.map(row=>row.orderPeak)),
      rankValues(rows.map(row=>row.displayPeak))
    ).toFixed(4)
  };
}

const output={
  meta:{
    source:'Complete 80-trial PSTHs reconstructed from the supplied S21-S40 spike rasters',
    nUnits:units.length,
    nTrials:N_TRIALS,
    binMs:BIN_SECONDS*1000,
    baselineWindow:BASELINE,
    postCueWindow:POST_CUE,
    responseWindow:RESPONSE,
    displayWindow:DISPLAY,
    figure1Window:FIGURE_1_WINDOW,
    peakLatencyWindow:PEAK_LATENCY_WINDOW,
    peakResponseSearchWindow:PEAK_RESPONSE_SEARCH,
    peakResponseWindow:[+peakResponse.start.toFixed(4),+peakResponse.end.toFixed(4)],
    peakResponseWindowSeconds:PEAK_RESPONSE_WIDTH_SECONDS,
    peakResponseSelectionScoreHz:+peakResponse.score.toFixed(6),
    peakResponseSelection:'Global 1 s post-cue window maximizing the across-unit mean absolute firing-rate change from each unit\'s -5 to 0 s baseline; searched from 0 to 5 s in native 25 ms steps',
    heatmapOrdering:'Cross-validated split-half display: odd-numbered trials determine each unit\'s peak-time order; even-numbered trials are independently averaged, baseline-z-scored, and displayed',
    smoothingSigmaMs:SMOOTH_SIGMA_BINS*BIN_SECONDS*1000,
    classification:'Per-unit paired t-test across 80 trial-wise 0-3 s minus -5-0 s firing-rate differences, followed by Benjamini-Hochberg FDR correction across 1,346 units at q < 0.05',
    latency:'Peak of the smoothed trial-mean PSTH within -1 to 4 s from cue',
    sdFloorHz:SD_FLOOR_HZ,
    alpha:ALPHA,
    multipleComparison:'Benjamini-Hochberg FDR across all 1,346 units',
    degreesOfFreedom:DF,
    adaptiveRateBinsHz:[0,2,4,6,8,10,12,14,16,18,20,25,30,35,40,50],
    nonresponsive:'Benjamini-Hochberg adjusted q is at least 0.05; this does not prove a zero effect'
  },
  tax:displayTax,
  eventAlignmentTax,
  metrics:records.map(record=>({
    id:record.id,
    area:record.area,
    wave:record.wave,
    baselineHz:record.baselineHz,
    postHz:record.postHz,
    peakResponseHz:record.peakResponseHz,
    responseHz:record.responseHz,
    cueDelta:record.cueDelta,
    differenceSd:record.differenceSd,
    standardError:record.standardError,
    tStatistic:record.tStatistic,
    pValue:record.pValue,
    qValue:record.qValue,
    ciLowHz:record.ciLowHz,
    ciHighHz:record.ciHighHz,
    cohenDz:record.cohenDz,
    nTrials:record.nTrials,
    referenceFunc:record.referenceFunc,
    responseClass:record.responseClass,
    peakLatency:record.peakLatency
  })),
  responseTraces,
  populationCueTraces,
  populationMatchedCueTraces,
  populationInference,
  eventAlignedPopulation,
  behaviorEventTiming,
  waveformTraces,
  thresholdCounts,
  waveComposition,
  responsiveMatrices,
  heatmaps,
  waveClassLabels:WAVE_CLASS,
  statisticalAudit:(()=>{
    const rejected=records.filter(record=>record.qValue<ALPHA);
    const oldClasses=RESPONSE_CLASSES;
    const confusion=Object.fromEntries(oldClasses.map(oldClass=>[
      oldClass,
      Object.fromEntries(RESPONSE_CLASSES.map(newClass=>[
        newClass,
        records.filter(record=>record.referenceFunc===oldClass&&record.responseClass===newClass).length
      ]))
    ]));
    const agreement=records.filter(record=>record.referenceFunc===record.responseClass).length;
    return {
      alpha:ALPHA,
      familySize:records.length,
      degreesOfFreedom:DF,
      bhCriticalP:rejected.length?Math.max(...rejected.map(record=>record.pValue)):null,
      minimumRejectedAbsT:rejected.length?Math.min(...rejected.map(record=>Math.abs(record.tStatistic))):null,
      maxAbsTStatisticDifferenceFromStored:+Math.max(...records.map(record=>record.tAuditDifference)).toFixed(6),
      maxAbsCueDeltaDifferenceFromStoredHz:+Math.max(...records.map(record=>record.cueAuditDifference)).toFixed(6),
      agreement,
      agreementRate:+(agreement/records.length).toFixed(5),
      changed:records.length-agreement,
      confusion
    };
  })()
};

fs.writeFileSync(
  path.join(root,'data','figure_reconstruction_third_draft.js'),
  `window.FIGURE_RECONSTRUCTION_THIRD_DRAFT=${JSON.stringify(output)};\n`
);

console.log(JSON.stringify({
  output:'data/figure_reconstruction_third_draft.js',
  heatmaps:Object.fromEntries(SCOPES.map(scope=>[scope,{n:heatmaps[scope].n,src:heatmaps[scope].src}])),
  thresholdCounts,
  statisticalAudit:output.statisticalAudit
},null,2));
