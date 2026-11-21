import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const assetDir=path.join(root,'assets','reconstruction_second_draft');
fs.mkdirSync(assetDir,{recursive:true});

function loadScript(file,context){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}

const context=vm.createContext({window:{}});
loadScript('data/core.js',context);
const units=context.window.UNITS;
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
const SMOOTH_SIGMA_BINS=2;
const SD_FLOOR_HZ=.05;
const WAVE_CLASS={Broad:'Slow / broad','Fast/Narrow':'Fast / narrow'};
const SCOPES=['All','M2','M1','S1'];
const RESPONSE_CLASSES=['Cue-excited','Cue-suppressed','Unmodulated'];
const WAVE_CLASSES=['Broad','Fast/Narrow'];
const AREAS=['M2','M1','S1'];

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
  const raw=details[index].psth;
  const smooth=gaussian(raw);
  const baselineRaw=baselineIndices.map(source=>raw[source]);
  const baselineSmooth=baselineIndices.map(source=>smooth[source]);
  const responseRaw=responseIndices.map(source=>raw[source]);
  const baselineHz=mean(baselineRaw);
  const postHz=mean(postIndices.map(source=>raw[source]));
  const responseHz=mean(responseRaw);
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
    cueDelta:+(responseHz-baselineHz).toFixed(5),
    smooth,
    baselineMeanSmooth,
    baselineSdSmooth,
    peakLatency:+center(peakLatencyIndices.reduce(
      (best,source)=>smooth[source]>smooth[best]?source:best,
      peakLatencyIndices[0]
    )).toFixed(4)
  };
});

const unmodulatedReferenceRecords=records.filter(record=>record.referenceFunc==='Unmodulated');
if(!unmodulatedReferenceRecords.length)throw new Error('No independently classified unmodulated reference units were found');

const referenceResponseValues=unmodulatedReferenceRecords.map(record=>record.cueDelta);
const referenceResponseMean=mean(referenceResponseValues);
const referenceResponseSd=Math.max(sampleSd(referenceResponseValues,referenceResponseMean),SD_FLOOR_HZ);

const referenceMeanFull=new Array(details[0].psth.length);
const referenceSdFull=new Array(details[0].psth.length);
for(let source=0;source<details[0].psth.length;source++){
  const samples=unmodulatedReferenceRecords.map(record=>record.smooth[source]-record.baselineMeanSmooth);
  referenceMeanFull[source]=mean(samples);
  referenceSdFull[source]=Math.max(sampleSd(samples,referenceMeanFull[source]),SD_FLOOR_HZ);
}

for(const record of records){
  const responseScore=(record.cueDelta-referenceResponseMean)/referenceResponseSd;
  const classify=()=>responseScore>1?'Cue-excited':responseScore< -1?'Cue-suppressed':'Unmodulated';
  record.responseScore=+responseScore.toFixed(5);
  record.responseClass=classify();
}

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
const referenceTraces={};
for(const scope of SCOPES){
  responseTraces[scope]={};
  for(const responseClass of RESPONSE_CLASSES){
    responseTraces[scope][responseClass]=summarizeTrace(
      scopeRecords(scope).filter(record=>record.responseClass===responseClass)
    );
  }
  referenceTraces[scope]=summarizeTrace(
    scopeRecords(scope).filter(record=>record.referenceFunc==='Unmodulated')
  );
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
const heatmapRows={};
for(const scope of SCOPES){
  const selected=scopeRecords(scope).map(record=>{
    const z=displayIndices.map(source=>
      (record.smooth[source]-record.baselineMeanSmooth)/record.baselineSdSmooth
    );
    let peak=0;
    for(let index=1;index<z.length;index++)if(z[index]>z[peak])peak=index;
    return {record,z,peak};
  }).sort((a,b)=>a.peak-b.peak||a.record.id-b.record.id);
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
  rows.forEach((row,rowIndex)=>row.z.forEach((value,column)=>{
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
    src:`assets/reconstruction_second_draft/${filename}`,
    orderedIds:rows.map(row=>row.record.id),
    areaStrip:rows.map(row=>row.record.area)
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
    peakLatencyWindow:PEAK_LATENCY_WINDOW,
    smoothingSigmaMs:SMOOTH_SIGMA_BINS*BIN_SECONDS*1000,
    classification:'Mean 0-3 s minus mean -5-0 s firing rate relative to the predefined unmodulated-unit reference mean +/- 1 SD',
    latency:'Peak of the smoothed trial-mean PSTH within -1 to 4 s from cue',
    sdFloorHz:SD_FLOOR_HZ,
    primaryThresholdSd:1,
    adaptiveRateBinsHz:[0,2,4,6,8,10,12,14,16,18,20,25,30,35,40,50],
    nonresponsive:'Cue-minus-baseline firing rate lies within the predefined unmodulated cohort mean +/- 1 SD'
  },
  tax:displayTax,
  metrics:records.map(record=>({
    id:record.id,
    area:record.area,
    wave:record.wave,
    baselineHz:record.baselineHz,
    postHz:record.postHz,
    responseHz:record.responseHz,
    cueDelta:record.cueDelta,
    responseScore:record.responseScore,
    responseClass:record.responseClass,
    peakLatency:record.peakLatency
  })),
  responseTraces,
  referenceTraces,
  unmodulatedReference:{
    n:unmodulatedReferenceRecords.length,
    responseMeanHz:+referenceResponseMean.toFixed(5),
    responseSdHz:+referenceResponseSd.toFixed(5),
    responseLowerHz:+(referenceResponseMean-referenceResponseSd).toFixed(5),
    responseUpperHz:+(referenceResponseMean+referenceResponseSd).toFixed(5),
    mean:displayIndices.map(source=>+referenceMeanFull[source].toFixed(5)),
    sd:displayIndices.map(source=>+referenceSdFull[source].toFixed(5))
  },
  waveformTraces,
  thresholdCounts,
  waveComposition,
  responsiveMatrices,
  heatmaps,
  waveClassLabels:WAVE_CLASS
};

fs.writeFileSync(
  path.join(root,'data','figure_reconstruction_second_draft.js'),
  `window.FIGURE_RECONSTRUCTION_SECOND_DRAFT=${JSON.stringify(output)};\n`
);

console.log(JSON.stringify({
  output:'data/figure_reconstruction_second_draft.js',
  heatmaps:Object.fromEntries(SCOPES.map(scope=>[scope,{n:heatmaps[scope].n,src:heatmaps[scope].src}])),
  thresholdCounts,
  responseBounds:{
    lower:+(referenceResponseMean-referenceResponseSd).toFixed(5),
    mean:+referenceResponseMean.toFixed(5),
    upper:+(referenceResponseMean+referenceResponseSd).toFixed(5)
  }
},null,2));
