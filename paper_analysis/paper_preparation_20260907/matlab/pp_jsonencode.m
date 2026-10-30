function out=pp_jsonencode(value)
%PP_JSONENCODE JSON writer preserving very small scientific P values in Octave.
% Some Octave builds round tiny doubles to0 in native jsonencode.
if ischar(value)
    out=jsonencode(value);
elseif isstruct(value)
    if numel(value)>1
        parts=arrayfun(@(v) pp_jsonencode(v),value,'UniformOutput',false);
        out=['[' strjoin(parts,',') ']'];
    else
        keys=fieldnames(value); parts=cell(1,numel(keys));
        for k=1:numel(keys)
            parts{k}=[jsonencode(keys{k}) ':' pp_jsonencode(value.(keys{k}))];
        end
        out=['{' strjoin(parts,',') '}'];
    end
elseif iscell(value)
    parts=cellfun(@pp_jsonencode,value(:)','UniformOutput',false);
    out=['[' strjoin(parts,',') ']'];
elseif isnumeric(value) || islogical(value)
    if isempty(value), out='[]';
    elseif isscalar(value)
        if islogical(value)
            if value, out='true'; else, out='false'; end
        elseif isfinite(value), out=sprintf('%.17g',value);
        else, out='null'; end
    elseif isvector(value)
        parts=arrayfun(@pp_jsonencode,value(:)','UniformOutput',false);
        out=['[' strjoin(parts,',') ']'];
    else
        parts=cell(1,size(value,1)); subs=repmat({':'},1,ndims(value));
        for row=1:size(value,1)
            subs{1}=row; parts{row}=pp_jsonencode(squeeze(value(subs{:})));
        end
        out=['[' strjoin(parts,',') ']'];
    end
else
    out=jsonencode(value);
end
end
