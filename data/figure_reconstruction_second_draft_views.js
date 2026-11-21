(function(){
  'use strict';

  window.createFigureReconstructionSecondDraft=function(api){
    const {h,s,stext,svgEl,axes,legend,showTip,on,AC,UNITS,SECOND_DRAFT}=api;
    if(!SECOND_DRAFT)return null;

    const scopes=['All','M2','M1','S1'];
    const areas=['M2','M1','S1'];
    const responseClasses=['Cue-excited','Cue-suppressed','Unmodulated'];
    const waveClasses=['Broad','Fast/Narrow'];
    const responseColor={
      'Cue-excited':'#d95f45',
      'Cue-suppressed':'#3f6da8',
      Unmodulated:'#9299a6'
    };
    const waveColor={Broad:'#6b5bd2','Fast/Narrow':'#e1cf36'};
    const waveInk={Broad:'#5545b7','Fast/Narrow':'#6d640f'};
    const rateColor={baseline:'#89a5b6',post:'#334e68'};
    const metrics=SECOND_DRAFT.metrics;
    const unitById=new Map(UNITS.map(unit=>[unit.id,unit]));
    const cueLimit=Math.ceil(Math.max(...metrics.map(metric=>Math.abs(metric.cueDelta)))/5)*5;

    function wrap(svg,extra=''){return h('div',{class:`swrap ${extra}`.trim()},svg);}
    function cohort(scope){return scope==='All'?metrics:metrics.filter(metric=>metric.area===scope);}
    function mean(values){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;}
    function median(values){
      if(!values.length)return null;
      const sorted=values.slice().sort((a,b)=>a-b),middle=sorted.length>>1;
      return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
    }
    function panel(label,title,subtitle,body,extra=''){
      return h('section',{class:`second-draft-panel ${extra}`.trim()},
        h('div',{class:'second-draft-panel-head'},
          h('span',{class:'second-draft-letter'},label),
          h('div',{},h('h3',{},title),subtitle?h('p',{},subtitle):null)),
        body);
    }
    function sectionHead(number,title,subtitle,download){
      return h('div',{class:'second-draft-figure-head'},
        h('div',{},h('span',{class:'second-draft-figure-number'},`Figure ${number}`),h('h2',{},title),h('p',{},subtitle)),
        download?h('a',{class:'btn figure-download',href:download,download:''},'Download SVG'):null);
    }
    function linePath(values,sx,sy,tax=SECOND_DRAFT.tax,maxTime=Infinity){
      let path='';
      values.forEach((value,index)=>{
        if(tax[index]>maxTime)return;
        path+=`${path?'L':'M'}${sx(tax[index]).toFixed(2)} ${sy(value).toFixed(2)} `;
      });
      return path;
    }
    function bandPath(values,sems,sx,sy,tax=SECOND_DRAFT.tax,maxTime=Infinity){
      const points=[];
      values.forEach((value,index)=>{if(tax[index]<=maxTime)points.push([sx(tax[index]),sy(value+sems[index])]);});
      for(let index=values.length-1;index>=0;index--)if(tax[index]<=maxTime)points.push([sx(tax[index]),sy(values[index]-sems[index])]);
      return points.map((point,index)=>`${index?'L':'M'}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(' ')+'Z';
    }
    function scopeColor(scope){return scope==='All'?'#263144':AC[scope];}
    function classLegend(){
      return legend(responseClasses.map(name=>[name,responseColor[name]]));
    }

    function adaptiveHistogram(values,edges){
      const counts=new Array(edges.length-1).fill(0);
      values.forEach(value=>{
        for(let index=0;index<edges.length-1;index++){
          if(value>=edges[index]&&(value<edges[index+1]||(index===edges.length-2&&value<=edges[index+1]))){
            counts[index]++;
            break;
          }
        }
      });
      return counts.map((count,index)=>({
        start:edges[index],
        end:edges[index+1],
        count,
        density:count/(edges[index+1]-edges[index])
      }));
    }

    function rateHistogram(scope){
      const list=cohort(scope),edges=SECOND_DRAFT.meta.adaptiveRateBinsHz;
      const baseline=adaptiveHistogram(list.map(metric=>metric.baselineHz),edges);
      const post=adaptiveHistogram(list.map(metric=>metric.postHz),edges);
      const W=560,H=350,pad={l:58,r:18,t:36,b:48};
      const ymax=Math.max(...baseline.map(bin=>bin.density),...post.map(bin=>bin.density),1)*1.1;
      const svg=svgEl(W,H);
      const graph=axes(svg,pad,W,H,[0,50],[0,ymax],{
        xt:[0,10,20,30,40,50],
        yt:[0,Math.round(ymax/2),Math.round(ymax)],
        xl:'firing rate (Hz)',
        yl:'unit density (# per Hz)'
      });
      baseline.forEach((bin,index)=>{
        const x=graph.sx(bin.start),width=graph.sx(bin.end)-x;
        svg.append(s('rect',{
          x:x+1,y:graph.sy(bin.density),width:Math.max(1,width/2-1.5),
          height:graph.sy(0)-graph.sy(bin.density),fill:rateColor.baseline,'fill-opacity':.9
        }));
        const postBin=post[index],postX=x+width/2;
        svg.append(s('rect',{
          x:postX+.5,y:graph.sy(postBin.density),width:Math.max(1,width/2-1.5),
          height:graph.sy(0)-graph.sy(postBin.density),fill:rateColor.post,'fill-opacity':.92
        }));
      });
      svg.append(stext(W/2,17,`${scope}  n=${list.length}`,{
        'font-size':12,'font-weight':750,'text-anchor':'middle',fill:scopeColor(scope)
      }));
      return wrap(svg);
    }

    function figure1A(){
      const key=legend([
        ['Baseline -5 to 0 s',rateColor.baseline],
        ['Post-cue 0 to 20 s',rateColor.post]
      ]);
      return panel(
        'A',
        'Baseline and post-cue firing-rate distributions',
        'Rates are computed separately in Hz: a 5 s baseline and the following 20 s post-cue period. Variable-width bins are normalized by bin width.',
        h('div',{},key,h('div',{class:'second-draft-four-grid'},...scopes.map(rateHistogram))),
        'second-draft-1a'
      );
    }

    function populationRasterComposite(){
      const W=1530,H=650,plotY=72,plotH=500,bottom=H-plotY-plotH;
      const panels=[
        {scope:'All',x:70,w:370},
        {scope:'M2',x:498,w:300},
        {scope:'M1',x:826,w:300},
        {scope:'S1',x:1154,w:300}
      ];
      const svg=svgEl(W,H);
      const defs=s('defs');
      const gradient=s('linearGradient',{id:'secondDraftParula',x1:'0%',y1:'100%',x2:'0%',y2:'0%'});
      [
        ['0%','#312a88'],['8.333%','#2141b0'],['16.667%','#1158d6'],
        ['25%','#0976d4'],['33.333%','#0094d2'],['41.667%','#11a6bd'],
        ['50%','#21b7a7'],['58.333%','#4eb789'],['66.667%','#79b76b'],
        ['75%','#a9b85b'],['83.333%','#daba4d'],['91.667%','#ead729'],
        ['100%','#f8f508']
      ].forEach(([offset,color])=>gradient.append(s('stop',{offset,'stop-color':color})));
      defs.append(gradient);
      svg.append(defs);
      panels.forEach(({scope,x,w})=>{
        const info=SECOND_DRAFT.heatmaps[scope],sx=value=>x+(value+1)/6*w;
        if(scope==='All'){
          svg.append(stext(x,50,'All units (1,346)',{'font-size':14,'font-weight':700,fill:'#222a35'}));
          svg.append(stext(x+w,50,'Average of 80 trials',{'font-size':14,'font-weight':700,'text-anchor':'end',fill:'#222a35'}));
        }else{
          svg.append(stext(x+w/2,25,scope,{
            'font-size':23,'font-weight':800,'text-anchor':'middle',fill:AC[scope]
          }));
          svg.append(s('rect',{x,y:37,width:w,height:11,fill:AC[scope]}));
        }
        svg.append(s('image',{x,y:plotY,width:w,height:plotH,href:info.src,preserveAspectRatio:'none'}));
        svg.append(s('rect',{x,y:plotY,width:w,height:plotH,fill:'none',stroke:'#8793a5','stroke-width':.8}));
        svg.append(s('line',{
          x1:sx(0),y1:plotY,x2:sx(0),y2:plotY+plotH,
          stroke:'#fff','stroke-width':1.3,'stroke-dasharray':'6 4'
        }));
        [-1,0,1,2,3,4,5].forEach(value=>{
          const tickX=sx(value);
          svg.append(s('line',{x1:tickX,y1:plotY+plotH,x2:tickX,y2:plotY+plotH+5,stroke:'#6c7788'}));
          svg.append(stext(tickX,plotY+plotH+19,String(value),{
            'font-size':11,'text-anchor':'middle',fill:'#344052'
          }));
        });
        svg.append(stext(x+w/2,H-12,'Time from cue (s)',{
          'font-size':13,'text-anchor':'middle',fill:'#273143'
        }));
        if(scope!=='All'){
          svg.append(stext(x+w-8,plotY+17,`${info.n} units`,{
            'font-size':13,'font-weight':700,'text-anchor':'end',fill:'#fff',
            stroke:'#455264','stroke-width':1.5,'paint-order':'stroke'
          }));
        }
      });
      const all=panels[0],allInfo=SECOND_DRAFT.heatmaps.All,stripX=451,stripW=12,rowH=plotH/allInfo.n;
      allInfo.areaStrip.forEach((area,index)=>svg.append(s('rect',{
        x:stripX,y:plotY+index*rowH,width:stripW,height:Math.max(.38,rowH+.08),fill:AC[area]
      })));
      svg.append(s('rect',{x:stripX,y:plotY,width:stripW,height:plotH,fill:'none',stroke:'#768194','stroke-width':.7}));
      [1,500,1000,1346].forEach(value=>{
        const y=plotY+(value-1)/(allInfo.n-1)*plotH;
        svg.append(s('line',{x1:all.x-5,y1:y,x2:all.x,y2:y,stroke:'#687487'}));
        svg.append(stext(all.x-9,y+4,value.toLocaleString(),{
          'font-size':11,'text-anchor':'end',fill:'#344052'
        }));
      });
      svg.append(stext(20,plotY+plotH/2,'Sorted unit number',{
        'font-size':13,'font-weight':650,'text-anchor':'middle',fill:'#273143',
        transform:`rotate(-90 20 ${plotY+plotH/2})`
      }));
      const keyX=1480,keyW=16;
      svg.append(s('rect',{x:keyX,y:plotY,width:keyW,height:plotH,fill:'url(#secondDraftParula)',stroke:'#7c8796','stroke-width':.7}));
      [-2,-1,0,1,2,3,4].forEach(value=>{
        const y=plotY+(4-value)/6*plotH;
        svg.append(s('line',{x1:keyX+keyW,y1:y,x2:keyX+keyW+5,y2:y,stroke:'#657187'}));
        svg.append(stext(keyX+keyW+9,y+4,String(value),{'font-size':10,fill:'#344052'}));
      });
      svg.append(stext(keyX+keyW+10,plotY+plotH+19,'z',{'font-size':11,'font-weight':700,fill:'#344052'}));
      return wrap(svg,'second-draft-raster-composite');
    }

    function responseTraceLimit(){
      let limit=0;
      scopes.forEach(scope=>{
        responseClasses.forEach(responseClass=>{
          const trace=SECOND_DRAFT.responseTraces[scope][responseClass];
          trace.mean.forEach((value,index)=>{limit=Math.max(limit,Math.abs(value)+trace.sem[index]);});
        });
        const reference=SECOND_DRAFT.referenceTraces[scope];
        reference.mean.forEach((value,index)=>limit=Math.max(
          limit,Math.abs(value-reference.sd[index]),Math.abs(value+reference.sd[index])
        ));
      });
      return Math.max(2,Math.ceil(limit/2)*2);
    }

    function responseTracePanel(scope,limit){
      const traces=SECOND_DRAFT.responseTraces[scope],reference=SECOND_DRAFT.referenceTraces[scope];
      const W=390,H=280,pad={l:54,r:16,t:37,b:44},svg=svgEl(W,H);
      const graph=axes(svg,pad,W,H,[-1,5],[-limit,limit],{
        xt:[-1,0,1,2,3,4,5],
        yt:[-limit,0,limit],
        xl:'time from cue (s)',
        yl:scope==='All'?'baseline-centered rate (Hz)':''
      });
      svg.append(s('line',{x1:graph.sx(0),y1:pad.t,x2:graph.sx(0),y2:H-pad.b,stroke:'#788499','stroke-dasharray':'5 3'}));
      svg.append(s('path',{
        d:bandPath(reference.mean,reference.sd,graph.sx,graph.sy),
        fill:'#7f8794','fill-opacity':.24,stroke:'none'
      }));
      const referenceUpper=reference.mean.map((value,index)=>value+reference.sd[index]);
      const referenceLower=reference.mean.map((value,index)=>value-reference.sd[index]);
      [referenceUpper,referenceLower].forEach(values=>svg.append(s('path',{
        d:linePath(values,graph.sx,graph.sy),
        fill:'none',stroke:'#727a87','stroke-width':1,'stroke-dasharray':'4 3'
      })));
      responseClasses.forEach(responseClass=>{
        const trace=traces[responseClass],color=responseColor[responseClass];
        svg.append(s('path',{
          d:bandPath(trace.mean,trace.sem,graph.sx,graph.sy),
          fill:color,'fill-opacity':.13,stroke:'none'
        }));
        svg.append(s('path',{
          d:linePath(trace.mean,graph.sx,graph.sy),
          fill:'none',stroke:color,'stroke-width':2.05,'stroke-linejoin':'round','stroke-linecap':'round'
        }));
      });
      const counts=SECOND_DRAFT.thresholdCounts[scope].counts;
      svg.append(stext(W/2,16,`${scope}  n=${SECOND_DRAFT.thresholdCounts[scope].n}`,{
        'font-size':12,'font-weight':750,'text-anchor':'middle',fill:scopeColor(scope)
      }));
      svg.append(stext(W/2,29,`E ${counts['Cue-excited']}  ·  S ${counts['Cue-suppressed']}  ·  U ${counts.Unmodulated}`,{
        'font-size':8.3,'text-anchor':'middle',fill:'#697487'
      }));
      return wrap(svg);
    }

    function figure1B(){
      const limit=responseTraceLimit();
      return panel(
        'B',
        'Cue-aligned population activity and one-SD response classes',
        'Each raster row is baseline z-scored using that unit\'s -5 to 0 s activity, then sorted by PSTH peak time. Lower panels show one-SD classes; gray is the predefined unmodulated cohort mean +/- 1 SD and colored uncertainty is mean +/- SEM.',
        h('div',{},
          populationRasterComposite(),
          h('div',{class:'second-draft-response-grid'},...scopes.map(scope=>responseTracePanel(scope,limit)))),
        'second-draft-1b'
      );
    }

    function binnedTrend(list,key,responseClass){
      const edges=SECOND_DRAFT.meta.adaptiveRateBinsHz,selected=list.filter(metric=>metric.responseClass===responseClass),points=[];
      for(let index=0;index<edges.length-1;index++){
        const inBin=selected.filter(metric=>metric[key]>=edges[index]&&metric[key]<(index===edges.length-2?edges[index+1]+1e-9:edges[index+1]));
        if(inBin.length<5)continue;
        points.push([median(inBin.map(metric=>metric[key])),median(inBin.map(metric=>metric.cueDelta)),inBin.length]);
      }
      return points;
    }

    function compositionBar(svg,list,x,y,height,width){
      let cursor=y+height;
      responseClasses.forEach(responseClass=>{
        const count=list.filter(metric=>metric.responseClass===responseClass).length;
        const segmentHeight=height*count/list.length;
        cursor-=segmentHeight;
        svg.append(s('rect',{x,y:cursor,width,height:segmentHeight,fill:responseColor[responseClass]}));
        svg.append(stext(x+width/2,cursor+segmentHeight/2,`${Math.round(100*count/list.length)}%`,{
          'font-size':segmentHeight<18?6.8:8.5,'font-weight':800,'text-anchor':'middle',
          'dominant-baseline':'middle',fill:'#fff',stroke:'#4f5968','stroke-width':segmentHeight<18?1.5:.8,
          'paint-order':'stroke'
        }));
      });
      svg.append(s('rect',{x,y,width,height,fill:'none',stroke:'#aeb8c6','stroke-width':.8}));
    }

    function modulationPanel(scope){
      const list=cohort(scope),W=570,H=380,pad={l:57,r:52,t:36,b:48},svg=svgEl(W,H);
      const graph=axes(svg,pad,W,H,[0,50],[-cueLimit,cueLimit],{
        xt:[0,10,20,30,40,50],
        yt:[-cueLimit,0,cueLimit],
        xl:'0-20 s firing rate (Hz)',
        yl:'cue - baseline (Hz)'
      });
      const lower=SECOND_DRAFT.unmodulatedReference.responseLowerHz;
      const upper=SECOND_DRAFT.unmodulatedReference.responseUpperHz;
      svg.append(s('rect',{
        x:pad.l,y:graph.sy(upper),width:W-pad.l-pad.r,height:Math.max(1,graph.sy(lower)-graph.sy(upper)),
        fill:responseColor.Unmodulated,'fill-opacity':.13
      }));
      [
        [lower,responseColor['Cue-suppressed']],
        [upper,responseColor['Cue-excited']]
      ].forEach(([value,color])=>svg.append(s('line',{
        x1:pad.l,y1:graph.sy(value),x2:W-pad.r,y2:graph.sy(value),
        stroke:color,'stroke-width':1.15,'stroke-dasharray':'5 3'
      })));
      svg.append(stext(W-pad.r-4,graph.sy(upper)-4,`+1 SD  ${upper.toFixed(2)} Hz`,{
        'font-size':7.7,'font-weight':700,'text-anchor':'end',fill:responseColor['Cue-excited'],
        stroke:'#fff','stroke-width':2,'paint-order':'stroke'
      }));
      svg.append(stext(W-pad.r-4,graph.sy(lower)+10,`-1 SD  ${lower.toFixed(2)} Hz`,{
        'font-size':7.7,'font-weight':700,'text-anchor':'end',fill:responseColor['Cue-suppressed'],
        stroke:'#fff','stroke-width':2,'paint-order':'stroke'
      }));
      svg.append(s('line',{x1:pad.l,y1:graph.sy(0),x2:W-pad.r,y2:graph.sy(0),stroke:'#9da8b7','stroke-dasharray':'4 3'}));
      list.forEach(metric=>{
        const mark=s('circle',{
          cx:graph.sx(Math.min(50,metric.postHz)),cy:graph.sy(metric.cueDelta),r:2.65,
          fill:responseColor[metric.responseClass],'fill-opacity':.7,stroke:'#fff','stroke-width':.45
        });
        on(mark,event=>showTip(event,`<b>Unit ${metric.id}</b> · ${metric.area}<br>0-20 s rate ${metric.postHz.toFixed(2)} Hz<br>cue-baseline ${metric.cueDelta.toFixed(2)} Hz<br>${metric.responseClass}`));
        svg.append(mark);
      });
      responseClasses.forEach(responseClass=>{
        const points=binnedTrend(list,'postHz',responseClass);
        if(points.length<2)return;
        const path=points.map((point,index)=>`${index?'L':'M'}${graph.sx(point[0]).toFixed(2)} ${graph.sy(point[1]).toFixed(2)}`).join(' ');
        svg.append(s('path',{
          d:path,fill:'none',stroke:responseColor[responseClass],'stroke-width':2.35,
          'stroke-linecap':'round','stroke-linejoin':'round'
        }));
        points.forEach(point=>svg.append(s('circle',{
          cx:graph.sx(point[0]),cy:graph.sy(point[1]),r:2.5,
          fill:responseColor[responseClass],stroke:'#fff','stroke-width':.7
        })));
      });
      compositionBar(svg,list,W-36,pad.t,graph.sy(-cueLimit)-pad.t,18);
      svg.append(stext(W/2,17,`${scope}  n=${list.length}`,{
        'font-size':12,'font-weight':750,'text-anchor':'middle',fill:scopeColor(scope)
      }));
      svg.append(stext(W-27,H-pad.b+17,'1 SD',{'font-size':8.5,'text-anchor':'middle',fill:'#68758a'}));
      return wrap(svg);
    }

    function figure1C(){
      const lineKey=h('div',{class:'second-draft-line-key'},
        classLegend(),
        h('span',{class:'line-sample solid'},'adaptive-bin median'),
        h('span',{class:'line-sample dashed'},'one-SD class boundary'));
      return panel(
        'C',
        'Cue modulation versus 0-20 s firing rate',
        'Dots are individual units classified by the same cue-minus-baseline value on the y-axis. Dashed bounds mark the predefined unmodulated cohort mean +/- 1 SD; units inside the gray band are unmodulated. Curves are adaptive-bin medians.',
        h('div',{},lineKey,h('div',{class:'second-draft-four-grid'},...scopes.map(modulationPanel))),
        'second-draft-1c'
      );
    }

    function waveformOverlay(waveClass){
      const list=UNITS.filter(unit=>unit.cls===waveClass),sample=list.filter((_,index)=>index%Math.max(1,Math.floor(list.length/85))===0).slice(0,85);
      const W=520,H=270,pad={l:53,r:16,t:35,b:42},svg=svgEl(W,H),n=list[0].wf.length;
      const sx=index=>pad.l+((index-41)/32+1.3)/2.6*(W-pad.l-pad.r);
      const sy=value=>pad.t+(1.05-value)/2.1*(H-pad.t-pad.b);
      [-1,0,1].forEach(value=>{
        const x=pad.l+(value+1.3)/2.6*(W-pad.l-pad.r);
        svg.append(s('line',{x1:x,y1:pad.t,x2:x,y2:H-pad.b,stroke:value===0?'#9aa5b4':'#e2e7ed','stroke-dasharray':value===0?'4 3':''}));
        svg.append(stext(x,H-pad.b+16,String(value),{'font-size':9,'text-anchor':'middle',fill:'#657187'}));
      });
      [-1,0,1].forEach(value=>svg.append(stext(pad.l-7,sy(value)+3,String(value),{'font-size':9,'text-anchor':'end',fill:'#657187'})));
      sample.forEach(unit=>{
        const path=unit.wf.map((value,index)=>`${index?'L':'M'}${sx(index).toFixed(2)} ${sy(value).toFixed(2)}`).join(' ');
        svg.append(s('path',{d:path,fill:'none',stroke:waveColor[waveClass],'stroke-opacity':.11,'stroke-width':.8}));
      });
      const average=new Array(n).fill(0);
      list.forEach(unit=>unit.wf.forEach((value,index)=>average[index]+=value/list.length));
      svg.append(s('path',{
        d:average.map((value,index)=>`${index?'L':'M'}${sx(index).toFixed(2)} ${sy(value).toFixed(2)}`).join(' '),
        fill:'none',stroke:waveColor[waveClass],'stroke-width':2.8,'stroke-linejoin':'round'
      }));
      svg.append(stext(W/2,17,`${SECOND_DRAFT.waveClassLabels[waveClass]}  n=${list.length}`,{
        'font-size':12,'font-weight':750,'text-anchor':'middle',fill:waveInk[waveClass]
      }));
      svg.append(stext(W/2,H-5,'time from trough (ms)',{'font-size':10,'text-anchor':'middle',fill:'#596579'}));
      svg.append(stext(13,H/2,'normalized amplitude',{'font-size':10,'text-anchor':'middle',fill:'#596579',transform:`rotate(-90 13 ${H/2})`}));
      return wrap(svg);
    }

    function waveformFeatureSpace(){
      const W=1060,H=340,pad={l:60,r:20,t:30,b:48},svg=svgEl(W,H);
      const ratioMax=Math.ceil(Math.max(...UNITS.map(unit=>unit.ratio))*10)/10;
      const graph=axes(svg,pad,W,H,[0,1.05],[0,ratioMax],{
        xt:[0,.2,.4,.6,.8,1],
        yt:[0,.4,.8,1.2].filter(value=>value<=ratioMax),
        xl:'trough-to-peak duration (ms)',
        yl:'post-peak / trough ratio'
      });
      svg.append(s('line',{x1:graph.sx(.4),y1:pad.t,x2:graph.sx(.4),y2:H-pad.b,stroke:'#555f6f','stroke-width':1.2,'stroke-dasharray':'5 3'}));
      UNITS.forEach(unit=>{
        const mark=s('circle',{
          cx:graph.sx(unit.t2p),cy:graph.sy(unit.ratio),r:2.25,
          fill:waveColor[unit.cls],'fill-opacity':.58,
          stroke:unit.cls==='Fast/Narrow'?waveInk['Fast/Narrow']:'#fff','stroke-width':unit.cls==='Fast/Narrow'?.35:.25
        });
        on(mark,event=>showTip(event,`<b>Unit ${unit.id}</b> · ${unit.area}<br>${SECOND_DRAFT.waveClassLabels[unit.cls]}<br>t2p ${unit.t2p.toFixed(3)} ms<br>PP/tr ${unit.ratio.toFixed(3)}`));
        svg.append(mark);
      });
      svg.append(stext(graph.sx(.4)+6,pad.t+12,'0.4 ms operational cutoff',{'font-size':9.5,fill:'#555f6f'}));
      return wrap(svg);
    }

    function figure2A(){
      return panel(
        'A',
        'Normalized extracellular waveforms and waveform feature space',
        'The two waveform classes use a dedicated purple-yellow palette. Pale traces are deterministic samples; bold traces are class means.',
        h('div',{},legend([
          ['Slow / broad',waveColor.Broad],
          ['Fast / narrow',waveColor['Fast/Narrow']]
        ]),h('div',{class:'second-draft-waveform-a-grid'},waveformOverlay('Broad'),waveformOverlay('Fast/Narrow'),waveformFeatureSpace())),
        'second-draft-2a'
      );
    }

    function figure2BChart(){
      const W=1040,H=470,pad={l:68,r:28,t:62,b:62},svg=svgEl(W,H);
      const plotH=H-pad.t-pad.b,plotW=W-pad.l-pad.r,barW=128;
      const sy=value=>H-pad.b-value/100*plotH;
      [0,25,50,75,100].forEach(value=>{
        const y=sy(value);
        svg.append(s('line',{x1:pad.l,y1:y,x2:W-pad.r,y2:y,stroke:'#e2e7ee','stroke-width':1}));
        svg.append(stext(pad.l-8,y+3,`${value}%`,{'font-size':9,'text-anchor':'end',fill:'#657187'}));
      });
      scopes.forEach((scope,index)=>{
        const info=SECOND_DRAFT.waveComposition[scope],broad=info.Broad,fast=info['Fast/Narrow'];
        const broadPct=100*broad/info.n,fastPct=100*fast/info.n;
        const x=pad.l+plotW*(index+.5)/scopes.length-barW/2;
        const broadY=sy(broadPct),fastY=sy(100);
        svg.append(s('rect',{x,y:broadY,width:barW,height:sy(0)-broadY,fill:waveColor.Broad}));
        svg.append(s('rect',{x,y:fastY,width:barW,height:broadY-fastY,fill:waveColor['Fast/Narrow']}));
        svg.append(s('rect',{x,y:sy(100),width:barW,height:plotH,fill:'none',stroke:'#aeb8c6','stroke-width':.9}));
        const broadLabelY=(broadY+sy(0))/2;
        const fastLabelY=(fastY+broadY)/2;
        svg.append(stext(x+barW/2,broadLabelY,`${broad} · ${Math.round(broadPct)}%`,{
          'font-size':10,'font-weight':750,'text-anchor':'middle','dominant-baseline':'middle',fill:'#fff'
        }));
        svg.append(stext(x+barW/2,fastLabelY,`${fast} · ${Math.round(fastPct)}%`,{
          'font-size':fastPct<7?7.2:9.5,'font-weight':800,'text-anchor':'middle','dominant-baseline':'middle',fill:'#29250c'
        }));
        svg.append(stext(x+barW/2,H-pad.b+22,scope,{
          'font-size':11.5,'font-weight':800,'text-anchor':'middle',fill:scopeColor(scope)
        }));
        svg.append(stext(x+barW/2,H-pad.b+38,`n=${info.n}`,{
          'font-size':8.7,'text-anchor':'middle',fill:'#69758a'
        }));
      });
      svg.append(s('line',{x1:pad.l,y1:sy(0),x2:W-pad.r,y2:sy(0),stroke:'#9ba7b6','stroke-width':1}));
      svg.append(s('line',{x1:pad.l,y1:sy(100),x2:pad.l,y2:sy(0),stroke:'#9ba7b6','stroke-width':1}));
      svg.append(stext(15,(pad.t+H-pad.b)/2,'within-area proportion',{
        'font-size':10,'text-anchor':'middle',fill:'#596579',transform:`rotate(-90 15 ${(pad.t+H-pad.b)/2})`
      }));
      return wrap(svg);
    }

    function figure2B(){
      return panel(
        'B',
        'Waveform-class composition by recording area',
        'Four equal-height vertical bars use their own area total as the 100% denominator. Both segment counts and percentages are printed inside the colored bars.',
        h('div',{},legend([
          ['Slow / broad',waveColor.Broad],
          ['Fast / narrow',waveColor['Fast/Narrow']]
        ]),figure2BChart()),
        'second-draft-2b'
      );
    }

    function combinedWaveformTraceChart(){
      const W=1480,H=430,pad={l:72,r:22,t:28,b:52},svg=svgEl(W,H);
      let ymin=0,ymax=0;
      waveClasses.forEach(waveClass=>areas.forEach(area=>{
        const trace=SECOND_DRAFT.waveformTraces[waveClass][area];
        trace.mean.forEach((value,index)=>{
          if(SECOND_DRAFT.tax[index]>4)return;
          ymin=Math.min(ymin,value-trace.sd[index]);
          ymax=Math.max(ymax,value+trace.sd[index]);
        });
      }));
      ymin=Math.floor(ymin/5)*5;
      ymax=Math.ceil(ymax/5)*5;
      const yt=[];
      for(let value=Math.ceil(ymin/10)*10;value<=ymax;value+=10)yt.push(value);
      if(!yt.includes(0))yt.push(0);
      yt.sort((a,b)=>a-b);
      const graph=axes(svg,pad,W,H,[-1,4],[ymin,ymax],{
        xt:[-1,0,1,2,3,4],
        yt,
        xl:'time from cue (s)',
        yl:'baseline-centered firing rate (Hz)'
      });
      svg.append(s('line',{x1:graph.sx(0),y1:pad.t,x2:graph.sx(0),y2:H-pad.b,stroke:'#798599','stroke-dasharray':'5 3'}));
      svg.append(s('line',{x1:pad.l,y1:graph.sy(0),x2:W-pad.r,y2:graph.sy(0),stroke:'#a5afbc','stroke-dasharray':'4 3'}));
      waveClasses.forEach(waveClass=>areas.forEach(area=>{
        const trace=SECOND_DRAFT.waveformTraces[waveClass][area],color=AC[area];
        svg.append(s('path',{
          d:bandPath(trace.mean,trace.sd,graph.sx,graph.sy,SECOND_DRAFT.tax,4),
          fill:color,'fill-opacity':waveClass==='Broad'?.045:.03,stroke:'none'
        }));
      }));
      waveClasses.forEach(waveClass=>areas.forEach(area=>{
        const trace=SECOND_DRAFT.waveformTraces[waveClass][area],color=AC[area];
        svg.append(s('path',{
          d:linePath(trace.mean,graph.sx,graph.sy,SECOND_DRAFT.tax,4),
          fill:'none',stroke:color,'stroke-width':waveClass==='Broad'?2.25:2,
          'stroke-dasharray':waveClass==='Fast/Narrow'?'7 4':'',
          'stroke-linejoin':'round','stroke-linecap':'round'
        }));
      }));
      svg.append(stext(pad.l+8,pad.t+14,'ribbons: mean +/- 1 SD across units',{
        'font-size':9,fill:'#68758a'
      }));
      return wrap(svg);
    }

    function combinedLatencyMap(){
      const W=1480,H=560,pad={l:84,r:22,t:24,b:56},svg=svgEl(W,H);
      const plotW=W-pad.l-pad.r,gap=18,bandH=(H-pad.t-pad.b-gap)/2;
      const sx=value=>pad.l+(value+1)/5*plotW;
      const bandTop={FastNarrow:pad.t,Broad:pad.t+bandH+gap};
      const sy=(waveClass,value)=>{
        const top=waveClass==='Fast/Narrow'?bandTop.FastNarrow:bandTop.Broad;
        return top+(cueLimit-value)/(2*cueLimit)*bandH;
      };
      [
        ['Fast/Narrow','#fffbed',waveInk['Fast/Narrow']],
        ['Broad','#f5f3ff',waveInk.Broad]
      ].forEach(([waveClass,fill,ink])=>{
        const top=waveClass==='Fast/Narrow'?bandTop.FastNarrow:bandTop.Broad;
        svg.append(s('rect',{x:pad.l,y:top,width:plotW,height:bandH,fill,'fill-opacity':.55,stroke:'#d7dde6','stroke-width':.8}));
        [-cueLimit,0,cueLimit].forEach(value=>{
          const y=sy(waveClass,value);
          svg.append(s('line',{
            x1:pad.l,y1:y,x2:W-pad.r,y2:y,
            stroke:value===0?'#9ba6b6':'#e0e5ec','stroke-width':1,
            'stroke-dasharray':value===0?'4 3':''
          }));
          svg.append(stext(pad.l-10,y+4,String(value),{'font-size':10,'text-anchor':'end',fill:'#5e6a7d'}));
        });
        svg.append(stext(pad.l+10,top+17,SECOND_DRAFT.waveClassLabels[waveClass],{
          'font-size':12,'font-weight':800,fill:ink
        }));
      });
      [-1,0,1,2,3,4].forEach(value=>{
        const x=sx(value);
        svg.append(s('line',{x1:x,y1:pad.t,x2:x,y2:pad.t+bandH*2+gap,stroke:'#e0e5ec','stroke-width':1}));
        svg.append(stext(x,H-pad.b+20,String(value),{'font-size':10,'text-anchor':'middle',fill:'#5e6a7d'}));
      });
      svg.append(s('line',{x1:sx(0),y1:pad.t,x2:sx(0),y2:pad.t+bandH*2+gap,stroke:'#7d899b','stroke-width':1.2,'stroke-dasharray':'6 4'}));
      svg.append(s('line',{
        x1:pad.l,y1:bandTop.Broad-gap/2,x2:W-pad.r,y2:bandTop.Broad-gap/2,
        stroke:'#303a4a','stroke-width':1.5
      }));
      waveClasses.forEach(waveClass=>areas.forEach(area=>{
        const trace=SECOND_DRAFT.waveformTraces[waveClass][area],color=AC[area];
        trace.latencyPoints.forEach(point=>{
          const mark=s('circle',{
            cx:sx(point.latency),cy:sy(waveClass,Math.max(-cueLimit,Math.min(cueLimit,point.cueDelta))),r:2.45,
            fill:color,'fill-opacity':.6,stroke:'#fff','stroke-width':.4
          });
          on(mark,event=>showTip(event,`<b>Unit ${point.id}</b> · ${area}<br>${SECOND_DRAFT.waveClassLabels[waveClass]}<br>PSTH peak latency ${point.latency.toFixed(3)} s<br>cue-baseline ${point.cueDelta.toFixed(2)} Hz<br>${point.responseClass}`));
          svg.append(mark);
        });
        const medianDelta=median(trace.latencyPoints.map(point=>point.cueDelta));
        const x=sx(trace.medianLatency),y=sy(waveClass,Math.max(-cueLimit,Math.min(cueLimit,medianDelta)));
        svg.append(s('path',{
          d:`M${x} ${y-6}L${x+6} ${y}L${x} ${y+6}L${x-6} ${y}Z`,
          fill:color,stroke:'#fff','stroke-width':1.1
        }));
      }));
      svg.append(stext(W/2,H-8,'PSTH peak latency from cue (s)',{
        'font-size':11,'text-anchor':'middle',fill:'#4f5c70'
      }));
      svg.append(stext(17,(pad.t+H-pad.b)/2,'cue - baseline delta firing rate (Hz)',{
        'font-size':11,'text-anchor':'middle',fill:'#4f5c70',
        transform:`rotate(-90 17 ${(pad.t+H-pad.b)/2})`
      }));
      return wrap(svg);
    }

    function figure2C(){
      return panel(
        'C',
        'Cue-response time courses and latency by waveform class',
        'The original six-trace design is retained: color identifies M2/M1/S1 and line style identifies slow/broad versus fast/narrow. Ribbons show +/- 1 SD. The lower map restores every unit\'s PSTH peak latency and cue-minus-baseline modulation; diamonds mark class-by-area medians.',
        h('div',{},
          h('div',{class:'second-draft-line-key'},
            legend(areas.map(area=>[area,AC[area]])),
            h('span',{class:'line-sample solid'},'slow / broad'),
            h('span',{class:'line-sample dashed'},'fast / narrow')),
          h('div',{class:'second-draft-combined-2c'},combinedWaveformTraceChart(),combinedLatencyMap())),
        'second-draft-2c'
      );
    }

    function responseMatrix(scope){
      const W=470,H=310,pad={l:112,r:20,t:58,b:30},svg=svgEl(W,H),info=SECOND_DRAFT.responsiveMatrices[scope];
      const cellW=(W-pad.l-pad.r)/2,cellH=(H-pad.t-pad.b)/2;
      responseClasses.slice(0,2).forEach((responseClass,column)=>{
        svg.append(stext(pad.l+cellW*(column+.5),36,responseClass.replace('Cue-','Cue '),{
          'font-size':10,'font-weight':750,'text-anchor':'middle',fill:responseColor[responseClass]
        }));
      });
      waveClasses.forEach((waveClass,row)=>{
        const rowTotal=info[waveClass]['Cue-excited']+info[waveClass]['Cue-suppressed'];
        svg.append(stext(pad.l-10,pad.t+cellH*(row+.5),SECOND_DRAFT.waveClassLabels[waveClass],{
          'font-size':10,'font-weight':750,'text-anchor':'end','dominant-baseline':'middle',fill:waveColor[waveClass]
        }));
        responseClasses.slice(0,2).forEach((responseClass,column)=>{
          const count=info[waveClass][responseClass],share=rowTotal?count/rowTotal:0,x=pad.l+column*cellW,y=pad.t+row*cellH;
          svg.append(s('rect',{
            x:x+2,y:y+2,width:cellW-4,height:cellH-4,fill:responseColor[responseClass],
            'fill-opacity':.18+.72*share,stroke:'#fff','stroke-width':2
          }));
          svg.append(stext(x+cellW/2,y+cellH/2-5,`${count}`,{
            'font-size':18,'font-weight':800,'text-anchor':'middle','dominant-baseline':'middle',fill:'#17202c'
          }));
          svg.append(stext(x+cellW/2,y+cellH/2+15,rowTotal?`${Math.round(100*share)}% of responsive ${SECOND_DRAFT.waveClassLabels[waveClass].toLowerCase()}`:'0%',{
            'font-size':8.3,'text-anchor':'middle','dominant-baseline':'middle',fill:'#354155'
          }));
        });
      });
      const total=waveClasses.reduce((sum,waveClass)=>sum+info[waveClass]['Cue-excited']+info[waveClass]['Cue-suppressed'],0);
      svg.append(stext(W/2,16,`${scope}  responsive n=${total}`,{
        'font-size':12,'font-weight':750,'text-anchor':'middle',fill:scopeColor(scope)
      }));
      return wrap(svg);
    }

    function figure2D(){
      return panel(
        'D',
        'Responsive-unit composition: waveform class by cue direction',
        'Each panel is a 2 x 2 count table. Rows are waveform classes and columns are one-SD response directions; units inside the neutral band are intentionally outside this responsive-only comparison.',
        h('div',{class:'second-draft-four-grid'},...scopes.map(responseMatrix)),
        'second-draft-2d'
      );
    }

    function methodNotes(){
      const counts=SECOND_DRAFT.thresholdCounts.All.counts;
      return h('section',{class:'second-draft-methods'},
        h('h3',{},'Decision rules and presentation choices'),
        h('div',{class:'second-draft-method-grid'},
          h('div',{},h('b',{},'Trial window'),h('p',{},'Every trial uses -5 to 0 s as baseline and 0 to 20 s as the post-cue period. Rates are converted to Hz before comparison, so unequal window duration does not bias the scale.')),
          h('div',{},h('b',{},'One-SD response rule'),h('p',{},`The predefined project-classified unmodulated cohort (n=${SECOND_DRAFT.unmodulatedReference.n}) supplies the cue-minus-baseline reference mean (${SECOND_DRAFT.unmodulatedReference.responseMeanHz.toFixed(2)} Hz) and SD (${SECOND_DRAFT.unmodulatedReference.responseSdHz.toFixed(2)} Hz). Values above +1 SD are excited, below -1 SD are suppressed, and values inside are unmodulated.`)),
          h('div',{},h('b',{},'Resulting classes'),h('p',{},`The one-SD operational rule gives ${counts['Cue-excited']} excited, ${counts['Cue-suppressed']} suppressed, and ${counts.Unmodulated} unmodulated units. This is an exploratory classification rule, not a p-value or a multiple-comparison-corrected significance test.`)),
          h('div',{},h('b',{},'Latency'),h('p',{},'Figure 2C reports each unit\'s peak time from its smoothed trial-mean PSTH between -1 and +4 s. It is a peak-latency descriptor, not response-onset latency; all units remain visible in the lower map.')),
          h('div',{},h('b',{},'Rate bins'),h('p',{},'Bins are 2 Hz wide from 0-20 Hz, then widen to 5-10 Hz in the sparse tail. Histograms divide counts by bin width; trend lines omit bins with fewer than five units.')),
          h('div',{},h('b',{},'Normalization and uncertainty'),h('p',{},'Raster color is each unit\'s pre-cue baseline z-score, clipped to -2 to 4. Figure 1B class ribbons are mean +/- SEM; Figure 2C ribbons are mean +/- 1 SD. Both summarize variability across recorded units and do not replace animal- or session-level inference.'))));
    }

    function vSecondDraft(main){
      main.append(
        h('div',{class:'head'},h('h1',{},'Figure reconstruction - second draft'),h('span',{class:'sub'},'80 complete cue-aligned trials · revised Task 1 figures')),
        h('div',{class:'summary-strip'},
          h('span',{},h('b',{},'5 s'),' pre-cue baseline'),
          h('span',{},h('b',{},'20 s'),' post-cue analysis'),
          h('span',{},h('b',{},'1 SD'),' response cutoff'),
          h('span',{},h('b',{},'-1 to +4 s'),' PSTH peak-latency window')),
        h('section',{class:'second-draft-figure'},
          sectionHead('1','Firing-rate distributions, population timing, and cue modulation','Window definitions and functional classes are rebuilt from the complete 80-trial PSTHs.','exports/figure1_second_draft.svg'),
          figure1A(),figure1B(),figure1C()),
        h('section',{class:'second-draft-figure'},
          sectionHead('2','Waveform class, response timing, and cue direction','Waveform identity and functional response use separate color grammars and explicit denominators.','exports/figure2_second_draft.svg'),
          figure2A(),figure2B(),figure2C(),figure2D()),
        methodNotes()
      );
    }

    return {vSecondDraft};
  };
})();
