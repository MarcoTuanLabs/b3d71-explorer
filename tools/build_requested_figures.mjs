import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');

function loadScript(file,context){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}

const context=vm.createContext({window:{}});
loadScript('data/core.js',context);
loadScript('data/pop.js',context);
const units=context.window.UNITS;
const pop=context.window.POP;
const details=units.map(unit=>{
  const local=vm.createContext({window:{}});
  loadScript(`data/units/u${unit.id}.js`,local);
  const detail=local.window.UNIT_CACHE[unit.id];
  if(!detail||detail.psth.length!==1000)throw new Error(`Invalid PSTH for unit ${unit.id}`);
  return detail;
});

const dx=details[0].psthDx;
const x0=details[0].psthX0;
const center=index=>x0+(index+.5)*dx;
const traceIndices=[];
for(let index=0;index<details[0].psth.length;index++)if(center(index)>=-1&&center(index)<=5)traceIndices.push(index);
const tax=traceIndices.map(center);

function gaussian(values,sigmaBins=2){
  const radius=Math.ceil(3*sigmaBins),kernel=[];
  let total=0;
  for(let offset=-radius;offset<=radius;offset++){
    const value=Math.exp(-.5*(offset/sigmaBins)**2);
    kernel.push(value);total+=value;
  }
  return values.map((_,index)=>{
    let sum=0,weight=0;
    kernel.forEach((value,k)=>{
      const source=index+k-radius;
      if(source>=0&&source<values.length){sum+=values[source]*value;weight+=value;}
    });
    return sum/(weight||total);
  });
}

function aggregate(predicate){
  const selected=units.map((unit,index)=>[unit,index]).filter(([unit])=>predicate(unit));
  const mean=new Array(traceIndices.length).fill(0);
  selected.forEach(([unit,index])=>traceIndices.forEach((source,column)=>{
    mean[column]+=(details[index].psth[source]-unit.baseHz)/selected.length;
  }));
  return {n:selected.length,values:gaussian(mean).map(value=>+value.toFixed(4))};
}

const scopes=['All','M2','M1','S1'];
const functions=['Cue-excited','Cue-suppressed','Unmodulated'];
const waveformClasses=['Broad','Fast/Narrow'];
const classDelta={};
scopes.forEach(scope=>{
  classDelta[scope]={};
  functions.forEach(func=>classDelta[scope][func]=aggregate(unit=>(scope==='All'||unit.area===scope)&&unit.func===func));
});

const waveformDelta={};
['M2','M1','S1'].forEach(area=>{
  waveformDelta[area]={};
  waveformClasses.forEach(cls=>waveformDelta[area][cls]=aggregate(unit=>unit.area===area&&unit.cls===cls));
});

const peakTimeSec=units.map((unit,index)=>{
  const smoothed=gaussian(details[index].psth);
  let best=-Infinity,bestTime=-1;
  for(let sample=0;sample<smoothed.length;sample++){
    const time=center(sample);
    if(time < -1 || time > 4)continue;
    if(smoothed[sample]>best){best=smoothed[sample];bestTime=time;}
  }
  return +bestTime.toFixed(4);
});
const cueYMin=Math.floor(Math.min(...units.map(unit=>unit.cueBase))/5)*5;
const cueYMax=Math.ceil(Math.max(...units.map(unit=>unit.cueBase))/5)*5;
const cueTicks=[cueYMin,0,20,cueYMax].filter((value,index,array)=>value>=cueYMin&&value<=cueYMax&&array.indexOf(value)===index).sort((a,b)=>a-b);

const figureData={
  meta:{
    source:'data/core.js plus data/units/u{id}.js',
    nUnits:units.length,
    nTrials:80,
    fullTrialCueRelative:[-5,20],
    fullTrialTrialRelative:[0,25],
    baselineCueRelative:[-5,0],
    baselineTrialRelative:[0,5],
    traceWindow:[-1,5],
    peakWindow:[-1,4],
    binMs:dx*1000,
    displaySmoothingSigmaMs:dx*1000*2,
    peakDefinition:'maximum 50 ms Gaussian-smoothed trial-mean PSTH within -1 to +4 s from cue'
  },
  tax:tax.map(value=>+value.toFixed(4)),
  classDelta,
  waveformDelta,
  peakTimeSec
};

fs.writeFileSync(path.join(root,'data/figure12.js'),`window.FIGURE12=${JSON.stringify(figureData)};\n`);

const C={
  ink:'#1d2735',mut:'#637086',grid:'#dfe5ec',panel:'#ffffff',bg:'#ffffff',
  full:'#214f8b',base:'#72a7c7',broad:'#4c72b0',fast:'#c94f5a',
  exc:'#d95f45',sup:'#3f6da8',unm:'#9299a6',M2:'#3f7fbf',M1:'#4a9d5b',S1:'#c0504d'
};

const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const tag=(name,attrs={},content='')=>`<${name}${Object.entries(attrs).map(([key,value])=>` ${key}="${esc(value)}"`).join('')}>${content}</${name}>`;
const text=(x,y,value,attrs={})=>tag('text',{x,y,...attrs},esc(value));
const line=(x1,y1,x2,y2,attrs={})=>tag('line',{x1,y1,x2,y2,...attrs});
const rect=(x,y,width,height,attrs={})=>tag('rect',{x,y,width,height,...attrs});
const pathTag=(d,attrs={})=>tag('path',{d,...attrs});
const circle=(cx,cy,r,attrs={})=>tag('circle',{cx,cy,r,...attrs});
const group=(content,attrs={})=>tag('g',attrs,content);
const scale=(a,b,c,d)=>value=>c+(value-a)/(b-a)*(d-c);
const median=values=>{const sorted=values.slice().sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const fmt=value=>Math.abs(value)>=10?value.toFixed(0):Math.abs(value)>=1?value.toFixed(1):value.toFixed(2);

function panel(x,y,width,height,label,title,subtitle=''){
  return rect(x,y,width,height,{rx:6,fill:C.panel,stroke:'#d7dde6'})+
    text(x+16,y+27,label,{'font-size':17,'font-weight':800,fill:C.ink})+
    text(x+48,y+27,title,{'font-size':15,'font-weight':700,fill:C.ink})+
    (subtitle?text(x+width-16,y+46,subtitle,{'font-size':10,'text-anchor':'end',fill:C.mut}):'');
}

function axes({x,y,w,h,xDomain,yDomain,xTicks,yTicks,xLabel,yLabel}){
  const sx=scale(xDomain[0],xDomain[1],x,x+w),sy=scale(yDomain[0],yDomain[1],y+h,y),parts=[];
  yTicks.forEach(value=>{parts.push(line(x,sy(value),x+w,sy(value),{stroke:C.grid,'stroke-width':1}),text(x-6,sy(value)+3,fmt(value),{'font-size':9,'text-anchor':'end',fill:C.mut}));});
  xTicks.forEach(value=>parts.push(text(sx(value),y+h+15,fmt(value),{'font-size':9,'text-anchor':'middle',fill:C.mut})));
  parts.push(line(x,y+h,x+w,y+h,{stroke:'#aeb8c7'}),line(x,y,x,y+h,{stroke:'#aeb8c7'}));
  if(xLabel)parts.push(text(x+w/2,y+h+31,xLabel,{'font-size':10,'text-anchor':'middle',fill:C.mut}));
  if(yLabel)parts.push(text(x-40,y+h/2,yLabel,{'font-size':10,'text-anchor':'middle',fill:C.mut,transform:`rotate(-90 ${x-40} ${y+h/2})`}));
  return {sx,sy,svg:parts.join('')};
}

function histogram(values,min,max,bins){
  const counts=new Array(bins).fill(0),step=(max-min)/bins;
  values.forEach(value=>{if(value<min||value>max)return;counts[Math.min(bins-1,Math.floor((value-min)/step))]++;});
  return {counts,step};
}

function histogramMini(scope,x,y,w,h){
  const cohort=scope==='All'?units:units.filter(unit=>unit.area===scope),max=50,bins=20,
    full=histogram(cohort.map(unit=>unit.meanHz),0,max,bins),base=histogram(cohort.map(unit=>unit.baseHz),0,max,bins),
    ymax=Math.max(...full.counts,...base.counts)*1.08;
  const chart=axes({x:x+38,y:y+28,w:w-50,h:h-55,xDomain:[0,max],yDomain:[0,ymax],xTicks:[0,10,20,30,40,50],yTicks:[0,Math.round(ymax/2),Math.round(ymax)],xLabel:'firing rate (Hz)',yLabel:'# units'}),parts=[chart.svg];
  const bw=(w-50)/bins;
  base.counts.forEach((count,index)=>parts.push(rect(chart.sx(index*base.step)+1,chart.sy(count),Math.max(1,bw/2-1.5),chart.sy(0)-chart.sy(count),{fill:C.base,'fill-opacity':.88})));
  full.counts.forEach((count,index)=>parts.push(rect(chart.sx(index*full.step)+bw/2,chart.sy(count),Math.max(1,bw/2-1.5),chart.sy(0)-chart.sy(count),{fill:C.full,'fill-opacity':.88})));
  parts.push(text(x+w/2,y+13,`${scope}  n=${cohort.length}`,{'font-size':11,'text-anchor':'middle','font-weight':700,fill:scope==='All'?C.ink:C[scope]}));
  return parts.join('');
}

function viridis(value){
  const colors=[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],t=Math.max(0,Math.min(1,value)),p=t*(colors.length-1),i=Math.floor(p),f=p-i,a=colors[i],b=colors[Math.min(colors.length-1,i+1)];
  return [Math.round(a[0]+(b[0]-a[0])*f),Math.round(a[1]+(b[1]-a[1])*f),Math.round(a[2]+(b[2]-a[2])*f),255];
}

const crcTable=(()=>{const table=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
function crc32(buffer){let c=0xffffffff;for(const byte of buffer)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function pngChunk(type,data){const typeBuffer=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer,data])));return Buffer.concat([length,typeBuffer,data,crc]);}
function pngData(width,height,rgba){
  const raw=Buffer.alloc((width*4+1)*height);
  for(let row=0;row<height;row++){raw[row*(width*4+1)]=0;rgba.copy(raw,row*(width*4+1)+1,row*width*4,(row+1)*width*4);}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ihdr),pngChunk('IDAT',zlib.deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))]).toString('base64');
}

function heatmapImage(scope){
  let ids=[...Array(pop.heatmap.z.length).keys()];
  if(scope!=='All')ids=ids.filter(index=>pop.heatmap.area[index]===scope);
  ids.sort((a,b)=>pop.heatmap.peak[a]-pop.heatmap.peak[b]);
  const width=pop.heatmap.T,height=ids.length,rgba=Buffer.alloc(width*height*4);
  ids.forEach((id,row)=>pop.heatmap.z[id].forEach((value,column)=>{
    const color=viridis((value+2)/6),offset=(row*width+column)*4;
    rgba[offset]=color[0];rgba[offset+1]=color[1];rgba[offset+2]=color[2];rgba[offset+3]=255;
  }));
  return {n:ids.length,data:pngData(width,height,rgba)};
}

function tracePath(values,sx,sy,windowEnd=5){
  let d='';figureData.tax.forEach((time,index)=>{if(time>windowEnd)return;d+=(d?'L':'M')+sx(time).toFixed(2)+' '+sy(values[index]).toFixed(2)+' ';});return d;
}

function rasterMini(scope,x,y,w,h){
  const image=heatmapImage(scope),heatY=y+22,heatH=h*.58,traceY=heatY+heatH+23,traceH=h-heatH-51,parts=[];
  parts.push(text(x+w/2,y+11,`${scope}  n=${image.n}`,{'font-size':11,'text-anchor':'middle','font-weight':700,fill:scope==='All'?C.ink:C[scope]}),tag('image',{x,y:heatY,width:w,height:heatH,href:`data:image/png;base64,${image.data}`,preserveAspectRatio:'none'}));
  const cueX=x+w/6;parts.push(line(cueX,heatY,cueX,heatY+heatH,{stroke:'#fff','stroke-width':1,'stroke-dasharray':'3 2'}));
  const series=functions.map(func=>figureData.classDelta[scope][func].values),limit=Math.max(...series.flat().map(Math.abs),.1)*1.05,
    chart=axes({x,y:traceY,w,h:traceH,xDomain:[-1,5],yDomain:[-limit,limit],xTicks:[-1,0,1,2,3,4,5],yTicks:[-limit,0,limit],xLabel:'time from cue (s)',yLabel:'delta Hz'});
  parts.push(chart.svg,line(chart.sx(0),traceY,chart.sx(0),traceY+traceH,{stroke:'#7b8493','stroke-dasharray':'3 2'}));
  functions.forEach(func=>parts.push(pathTag(tracePath(figureData.classDelta[scope][func].values,chart.sx,chart.sy),{fill:'none',stroke:func==='Cue-excited'?C.exc:func==='Cue-suppressed'?C.sup:C.unm,'stroke-width':1.8})));
  return parts.join('');
}

function diverging(value,limit){
  const t=Math.max(-1,Math.min(1,value/limit)),a=t<0?[38,102,178]:[239,239,239],b=t<0?[239,239,239]:[211,73,91],f=t<0?t+1:t;
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}

function trend(cohort,key,bins=9){
  const sorted=cohort.slice().sort((a,b)=>a[key]-b[key]),points=[];
  for(let bin=0;bin<bins;bin++){
    const start=Math.floor(bin*sorted.length/bins),end=Math.floor((bin+1)*sorted.length/bins),slice=sorted.slice(start,end);
    if(slice.length<2)continue;
    points.push([median(slice.map(unit=>unit[key])),median(slice.map(unit=>unit.cueBase))]);
  }
  return points;
}

function rateScatterMini(scope,x,y,w,h){
  const cohort=scope==='All'?units:units.filter(unit=>unit.area===scope),xmax=50,limit=Math.max(...units.map(unit=>Math.abs(unit.cueBase))),chart=axes({x:x+38,y:y+24,w:w-50,h:h-52,xDomain:[0,xmax],yDomain:[-22,38],xTicks:[0,10,20,30,40,50],yTicks:[-20,0,20,40],xLabel:'firing rate (Hz)',yLabel:'cue - baseline (Hz)'}),parts=[chart.svg];
  cohort.forEach(unit=>{if(unit.meanHz>xmax||unit.cueBase<-22||unit.cueBase>38)return;parts.push(circle(chart.sx(unit.meanHz),chart.sy(unit.cueBase),1.35,{fill:diverging(unit.cueBase,limit),'fill-opacity':.47}));});
  functions.forEach(func=>{
    const selected=cohort.filter(unit=>unit.func===func),color=func==='Cue-excited'?C.exc:func==='Cue-suppressed'?C.sup:C.unm;
    [['baseHz','5 s baseline','5 3'],['meanHz','25 s full trial','']].forEach(([key,,dash])=>{const points=trend(selected,key),d=points.map((point,index)=>(index?'L':'M')+chart.sx(point[0]).toFixed(2)+' '+chart.sy(point[1]).toFixed(2)).join(' ');parts.push(pathTag(d,{fill:'none',stroke:color,'stroke-width':2,'stroke-dasharray':dash}));});
  });
  parts.push(text(x+w/2,y+12,scope,{'font-size':11,'text-anchor':'middle','font-weight':700,fill:scope==='All'?C.ink:C[scope]}));return parts.join('');
}

function waveformOverlay(cohort,x,y,w,h,color,label){
  const n=cohort[0].wf.length,sampleMs=.03125,troughIndex=41,chart=axes({x:x+42,y:y+19,w:w-52,h:h-48,xDomain:[-1.25,1.25],yDomain:[-1.15,.75],xTicks:[-1,0,1],yTicks:[-1,0,.5],xLabel:'time from trough (ms)',yLabel:'normalized amplitude'}),sx=index=>chart.sx((index-troughIndex)*sampleMs),sy=chart.sy,parts=[chart.svg,line(chart.sx(0),y+19,chart.sx(0),y+h-29,{stroke:'#808a99','stroke-width':.8,'stroke-dasharray':'4 3'})];
  const step=Math.max(1,Math.ceil(cohort.length/120));
  cohort.filter((_,index)=>index%step===0).forEach(unit=>{const d=unit.wf.map((value,index)=>(index?'L':'M')+sx(index).toFixed(2)+' '+sy(value).toFixed(2)).join(' ');parts.push(pathTag(d,{fill:'none',stroke:color,'stroke-width':.45,'stroke-opacity':.16}));});
  const mean=new Array(n).fill(0);cohort.forEach(unit=>unit.wf.forEach((value,index)=>mean[index]+=value/cohort.length));
  parts.push(pathTag(mean.map((value,index)=>(index?'L':'M')+sx(index).toFixed(2)+' '+sy(value).toFixed(2)).join(' '),{fill:'none',stroke:color,'stroke-width':2.4}),text(x+w/2,y+10,`${label}  n=${cohort.length}`,{'font-size':11,'text-anchor':'middle','font-weight':700,fill:color}));
  return parts.join('');
}

function alignedWaveforms(x,y,w,h){
  const chart=axes({x:x+52,y:y+18,w:w-67,h:h-52,xDomain:[0,1],yDomain:[-1.1,.75],xTicks:[0,.2,.4,.6,.8,1],yTicks:[-1,0,.5],xLabel:'time after waveform trough (ms)',yLabel:'normalized amplitude'}),parts=[chart.svg,line(chart.sx(.4),y+18,chart.sx(.4),y+18+h-52,{stroke:'#717b8b','stroke-dasharray':'5 3'})],sampleMs=.03125;
  [
    ['Broad',C.broad],
    ['Fast/Narrow',C.fast]
  ].forEach(([cls,color])=>{
    const cohort=units.filter(unit=>unit.cls===cls),aligned=cohort.map(unit=>{const trough=unit.wf.indexOf(Math.min(...unit.wf));return unit.wf.slice(trough,trough+33);}),step=Math.max(1,Math.ceil(aligned.length/150));
    aligned.filter((_,index)=>index%step===0).forEach(values=>parts.push(pathTag(values.map((value,index)=>(index?'L':'M')+chart.sx(index*sampleMs).toFixed(2)+' '+chart.sy(value).toFixed(2)).join(' '),{fill:'none',stroke:color,'stroke-width':.45,'stroke-opacity':.13})));
    const length=Math.max(...aligned.map(values=>values.length)),mean=new Array(length).fill(0),counts=new Array(length).fill(0);aligned.forEach(values=>values.forEach((value,index)=>{mean[index]+=value;counts[index]++;}));mean.forEach((value,index)=>mean[index]=value/(counts[index]||1));parts.push(pathTag(mean.map((value,index)=>(index?'L':'M')+chart.sx(index*sampleMs).toFixed(2)+' '+chart.sy(value).toFixed(2)).join(' '),{fill:'none',stroke:color,'stroke-width':2.5,'stroke-linejoin':'round'}));
  });
  parts.push(text(chart.sx(.4)+4,y+30,'0.4 ms',{'font-size':9,fill:C.mut}));return parts.join('');
}

function waveformScatter(x,y,w,h){
  const ratioMax=Math.ceil(Math.max(...units.map(unit=>unit.ratio))*10)/10,chart=axes({x:x+52,y:y+18,w:w-67,h:h-50,xDomain:[0,1],yDomain:[0,ratioMax],xTicks:[0,.2,.4,.6,.8,1],yTicks:[0,.5,1,1.5,2],xLabel:'trough-to-peak duration (ms)',yLabel:'post-peak / trough ratio'}),parts=[chart.svg,line(chart.sx(.4),y+18,chart.sx(.4),y+18+h-50,{stroke:'#717b8b','stroke-dasharray':'5 3'})];
  units.forEach(unit=>parts.push(circle(chart.sx(unit.t2p),chart.sy(unit.ratio),1.65,{fill:unit.cls==='Broad'?C.broad:C.fast,'fill-opacity':.6})));
  parts.push(text(chart.sx(.4)+4,y+30,'0.4 ms',{'font-size':9,fill:C.mut}));return parts.join('');
}

function waveformCountBars(x,y,w,h){
  const groups=scopes.map(scope=>[scope,scope==='All'?units:units.filter(unit=>unit.area===scope)]),max=1400,chart=axes({x:x+62,y:y+22,w:w-82,h:h-72,xDomain:[0,4],yDomain:[0,max],xTicks:[],yTicks:[0,350,700,1050,1400],xLabel:'recording area',yLabel:'# neurons'}),parts=[chart.svg],slot=(w-82)/4,barW=slot*.62;
  groups.forEach(([scope,cohort],index)=>{
    const broad=cohort.filter(unit=>unit.cls==='Broad').length,fast=cohort.length-broad,cx=chart.sx(index+.5)-barW/2,zero=chart.sy(0),broadY=chart.sy(broad),fastY=chart.sy(broad+fast),fastH=broadY-fastY,centerX=cx+barW/2,
      broadStyle={'font-size':12,'text-anchor':'middle','dominant-baseline':'middle',fill:'#fff','font-weight':800,stroke:C.broad,'stroke-width':1.8,'paint-order':'stroke','stroke-linejoin':'round'},
      fastFont=Math.max(7.6,Math.min(12,fastH*.72)),fastStyle={'font-size':fastFont,'text-anchor':'middle','dominant-baseline':'middle',fill:'#fff','font-weight':800,stroke:C.fast,'stroke-width':Math.min(1.4,fastFont*.14),'paint-order':'stroke','stroke-linejoin':'round'};
    parts.push(rect(cx,broadY,barW,zero-broadY,{fill:C.broad}),rect(cx,fastY,barW,fastH,{fill:C.fast}),text(centerX,chart.sy(broad/2),String(broad),broadStyle),text(centerX,fastY+fastH/2,String(fast),fastStyle),text(centerX,y+h-22,scope,{'font-size':10.5,'text-anchor':'middle','font-weight':700,fill:scope==='All'?C.ink:C[scope]}));
  });return parts.join('');
}

function sixTraceChart(x,y,w,h){
  const values=['M2','M1','S1'].flatMap(area=>waveformClasses.map(cls=>figureData.waveformDelta[area][cls].values.filter((_,index)=>figureData.tax[index]<=4))),limit=Math.max(...values.flat().map(Math.abs),.1)*1.05,chart=axes({x:x+166,y:y+18,w:w-190,h:h-50,xDomain:[-1,4],yDomain:[-limit,limit],xTicks:[-1,0,1,2,3,4],yTicks:[-limit,0,limit],xLabel:'time from cue (s)',yLabel:'delta firing rate (Hz)'}),parts=[chart.svg,line(chart.sx(0),y+18,chart.sx(0),y+18+h-50,{stroke:'#747f90','stroke-dasharray':'4 3'})];
  ['M2','M1','S1'].forEach(area=>waveformClasses.forEach(cls=>parts.push(pathTag(tracePath(figureData.waveformDelta[area][cls].values,chart.sx,chart.sy,4),{fill:'none',stroke:C[area],'stroke-width':cls==='Broad'?2.2:1.8,'stroke-dasharray':cls==='Broad'?'':'6 3'}))));return parts.join('');
}

function latencyBandChart(x,y,w,h){
  const pad={l:166,r:24,t:24,b:46},plotX=x+pad.l,plotY=y+pad.t,plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b,divider=plotY+plotH/2,bandH=plotH/2,
    bandTop={'Fast/Narrow':plotY,Broad:divider},inset=15,sx=scale(-1,4,plotX,plotX+plotW),sy=(cls,value)=>bandTop[cls]+inset+(cueYMax-Math.max(cueYMin,Math.min(cueYMax,value)))/(cueYMax-cueYMin)*(bandH-2*inset),parts=[];
  parts.push(rect(plotX,plotY,plotW,bandH,{fill:C.fast,'fill-opacity':.055}),rect(plotX,divider,plotW,bandH,{fill:C.broad,'fill-opacity':.055}));
  [-1,0,1,2,3,4].forEach(value=>{const px=sx(value);parts.push(line(px,plotY,px,plotY+plotH,{stroke:value===0?'#747f90':C.grid,'stroke-width':1,'stroke-dasharray':value===0?'5 3':''}),text(px,plotY+plotH+16,String(value),{'font-size':9,'text-anchor':'middle',fill:C.mut}));});
  waveformClasses.forEach(cls=>cueTicks.forEach(value=>{const py=sy(cls,value);parts.push(line(plotX,py,plotX+plotW,py,{stroke:value===0?'#bdc6d2':C.grid,'stroke-width':value===0?1:.7,'stroke-dasharray':value===0?'3 3':''}),text(plotX-8,py+3,String(value),{'font-size':9,'text-anchor':'end',fill:C.mut}));}));
  parts.push(line(plotX,divider,plotX+plotW,divider,{stroke:'#303b4d','stroke-width':1.4}),line(plotX,plotY+plotH,plotX+plotW,plotY+plotH,{stroke:'#aeb8c7'}),
    text(plotX+9,plotY+13,'Fast / narrow',{'font-size':9.5,'font-weight':750,fill:C.fast}),text(plotX+9,divider+13,'Slow / broad',{'font-size':9.5,'font-weight':750,fill:C.broad}),text(x+17,plotY+plotH/2,'cue - baseline delta firing rate (Hz)',{'font-size':10,'text-anchor':'middle',fill:C.mut,transform:`rotate(-90 ${x+17} ${plotY+plotH/2})`}),text(plotX+plotW/2,y+h-3,'PSTH peak latency from cue (s)',{'font-size':10,'text-anchor':'middle',fill:C.mut}));
  units.forEach((unit,index)=>parts.push(circle(sx(peakTimeSec[index]),sy(unit.cls,unit.cueBase),1.75,{fill:C[unit.area],'fill-opacity':.46})));
  waveformClasses.forEach(cls=>['M2','M1','S1'].forEach(area=>{const selected=units.map((unit,index)=>({unit,index})).filter(item=>item.unit.area===area&&item.unit.cls===cls),latency=median(selected.map(item=>peakTimeSec[item.index])),delta=median(selected.map(item=>item.unit.cueBase)),px=sx(latency),py=sy(cls,delta);parts.push(pathTag(`M${px} ${py-4.5}L${px+4.5} ${py}L${px} ${py+4.5}L${px-4.5} ${py}Z`,{fill:C[area],stroke:'#fff','stroke-width':1}));}));
  return parts.join('');
}

function compositionMini(scope,x,y,w,h){
  const cohort=scope==='All'?units:units.filter(unit=>unit.area===scope),classes=[['Broad','Slow / broad'],['Fast/Narrow','Fast / narrow']],barW=96,gap=72,totalWidth=barW*2+gap,start=x+(w-totalWidth)/2,plotY=y+48,plotH=h-108,parts=[text(x+w/2,y+14,scope,{'font-size':12,'text-anchor':'middle','font-weight':750,fill:scope==='All'?C.ink:C[scope]})];
  classes.forEach(([cls,label],bar)=>{
    const selected=cohort.filter(unit=>unit.cls===cls),counts=functions.map(func=>selected.filter(unit=>unit.func===func).length),total=selected.length||1,bx=start+bar*(barW+gap),segments=[];let bottom=plotY+plotH;
    functions.forEach((func,index)=>{const percent=100*counts[index]/total,height=plotH*counts[index]/total,color=func==='Cue-excited'?C.exc:func==='Cue-suppressed'?C.sup:C.unm;bottom-=height;parts.push(rect(bx,bottom,barW,height,{fill:color}));segments.push({percent,height,center:bottom+height/2,color,labelY:bottom+height/2});});
    const tiny=segments.filter(item=>item.height<24).sort((a,b)=>a.center-b.center);let cursor=plotY-1;tiny.forEach(item=>{item.labelY=Math.max(item.center,cursor+12);cursor=item.labelY;});const overflow=Math.max(0,cursor-(plotY+plotH-7));tiny.forEach(item=>item.labelY-=overflow);
    segments.forEach(item=>{const fontSize=item.height<24?8.5:10,strokeWidth=item.height<24?1.15:0;parts.push(text(bx+barW/2,item.labelY,`${Math.round(item.percent)}%`,{'font-size':fontSize,'text-anchor':'middle','dominant-baseline':'middle',fill:'#fff','font-weight':800,stroke:item.color,'stroke-width':strokeWidth,'paint-order':'stroke','stroke-linejoin':'round'}));});
    parts.push(text(bx+barW/2,plotY+plotH+22,label,{'font-size':9,'text-anchor':'middle',fill:C.mut}),text(bx+barW/2,plotY-12,`n=${selected.length}`,{'font-size':9,'text-anchor':'middle',fill:C.mut}));
  });return parts.join('');
}

function legendLine(x,y,color,label,dash=''){
  return line(x,y,x+24,y,{stroke:color,'stroke-width':2.4,'stroke-dasharray':dash})+text(x+30,y+3,label,{'font-size':9,fill:C.mut});
}

function figureOneSvg(){
  const W=1600,H=1940,parts=[rect(0,0,W,H,{fill:C.bg}),text(40,38,'Figure 1. Firing-rate distributions, population timing, and cue modulation',{'font-size':21,'font-weight':800,fill:C.ink})];
  parts.push(panel(30,55,1540,540,'A','Baseline versus full-trial firing-rate distributions','baseline: trial 0-5 s; full trial: 0-25 s'));
  scopes.forEach((scope,index)=>parts.push(histogramMini(scope,52+index*378,110,350,430)));
  parts.push(legendLine(1280,78,C.full,'25 s full-trial mean'),legendLine(1417,78,C.base,'5 s baseline'));
  parts.push(panel(30,615,1540,540,'B','Population rasters with functional-class delta-rate traces','four equal-width cohorts; heatmap: unit z-rate; traces: Hz relative to each unit baseline'));
  scopes.forEach((scope,index)=>parts.push(rasterMini(scope,55+index*380,660,340,440)));
  parts.push(legendLine(1160,640,C.exc,'Cue-excited'),legendLine(1270,640,C.sup,'Cue-suppressed'),legendLine(1398,640,C.unm,'Unmodulated'));
  parts.push(panel(30,1175,1540,720,'C','Cue modulation versus baseline and full-trial firing rate','one shared color scale aligned with all four cohort panels'));
  const scatterY=1250,scatterH=590,barX=54,barY=scatterY+24,barH=scatterH-52,limit=Math.max(...units.map(unit=>Math.abs(unit.cueBase)));for(let step=0;step<100;step++)parts.push(rect(barX,barY+barH-step*barH/100,14,barH/100+1,{fill:diverging((step/99*2-1)*limit,limit)}));
  parts.push(text(barX+7,barY-8,'activatory',{'font-size':9,'text-anchor':'middle',fill:C.mut}),text(barX+7,barY+barH+18,'inhibitory',{'font-size':9,'text-anchor':'middle',fill:C.mut}));
  scopes.forEach((scope,index)=>parts.push(rateScatterMini(scope,88+index*365,scatterY,338,scatterH)));
  parts.push(legendLine(930,1205,C.exc,'Excited'),legendLine(1020,1205,C.sup,'Suppressed'),legendLine(1125,1205,C.unm,'Unmodulated'),legendLine(1240,1205,C.ink,'full-trial curve'),legendLine(1385,1205,C.ink,'baseline curve','5 3'));
  parts.push(text(40,H-14,'Source: 1,346 units; 80 trial-averaged PSTHs. Curves are descriptive and do not establish cell identity or causality.',{'font-size':10,fill:C.mut}));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

function figureTwoSvg(){
  const W=1600,H=3220,parts=[rect(0,0,W,H,{fill:C.bg}),text(40,38,'Figure 2. Waveform class, latency, and cue modulation',{'font-size':21,'font-weight':800,fill:C.ink})];
  parts.push(panel(30,55,900,1280,'A','Normalized waveform templates and aligned feature space',''));
  parts.push(legendLine(600,106,C.fast,'Fast / narrow'),legendLine(735,106,C.broad,'Slow / broad'),waveformOverlay(units.filter(unit=>unit.cls==='Fast/Narrow'),72,135,390,215,C.fast,'Fast / narrow'),waveformOverlay(units.filter(unit=>unit.cls==='Broad'),502,135,390,215,C.broad,'Slow / broad'),line(72,372,892,372,{stroke:'#d4dae3'}),text(72,365,'TROUGH-ALIGNED WAVEFORM AND FEATURE SPACE',{'font-size':9,'font-weight':700,fill:C.mut}),alignedWaveforms(72,385,820,340),waveformScatter(72,750,820,500));
  parts.push(panel(950,55,620,1280,'B','Waveform composition by area',''));
  parts.push(legendLine(1115,106,C.broad,'Slow / broad'),legendLine(1285,106,C.fast,'Fast / narrow'),waveformCountBars(968,140,584,1120));
  parts.push(panel(30,1360,1540,900,'C','Cue-response latency by waveform class and area','upper and lower plots share identical cue-relative x geometry'));
  parts.push(legendLine(915,1420,C.M2,'M2'),legendLine(985,1420,C.M1,'M1'),legendLine(1055,1420,C.S1,'S1'),legendLine(1140,1420,C.ink,'slow / broad'),legendLine(1280,1420,C.ink,'fast / narrow','6 3'));
  parts.push(sixTraceChart(70,1440,1460,330),line(236,1782,1506,1782,{stroke:'#cfd6df'}),latencyBandChart(70,1790,1460,415));
  parts.push(panel(30,2285,1540,880,'D','Cue-response composition within waveform class',''));
  parts.push(legendLine(990,2330,C.exc,'Cue-excited'),legendLine(1120,2330,C.sup,'Cue-suppressed'),legendLine(1270,2330,C.unm,'Unmodulated'));
  scopes.forEach((scope,index)=>parts.push(compositionMini(scope,55+index*380,2370,350,700)));
  parts.push(text(40,H-14,'Waveform labels are extracellular descriptors, not confirmed neuronal identities. Delta traces are baseline-centered cohort means with 50 ms display smoothing.',{'font-size':10,fill:C.mut}));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}

fs.mkdirSync(path.join(root,'exports'),{recursive:true});
fs.writeFileSync(path.join(root,'exports','figure1_firing_rate_population.svg'),figureOneSvg());
fs.writeFileSync(path.join(root,'exports','figure2_waveform_latency.svg'),figureTwoSvg());
console.log(`Built data/figure12.js and two SVG figures from ${units.length} units.`);
