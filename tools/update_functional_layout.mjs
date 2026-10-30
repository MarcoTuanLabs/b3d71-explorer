#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outputPath=path.join(root,'data','functional_hierarchy.js');
const prefix='window.FUNCTIONAL_HIERARCHY=';
const source=fs.readFileSync(outputPath,'utf8').trim();
if(!source.startsWith(prefix)||!source.endsWith(';'))throw new Error('Unexpected hierarchy payload wrapper');
const payload=JSON.parse(source.slice(prefix.length,-1));
const graph=payload.graph;
const n=graph.communityById.length;
const degree=new Float64Array(n);
const edges=graph.edges.map(([a,b,w])=>[a,b,w]);
for(const [a,b,w] of edges){degree[a]+=w;degree[b]+=w;}

let seed=71;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const componentCount=4;
let vectors=Array.from({length:componentCount},()=>Float64Array.from({length:n},()=>random()-.5));

function orthonormalize(columns){
  for(let column=0;column<columns.length;column++){
    for(let previous=0;previous<column;previous++){
      let dot=0;
      for(let index=0;index<n;index++)dot+=columns[column][index]*columns[previous][index];
      for(let index=0;index<n;index++)columns[column][index]-=dot*columns[previous][index];
    }
    let norm=0;
    for(let index=0;index<n;index++)norm+=columns[column][index]**2;
    norm=Math.sqrt(norm)||1;
    for(let index=0;index<n;index++)columns[column][index]/=norm;
  }
  return columns;
}

vectors=orthonormalize(vectors);
const applyShiftedNormalizedLaplacian=columns=>{
  // 2I-L_norm = I + D^-1/2 A D^-1/2. Its largest eigenvectors are
  // the smallest eigenvectors of the normalized graph Laplacian.
  const next=columns.map(column=>Float64Array.from(column));
  for(const [a,b,w] of edges){
    const normalized=w/Math.sqrt(Math.max(1e-12,degree[a]*degree[b]));
    for(let column=0;column<componentCount;column++){
      next[column][a]+=normalized*columns[column][b];
      next[column][b]+=normalized*columns[column][a];
    }
  }
  return next;
};

for(let iteration=0;iteration<2500;iteration++){
  const next=applyShiftedNormalizedLaplacian(vectors);
  vectors=orthonormalize(next);
}

// Orthogonal iteration recovers the leading four-dimensional subspace. A
// Rayleigh-Ritz step rotates that subspace onto individual eigenvectors so the
// displayed axes match eigsh(..., k=4, which='SM') rather than an arbitrary
// mixture of the same modes.
const projected=Array.from({length:componentCount},()=>Array(componentCount).fill(0));
const applied=applyShiftedNormalizedLaplacian(vectors);
for(let row=0;row<componentCount;row++){
  for(let column=0;column<componentCount;column++){
    let dot=0;
    for(let index=0;index<n;index++)dot+=vectors[row][index]*applied[column][index];
    projected[row][column]=dot;
  }
}

function symmetricEigen(matrix){
  const a=matrix.map(row=>row.slice());
  const eigenvectors=Array.from({length:componentCount},(_,row)=>
    Array.from({length:componentCount},(_,column)=>Number(row===column))
  );
  for(let sweep=0;sweep<100;sweep++){
    let p=0;
    let q=1;
    let largest=Math.abs(a[p][q]);
    for(let row=0;row<componentCount;row++){
      for(let column=row+1;column<componentCount;column++){
        const magnitude=Math.abs(a[row][column]);
        if(magnitude>largest){largest=magnitude;p=row;q=column;}
      }
    }
    if(largest<1e-13)break;
    const angle=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]);
    const cosine=Math.cos(angle);
    const sine=Math.sin(angle);
    const app=a[p][p];
    const aqq=a[q][q];
    const apq=a[p][q];
    for(let index=0;index<componentCount;index++){
      if(index===p||index===q)continue;
      const aip=a[index][p];
      const aiq=a[index][q];
      a[index][p]=a[p][index]=cosine*aip-sine*aiq;
      a[index][q]=a[q][index]=sine*aip+cosine*aiq;
    }
    a[p][p]=cosine*cosine*app-2*sine*cosine*apq+sine*sine*aqq;
    a[q][q]=sine*sine*app+2*sine*cosine*apq+cosine*cosine*aqq;
    a[p][q]=a[q][p]=0;
    for(let row=0;row<componentCount;row++){
      const vip=eigenvectors[row][p];
      const viq=eigenvectors[row][q];
      eigenvectors[row][p]=cosine*vip-sine*viq;
      eigenvectors[row][q]=sine*vip+cosine*viq;
    }
  }
  return {
    values:Array.from({length:componentCount},(_,index)=>a[index][index]),
    vectors:eigenvectors,
  };
}

const reduced=symmetricEigen(projected);
const eigenOrder=Array.from({length:componentCount},(_,index)=>index)
  .sort((a,b)=>reduced.values[b]-reduced.values[a]);
const expandEigenvector=eigenIndex=>Float64Array.from({length:n},(_,index)=>{
  let value=0;
  for(let column=0;column<componentCount;column++){
    value+=vectors[column][index]*reduced.vectors[column][eigenIndex];
  }
  return value;
});
const xVector=expandEigenvector(eigenOrder[1]);
const yVector=expandEigenvector(eigenOrder[2]);

function normalize(column){
  const ordered=Array.from(column).sort((a,b)=>a-b);
  const min=ordered[Math.floor(.01*(ordered.length-1))];
  const max=ordered[Math.floor(.99*(ordered.length-1))];
  const span=Math.max(1e-12,max-min);
  return Array.from(column,value=>Number(Math.max(0,Math.min(1,(value-min)/span)).toFixed(4)));
}

// The first eigenvector is the trivial degree mode; eigenvectors 2 and 3 carry
// the graph geometry. Axis signs are fixed only for deterministic rendering.
graph.x=normalize(xVector);
graph.y=normalize(Float64Array.from(yVector,value=>-value));
graph.layout='normalized graph-Laplacian spectral embedding; eigsh-equivalent nontrivial eigenvectors 2 and 3';
fs.writeFileSync(outputPath,prefix+JSON.stringify(payload)+';\n');
console.log(`Updated ${n} atlas coordinates from ${edges.length} graph edges.`);
