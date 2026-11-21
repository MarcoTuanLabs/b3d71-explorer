(function(){
  'use strict';

  window.createFunctionalHierarchy=function(api){
    const {h,s,stext,svgEl,axes,showTip,moveTip,hideTip,AC,UNITS,POP,HIER,selectUnit}=api;
    if(!HIER)return null;

    const majorColors=['#e76f00','#49b653','#ff3f91','#24a7df','#6657c8'];
    const communityColors=['#ef4c45','#436bd1','#8bd43b','#db3fbc','#43c7bb','#d98b2f','#744bd6','#39b54a','#d45d7a','#2f91c7','#86942f','#8b6f61','#637388','#de7f32','#2aa198','#a45195'];
    const subtypeColors={};

    function mix(a,b,t){
      const parse=value=>value.match(/[a-f\d]{2}/gi).map(part=>parseInt(part,16)),aa=parse(a),bb=parse(b);
      return '#'+aa.map((value,index)=>Math.round(value+(bb[index]-value)*t).toString(16).padStart(2,'0')).join('');
    }
    for(let major=1;major<=5;major++){
      const labels=HIER.cue.subtypeOrder.filter(label=>+label[1]===major);
      labels.forEach((label,index)=>{const t=labels.length===1?.8:.54+.42*index/(labels.length-1);subtypeColors[label]=mix('#ffffff',majorColors[major-1],t);});
    }

    function swrap(node,className=''){return h('div',{class:`swrap ${className}`.trim()},node);}
    function sectionHead(label,title,subtitle){
      return h('div',{class:'figure-section-head hierarchy-section-head'},
        h('span',{class:'hierarchy-panel-label'},label),
        h('div',{},h('h2',{},title),h('span',{},subtitle))
      );
    }
    function fmt(value,digits=2){return Number(value).toFixed(digits);}
    function viridis(value){
      const t=Math.max(0,Math.min(1,(value+2)/6)),colors=[[68,1,84],[71,44,122],[59,82,139],[44,113,142],[33,145,140],[39,173,129],[94,201,98],[173,220,48],[253,231,37]],position=t*(colors.length-1),index=Math.floor(position),f=position-index,a=colors[index],b=colors[Math.min(colors.length-1,index+1)];
      return [Math.round(a[0]+(b[0]-a[0])*f),Math.round(a[1]+(b[1]-a[1])*f),Math.round(a[2]+(b[2]-a[2])*f)];
    }

    function dendrogramSvg(mode,height){
      const W=112,H=height,sv=svgEl(W,H),segments=HIER[mode].dendrogram;
      segments.forEach(item=>{const segment=item.points||item,points=[];for(let index=0;index<8;index+=2)points.push([W-5-segment[index]*(W-12),5+segment[index+1]*(H-10)]);sv.append(s('path',{d:`M${points[0][0]} ${points[0][1]}L${points[1][0]} ${points[1][1]}L${points[2][0]} ${points[2][1]}L${points[3][0]} ${points[3][1]}`,fill:'none',stroke:item.color||'#68758a','stroke-width':.55,'stroke-opacity':.78}));});
      return sv;
    }

    function orderedStrip(order,height,kind,mode='cue'){
      const width=kind==='region'?8:kind==='major'?10:12,canvas=h('canvas',{width,height,class:`hierarchy-order-strip ${kind}`,'aria-label':`${kind} membership strip`}),ctx=canvas.getContext('2d');
      order.forEach((unitId,row)=>{
        if(kind==='region')ctx.fillStyle=AC[UNITS[unitId].area];
        else if(kind==='subtype')ctx.fillStyle=subtypeColors[HIER.cue.subtypeById[unitId]];
        else ctx.fillStyle=majorColors[Math.max(0,HIER[mode].majorById[unitId]-1)];
        ctx.fillRect(0,row*height/order.length,width,Math.ceil(height/order.length)+1);
      });
      return canvas;
    }

    function matrixScale(range){
      return h('div',{class:'matrix-scale grayscale'},h('span',{},fmt(range[0],range[1]-range[0]<.2?3:1)),h('i',{}),h('span',{},fmt(range[1],range[1]-range[0]<.2?3:1)),h('b',{},'Pearson r'));
    }

    function hierarchyInnerTitle(mode){
      const titles={
        cue:['Hierarchical Functional Clustering','unit-by-unit correlation of trial-aligned firing-rate profiles'],
        fullRaw:['Full-Trial Trial-by-Trial Pearson Clustering','unit-by-unit Pearson correlation of concatenated 80-trial firing patterns'],
        fullSmooth:['Smoothed Z-Scored Full-Trial Pearson Clustering','five-bin smoothed, per-unit/per-trial z-scored firing patterns']
      };
      const copy=titles[mode]||titles.cue;
      return h('div',{class:'hierarchy-inner-title'},h('h3',{},copy[0]),h('p',{},copy[1]));
    }

    function matrixComposite(mode,subtype=false){
      const data=HIER[mode],height=610,order=subtype?data.subtypeOrderIds:data.order,image=subtype?data.subtypeMatrix:data.matrix,range=subtype?data.subtypeMatrixRange:data.matrixRange;
      return h('div',{class:`hierarchy-matrix-block ${subtype?'subtype-matrix-block':''}`},
        h('div',{class:'hierarchy-matrix-shell'},
          subtype?null:dendrogramSvg(mode,height),
          orderedStrip(order,height,'region',mode),
          orderedStrip(order,height,'major',mode),
          subtype?orderedStrip(order,height,'subtype',mode):null,
          h('img',{src:image,alt:`${subtype?'Subtype-sorted':mode} unit-by-unit Pearson correlation matrix`,width:height,height})
        ),
        matrixScale(range),
        h('div',{class:'matrix-unit-count'},`${order.length.toLocaleString()} units`)
      );
    }

    function profileOverlay(mode,title){
      const data=HIER[mode],items=data.classes,tax=data.tax,W=520,H=268,pad={l:48,r:18,t:20,b:38},fullTrial=mode!=='cue',maxValue=fullTrial?6.6:Math.max(1,...items.flatMap(item=>item.values))*1.04,yTicks=fullTrial?[0,2.2,4.4,6.6]:[0,maxValue/2,maxValue],xTicks=mode==='cue'?[-1,0,1,2,3,4,5]:[0,5,10,15,20,25],sv=svgEl(W,H),g=axes(sv,pad,W,H,[tax[0],tax[tax.length-1]],[0,maxValue],{xt:xTicks,yt:yTicks,xl:mode==='cue'?'time from cue (s)':'time in trial (s)',yl:'Hz'}),clipId=`hierarchy-profile-${mode}`,defs=s('defs'),clip=s('clipPath',{id:clipId}),lineGroup=s('g',{'clip-path':`url(#${clipId})`});
      clip.append(s('rect',{x:pad.l,y:pad.t,width:W-pad.l-pad.r,height:H-pad.t-pad.b}));defs.append(clip);sv.append(defs);
      sv.append(s('line',{x1:g.sx(data.eventTime),y1:pad.t,x2:g.sx(data.eventTime),y2:H-pad.b,stroke:'#f05a91','stroke-width':1,'stroke-opacity':.75}),stext(g.sx(data.eventTime)+4,pad.t+10,'cue',{'font-size':8.5,fill:'#d84078'}));
      items.forEach((item,index)=>{const path=item.values.map((value,column)=>(column?'L':'M')+g.sx(tax[column]).toFixed(1)+' '+g.sy(value).toFixed(1)).join(' ');lineGroup.append(s('path',{d:path,fill:'none',stroke:majorColors[index], 'stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round'}));});sv.append(lineGroup);
      return h('div',{class:'hierarchy-profile'},h('h4',{},title),swrap(sv),h('div',{class:'hierarchy-class-legend'},...items.map((item,index)=>h('span',{},h('i',{style:{background:majorColors[index]}}),h('b',{},item.label),` ${item.n.toLocaleString()}`))));
    }

    function compositionRows(items,title){
      const W=520,rowH=35,H=items.length*rowH+18,pad={l:38,r:68,t:4,b:8},sv=svgEl(W,H),plotW=W-pad.l-pad.r;
      items.forEach((item,index)=>{const y=pad.t+index*rowH,total=Math.max(1,item.n);let x=pad.l;sv.append(stext(pad.l-7,y+17,item.label,{'font-size':10,'text-anchor':'end','font-weight':750,fill:item.label[0]==='C'&&item.label.length===2?majorColors[Math.max(0,+item.label[1]-1)]:'#445066'}));['M2','M1','S1'].forEach(area=>{const count=item.areas[area]||0,width=plotW*count/total,rect=s('rect',{x,y,width,height:23,fill:AC[area]});rect.addEventListener('mouseenter',event=>showTip(event,`<b>${item.label} / ${area}</b><br>${count} of ${item.n} units`));rect.addEventListener('mousemove',moveTip);rect.addEventListener('mouseleave',hideTip);sv.append(rect);if(width>35)sv.append(stext(x+width/2,y+15,String(count),{'font-size':8.5,'text-anchor':'middle',fill:'#fff','font-weight':700}));x+=width;});sv.append(stext(W-pad.r+7,y+16,`n=${item.n}`,{'font-size':8.5,fill:'#6b778b'}));});
      return h('div',{class:'hierarchy-composition-block'},h('h4',{},title),h('div',{class:'hierarchy-area-legend'},...['M2','M1','S1'].map(area=>h('span',{},h('i',{style:{background:AC[area]}}),area))),swrap(sv));
    }

    function classProportionRows(items,title='Class proportion within each region'){
      const W=520,H=126,pad={l:38,r:12,t:5,b:5},sv=svgEl(W,H),totals={};['M2','M1','S1'].forEach(area=>totals[area]=items.reduce((sum,item)=>sum+(item.areas[area]||0),0));
      ['M2','M1','S1'].forEach((area,row)=>{const y=pad.t+row*38;let x=pad.l;sv.append(stext(pad.l-7,y+16,area,{'font-size':10,'text-anchor':'end','font-weight':750,fill:AC[area]}));items.forEach((item,index)=>{const width=(W-pad.l-pad.r)*(item.areas[area]||0)/totals[area],rect=s('rect',{x,y,width,height:23,fill:majorColors[index]});rect.addEventListener('mouseenter',event=>showTip(event,`<b>${area} / ${item.label}</b><br>${item.areas[area]} units (${fmt(100*item.areas[area]/totals[area],1)}%)`));rect.addEventListener('mousemove',moveTip);rect.addEventListener('mouseleave',hideTip);sv.append(rect);x+=width;});});
      return h('div',{class:'hierarchy-proportion-block'},h('h4',{},title),swrap(sv));
    }

    function hierarchyFigure(mode,featureText,auditKey){
      const data=HIER[mode],audit=HIER.meta.referenceAudit[auditKey],fullTrial=mode!=='cue',summaryClasses=data.classes;
      return h('section',{class:'hierarchy-reference-figure hierarchy-analysis-body'},
        hierarchyInnerTitle(mode),
        h('div',{class:'hierarchy-figure-layout'},matrixComposite(mode),h('div',{class:'hierarchy-figure-summary'},profileOverlay(mode,'Mean firing rate by Pearson class'),compositionRows(summaryClasses,'Region composition by class'),classProportionRows(summaryClasses),h('p',{class:'hierarchy-summary-source'},fullTrial?'The correlation matrix uses all 80 individual trials. The class profiles at right are raster-derived trial means in physical firing-rate units.':'Both the correlation matrix and summary profiles are rebuilt from 50 ms bins of the supplied 80-trial spike rasters.'))),
        h('div',{class:'hierarchy-feature-note'},h('b',{},'Feature vector'),h('span',{},featureText,fullTrial?h('small',{style:{display:'block',marginTop:'4px'}},HIER.meta.fullClassCut):null)),
        h('details',{class:'compact-details hierarchy-count-audit-details'},h('summary',{},'Reference-count comparison'),h('div',{class:'hierarchy-count-audit'},h('span',{},'Raster reconstruction ',audit.observed.join(' / ')),h('span',{},'Teacher panel ',audit.teacher.join(' / ')),h('small',{},'Teacher counts are comparison-only and never define memberships.')))
      );
    }

    function prototypeChart(item,tax,color,limit){
      const W=310,H=160,pad={l:34,r:9,t:17,b:28},sv=svgEl(W,H),g=axes(sv,pad,W,H,[tax[0],tax[tax.length-1]],[0,limit],{xt:[-1,0,5],yt:[0,limit],xl:'',yl:''}),path=item.values.map((value,index)=>(index?'L':'M')+g.sx(tax[index]).toFixed(1)+' '+g.sy(value).toFixed(1)).join(' ');
      sv.append(s('line',{x1:g.sx(0),y1:pad.t,x2:g.sx(0),y2:H-pad.b,stroke:'#f05a91','stroke-width':.8,'stroke-opacity':.7}),s('path',{d:path,fill:'none',stroke:color,'stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round'}),stext(pad.l+3,12,item.label,{'font-size':11,'font-weight':800,fill:color}),stext(W-pad.r,12,`n=${item.n}`,{'font-size':8.5,'text-anchor':'end',fill:'#5f6c81'}));
      return swrap(sv);
    }

    function subtypePrototypeGrid(){
      const items=HIER.cue.subtypes,tax=HIER.cue.tax,limit=Math.max(1,...items.flatMap(item=>item.values))*1.03;
      return h('section',{class:'hierarchy-prototypes hierarchy-analysis-body'},h('div',{class:'prototype-grid subtype'},...items.map(item=>prototypeChart(item,tax,subtypeColors[item.label],limit))),h('div',{class:'cap'},'Each trace is the raster-derived mean response of one within-major-class subtype. Membership uses the minimum-inertia result across 32 deterministic k-means++ starts; subtype letters follow prototype peak time.'));
    }

    function sortedHeatmap(scope){
      const zProfiles=HIER.cue.z||[],width=zProfiles[0]&&zProfiles[0].length||0,profileTax=HIER.cue.tax,subtypeRank=Object.fromEntries(HIER.cue.subtypeOrder.map((label,index)=>[label,index])),displayPeak=HIER.cue.peak||zProfiles.map(row=>row.reduce((best,value,index)=>value>row[best]?index:best,0)),all=(HIER.cue.subtypeOrderIds||HIER.cue.order).slice().sort((a,b)=>subtypeRank[HIER.cue.subtypeById[a]]-subtypeRank[HIER.cue.subtypeById[b]]||displayPeak[a]-displayPeak[b]||a-b),ids=all.filter(unitId=>scope==='All'||UNITS[unitId].area===scope),height=ids.length,showStrips=scope==='All',canvas=h('canvas',{width,height,class:'functional-heatmap',role:'img','aria-label':`${scope} subtype-sorted row-z-scored firing heatmap`}),majorStrip=showStrips?h('canvas',{width:8,height,class:'functional-heatmap-strip major','aria-label':'major class strip'}):null,subtypeStrip=showStrips?h('canvas',{width:8,height,class:'functional-heatmap-strip subtype','aria-label':'subtype strip'}):null,ctx=canvas.getContext('2d'),majorCtx=majorStrip&&majorStrip.getContext('2d'),subtypeCtx=subtypeStrip&&subtypeStrip.getContext('2d'),image=ctx.createImageData(width,height);
      ids.forEach((unitId,row)=>{
        zProfiles[unitId].forEach((value,column)=>{const color=viridis(value),offset=(row*width+column)*4;image.data[offset]=color[0];image.data[offset+1]=color[1];image.data[offset+2]=color[2];image.data[offset+3]=255;});
        if(showStrips){majorCtx.fillStyle=majorColors[Math.max(0,HIER.cue.majorById[unitId]-1)];majorCtx.fillRect(0,row,8,1);subtypeCtx.fillStyle=subtypeColors[HIER.cue.subtypeById[unitId]];subtypeCtx.fillRect(0,row,8,1);}
      });
      ctx.putImageData(image,0,0);
      ids.forEach((unitId,row)=>{if(!row)return;const previous=ids[row-1],majorChanged=HIER.cue.majorById[unitId]!==HIER.cue.majorById[previous],subtypeChanged=HIER.cue.subtypeById[unitId]!==HIER.cue.subtypeById[previous];if(majorChanged||subtypeChanged){ctx.fillStyle=majorChanged?'rgba(15,22,33,.92)':'rgba(28,36,48,.72)';ctx.fillRect(0,row,width,majorChanged?2:1);}});
      const cueColumn=Math.max(0,profileTax.findIndex(time=>time>=0));ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(cueColumn,0,1,height);
      const bodyChildren=[canvas];if(showStrips)bodyChildren.push(majorStrip,subtypeStrip);
      return h('div',{class:`hierarchy-heatmap-panel ${showStrips?'all-units':''}`.trim()},h('div',{class:'heatmap-head'},h('b',{style:{color:scope==='All'?'#263144':AC[scope]}},scope==='All'?'All units':scope),h('span',{},`n=${ids.length.toLocaleString()}`)),scope==='All'?h('div',{class:'heatmap-region-rule all'}):h('div',{class:'heatmap-region-rule',style:{background:AC[scope]}}),h('div',{class:`functional-heatmap-body ${showStrips?'with-strips':''}`.trim()},...bodyChildren),h('div',{class:`heatmap-axis ${showStrips?'with-strips':''}`.trim()},h('span',{class:'start'},'-1'),h('span',{class:'cue'},'0'),h('span',{class:'end'},'+5'),h('b',{class:'heatmap-axis-title'},'Time from cue (s)')),showStrips?h('div',{class:'heatmap-strip-labels'},h('span',{},'major'),h('span',{},'subtype')):null);
    }

    function heatmapColorScale(){
      return h('div',{class:'heatmap-colorbar','aria-label':'shared z-score color scale'},h('div',{class:'heatmap-colorbar-ramp'}),...[-2,-1,0,1,2,3,4].map(value=>h('span',{style:{bottom:`${100*(value+2)/6}%`}},String(value))),h('b',{},'z'));
    }

    function heatmapCategoricalLegend(title,items,colorFor){
      return h('div',{class:'heatmap-categorical-legend'},h('b',{},title),h('div',{},...items.map(item=>h('span',{},h('i',{style:{background:colorFor(item)}}),item))));
    }

    function heatmapSection(){
      return h('section',{class:'hierarchy-heatmaps hierarchy-analysis-body'},
        h('div',{class:'hierarchy-heatmap-reference-layout'},h('div',{class:'hierarchy-heatmap-grid'},...['All','M2','M1','S1'].map(sortedHeatmap)),heatmapColorScale()),
        h('div',{class:'heatmap-reference-legends'},heatmapCategoricalLegend('Major classes',['C1','C2','C3','C4','C5'],item=>majorColors[+item[1]-1]),heatmapCategoricalLegend('Subtypes',HIER.cue.subtypeOrder,item=>subtypeColors[item])),
        h('div',{class:'cap'},'Each row is recomputed from the supplied spike rasters, row-z-scored once across -1 to +5 s, then ordered by major class, subtype, and peak time. All four panels use the same -2 to +4 color scale.'));
    }

    function regionBar(item){
      return h('div',{class:'subtype-region-bar'},...['M2','M1','S1'].map(area=>h('i',{style:{width:`${100*(item.areas[area]||0)/Math.max(1,item.n)}%`,background:AC[area]}})));
    }

    function subtypeTable(){
      const wrap=h('div',{class:'factor-table hierarchy-subtype-table'}),table=h('table'),head=h('tr');['Subtype','n','full-pipeline stability','region composition'].forEach((label,index)=>head.append(h('th',{class:index===0?'l':''},label)));table.append(h('thead',{},head));const body=h('tbody');HIER.cue.subtypes.forEach(item=>{const row=h('tr'),ci=item.stabilityCI||[item.stability,item.stability],stability=h('span',{class:'stability-value',title:`95% bootstrap interval ${ci[0].toFixed(2)}-${ci[1].toFixed(2)}`},h('b',{},item.stability.toFixed(2)));row.append(h('td',{class:'l'},h('i',{class:'subtype-chip',style:{background:subtypeColors[item.label]}}),h('b',{},item.label)),h('td',{},item.n.toLocaleString()),h('td',{},stability),h('td',{},regionBar(item)));body.append(row);});table.append(body);wrap.append(table,h('p',{class:'subtype-stability-note'},'Each value is end-to-end membership recovery: every bootstrap rebuilds and aligns both the major hierarchy and its subtypes. Hover for the 95% interval.'));return wrap;
    }

    function subtypeStackRows(groupMode){
      const items=HIER.cue.subtypes,W=720,H=(groupMode==='major'?5:3)*40+16,pad={l:42,r:9,t:4,b:6},sv=svgEl(W,H),groups=groupMode==='major'?['C1','C2','C3','C4','C5']:['M2','M1','S1'];
      groups.forEach((group,row)=>{const y=pad.t+row*40,counts=items.map(item=>groupMode==='major'?(item.major===group?item.n:0):(item.areas[group]||0)),total=counts.reduce((a,b)=>a+b,0)||1;let x=pad.l;sv.append(stext(pad.l-7,y+17,group,{'font-size':10,'text-anchor':'end','font-weight':800,fill:groupMode==='major'?majorColors[+group[1]-1]:AC[group]}));items.forEach((item,index)=>{const width=(W-pad.l-pad.r)*counts[index]/total;if(width<=0)return;const rect=s('rect',{x,y,width,height:24,fill:subtypeColors[item.label],stroke:'#fff','stroke-width':.4});rect.addEventListener('mouseenter',event=>showTip(event,`<b>${group} / ${item.label}</b><br>${counts[index]} units (${fmt(100*counts[index]/total,1)}%)`));rect.addEventListener('mousemove',moveTip);rect.addEventListener('mouseleave',hideTip);sv.append(rect);if(width>34)sv.append(stext(x+width/2,y+16,item.label,{'font-size':8,'text-anchor':'middle',fill:'#263144'}));x+=width;});});
      return swrap(sv);
    }

    function subtypeRateBars(){
      const items=HIER.cue.subtypes,W=720,H=235,pad={l:42,r:9,t:12,b:45},max=6.6,sv=svgEl(W,H),g=axes(sv,pad,W,H,[0,items.length],[0,max],{xt:[],yt:[0,2.2,4.4,6.6],xl:'subtype',yl:'mean Hz'}),barW=(W-pad.l-pad.r)/items.length*.72;
      items.forEach((item,index)=>{const x=g.sx(index+.5)-barW/2,y=g.sy(item.meanHz),rect=s('rect',{x,y,width:barW,height:H-pad.b-y,fill:subtypeColors[item.label]});rect.addEventListener('mouseenter',event=>showTip(event,`<b>${item.label}</b><br>${item.meanHz.toFixed(2)} Hz across ${item.n} units`));rect.addEventListener('mousemove',moveTip);rect.addEventListener('mouseleave',hideTip);sv.append(rect,stext(g.sx(index+.5),H-pad.b+12,item.label,{'font-size':7.5,'text-anchor':'middle',fill:'#5f6c81',transform:`rotate(-55 ${g.sx(index+.5)} ${H-pad.b+12})`}));});return swrap(sv);
    }

    function subtypeSummaryFigure(){
      return h('section',{class:'subtype-summary-figure hierarchy-analysis-body'},h('div',{class:'subtype-reference-layout'},matrixComposite('cue',true),h('div',{class:'subtype-reference-summary'},subtypeTable(),h('h4',{},'Subtype proportion within each major class'),subtypeStackRows('major'),h('h4',{},'Subtype proportion within each region'),subtypeStackRows('area'),h('h4',{},'Average firing rate by subtype'),subtypeRateBars())),h('div',{class:'cap'},'The source panel had no heading. This reconstruction names it from its contents: a subtype-ordered unit-correlation matrix paired with subtype stability, rate, and regional-composition summaries.'));
    }

    function atlasCanvas(colorMode){
      const W=820,H=530,canvas=h('canvas',{width:W,height:H,class:'atlas-canvas',role:'img','aria-label':`functional similarity graph colored by ${colorMode}`}),ctx=canvas.getContext('2d'),graph=HIER.graph,x=index=>28+graph.x[index]*(W-56),y=index=>24+graph.y[index]*(H-48),maxDegree=Math.max(...graph.degree,1);
      ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,W,H);ctx.lineWidth=.6;graph.edges.forEach(edge=>{ctx.strokeStyle=`rgba(86,99,121,${.04+.20*edge[2]})`;ctx.beginPath();ctx.moveTo(x(edge[0]),y(edge[0]));ctx.lineTo(x(edge[1]),y(edge[1]));ctx.stroke();});UNITS.forEach((unit,index)=>{ctx.beginPath();ctx.arc(x(index),y(index),1.1+4.5*Math.sqrt(graph.degree[index]/maxDegree),0,Math.PI*2);ctx.fillStyle=colorMode==='community'?communityColors[(graph.communityById[index]-1)%communityColors.length]:AC[unit.area];ctx.fill();ctx.strokeStyle='rgba(255,255,255,.76)';ctx.lineWidth=.5;ctx.stroke();});
      function nearest(event){const bounds=canvas.getBoundingClientRect(),mx=(event.clientX-bounds.left)*W/bounds.width,my=(event.clientY-bounds.top)*H/bounds.height;let found=-1,distance=Infinity;for(let index=0;index<UNITS.length;index++){const d=(x(index)-mx)**2+(y(index)-my)**2;if(d<distance){distance=d;found=index;}}return distance<110?found:-1;}
      canvas.addEventListener('mousemove',event=>{const index=nearest(event);if(index>=0)showTip(event,`<b>Unit ${index}</b> / ${UNITS[index].area}<br>community C${graph.communityById[index]}<br>degree ${graph.degree[index].toFixed(2)}`);else hideTip();});canvas.addEventListener('mouseleave',hideTip);canvas.addEventListener('click',event=>{const index=nearest(event);if(index>=0)selectUnit(index);});return canvas;
    }

    function positionCanvas(colorMode){
      const W=660,H=430,canvas=h('canvas',{width:W,height:H,class:'atlas-canvas position',role:'img','aria-label':`CW90 unit positions colored by ${colorMode}`}),ctx=canvas.getContext('2d'),graph=HIER.graph,xs=graph.positionY,ys=graph.positionX.map(value=>-value),pad={l:34,r:18,t:34,b:42},xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),sx=value=>pad.l+(value-xmin)/(xmax-xmin||1)*(W-pad.l-pad.r),sy=value=>H-pad.b-(value-ymin)/(ymax-ymin||1)*(H-pad.t-pad.b);
      ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#d7dde6';ctx.lineWidth=1;ctx.strokeRect(pad.l+.5,pad.t+.5,W-pad.l-pad.r-1,H-pad.t-pad.b-1);ctx.strokeStyle='rgba(215,221,230,.65)';for(let step=1;step<4;step++){const gx=pad.l+step*(W-pad.l-pad.r)/4,gy=pad.t+step*(H-pad.t-pad.b)/4;ctx.beginPath();ctx.moveTo(gx,pad.t);ctx.lineTo(gx,H-pad.b);ctx.moveTo(pad.l,gy);ctx.lineTo(W-pad.r,gy);ctx.stroke();}
      UNITS.forEach((unit,index)=>{ctx.beginPath();ctx.arc(sx(xs[index]),sy(ys[index]),2.15,0,Math.PI*2);ctx.fillStyle=colorMode==='community'?communityColors[(graph.communityById[index]-1)%communityColors.length]:AC[unit.area];ctx.fill();});
      const duplicates=new Map();UNITS.forEach((unit,index)=>{const key=`${unit.x}|${unit.y}`;if(!duplicates.has(key))duplicates.set(key,[]);duplicates.get(key).push(index);});ctx.font='8px ui-monospace, SFMono-Regular, Menlo, monospace';ctx.textAlign='center';ctx.textBaseline='middle';duplicates.forEach(ids=>{if(ids.length<6)return;const unit=UNITS[ids[0]],cx=sx(unit.y),cy=sy(-unit.x);ctx.beginPath();ctx.arc(cx,cy,6.2,0,Math.PI*2);ctx.strokeStyle='rgba(63,76,96,.55)';ctx.fillStyle='rgba(255,255,255,.72)';ctx.fill();ctx.stroke();ctx.fillStyle='#526076';ctx.fillText(String(ids.length),cx,cy+.3);});
      ctx.fillStyle='#5f6c81';ctx.font='9px system-ui, sans-serif';ctx.textAlign='center';ctx.fillText('unit_y (CW90)',pad.l+(W-pad.l-pad.r)/2,H-13);ctx.textAlign='left';ctx.fillText('vertical: -unit_x (CW90)',pad.l+4,16);return canvas;
    }

    function edgeStrengthMatrix(matrix=HIER.graph.edgeStrength){
      const W=330,H=305,pad=62,cell=70,sv=svgEl(W,H),flat=matrix.flat(),lo=Math.min(...flat),hi=Math.max(...flat);
      ['M2','M1','S1'].forEach((area,index)=>{sv.append(stext(pad+index*cell+cell/2,pad-11,area,{'font-size':10,'text-anchor':'middle','font-weight':800,fill:AC[area]}),stext(pad-11,pad+index*cell+cell/2+3,area,{'font-size':10,'text-anchor':'end','font-weight':800,fill:AC[area]}));matrix[index].forEach((value,column)=>{const shade=Math.round(242-190*(value-lo)/(hi-lo||1)),rect=s('rect',{x:pad+column*cell,y:pad+index*cell,width:cell,height:cell,fill:`rgb(${shade},${shade},${shade})`,stroke:'#9ba5b4','stroke-width':.6});sv.append(rect,stext(pad+column*cell+cell/2,pad+index*cell+cell/2+3,value.toFixed(1),{'font-size':9.5,'text-anchor':'middle',fill:shade<125?'#fff':'#263144','font-weight':700}));});});return swrap(sv);
    }

    function rankTable(title,rows,metric){
      const reference=rows.some(item=>item.score!=null),wrap=h('div',{class:'factor-table hierarchy-rank-table'},h('h4',{},title)),table=h('table'),head=h('tr');['Unit','Area','Community',reference?'reference value':metric==='degree'?'weighted degree':'cross-region weight'].forEach((label,index)=>head.append(h('th',{class:index===0?'l':''},label)));table.append(h('thead',{},head));const body=h('tbody');rows.slice(0,8).forEach(item=>{const unit=UNITS[item.unit],area=item.area||unit.area,community=item.community||`C${HIER.graph.communityById[item.unit]}`,value=item.score==null?item[metric]:item.score,row=h('tr',{style:{cursor:'pointer'},onclick:()=>selectUnit(item.unit)});row.append(h('td',{class:'l'},`u${String(item.unit).padStart(4,'0')}`),h('td',{},area),h('td',{},community),h('td',{},value.toFixed(2)));body.append(row);});table.append(body);wrap.append(table);return wrap;
    }

    function atlasGraphSection(){
      const audit=HIER.graph.communityAudit||{observed:HIER.graph.communities.map(item=>item.n).sort((a,b)=>b-a),teacher:[985,115,90,65,29,27,21,14]};
      return h('div',{},
        h('div',{class:'atlas-grid hierarchy-analysis-body'},h('section',{class:'hierarchy-atlas-panel'},h('div',{class:'chart-title'},h('h3',{},'Functional communities'),h('span',{},`top ${HIER.graph.k} positive Pearson neighbors · 100-run label-propagation consensus`)),atlasCanvas('community')),h('section',{class:'hierarchy-atlas-panel'},h('div',{class:'chart-title'},h('h3',{},'Same graph by brain region'),h('span',{},'identical weighted force-directed geometry')),atlasCanvas('area'))),
        h('details',{class:'compact-details hierarchy-count-audit-details'},h('summary',{},'Community-count comparison'),h('div',{class:'hierarchy-count-audit atlas-audit'},h('span',{},`Raster reconstruction ${audit.observed.join(' / ')}`),h('span',{},`Teacher panel ${audit.teacher.join(' / ')}`),h('small',{},'reference counts were not used to fit memberships')))
      );
    }

    function atlasReferenceAudit(){
      const computedSizes=HIER.graph.communities.map(item=>item.n).sort((a,b)=>b-a),referenceSizes=(HIER.graph.referenceCommunities||[]).map(item=>item.n).sort((a,b)=>b-a),computedMatrix=HIER.graph.edgeStrength,referenceMatrix=HIER.graph.referenceEdgeStrength||[],matrixError=referenceMatrix.length?computedMatrix.flat().reduce((sum,value,index)=>sum+Math.abs(value-referenceMatrix.flat()[index]),0)/computedMatrix.flat().length:NaN,computedHubIds=new Set(HIER.graph.hubs.slice(0,8).map(item=>item.unit)),referenceHubIds=(HIER.graph.referenceHubs||[]).map(item=>item.unit),hubOverlap=referenceHubIds.filter(id=>computedHubIds.has(id)).length;
      return h('details',{class:'compact-details graph-reference-audit'},h('summary',{},'Teacher screenshot audit · comparison only'),h('div',{class:'graph-audit-copy'},h('p',{},h('b',{},'Community sizes: '),`recomputed ${computedSizes.join(' / ')}; screenshot ${referenceSizes.join(' / ')}.`),h('p',{},h('b',{},'Cross-region matrix: '),Number.isFinite(matrixError)?`mean absolute cell difference ${matrixError.toFixed(1)}.`:'reference matrix unavailable'),h('p',{},h('b',{},'Hub overlap: '),`${hubOverlap}/${referenceHubIds.length} screenshot hub IDs occur in the recomputed top eight.`),h('p',{},'The screenshot did not provide the original Pearson matrix, node/edge CSV, label-propagation seed, or graph coordinates. Its transcribed values remain available for audit but are never substituted for recomputed results.')));
    }

    function atlasSummarySection(){
      const communities=HIER.graph.communities,edgeStrength=HIER.graph.edgeStrength,hubs=HIER.graph.hubs,bridges=HIER.graph.bridges;
      return h('div',{},h('div',{class:'atlas-summary-grid hierarchy-analysis-body'},h('section',{class:'hierarchy-summary-panel'},compositionRows(communities,'Community region comparison')),h('section',{class:'hierarchy-summary-panel'},h('div',{class:'chart-title'},h('h3',{},'Cross-region edge strength'),h('span',{},'unique undirected top-10 kNN edge budget')),edgeStrengthMatrix(edgeStrength)),h('section',{class:'hierarchy-summary-panel'},h('div',{class:'chart-title'},h('h3',{},'Top hub / bridge units'),h('span',{},'recomputed weighted graph summaries')),h('div',{class:'hub-grid'},rankTable('Hub',hubs,'degree'),rankTable('Bridge',bridges,'bridge')),h('p',{class:'subtype-stability-note'},'Hub score is weighted degree in the reconstructed graph. Bridge score is the summed weight of unique edges connecting the unit to a different recorded region.'))),atlasReferenceAudit());
    }

    function positionMapSection(){
      const communityItems=HIER.graph.communities.map(item=>item.label),positionLegend=(items,colorFor)=>h('div',{class:'position-map-legend'},...items.map(item=>h('span',{},h('i',{style:{background:colorFor(item)}}),item)));
      return h('div',{class:'atlas-grid position-grid hierarchy-analysis-body'},h('section',{class:'hierarchy-atlas-panel'},h('div',{class:'chart-title'},h('h3',{},'Unit position colored by kNN community'),h('span',{},'duplicate coordinates marked by count rings')),positionCanvas('community'),positionLegend(communityItems,item=>communityColors[(+item.slice(1)-1)%communityColors.length])),h('section',{class:'hierarchy-atlas-panel'},h('div',{class:'chart-title'},h('h3',{},'Unit position colored by brain region'),h('span',{},'identical CW90 electrode coordinates')),positionCanvas('area'),positionLegend(['M2','M1','S1'],item=>AC[item])));
    }

    function auditStrip(){
      const entries=[['Raw full trial','rawFull'],['Cue aligned','cue'],['Smoothed z full','smoothedZFull']];
      const cards=entries.map(([label,key])=>{const item=HIER.meta.referenceAudit[key];return h('div',{class:item.exactMatch?'exact':''},h('b',{},label),h('span',{},`reconstruction: ${item.observed.join(' / ')}`),h('small',{},`teacher: ${item.teacher.join(' / ')}`));});
      const graph=HIER.graph.communityAudit;if(graph)cards.push(h('div',{},h('b',{},'kNN communities'),h('span',{},`reconstruction: ${graph.observed.join(' / ')}`),h('small',{},`teacher: ${graph.teacher.join(' / ')}`)));
      return h('details',{class:'compact-details hierarchy-reference-audit'},h('summary',{},'Teacher-panel comparison audit'),h('div',{class:'hierarchy-audit-strip'},...cards),h('p',{},'These counts are diagnostic only. No teacher count, stability value, partition, or graph summary is substituted into the displayed reconstruction.'));
    }

    function vHierarchy(main){
      const completeness=HIER.meta.rasterCompleteness;
      main.classList.add('hierarchy-publication');
      main.append(
        h('div',{class:'head'},h('h1',{},'Functional hierarchy'),h('span',{class:'sub'},'trial-resolved Pearson structure, cue subtypes, and the full-trial similarity atlas')),
        h('div',{class:'summary-strip'},h('span',{},h('b',{},HIER.meta.nUnits.toLocaleString()),' units'),h('span',{},h('b',{},HIER.meta.nTrials),' trials'),h('span',{},h('b',{},HIER.meta.binHz+' Hz'),' spike bins'),h('span',{},h('b',{},HIER.meta.featuresPerUnit.toLocaleString()),' features per full-trial unit vector'),h('span',{},h('b',{},HIER.meta.subtypes),' cue subtypes')),
        h('div',{class:'note hierarchy-provenance'},h('b',{},'Data provenance: '),HIER.meta.provenance)
      );
      if(completeness){const message=completeness.complete?`All ${HIER.meta.nUnits.toLocaleString()} unit profiles were rebuilt from the complete S21-S40 recordings, and every raw rate agrees with the supplied two-decimal mean-rate table after rounding.`:`${completeness.unitsBelow90Percent} of ${HIER.meta.nUnits} units contain less than 90% of the spike count implied by the supplied mean-rate field.`;main.append(h('div',{class:'note hierarchy-provenance'},h('b',{},'Raster completeness audit: '),message));}
      main.append(
        sectionHead('a','Trial-aligned unit correlation hierarchy','Unit-by-unit Pearson clustering of raster-derived -1 to +5 s cue profiles with class rate and regional summaries.'),
        hierarchyFigure('cue','Each unit is represented by its 120-bin, 50 ms cue-aligned trial-mean firing profile. Pearson correlation emphasizes response shape; summaries return to Hz.','cue'),
        sectionHead('b','Subtype-resolved functional correlation hierarchy','Inferred title for the untitled source panel: subtype-ordered correlations with bootstrap stability, rate, and regional summaries.'),
        subtypeSummaryFigure(),
        sectionHead('c','Subtype-sorted z-score firing-rate heatmap','Rows are raster-derived, row-z-scored once across -1 to +5 s, then ordered by major class, subtype, and peak time.'),
        heatmapSection(),
        sectionHead('d','Subtype prototype traces','Sixteen raster-derived cue-response prototypes shown with one shared firing-rate scale.'),
        subtypePrototypeGrid(),
        sectionHead('e','Full-trial trial-by-trial Pearson hierarchy','Raw 80-trial, 25 s, 80 Hz spike-count vectors with corresponding class rate and regional summaries.'),
        hierarchyFigure('fullRaw','Each unit vector concatenates all 80 unsmoothed single-trial traces. Trial identity is retained; no trial averaging enters the correlation.','rawFull'),
        sectionHead('f','Smoothed z-scored full-trial Pearson hierarchy','Five-bin smoothing followed by a separate within-trial z-score before concatenating all 80 trials.'),
        hierarchyFigure('fullSmooth','Each of the 80 trials is normalized independently, preventing high-rate units or between-trial offsets from dominating full-trial similarity.','smoothedZFull'),
        sectionHead('g','Smoothed z-scored full-trial functional similarity atlas','Weighted positive-Pearson kNN graph from the same normalized full-trial matrix. Graph geometry is a deterministic display embedding.'),
        atlasGraphSection(),
        sectionHead('h','Community and cross-region graph summaries','Raster-derived community composition, unique graph-edge budgets, and top weighted hub and cross-region bridge units.'),
        atlasSummarySection(),
        sectionHead('i','Functional similarity unit position maps','The same supplied CW90 electrode coordinates, recolored by reconstructed functional community and recorded region.'),
        positionMapSection(),
        auditStrip(),
        h('details',{class:'compact-details figure-methods'},h('summary',{},'Methods and interpretation'),h('p',{},'Every visible membership and summary is reconstructed from the supplied spike rasters. Cue profiles use 50 ms bins averaged over 80 trials. Raw full-trial vectors concatenate 80 separate 25-second, 80-Hz spike-count traces. Normalized full-trial vectors receive a centered five-bin smooth and a separate within-trial z-score before concatenation. Major classes use average-linkage hierarchical clustering cut to five groups; alternative linkage and distance choices were audited with cophenetic fidelity, silhouette separation, and split-half adjusted Rand agreement. Cue subtypes use 32-start minimum-inertia k-means++ at the source panel\'s sixteen-subtype resolution, with end-to-end trial-bootstrap recovery. The atlas connects each unit to its ten strongest positive normalized full-trial Pearson neighbors and uses a 100-run weighted label-propagation consensus at the displayed eight-community resolution. Its weighted force layout changes display positions only. Reference counts are audit comparators, never fitting targets. These are functional-similarity summaries, not anatomical connectivity or causality.'))
      );
    }

    return {vHierarchy};
  };
})();
