function label = paper_significance_stars(p)
% Stars use the supplied P value; caller determines its correction policy.
if ~isfinite(p), label = 'NA';
elseif p < 0.0001, label = '****';
elseif p < 0.001, label = '***';
elseif p < 0.01, label = '**';
elseif p < 0.05, label = '*';
else, label = 'ns';
end
end
