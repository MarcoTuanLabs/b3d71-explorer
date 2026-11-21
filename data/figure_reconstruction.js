(function(){
  'use strict';

  window.createFigureReconstruction=function(api){
    const {h,s,stext,svgEl,axes,legend,scatterChart,popHeatmap,showTip,on,
      AC,CC,UNITS,POP,FIG12,selectUnit}=api;
    if(!FIG12)return null;

    const scopes=['All','M2','M1','S1'];
    const funcs=['Cue-excited','Cue-suppressed','Unmodulated'];
    const funcColor={'Cue-excited':'#d95f45','Cue-suppressed':'#3f6da8','Unmodulated':'#9299a6'};
    const waveClasses=['Broad','Fast/Narrow'];
    const cueMin=Math.min(...UNITS.map(unit=>unit.cueBase));
    const cueMax=Math.max(...UNITS.map(unit=>unit.cueBase));
    const cueLimit=Math.max(Math.abs(cueMin),Math.abs(cueMax));
    const cueYMin=Math.floor(cueMin/5)*5;
    const cueYMax=Math.ceil(cueMax/5)*5;
    const cueTicks=[cueYMin,0,20,cueYMax].filter((value,index,array)=>value>=cueYMin&&value<=cueYMax&&array.indexOf(value)===index).sort((a,b)=>a-b);
    const xRateMax=Math.ceil(Math.max(...UNITS.flatMap(unit=>[unit.meanHz,unit.baseHz]))/10)*10;
    const ratioMax=Math.ceil(Math.max(...UNITS.map(unit=>unit.ratio))*10)/10;

    function cohort(scope){return scope==='All'?UNITS:UNITS.filter(unit=>unit.area===scope);}
    function panel(label,title,subtitle,body,extra=''){
      return h('section',{class:'card requested-panel reconstruction-panel '+extra},
        h('div',{class:'requested-panel-head'},h('span',{class:'panel-letter'},label),h('div',{},h('h3',{},title),subtitle?h('p',{},subtitle):null)),body);
    }
    function sectionHead(title,subtitle,href){
      return h('div',{class:'figure-section-head'},h('div',{},h('h2',{},title),h('span',{},subtitle)),href?h('a',{class:'btn figure-download',href,download:''},'Download SVG'):null);
    }
    function median(values){const sorted=values.slice().sort((a,b)=>a-b),middle=sorted.length>>1;return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
    function bins(values,min,max,count){const out=new Array(count).fill(0),step=(max-min)/count;values.forEach(value=>{if(value<min||value>max)return;out[Math.min(count-1,Math.floor((value-min)/step))]++;});return{out,step};}
    function diverging(value){
      const t=Math.max(-1,Math.min(1,value/cueLimit));
      const a=t<0?[40,102,177]:[238,240,243],b=t<0?[238,240,243]:[210,68,86],f=t<0?t+1:t;
      return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
    }
    function wrap(svg){return h('div',{class:'swrap'},svg);}

    function pairedHistogram(scope){
      const list=cohort(scope),W=420,H=330,pad={l:52,r:13,t:34,b:45},count=20,
        baseline=bins(list.map(unit=>unit.baseHz),0,xRateMax,count),full=bins(list.map(unit=>unit.meanHz),0,xRateMax,count),
        ymax=Math.max(...baseline.out,...full.out,1)*1.1,sv=svgEl(W,H),g=axes(sv,pad,W,H,[0,xRateMax],[0,ymax],{xt:[0,10,20,30,40,50].filter(value=>value<=xRateMax),yt:[0,Math.round(ymax/2),Math.round(ymax)],xl:'firing rate (Hz)',yl:'# units'}),plotW=W-pad.l-pad.r,binW=plotW/count;
      sv.append(stext(W/2,16,`${scope}  n=${list.length}`,{'font-size':12,'text-anchor':'middle','font-weight':700,fill:scope==='All'?'#263144':AC[scope]}));
      baseline.out.forEach((value,index)=>{const x=pad.l+index*binW,half=Math.max(1,binW/2-1),base=s('rect',{x:x+.7,y:g.sy(value),width:half,height:g.sy(0)-g.sy(value),fill:'#75a8c5',rx:1}),fullBar=s('rect',{x:x+binW/2,y:g.sy(full.out[index]),width:half,height:g.sy(0)-g.sy(full.out[index]),fill:'#244f86',rx:1});on(base,event=>showTip(event,`<b>${scope} baseline</b><br>${(index*baseline.step).toFixed(1)}-${((index+1)*baseline.step).toFixed(1)} Hz<br>${value} units`));on(fullBar,event=>showTip(event,`<b>${scope} full trial</b><br>${(index*full.step).toFixed(1)}-${((index+1)*full.step).toFixed(1)} Hz<br>${full.out[index]} units`));sv.append(base,fullBar);});
      return wrap(sv);
    }

    function histPanel(){
      return panel('A','Baseline versus full-trial firing-rate distributions','Baseline is trial 0-5 s (cue-relative -5 to 0 s); full trial is 0-25 s (cue-relative -5 to +20 s).',
        h('div',{},legend([['5 s baseline','#75a8c5'],['25 s full-trial mean','#244f86']]),h('div',{class:'four-plot-grid'},...scopes.map(pairedHistogram))));
    }

    function quantileTrend(list,key,count=9){
      const sorted=list.slice().sort((a,b)=>a[key]-b[key]),points=[];
      for(let bin=0;bin<count;bin++){
        const slice=sorted.slice(Math.floor(bin*sorted.length/count),Math.floor((bin+1)*sorted.length/count));
        if(slice.length>1)points.push([median(slice.map(unit=>unit[key])),median(slice.map(unit=>unit.cueBase))]);
      }
      return points;
    }

    function rateModulationChart(scope){
      const list=cohort(scope),W=360,H=300,pad={l:50,r:10,t:29,b:41},sv=svgEl(W,H),yr=[Math.floor(cueMin/5)*5,Math.ceil(cueMax/5)*5],g=axes(sv,pad,W,H,[0,xRateMax],yr,{xt:[0,10,20,30,40,50].filter(value=>value<=xRateMax),yt:[yr[0],0,20,yr[1]].filter((value,index,array)=>value>=yr[0]&&value<=yr[1]&&array.indexOf(value)===index),xl:'firing rate (Hz)',yl:'cue - baseline (Hz)'});
      sv.append(stext(W/2,14,`${scope}  n=${list.length}`,{'font-size':11.5,'text-anchor':'middle','font-weight':700,fill:scope==='All'?'#263144':AC[scope]}));
      list.forEach(unit=>{const mark=s('circle',{cx:g.sx(unit.meanHz),cy:g.sy(unit.cueBase),r:2,fill:diverging(unit.cueBase),'fill-opacity':.46});on(mark,event=>showTip(event,`<b>Unit ${unit.id}</b> · ${unit.area}<br>full mean ${unit.meanHz.toFixed(2)} Hz<br>baseline ${unit.baseHz.toFixed(2)} Hz<br>cue-base ${unit.cueBase.toFixed(2)} Hz`));mark.addEventListener('click',()=>selectUnit(unit.id));sv.append(mark);});
      funcs.forEach(func=>{
        const selected=list.filter(unit=>unit.func===func);
        [['baseHz','6 4'],['meanHz','']].forEach(([key,dash])=>{const points=quantileTrend(selected,key),d=points.map((point,index)=>(index?'L':'M')+g.sx(point[0]).toFixed(1)+' '+g.sy(point[1]).toFixed(1)).join(' ');sv.append(s('path',{d,fill:'none',stroke:funcColor[func],'stroke-width':2.1,'stroke-dasharray':dash,'stroke-linejoin':'round'}));});
      });
      return wrap(sv);
    }

    function rateColorKey(){
      return h('div',{class:'rate-color-key','aria-label':'Cue minus baseline color scale from inhibitory to activatory'},
        h('span',{class:'rate-key-top'},'activatory'),
        h('i',{class:'rate-key-gradient'}),
        h('span',{class:'rate-key-mid'},'neutral'),
        h('span',{class:'rate-key-bottom'},'inhibitory'),
        h('b',{},'cue-base'));
    }

    function ratePanel(){
      const legendNode=h('div',{class:'dual-legend'},legend(funcs.map(func=>[func,funcColor[func]])),h('span',{class:'line-key solid'},'25 s full-trial curve'),h('span',{class:'line-key dashed'},'5 s baseline curve'));
      return panel('C','Cue modulation versus baseline and full-trial firing rate','Points show each unit at its full-trial mean. Six curves are class-specific binned medians: three classes x two rate definitions.',
        h('div',{},legendNode,h('div',{class:'rate-modulation-layout'},rateColorKey(),h('div',{class:'four-plot-grid'},...scopes.map(rateModulationChart)))),'rate-panel');
    }

    function traceSeriesPath(values,g,end=5){let d='';FIG12.tax.forEach((time,index)=>{if(time>end)return;d+=(d?'L':'M')+g.sx(time).toFixed(1)+' '+g.sy(values[index]).toFixed(1)+' ';});return d;}
    function classTraceLimit(){return Math.max(.1,...scopes.flatMap(scope=>funcs.flatMap(func=>FIG12.classDelta[scope][func].values.map(Math.abs))))*1.05;}
    function compactClassTrace(scope,W){
      const H=180,pad={l:scope==='All'?43:36,r:8,t:15,b:34},limit=classTraceLimit(),sv=svgEl(W,H),g=axes(sv,pad,W,H,[-1,5],[-limit,limit],{xt:[-1,0,1,2,3,4,5],yt:[-limit,0,limit],xl:'time from cue (s)',yl:'delta Hz'});
      sv.append(s('line',{x1:g.sx(0),y1:pad.t,x2:g.sx(0),y2:H-pad.b,stroke:'#6e7889','stroke-dasharray':'4 3'}));
      funcs.forEach(func=>sv.append(s('path',{d:traceSeriesPath(FIG12.classDelta[scope][func].values,g),fill:'none',stroke:funcColor[func],'stroke-width':2,'stroke-linejoin':'round'})));
      return wrap(sv);
    }
    function rasterPanel(){
      const body=h('div',{},legend(funcs.map(func=>[func,funcColor[func]])),h('div',{class:'raster-figure-grid'}));
      const grid=body.lastChild;
      scopes.forEach(scope=>{const width=220,heatmap=popHeatmap(scope,scope==='All'?null:{a:scope});heatmap.className='raster-heat-fixed';grid.append(h('div',{class:'raster-trace-stack'},heatmap,h('div',{class:'aligned-trace-label'},'Functional-class mean delta rate'),compactClassTrace(scope,width)));});
      return panel('B','Population rasters with aligned functional-class delta-rate traces','Heatmaps show trial-averaged z-scored rate sorted by peak time. The aligned traces below are cohort-mean PSTH minus each unit own 5 s baseline.',body);
    }

    function waveformCountChart(){
      const W=700,H=900,pad={l:64,r:22,t:32,b:56},sv=svgEl(W,H),max=1400,g=axes(sv,pad,W,H,[0,4],[0,max],{xt:[],yt:[0,350,700,1050,1400],xl:'recording area',yl:'# neurons'}),slot=(W-pad.l-pad.r)/4,barW=slot*.62;
      scopes.forEach((scope,index)=>{
        const list=cohort(scope),slow=list.filter(unit=>unit.cls==='Broad').length,fast=list.length-slow,x=pad.l+index*slot+(slot-barW)/2,slowY=g.sy(slow),totalY=g.sy(slow+fast),fastH=slowY-totalY;
        const slowBar=s('rect',{x,y:slowY,width:barW,height:g.sy(0)-slowY,fill:CC.Broad}),fastBar=s('rect',{x,y:totalY,width:barW,height:fastH,fill:CC['Fast/Narrow']});
        on(slowBar,event=>showTip(event,`<b>${scope} slow/broad</b><br>${slow} neurons`));
        on(fastBar,event=>showTip(event,`<b>${scope} fast/narrow</b><br>${fast} neurons`));
        const countStyle=(color,size)=>({'font-size':size,'text-anchor':'middle','dominant-baseline':'middle',fill:'#fff','font-weight':800,stroke:color,'stroke-width':size<10?1.15:1.6,'paint-order':'stroke','stroke-linejoin':'round'}),fastFont=Math.max(8.2,Math.min(12.5,fastH*.72));
        sv.append(slowBar,fastBar,
          stext(x+barW/2,slowY+(g.sy(0)-slowY)/2,String(slow),countStyle(CC.Broad,12.5)),
          stext(x+barW/2,totalY+fastH/2,String(fast),countStyle(CC['Fast/Narrow'],fastFont)),
          stext(x+barW/2,H-pad.b+23,scope,{'font-size':12,'text-anchor':'middle','font-weight':700,fill:scope==='All'?'#263144':AC[scope]}));
      });
      return wrap(sv);
    }

    function waveformClassChart(cls){
      const W=420,H=225,pad={l:47,r:13,t:30,b:38},sv=svgEl(W,H),sampleMs=.03125,troughIndex=41,color=CC[cls],label=cls==='Fast/Narrow'?'Fast / narrow':'Slow / broad',list=UNITS.filter(unit=>unit.cls===cls),g=axes(sv,pad,W,H,[-1.25,1.25],[-1.1,.75],{xt:[-1,-.5,0,.5,1],yt:[-1,0,.5],xl:'time from waveform trough (ms)',yl:'normalized amplitude'}),step=Math.max(1,Math.ceil(list.length/175));
      sv.append(s('line',{x1:g.sx(0),y1:pad.t,x2:g.sx(0),y2:H-pad.b,stroke:'#818b9b','stroke-width':.9,'stroke-dasharray':'4 3'}));
      list.filter((_,index)=>index%step===0).forEach(unit=>{const d=unit.wf.map((value,index)=>(index?'L':'M')+g.sx((index-troughIndex)*sampleMs).toFixed(1)+' '+g.sy(value).toFixed(1)).join(' ');sv.append(s('path',{d,fill:'none',stroke:color,'stroke-width':.55,'stroke-opacity':.14,'stroke-linejoin':'round'}));});
      const mean=new Array(list[0].wf.length).fill(0);list.forEach(unit=>unit.wf.forEach((value,index)=>mean[index]+=value/list.length));sv.append(s('path',{d:mean.map((value,index)=>(index?'L':'M')+g.sx((index-troughIndex)*sampleMs).toFixed(1)+' '+g.sy(value).toFixed(1)).join(' '),fill:'none',stroke:color,'stroke-width':2.45,'stroke-linecap':'round','stroke-linejoin':'round'}),stext(W/2,14,`${label} · n=${list.length.toLocaleString()}`,{'font-size':11,'text-anchor':'middle','font-weight':750,fill:color}));
      return wrap(sv);
    }

    function alignedWaveformChart(){
      const W=840,H=245,pad={l:54,r:16,t:22,b:39},sv=svgEl(W,H),sampleMs=.03125,g=axes(sv,pad,W,H,[0,1],[-1.1,.75],{xt:[0,.2,.4,.6,.8,1],yt:[-1,0,.5],xl:'time after waveform trough (ms)',yl:'normalized amplitude'});
      sv.append(s('line',{x1:g.sx(.4),y1:pad.t,x2:g.sx(.4),y2:H-pad.b,stroke:'#7f8998','stroke-width':1.1,'stroke-dasharray':'5 3'}),stext(g.sx(.4)+4,pad.t+11,'0.4 ms',{'font-size':9.5,fill:'#6a7586'}));
      waveClasses.slice().reverse().forEach(cls=>{
        const list=UNITS.filter(unit=>unit.cls===cls),step=Math.max(1,Math.ceil(list.length/155)),color=CC[cls],aligned=list.map(unit=>{const trough=unit.wf.indexOf(Math.min(...unit.wf));return unit.wf.slice(trough,trough+33);});
        aligned.filter((_,index)=>index%step===0).forEach(values=>{const d=values.map((value,index)=>(index?'L':'M')+g.sx(index*sampleMs).toFixed(1)+' '+g.sy(value).toFixed(1)).join(' ');sv.append(s('path',{d,fill:'none',stroke:color,'stroke-width':.55,'stroke-opacity':.12,'stroke-linejoin':'round'}));});
        const length=Math.max(...aligned.map(values=>values.length)),mean=new Array(length).fill(0),counts=new Array(length).fill(0);aligned.forEach(values=>values.forEach((value,index)=>{mean[index]+=value;counts[index]++;}));mean.forEach((value,index)=>mean[index]=value/(counts[index]||1));
        const d=mean.map((value,index)=>(index?'L':'M')+g.sx(index*sampleMs).toFixed(1)+' '+g.sy(value).toFixed(1)).join(' ');sv.append(s('path',{d,fill:'none',stroke:color,'stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'}));
      });
      return wrap(sv);
    }

    function waveformAPanel(){
      const feature=scatterChart(UNITS,'t2p','ratio',[0,1],[0,ratioMax],'Trough-to-peak duration (ms)','Post-peak / trough ratio',unit=>CC[unit.cls],{cut:.4,cutLabel:'0.4 ms',xt:[0,.2,.4,.6,.8,1],yt:[0,.5,1,1.5,2],H:350,W:840});
      return panel('A','Normalized waveform templates and aligned feature space',`The two upper panels restore the class-specific waveform overlays. The lower comparison shares a 0-1 ms post-trough axis with the feature map. Fast/narrow units are red; slow/broad units are blue.`,h('div',{},legend([['Fast / narrow',CC['Fast/Narrow']],['Slow / broad',CC.Broad]]),h('div',{class:'waveform-class-overlays'},waveformClassChart('Fast/Narrow'),waveformClassChart('Broad')),h('div',{class:'waveform-a-subhead'},'Trough-aligned waveform and waveform feature space'),h('div',{class:'waveform-aligned-stack'},alignedWaveformChart(),feature)),'waveform-a');
    }
    function waveformBPanel(){return panel('B','Waveform-class composition by area','Vertical stacked bars report neuron counts, not percentages.',h('div',{},legend([['Slow / broad',CC.Broad],['Fast / narrow',CC['Fast/Narrow']]]),waveformCountChart()),'waveform-b');}

    function sixTraceLimit(){return Math.max(.1,...['M2','M1','S1'].flatMap(area=>waveClasses.flatMap(cls=>FIG12.waveformDelta[area][cls].values.map(Math.abs))))*1.05;}
    function sixTraceChart(){
      const W=1200,H=340,pad={l:176,r:24,t:18,b:46},limit=sixTraceLimit(),sv=svgEl(W,H),g=axes(sv,pad,W,H,[-1,4],[-limit,limit],{xt:[-1,0,1,2,3,4],yt:[-limit,0,limit],xl:'time from cue (s)',yl:'delta firing rate (Hz)'});
      sv.append(s('line',{x1:g.sx(0),y1:pad.t,x2:g.sx(0),y2:H-pad.b,stroke:'#6e7889','stroke-dasharray':'4 3'}));
      ['M2','M1','S1'].forEach(area=>waveClasses.forEach(cls=>sv.append(s('path',{d:traceSeriesPath(FIG12.waveformDelta[area][cls].values,g,4),fill:'none',stroke:AC[area],'stroke-width':cls==='Broad'?2.3:1.9,'stroke-dasharray':cls==='Broad'?'':'6 3','stroke-linejoin':'round'}))));
      return wrap(sv);
    }
    function latencyScatter(){
      const W=1200,H=470,pad={l:176,r:24,t:24,b:50},sv=svgEl(W,H),plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b,
        sx=value=>pad.l+(value+1)/5*plotW,divider=pad.t+plotH/2,bandH=plotH/2,bandTop={'Fast/Narrow':pad.t,Broad:divider},inset=17,
        sy=(cls,value)=>bandTop[cls]+inset+(cueYMax-Math.max(cueYMin,Math.min(cueYMax,value)))/(cueYMax-cueYMin)*(bandH-2*inset);
      sv.append(s('rect',{x:pad.l,y:pad.t,width:plotW,height:bandH,fill:CC['Fast/Narrow'],'fill-opacity':.055}),
        s('rect',{x:pad.l,y:divider,width:plotW,height:bandH,fill:CC.Broad,'fill-opacity':.055}));
      [-1,0,1,2,3,4].forEach(value=>{const x=sx(value);sv.append(s('line',{x1:x,y1:pad.t,x2:x,y2:H-pad.b,stroke:value===0?'#768196':'#e1e6ed','stroke-dasharray':value===0?'5 3':''}),stext(x,H-pad.b+17,String(value),{'font-size':10,'text-anchor':'middle'}));});
      waveClasses.forEach(cls=>cueTicks.forEach(value=>{const y=sy(cls,value);sv.append(s('line',{x1:pad.l,y1:y,x2:W-pad.r,y2:y,stroke:value===0?'#bcc5d1':'#e5e9ef','stroke-dasharray':value===0?'3 3':'','stroke-width':value===0?1.05:.8}),stext(pad.l-9,y+3,String(value),{'font-size':9.5,'text-anchor':'end',fill:'#657187'}));}));
      sv.append(s('line',{x1:pad.l,y1:divider,x2:W-pad.r,y2:divider,stroke:'#303b4d','stroke-width':1.4}),
        s('line',{x1:pad.l,y1:H-pad.b,x2:W-pad.r,y2:H-pad.b,stroke:'#aeb7c5'}),
        stext(pad.l+10,pad.t+14,'Fast / narrow',{'font-size':10.5,'font-weight':750,fill:CC['Fast/Narrow']}),
        stext(pad.l+10,divider+14,'Slow / broad',{'font-size':10.5,'font-weight':750,fill:CC.Broad}),
        stext(18,(pad.t+H-pad.b)/2,'cue - baseline delta firing rate (Hz)',{'font-size':10.5,'text-anchor':'middle',fill:'#586376',transform:`rotate(-90 18 ${(pad.t+H-pad.b)/2})`}),
        stext((pad.l+W-pad.r)/2,H-4,'PSTH peak latency from cue (s)',{'font-size':11,'text-anchor':'middle',fill:'#586376'}));
      UNITS.forEach((unit,index)=>{const x=sx(FIG12.peakTimeSec[index]),y=sy(unit.cls,unit.cueBase),color=AC[unit.area],mark=s('circle',{cx:x,cy:y,r:2.15,fill:color,'fill-opacity':.48});on(mark,event=>showTip(event,`<b>Unit ${unit.id}</b> · ${unit.area}<br>${unit.cls}<br>peak latency ${FIG12.peakTimeSec[index].toFixed(2)} s<br>cue-base ${unit.cueBase.toFixed(2)} Hz`));mark.addEventListener('click',()=>selectUnit(unit.id));sv.append(mark);});
      waveClasses.forEach(cls=>['M2','M1','S1'].forEach(area=>{const selected=UNITS.map((unit,index)=>({unit,index})).filter(item=>item.unit.area===area&&item.unit.cls===cls),latency=median(selected.map(item=>FIG12.peakTimeSec[item.index])),delta=median(selected.map(item=>item.unit.cueBase)),x=sx(latency),y=sy(cls,delta),mark=s('path',{d:`M${x} ${y-5}L${x+5} ${y}L${x} ${y+5}L${x-5} ${y}Z`,fill:AC[area],stroke:'#fff','stroke-width':1.1});on(mark,event=>showTip(event,`<b>${area} · ${cls}</b><br>median latency ${latency.toFixed(2)} s<br>median cue-base ${delta.toFixed(2)} Hz<br>n=${selected.length}`));sv.append(mark);}));
      return wrap(sv);
    }
    function waveformCPanel(){
      const key=h('div',{class:'dual-legend'},legend([['M2',AC.M2],['M1',AC.M1],['S1',AC.S1]]),h('span',{class:'line-key solid'},'slow / broad'),h('span',{class:'line-key dashed'},'fast / narrow'));
      return panel('C','Cue-response latency by waveform class and area','One shared cue-relative time axis links both parts. The lower PSTH peak-latency distribution repeats the same numerical cue-baseline delta-rate axis; a horizontal cutoff separates fast/narrow from slow/broad units.',h('div',{},key,h('div',{class:'linked-latency-stack'},sixTraceChart(),latencyScatter())),'waveform-c');
    }

    function compositionChart(scope){
      const W=360,H=455,pad={l:19,r:19,t:49,b:57},sv=svgEl(W,H),list=cohort(scope),classes=[['Broad','Slow / broad'],['Fast/Narrow','Fast / narrow']],plotH=H-pad.t-pad.b,barW=92;
      sv.append(stext(W/2,17,scope,{'font-size':13,'text-anchor':'middle','font-weight':700,fill:scope==='All'?'#263144':AC[scope]}));
      classes.forEach(([cls,label],index)=>{
        const selected=list.filter(unit=>unit.cls===cls),x=34+index*181,segments=[];let bottom=pad.t+plotH;
        funcs.forEach(func=>{const count=selected.filter(unit=>unit.func===func).length,percent=100*count/Math.max(1,selected.length),height=plotH*count/Math.max(1,selected.length);bottom-=height;const segment=s('rect',{x,y:bottom,width:barW,height,fill:funcColor[func]});on(segment,event=>showTip(event,`<b>${scope} · ${label}</b><br>${func}: ${count} of ${selected.length}<br>${percent.toFixed(1)}%`));sv.append(segment);segments.push({func,percent,height,center:bottom+height/2,labelY:bottom+height/2});});
        const tiny=segments.filter(item=>item.height<22).sort((a,b)=>a.center-b.center);let cursor=pad.t-6;tiny.forEach(item=>{item.labelY=Math.max(item.center,cursor+13);cursor=item.labelY;});const overflow=Math.max(0,cursor-(pad.t+plotH-7));tiny.forEach(item=>item.labelY-=overflow);
        segments.forEach(item=>{const labelText=`${Math.round(item.percent)}%`,small=item.height<22,labelY=small?item.labelY:item.center;sv.append(stext(x+barW/2,labelY,labelText,{'font-size':small?8.4:10.5,'text-anchor':'middle','dominant-baseline':'middle',fill:'#fff','font-weight':800,stroke:funcColor[item.func],'stroke-width':small?1.25:0,'paint-order':'stroke','stroke-linejoin':'round'}));});
        sv.append(stext(x+barW/2,pad.t-15,`n=${selected.length}`,{'font-size':10.5,'text-anchor':'middle',fill:'#68758a'}),stext(x+barW/2,H-27,label,{'font-size':11,'text-anchor':'middle',fill:'#68758a'}));
      });
      return wrap(sv);
    }
    function waveformDPanel(){return panel('D','Cue-response composition within waveform class','Each slow/fast bar is normalized independently to 100%; labels preserve sample sizes.',h('div',{},legend(funcs.map(func=>[func,funcColor[func]])),h('div',{class:'composition-grid'},...scopes.map(compositionChart))),'waveform-d');}

    function waveformLayout(){return h('div',{class:'figure-two-grid'},waveformAPanel(),waveformBPanel(),waveformCPanel(),waveformDPanel());}
    function methodsNote(){return h('details',{class:'compact-details figure-methods'},h('summary',{},'Definitions and scientific guardrails'),h('p',{},'Full-trial mean uses the complete 25 s window. Baseline uses the first 5 s before cue. Delta traces subtract each unit baseline before cohort averaging and use 50 ms Gaussian display smoothing. Peak time is recomputed from the smoothed PSTH in -1 to +4 s. Waveform classes are extracellular descriptors, not confirmed excitatory or inhibitory identities.'));}

    function vFiring(main){
      main.append(h('div',{class:'head'},h('h1',{},'Firing rates'),h('span',{class:'sub'},'Figure 1A/C · 1,346 units · 80-trial mean PSTHs')),
        h('div',{class:'summary-strip'},h('span',{},h('b',{},'0-5 s'),' trial baseline'),h('span',{},h('b',{},'0-25 s'),' full trial'),h('span',{},h('b',{},'-5 to 0 s'),' cue-relative baseline'),h('span',{},h('b',{},'-5 to +20 s'),' cue-relative full window')),
        sectionHead('Figure 1A','Rate distributions within All, M2, M1, and S1'),histPanel(),sectionHead('Figure 1C','Cue modulation versus firing-rate definition'),ratePanel(),methodsNote());
    }
    function vWaveform(main){
      main.append(h('div',{class:'head'},h('h1',{},'Waveform classes'),h('span',{class:'sub'},'Figure 2A-D · full 1,346-unit cohort')),waveformLayout(),methodsNote());
    }
    function populationRasterPanels(){return rasterPanel();}
    function figurePlate(number,title,subtitle,href,body,extra=''){
      return h('section',{class:`reconstruction-paper ${extra}`.trim()},
        sectionHead(`Figure ${number}`,title,href),
        h('p',{class:'reconstruction-paper-deck'},subtitle),
        body);
    }
    function vReconstruction(main){
      main.append(h('div',{class:'head'},h('h1',{},'Figure reconstruction'),h('span',{class:'sub'},'Requested A-D layouts rebuilt from the available unit and PSTH data')),
        h('div',{class:'note'},'These are data reconstructions, not traced copies of the whiteboard sketches. The sketches define panel placement; axes, denominators, and curves come from the recorded dataset.'),
        figurePlate('1','Firing-rate distribution, population raster, and cue modulation','Baseline and complete-trial rate definitions are kept distinct throughout; all four regional panels use the same visual grammar and axis construction.','exports/figure1_firing_rate_population.svg',h('div',{class:'reconstruction-figure-flow figure-one-flow'},histPanel(),rasterPanel(),ratePanel()),'figure-one-paper'),
        figurePlate('2','Waveform class, timing, and cue-response composition','Waveform shape, latency, and cue modulation are arranged as one coordinated figure with shared class and region encodings.','exports/figure2_waveform_latency.svg',waveformLayout(),'figure-two-paper'),
        methodsNote());
    }

    return{vFiring,vWaveform,vReconstruction,populationRasterPanels};
  };
})();
