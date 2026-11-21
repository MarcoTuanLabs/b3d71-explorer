function plot_paper_figure3(f3,outdir,panels)
% All marks, matrices, layouts, typography and exports are drawn in MATLAB.
% Inputs are numeric recomputations from raw spike samples, never source images.
if nargin<3,panels={'a','b','c','d','e','f','g'};end
f3=double_numbers(f3);
if exist(outdir,'dir')~=7,mkdir(outdir);end
area=[59 126 161;182 92 80;90 143 98]/255;
if any(strcmp(panels,'a')),plot_hierarchy(f3.cue,'a','Cue-response correlation hierarchy','120 cue bins | -1 to +5 s | trial-mean firing profiles',outdir,'paper_figure_03a_cue_hierarchy',area); end
if any(strcmp(panels,'b')),plot_subtypes(f3,outdir,area); end
if any(strcmp(panels,'c')),plot_prototypes(f3,outdir); end
if any(strcmp(panels,'d')),plot_hierarchy(f3.raw,'d','Full-trial spike-count hierarchy','160,000 bins per neuron | 80 trials | -5 to +20 s | 12.5-ms bins',outdir,'paper_figure_03d_full_trial_hierarchy',area); end
if any(strcmp(panels,'e')),plot_hierarchy(f3.smooth,'e','Normalized full-trial correlation hierarchy','Five-bin smoothing | each trial standardized separately | 80 concatenated trials',outdir,'paper_figure_03e_normalized_hierarchy',area); end
if any(strcmp(panels,'f')),plot_graph(f3,outdir,area); end
if any(strcmp(panels,'g')),plot_graph_summary(f3,outdir,area); end
end

function plot_hierarchy(s,letter,heading,subtitle,outdir,stem,area)
fig=canvas(7.4,letter,heading,subtitle);colors=palette(s.k);n=numel(s.order);
ax=axnew(fig,[.085 .29 .38 .4364864865]);correlation_map(ax,s.corr,s.order);xlabel(ax,'Neuron rank in hierarchy');ylabel(ax,'Neuron rank in hierarchy');
ax=axnew(fig,[.085 .752 .38 .093]);draw_tree(ax,s.tree,s.order);ylabel(ax,'1 - r','FontSize',7);set(ax,'XTick',[]);
ax=axnew(fig,[.085 .735 .38 .009]);image(ax,reshape(colors(s.labels(s.order),:),[1 n 3]));set(ax,'XLim',[.5 n+.5],'YLim',[.5 1.5]);axis(ax,'off');
ax=axnew(fig,[.60 .655 .34 .19]);hold(ax,'on');for g=1:s.k,plot(ax,s.time,s.profiles(g,:),'Color',colors(g,:),'LineWidth',1.05);end
xline(ax,0,':','Color',[.45 .45 .45]);xlim(ax,[min(s.time) max(s.time)]);xlabel(ax,'Time from cue (s)');ylabel(ax,'Mean firing rate (Hz)');title(ax,'Cluster mean profiles','FontSize',9);
legend(ax,arrayfun(@(g)sprintf('C%d',g),1:s.k,'UniformOutput',false),'Location','eastoutside','Box','off','FontSize',6.5);
ax=axnew(fig,[.60 .38 .34 .17]);rowbars(ax,s.counts,area,arrayfun(@(g)sprintf('C%d (n=%d)',g,sum(s.counts(g,:))),1:s.k,'UniformOutput',false));title(ax,'Region composition within each cluster','FontSize',9);xlabel(ax,'Within-cluster percentage');
ax=axnew(fig,[.60 .12 .34 .15]);rowbars(ax,s.counts',colors,{'S1','M1','M2'});title(ax,'Cluster composition within each region','FontSize',9);xlabel(ax,'Within-region percentage');
[best_score,best_index]=max(s.scores(:,2));
label(fig,[.085 .112 .38 .048],sprintf('Specified K=%d: silhouette %.3f\nBest among K=2-10: K=%d, %.3f',s.k,s.silhouette,s.scores(best_index,1),best_score),8.0);
legend_row(fig,{'S1','M1','M2'},area,.60,.585,.12);
label(fig,[.085 .035 .87 .035],'Average linkage on 1 - Pearson r; five groups specified; K=2-10 shown for sensitivity. Groups are descriptive.',7.2);
pp_export(fig,stem,outdir);close(fig);
end

function plot_subtypes(f3,outdir,area)
s=f3.subtypes;fig=canvas(11.0,'b','Cue subtypes and membership recovery',sprintf('%d specified subtypes | 50 recording-block bootstrap resamples',s.k));colors=palette(s.k);
ax=axnew(fig,[.085 .565 .37 .285909091]);correlation_map(ax,f3.cue.corr,s.order,true);xlabel(ax,'Neuron rank by subtype');ylabel(ax,'Neuron rank by subtype');
ax=axnew(fig,[.085 .861 .37 .006]);image(ax,reshape(colors(s.labels(s.order),:),[1 numel(s.order) 3]));set(ax,'XLim',[.5 numel(s.order)+.5],'YLim',[.5 1.5]);axis(ax,'off');
ax=axnew(fig,[.65 .565 .28 .265]);hold(ax,'on');for k=1:s.k,plot(ax,s.recovery_interval(k,:),[k k],'-','Color',colors(k,:),'LineWidth',1.2);scatter(ax,s.recovery_mean(k),k,20,colors(k,:),'filled');end
set(ax,'YDir','reverse','YTick',1:s.k,'YTickLabel',names(s.names),'YLim',[.4 s.k+.6],'XLim',[0 1]);xlabel(ax,'Membership Jaccard recovery');title(ax,'Mean and 95% resampling range','FontSize',9);
ax=axnew(fig,[.085 .335 .37 .16]);rowbars(ax,s.counts,area,arrayfun(@(g)sprintf('%s (%d)',s.names{g},sum(s.counts(g,:))),1:s.k,'UniformOutput',false));set(ax,'FontSize',6.2);xlabel(ax,'Within-subtype percentage');title(ax,'Regional composition','FontSize',9);
ax=axnew(fig,[.65 .335 .28 .16]);barh(ax,1:s.k,s.mean_hz,.65,'FaceColor','flat','CData',colors,'EdgeColor','white');set(ax,'YDir','reverse','YTick',1:s.k,'YTickLabel',names(s.names),'YLim',[.4 s.k+.6],'FontSize',6.2);xlabel(ax,'Mean cue-window firing rate (Hz)');title(ax,'Rates recomputed from raw spikes','FontSize',9);
legend_row(fig,{'S1','M1','M2'},area,.085,.295,.12);
parent_counts=zeros(5,s.k);for g=1:5,for k=1:s.k,parent_counts(g,k)=sum(f3.cue.labels(:)==g & s.labels(:)==k);end,end
ax=axnew(fig,[.085 .15 .37 .115]);rowbars(ax,parent_counts,colors,{'C1','C2','C3','C4','C5'});xlabel(ax,'Within-parent percentage');title(ax,'Subtype composition within major classes','FontSize',9);
ax=axnew(fig,[.65 .15 .28 .115]);rowbars(ax,s.counts',colors,{'S1','M1','M2'});xlabel(ax,'Within-region percentage');title(ax,'Subtype composition within regions','FontSize',9);
legend_grid(fig,names(s.names),colors,.085,.081,.87,8);
label(fig,[.085 .012 .88 .027],'Specified 5/1/3/1/6 resolution; memberships refitted from actual profiles. Bootstrap ranges are within-mouse recovery.',7.0);
pp_export(fig,'paper_figure_03b_subtype_recovery',outdir);close(fig);
end

function plot_prototypes(f3,outdir)
s=f3.subtypes;cols=min(4,s.k);rows=ceil(s.k/cols);height=max(3.7,2.0+rows*1.55);fig=canvas(height,'c','Subtype firing-rate prototypes','Physical firing rates from complete spike recordings | one common y scale');colors=palette(s.k);ymax=max(s.profiles(:))*1.12;
for k=1:s.k
 r=floor((k-1)/cols);c=mod(k-1,cols);w=.81/cols;h=.66/rows;
 ax=axnew(fig,[.085+c*.875/cols .16+(.66-h)-r*h w*.83 h*.64]);plot(ax,s.time,s.profiles(k,:),'Color',colors(k,:),'LineWidth',1.2);hold(ax,'on');xline(ax,0,':','Color',[.5 .5 .5]);set(ax,'XLim',[-1 5],'YLim',[0 ymax],'XTick',[-1 0 2 5]);xlabel(ax,'Time from cue (s)');if c==0,ylabel(ax,'Mean rate (Hz)');end
 title(ax,sprintf('%s | n=%d',s.names{k},sum(s.counts(k,:))),'FontSize',9,'Color',colors(k,:));
end
label(fig,[.085 .038 .87 .036],'Each curve averages neurons within its recovered subtype. Rates and subtype sizes are not copied from a reference.',7.2);
pp_export(fig,'paper_figure_03c_subtype_prototypes',outdir);close(fig);
end

function plot_graph(f3,outdir,area)
s=f3.graph;colors=palette(s.k);xy=[f3.positions(:,2) -f3.positions(:,1)];[~,~,ic]=unique(xy,'rows');counts=accumarray(ic,1);offset=xy;
for q=1:numel(counts)
 ids=find(ic==q);if numel(ids)<=1,continue;end
 theta=(0:numel(ids)-1)'*2*pi/numel(ids);offset(ids,:)=xy(ids,:)+1.8*[cos(theta) sin(theta)];
end
% Every original graph edge is drawn in BOTH views, without a display filter.
e=s.edges;bounds=[0 .05 .10 .20 Inf];widths=[.15 .22 .34 .55];ink=[.96 .965 .975;.90 .92 .94;.76 .81 .86;.50 .58 .67];
fig=canvas(6.8,'f','Spatial organization of the full functional network','All original graph connections | recorded positions | line width and shade encode Pearson weight');
sizes=6+34*sqrt(s.degree/max(s.degree));
for j=1:2
 ax=axnew(fig,[.095+(j-1)*.485 .37 .38 .48]);
 for b=1:4
  rows=find(e(:,3)>=bounds(b) & e(:,3)<bounds(b+1));
  xx=[offset(e(rows,1),1) offset(e(rows,2),1) nan(numel(rows),1)]';yy=[offset(e(rows,1),2) offset(e(rows,2),2) nan(numel(rows),1)]';
  plot(ax,xx(:),yy(:),'-','Color',ink(b,:),'LineWidth',widths(b),'Tag','pp_f3_spatial_edges','UserData',rows);
 end
 if j==1,c=colors(s.labels,:);ttl='Functional graph by community';else,c=area(f3.area,:);ttl='Functional graph by recorded region';end
 scatter(ax,offset(:,1),offset(:,2),sizes,c,'filled','MarkerEdgeColor','white','LineWidth',.15,'Tag','pp_f3_nodes','UserData',f3.unit_id);
 axis(ax,'equal');axis(ax,'tight');xlabel(ax,'unit y (source coordinates)');ylabel(ax,'-unit x (source coordinates)');title(ax,ttl,'FontSize',8.8);
end
legend_grid(fig,arrayfun(@(i)sprintf('G%d',i),1:s.k,'UniformOutput',false),colors,.095,.275,.38,4);
legend_row(fig,{'S1','M1','M2'},area,.58,.275,.12);
label(fig,[.095 .177 .50 .030],'Connection weight (r) / line width and shade',8.3,'bold');
la=axnew(fig,[.095 .087 .49 .078]);ranges={'0 < r < 0.05','0.05 <= r < 0.10','0.10 <= r < 0.20','r >= 0.20'};
for b=1:4,col=mod(b-1,2);row=floor((b-1)/2);x=.53*col;y=.78-.53*row;plot(la,[x x+.09],[y y],'Color',ink(b,:),'LineWidth',widths(b));text(la,x+.12,y,ranges{b},'FontSize',7.1,'VerticalAlignment','middle');end
set(la,'XLim',[0 1.03],'YLim',[0 1]);axis(la,'off');
label(fig,[.675 .177 .30 .030],'Node size / weighted degree',8.3,'bold');
la=axnew(fig,[.675 .087 .27 .078]);dv=[1 10 50];scatter(la,[.12 .49 .86],[.68 .68 .68],6+34*sqrt(dv/max(s.degree)),[.38 .45 .53],'filled');for b=1:3,text(la,.12+.37*(b-1),.14,sprintf('%g',dv(b)),'HorizontalAlignment','center','FontSize',7.1);end
set(la,'XLim',[0 1],'YLim',[0 1]);axis(la,'off');
label(fig,[.085 .044 .90 .026],sprintf('All %d neurons and %d edges in EACH panel. Identical positions, connections and node sizes; only colors differ.',numel(f3.unit_id),size(e,1)),7.1);
label(fig,[.085 .014 .90 .026],'Shared positions use 1.8-unit display offsets. Edges represent firing-pattern similarity, not anatomical connections.',7.1);
pp_export(fig,'paper_figure_03f_similarity_atlas',outdir);close(fig);
end

function plot_graph_summary(f3,outdir,area)
s=f3.graph;fig=canvas(7.7,'g','Community composition and graph summaries','Every statistic is recomputed from the unique undirected positive-Pearson edge set');
ax=axnew(fig,[.12 .58 .36 .25]);rowbars(ax,s.counts,area,arrayfun(@(g)sprintf('G%d (n=%d)',g,sum(s.counts(g,:))),1:s.k,'UniformOutput',false));xlabel(ax,'Within-community percentage');title(ax,'Community region composition','FontSize',9);legend_row(fig,{'S1','M1','M2'},area,.12,.49,.115);
ax=axnew(fig,[.65 .575 .26 .255]);imagesc(ax,s.edge_strength);colormap(ax,parula(256));set(ax,'XTick',1:3,'YTick',1:3,'XTickLabel',{'S1','M1','M2'},'YTickLabel',{'S1','M1','M2'},'YDir','reverse','TickLength',[0 0]);axis(ax,'image');title(ax,'Summed edge weight','FontSize',9);for a=1:3,for b=1:3,co='k';if s.edge_strength(a,b)<max(s.edge_strength(:))*.4,co='w';end;text(ax,b,a,sprintf('%.1f',s.edge_strength(a,b)),'HorizontalAlignment','center','Color',co,'FontSize',8.5);end,end
for j=1:2
 if j==1,ids=s.hubs;values=s.degree(ids);ttl='Hub units';xl='Weighted degree';else,ids=s.bridges;values=s.bridge(ids);ttl='Cross-region bridge units';xl='Cross-region edge weight';end
 ax=axnew(fig,[.17+(j-1)*.49 .16 .28 .25]);barh(ax,1:numel(ids),values,.67,'FaceColor','flat','CData',area(f3.area(ids),:),'EdgeColor','white');lab=cell(numel(ids),1);regions={'S1','M1','M2'};for k=1:numel(ids),lab{k}=sprintf('u%d | %s | G%d',f3.unit_id(ids(k)),regions{f3.area(ids(k))},s.labels(ids(k)));end
 set(ax,'YDir','reverse','YTick',1:numel(ids),'YTickLabel',lab,'YLim',[.4 numel(ids)+.6],'FontSize',7.2);xlabel(ax,xl);title(ax,ttl,'FontSize',9);
end
label(fig,[.085 .070 .87 .028],'Matrix diagonal counts within-region edges once; off-diagonal cells mirror the same cross-region total.',7.1);
label(fig,[.085 .035 .87 .028],'Hubs sum all incident weights; bridges sum only cross-region weights. These are descriptive ranks.',7.1);
pp_export(fig,'paper_figure_03g_graph_summaries',outdir);close(fig);
end

function correlation_map(ax,c,order,vertical)
if nargin<4,vertical=false;end
position=get(ax,'Position');v=abs(c(triu(true(size(c)),1)));v=sort(v);limit=max(.01,v(max(1,round(.99*numel(v)))));imagesc(ax,c(order,order));set(ax,'YDir','reverse');axis(ax,'image');set(ax,'CLim',[-limit limit],'XTick',[1 size(c,1)],'YTick',[1 size(c,1)]);colormap(ax,diverge(256));
if vertical,cb=colorbar(ax,'eastoutside');set(cb,'Position',[position(1)+position(3)+.025 position(2)+.05 .012 position(4)-.1]);else,cb=colorbar(ax,'southoutside');set(cb,'Position',[position(1) position(2)-.077 position(3) .014]);end
set(ax,'Position',position);cb.Label.String='Pearson r (99% absolute scale)';cb.FontSize=7;cb.Ticks=[-limit 0 limit];cb.TickLabels={sprintf('%.2g',-limit),'0',sprintf('%.2g',limit)};
end
function draw_tree(ax,tree,order)
n=numel(order);x=zeros(2*n-1,1);y=zeros(2*n-1,1);x(order)=1:n;xx=[];yy=[];
for k=1:size(tree,1),a=tree(k,1)+1;b=tree(k,2)+1;i=n+k;x(i)=(x(a)+x(b))/2;y(i)=tree(k,3);xx=[xx x(a) x(a) x(b) x(b) NaN];yy=[yy y(a) y(i) y(i) y(b) NaN];end %#ok<AGROW>
plot(ax,xx,yy,'Color',[.3 .35 .4],'LineWidth',.35);xlim(ax,[.5 n+.5]);set(ax,'YTick',[0 max(y)],'YTickLabel',{'0',sprintf('%.2f',max(y))});
end
function rowbars(ax,counts,colors,labels)
counts=double(counts);p=100*counts./sum(counts,2);h=barh(ax,p,'stacked','BarWidth',.68);for k=1:numel(h),set(h(k),'FaceColor',colors(k,:),'EdgeColor','white','LineWidth',.35);end
set(ax,'YDir','reverse','YTick',1:size(p,1),'YTickLabel',labels,'YLim',[.4 size(p,1)+.6],'XLim',[0 100],'XTick',[0 50 100],'FontSize',7.2);
end
function fig=canvas(height,letter,heading,subtitle)
fig=figure('Visible','off','Color','white','Units','inches','Position',[.5 .5 8.5 height],'PaperUnits','inches','PaperSize',[8.5 height],'PaperPosition',[0 0 8.5 height],'Renderer','painters','InvertHardcopy','off','DefaultAxesFontName','Arial','DefaultTextFontName','Arial','DefaultAxesFontSize',8,'DefaultTextFontSize',8,'DefaultTextInterpreter','none','DefaultAxesTickLabelInterpreter','none');
label(fig,[.025 .934 .035 .045],letter,13,'bold');label(fig,[.085 .934 .89 .045],heading,12,'bold');label(fig,[.085 .884 .88 .035],subtitle,8.3);
end
function ax=axnew(fig,pos)
ax=axes('Parent',fig,'Position',pos,'Tag','pp_data_axes');set(ax,'FontName','Arial','FontSize',8,'LineWidth',.75,'Box','off','TickDir','out','TickLength',[.017 .017],'XColor',[.24 .29 .35],'YColor',[.24 .29 .35],'Color','white','Layer','top','TickLabelInterpreter','none');hold(ax,'on');
end
function label(fig,pos,value,size_,weight)
if nargin<5,weight='normal';end
annotation(fig,'textbox',pos,'String',value,'EdgeColor','none','Margin',.01,'Interpreter','none','FontName','Arial','FontSize',size_,'FontWeight',weight,'Color',[.20 .25 .31],'VerticalAlignment','middle','FitBoxToText','off');
end
function legend_row(fig,labels,colors,x,y,step)
for k=1:numel(labels),annotation(fig,'rectangle',[x+(k-1)*step y .014 .019],'FaceColor',colors(k,:),'EdgeColor','none');label(fig,[x+(k-1)*step+.019 y-.004 step-.02 .027],labels{k},7.2);end
end
function legend_grid(fig,labels,colors,x,y,width,cols)
for k=1:numel(labels),r=floor((k-1)/cols);c=mod(k-1,cols);xx=x+c*width/cols;yy=y-r*.031;annotation(fig,'rectangle',[xx yy .012 .016],'FaceColor',colors(k,:),'EdgeColor','none');label(fig,[xx+.016 yy-.005 width/cols-.017 .027],labels{k},7);end
end
function c=palette(k)
base=[59 126 161;182 92 80;90 143 98;147 112 166;204 155 65;72 153 151;177 117 140;111 121 139;140 145 73;185 132 94;80 100 164;158 90 103;89 149 184;199 126 66;138 91 140;109 161 127]/255;
c=base(mod(0:k-1,size(base,1))+1,:);
end
function m=diverge(n)
m=interp1([0 .5 1],[63 109 168;248 249 250;217 95 69]/255,linspace(0,1,n));
end
function c=names(values)
if iscell(values),c=values;else,c=cellstr(values);end
end

function out=double_numbers(in)
if isstruct(in)
 out=in;fields=fieldnames(in);for k=1:numel(fields),out.(fields{k})=double_numbers(in.(fields{k}));end
elseif isnumeric(in),out=double(in);
else,out=in;end
end
