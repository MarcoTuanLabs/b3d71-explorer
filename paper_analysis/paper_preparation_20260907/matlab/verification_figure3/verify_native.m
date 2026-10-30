function verify_native()
here=fileparts(mfilename('fullpath'));source=fullfile(here,'..','..','neuron_explorer','paper_analysis','paper_preparation_20260907','matlab');addpath(source);loaded=load(fullfile(source,'paper_figure3_data.mat'));f3=loaded.f3;
files=dir(fullfile(here,'generated','paper_figure_03*.fig'));assert(numel(files)==7);result=struct([]);
for i=1:numel(files)
 fig=openfig(fullfile(files(i).folder,files(i).name),'new','invisible');drawnow;ax=findall(fig,'Tag','pp_data_axes');
 for j=1:numel(ax),p=get(ax(j),'Position');assert(all(isfinite(p)) && all(p(3:4)>.004) && all(p(1:2)>=0) && p(1)+p(3)<=1.01 && p(2)+p(4)<=1.01,'Axes must be visible and inside figure');end
 matrix_count=0;ims=findall(fig,'Type','image');
 for j=1:numel(ims)
  c=get(ims(j),'CData');if isequal(size(c),[1346 1346]),matrix_count=matrix_count+1;assert(all(isfinite(c(:))));else,assert(size(c,1)==1 || isequal(size(c),[3 3]),'No neuron-by-time firing map is included');end
 end
 if contains(files(i).name,'03c_')
  lines=findall(fig,'Type','line');traces=0;
  for j=1:numel(lines)
   x=get(lines(j),'XData');if numel(x)==120
    y=get(lines(j),'YData');traces=traces+1;assert(any(max(abs(double(f3.subtypes.profiles)-y(:)'),[],2)<1e-10));
   end
  end
  assert(traces==16 && numel(ax)==16,'All 16 subtype prototypes must be present');
 end
 if contains(files(i).name,'03f_')
  nodes=findall(fig,'Tag','pp_f3_nodes');assert(numel(nodes)==2);
  assert(isequal(get(nodes(1),'XData'),get(nodes(2),'XData')) && isequal(get(nodes(1),'YData'),get(nodes(2),'YData')) && isequal(get(nodes(1),'SizeData'),get(nodes(2),'SizeData')));
  xy=[double(f3.positions(:,2)) -double(f3.positions(:,1))];[~,~,ic]=unique(xy,'rows');offset=xy;
  for q=1:max(ic),ids=find(ic==q);if numel(ids)>1,theta=(0:numel(ids)-1)'*2*pi/numel(ids);offset(ids,:)=xy(ids,:)+1.8*[cos(theta) sin(theta)];end,end
  e=double(f3.graph.edges);bounds=[0 .05 .1 .2 Inf];widths=[.15 .22 .34 .55];
  community=[59 126 161;182 92 80;90 143 98;147 112 166;204 155 65;72 153 151;177 117 140;111 121 139]/255;region=[59 126 161;182 92 80;90 143 98]/255;seenCommunity=false;seenRegion=false;
  for k=1:2
   node=nodes(k);x=get(node,'XData');y=get(node,'YData');assert(numel(x)==1346 && isequal(get(node,'UserData'),double(f3.unit_id)));
   sizes=get(node,'SizeData');degree=double(f3.graph.degree(:));assert(max(abs(sizes(:)-(6+34*sqrt(degree/max(degree)))))<1e-10);
   assert(max(abs(x(:)-offset(:,1)))<1e-10 && max(abs(y(:)-offset(:,2)))<1e-10);
   c=get(node,'CData');seenCommunity=seenCommunity || isequal(c,community(double(f3.graph.labels),:));seenRegion=seenRegion || isequal(c,region(double(f3.area),:));
   mapped=findobj(get(node,'Parent'),'Tag','pp_f3_spatial_edges');assert(numel(mapped)==4);seen=[];
   for j=1:numel(mapped)
    rows=get(mapped(j),'UserData');seen=[seen;rows];mx=reshape(get(mapped(j),'XData'),3,[])';my=reshape(get(mapped(j),'YData'),3,[])';
    assert(isequal(mx(:,1),x(e(rows,1))') && isequal(mx(:,2),x(e(rows,2))') && isequal(my(:,1),y(e(rows,1))') && isequal(my(:,2),y(e(rows,2))'));
    b=find(abs(widths-get(mapped(j),'LineWidth'))<1e-9);assert(numel(b)==1 && all(e(rows,3)>=bounds(b) & e(rows,3)<bounds(b+1)));
   end
   assert(isequal(sort(seen),(1:size(e,1))') && numel(seen)==12474);
  end
  assert(seenCommunity && seenRegion);
 end
 result(i).file=files(i).name;result(i).axes_count=numel(ax);result(i).square_correlation_matrices=matrix_count;close(fig);
end
fid=fopen(fullfile(here,'native_verification.json'),'w');fprintf(fid,'%s\n',pp_jsonencode(struct('status','PASS','panels',result,'prototype_traces',16,'spatial_nodes',1346,'display_edges_per_view',12474,'spatial_views',2,'full_graph_edges',12474,'empty_axes',false,'zscore_firing_map',false)));fclose(fid);
disp('PASS: all seven native FIGs; 16 nonempty prototype axes; restored two spatial views, each with all 12474 correctly mapped edges.');
end
