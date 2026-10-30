#!/usr/bin/env node

/* Build browser-ready CASTLE labels, decoder ablations, and multivariate S-map data.
 *
 * This script intentionally uses only Node built-ins. The source computer does not
 * need a Python scientific stack to reproduce the derived analysis bundle.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_RAW_ROOT = '/Users/mac/Documents/Neuron Visualization/yuwei/data/B3D71_project_raw_inputs_20260706/raw_inputs';
const PHASE_COUNT = 5;
const CASTLE_TRIALS = 52;
const CASTLE_BINS = 480;
const CASTLE_HZ = 80;
const DECODER_HZ = 20;
const DECODER_BINS = 120;
const DECODER_DT = 1 / DECODER_HZ;
const FOLDS = 5;

function parseArgs(argv) {
  const out = {rawRoot: DEFAULT_RAW_ROOT, output: path.join(APP_ROOT, 'data', 'analysis.js')};
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--raw-root') out.rawRoot = path.resolve(argv[++i]);
    else if (argv[i] === '--output') out.output = path.resolve(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return out;
}

function loadWindowAssignment(file, key) {
  const context = {window: {}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
  if (!(key in context.window)) throw new Error(`${key} was not defined by ${file}`);
  return context.window[key];
}

function loadUnitPayload(unitId) {
  const file = path.join(APP_ROOT, 'data', 'units', `u${unitId}.js`);
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/window\.UNIT_CACHE\[\d+\]=(\{.*\});\s*$/s);
  if (!match) throw new Error(`Could not parse ${file}`);
  return JSON.parse(match[1]);
}

function readNpyInt64(file) {
  const buffer = fs.readFileSync(file);
  if (buffer[0] !== 0x93 || buffer.toString('ascii', 1, 6) !== 'NUMPY') {
    throw new Error(`Not an NPY file: ${file}`);
  }
  const major = buffer[6];
  const headerLength = major === 1 ? buffer.readUInt16LE(8) : buffer.readUInt32LE(8);
  const headerStart = major === 1 ? 10 : 12;
  const header = buffer.toString('ascii', headerStart, headerStart + headerLength);
  if (!header.includes("'descr': '<i8'") && !header.includes('"descr": "<i8"')) {
    throw new Error(`Expected little-endian int64 NPY data: ${header}`);
  }
  const shapeMatch = header.match(/['"]shape['"]:\s*\(([^)]*)\)/);
  if (!shapeMatch) throw new Error(`Could not parse NPY shape: ${header}`);
  const shape = shapeMatch[1].split(',').map(v => v.trim()).filter(Boolean).map(Number);
  const count = shape.reduce((a, b) => a * b, 1);
  const start = headerStart + headerLength;
  const values = new Int16Array(count);
  for (let i = 0; i < count; i += 1) values[i] = Number(buffer.readBigInt64LE(start + i * 8));
  return {shape, values};
}

function compact(value) {
  return JSON.stringify(value);
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i += 1) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let va = 0;
  let vb = 0;
  let cov = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    va += da * da;
    vb += db * db;
    cov += da * db;
  }
  return cov / (Math.sqrt(va * vb) + 1e-12);
}

function majorityPhase(labels, trial, bin) {
  const counts = new Uint8Array(PHASE_COUNT);
  const start = trial * CASTLE_BINS + bin * (CASTLE_HZ / DECODER_HZ);
  for (let k = 0; k < CASTLE_HZ / DECODER_HZ; k += 1) counts[labels[start + k]] += 1;
  let best = 0;
  for (let phase = 1; phase < PHASE_COUNT; phase += 1) {
    if (counts[phase] > counts[best]) best = phase;
  }
  return best;
}

function unitDecoderCounts(payload, trialRowByNeuralTrial) {
  const counts = new Uint16Array(CASTLE_TRIALS * DECODER_BINS);
  const raster = payload.raster || {tr: [], t: []};
  for (let i = 0; i < raster.tr.length; i += 1) {
    const row = trialRowByNeuralTrial.get(Number(raster.tr[i]));
    const time = Number(raster.t[i]);
    if (row == null || time < -1 || time >= 5) continue;
    const bin = Math.max(0, Math.min(DECODER_BINS - 1, Math.floor((time + 1) * DECODER_HZ)));
    counts[row * DECODER_BINS + bin] += 1;
  }
  return counts;
}

function decoderRateModels(counts, samplePhase, sampleFold) {
  const models = new Float64Array(FOLDS * PHASE_COUNT);
  for (let fold = 0; fold < FOLDS; fold += 1) {
    const phaseCounts = new Float64Array(PHASE_COUNT);
    const phaseSamples = new Uint32Array(PHASE_COUNT);
    for (let sample = 0; sample < samplePhase.length; sample += 1) {
      if (sampleFold[sample] === fold) continue;
      const phase = samplePhase[sample];
      phaseSamples[phase] += 1;
      phaseCounts[phase] += counts[sample];
    }
    for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
      // Weak Gamma-Poisson smoothing avoids undefined log likelihoods for sparse units.
      models[fold * PHASE_COUNT + phase] =
        (phaseCounts[phase] + 0.5) / (phaseSamples[phase] * DECODER_DT + 0.5);
    }
  }
  return models;
}

function balancedAccuracy(prediction, truth) {
  const correct = new Uint32Array(PHASE_COUNT);
  const total = new Uint32Array(PHASE_COUNT);
  let rawCorrect = 0;
  for (let i = 0; i < truth.length; i += 1) {
    total[truth[i]] += 1;
    if (prediction[i] === truth[i]) {
      correct[truth[i]] += 1;
      rawCorrect += 1;
    }
  }
  let balanced = 0;
  for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
    balanced += correct[phase] / Math.max(1, total[phase]);
  }
  return {
    balanced: balanced / PHASE_COUNT,
    accuracy: rawCorrect / truth.length,
    recall: Array.from(correct, (value, phase) => value / Math.max(1, total[phase])),
  };
}

function argmaxScores(scores, sample, unitCounts = null, models = null, sampleFold = null) {
  let bestPhase = 0;
  let bestScore = -Infinity;
  const fold = sampleFold ? sampleFold[sample] : 0;
  const count = unitCounts ? unitCounts[sample] : 0;
  for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
    let score = scores[sample * PHASE_COUNT + phase];
    if (unitCounts && models) {
      const mu = Math.max(1e-10, models[fold * PHASE_COUNT + phase] * DECODER_DT);
      score -= count * Math.log(mu) - mu;
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  return bestPhase;
}

function buildDecoder(labels, trialIds, unitCount) {
  const sampleCount = CASTLE_TRIALS * DECODER_BINS;
  const samplePhase = new Uint8Array(sampleCount);
  const sampleFold = new Uint8Array(sampleCount);
  for (let trial = 0; trial < CASTLE_TRIALS; trial += 1) {
    for (let bin = 0; bin < DECODER_BINS; bin += 1) {
      const sample = trial * DECODER_BINS + bin;
      samplePhase[sample] = majorityPhase(labels, trial, bin);
      sampleFold[sample] = trial % FOLDS;
    }
  }
  const trialRowByNeuralTrial = new Map(trialIds.map((trial, row) => [trial, row]));
  const scores = new Float64Array(sampleCount * PHASE_COUNT);
  const allModels = new Float32Array(unitCount * FOLDS * PHASE_COUNT);

  console.log(`Decoder pass 1/2: ${unitCount} units, ${sampleCount} held-out bins`);
  for (let unitId = 0; unitId < unitCount; unitId += 1) {
    const counts = unitDecoderCounts(loadUnitPayload(unitId), trialRowByNeuralTrial);
    const models = decoderRateModels(counts, samplePhase, sampleFold);
    allModels.set(models, unitId * FOLDS * PHASE_COUNT);
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const fold = sampleFold[sample];
      const count = counts[sample];
      const base = sample * PHASE_COUNT;
      for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
        const mu = Math.max(1e-10, models[fold * PHASE_COUNT + phase] * DECODER_DT);
        scores[base + phase] += count * Math.log(mu) - mu;
      }
    }
    if ((unitId + 1) % 200 === 0) console.log(`  accumulated ${unitId + 1}/${unitCount}`);
  }

  const fullPrediction = new Uint8Array(sampleCount);
  for (let sample = 0; sample < sampleCount; sample += 1) {
    fullPrediction[sample] = argmaxScores(scores, sample);
  }
  const full = balancedAccuracy(fullPrediction, samplePhase);

  console.log('Decoder pass 2/2: leave-one-unit-out fixed-model evaluation');
  const units = new Array(unitCount);
  for (let unitId = 0; unitId < unitCount; unitId += 1) {
    const counts = unitDecoderCounts(loadUnitPayload(unitId), trialRowByNeuralTrial);
    const offset = unitId * FOLDS * PHASE_COUNT;
    const models = allModels.subarray(offset, offset + FOLDS * PHASE_COUNT);
    const prediction = new Uint8Array(sampleCount);
    for (let sample = 0; sample < sampleCount; sample += 1) {
      prediction[sample] = argmaxScores(scores, sample, counts, models, sampleFold);
    }
    const loo = balancedAccuracy(prediction, samplePhase);
    units[unitId] = {
      id: unitId,
      balancedAccuracy: round(loo.balanced, 6),
      accuracy: round(loo.accuracy, 6),
      deltaBalancedPoints: round(100 * (full.balanced - loo.balanced), 5),
      changedPredictions: prediction.reduce((sum, value, index) => sum + (value !== fullPrediction[index] ? 1 : 0), 0),
    };
    if ((unitId + 1) % 200 === 0) console.log(`  evaluated ${unitId + 1}/${unitCount}`);
  }
  const sorted = units.map(unit => unit.deltaBalancedPoints).slice().sort((a, b) => a - b);
  units.forEach(unit => {
    let rank = 0;
    while (rank < sorted.length && sorted[rank] <= unit.deltaBalancedPoints) rank += 1;
    unit.deltaPercentile = round(100 * rank / sorted.length, 2);
  });
  return {
    method: 'Five-fold trial-blocked independent-Poisson CASTLE phase decoder with equal class priors',
    folds: FOLDS,
    binSeconds: DECODER_DT,
    mappedTrials: CASTLE_TRIALS,
    samples: sampleCount,
    fullBalancedAccuracy: round(full.balanced, 6),
    fullAccuracy: round(full.accuracy, 6),
    fullRecall: full.recall.map(value => round(value, 5)),
    chanceBalancedAccuracy: 0.2,
    caveat: 'Leave-one-unit-out holds the fitted population decoder fixed. It is a descriptive model-importance proxy, not LFADS retraining or causal ablation.',
    units,
  };
}

function invertSolve4(a, b) {
  const rows = Array.from({length: 4}, (_, row) => [
    a[row * 4], a[row * 4 + 1], a[row * 4 + 2], a[row * 4 + 3],
    b[row * 3], b[row * 3 + 1], b[row * 3 + 2],
  ]);
  for (let col = 0; col < 4; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 4; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    if (pivot !== col) [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = Math.abs(rows[col][col]) < 1e-12 ? 1e-12 : rows[col][col];
    for (let k = col; k < 7; k += 1) rows[col][k] /= divisor;
    for (let row = 0; row < 4; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let k = col; k < 7; k += 1) rows[row][k] -= factor * rows[col][k];
    }
  }
  const out = new Float64Array(12);
  for (let row = 0; row < 4; row += 1) {
    for (let target = 0; target < 3; target += 1) out[row * 3 + target] = rows[row][4 + target];
  }
  return out;
}

function localSMap(queryIndex, theta, x, y, trialOf, timeOf, trialCount, timeCount) {
  const queryTrial = trialOf[queryIndex];
  const q0 = x[queryIndex * 3];
  const q1 = x[queryIndex * 3 + 1];
  const q2 = x[queryIndex * 3 + 2];
  let distanceSum = 0;
  let librarySize = 0;
  for (let trial = 0; trial < trialCount; trial += 1) {
    if (trial === queryTrial) continue;
    const trialBase = trial * timeCount;
    for (let time = 0; time < timeCount; time += 1) {
      const index = trialBase + time;
      const d0 = x[index * 3] - q0;
      const d1 = x[index * 3 + 1] - q1;
      const d2 = x[index * 3 + 2] - q2;
      distanceSum += Math.hypot(d0, d1, d2);
      librarySize += 1;
    }
  }
  const meanDistance = distanceSum / Math.max(1, librarySize);
  const a = new Float64Array(16);
  const b = new Float64Array(12);
  let sumWeight = 0;
  let sumWeightSquared = 0;
  for (let trial = 0; trial < trialCount; trial += 1) {
    if (trial === queryTrial) continue;
    const trialBase = trial * timeCount;
    for (let time = 0; time < timeCount; time += 1) {
      const index = trialBase + time;
      const x0 = x[index * 3];
      const x1 = x[index * 3 + 1];
      const x2 = x[index * 3 + 2];
      const distance = Math.hypot(x0 - q0, x1 - q1, x2 - q2);
      const weight = theta === 0 ? 1 : Math.exp(-theta * distance / Math.max(meanDistance, 1e-12));
      const z = [1, x0, x1, x2];
      sumWeight += weight;
      sumWeightSquared += weight * weight;
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) a[row * 4 + col] += weight * z[row] * z[col];
        for (let target = 0; target < 3; target += 1) b[row * 3 + target] += weight * z[row] * y[index * 3 + target];
      }
    }
  }
  const ridge = Math.max(1e-10, sumWeight * 1e-6);
  for (let axis = 1; axis < 4; axis += 1) a[axis * 4 + axis] += ridge;
  const coefficients = invertSolve4(a, b);
  const prediction = new Float64Array(3);
  for (let target = 0; target < 3; target += 1) {
    prediction[target] = coefficients[target] + q0 * coefficients[3 + target] + q1 * coefficients[6 + target] + q2 * coefficients[9 + target];
  }
  return {
    coefficients,
    prediction,
    effectiveN: sumWeight * sumWeight / Math.max(1e-12, sumWeightSquared),
  };
}

function buildSMap(pop) {
  const regions = ['m1', 'm2', 's1'];
  const trialCount = pop.sig.m1.length;
  const timeCount = pop.sig.m1[0].length - 1;
  const pointCount = trialCount * timeCount;
  const mean = new Float64Array(3);
  const sd = new Float64Array(3);
  for (let axis = 0; axis < 3; axis += 1) {
    for (let trial = 0; trial < trialCount; trial += 1) {
      for (let time = 0; time < timeCount; time += 1) mean[axis] += pop.sig[regions[axis]][trial][time];
    }
    mean[axis] /= pointCount;
    for (let trial = 0; trial < trialCount; trial += 1) {
      for (let time = 0; time < timeCount; time += 1) {
        const delta = pop.sig[regions[axis]][trial][time] - mean[axis];
        sd[axis] += delta * delta;
      }
    }
    sd[axis] = Math.sqrt(sd[axis] / Math.max(1, pointCount - 1)) || 1;
  }

  const x = new Float64Array(pointCount * 3);
  const y = new Float64Array(pointCount * 3);
  const trialOf = new Uint8Array(pointCount);
  const timeOf = new Uint8Array(pointCount);
  for (let trial = 0; trial < trialCount; trial += 1) {
    for (let time = 0; time < timeCount; time += 1) {
      const index = trial * timeCount + time;
      trialOf[index] = trial;
      timeOf[index] = time;
      for (let axis = 0; axis < 3; axis += 1) {
        x[index * 3 + axis] = (pop.sig[regions[axis]][trial][time] - mean[axis]) / sd[axis];
        y[index * 3 + axis] = (pop.sig[regions[axis]][trial][time + 1] - mean[axis]) / sd[axis];
      }
    }
  }

  const thetaGrid = [0, 0.5, 1, 2, 4, 8];
  const cvQueries = [];
  for (let trial = 0; trial < trialCount; trial += 10) {
    for (let time = 0; time < timeCount; time += 6) cvQueries.push(trial * timeCount + time);
  }
  const thetaResults = thetaGrid.map(theta => {
    const observed = [[], [], []];
    const predicted = [[], [], []];
    for (const query of cvQueries) {
      const fit = localSMap(query, theta, x, y, trialOf, timeOf, trialCount, timeCount);
      for (let target = 0; target < 3; target += 1) {
        observed[target].push(y[query * 3 + target]);
        predicted[target].push(fit.prediction[target]);
      }
    }
    const rho = observed.map((values, target) => pearson(values, predicted[target]));
    let rmse = 0;
    let count = 0;
    for (let target = 0; target < 3; target += 1) {
      for (let i = 0; i < observed[target].length; i += 1) {
        rmse += (observed[target][i] - predicted[target][i]) ** 2;
        count += 1;
      }
    }
    return {theta, rho, meanRho: rho.reduce((a, b) => a + b, 0) / 3, nrmse: Math.sqrt(rmse / Math.max(1, count))};
  });
  thetaResults.sort((a, b) => b.meanRho - a.meanRho || a.nrmse - b.nrmse);
  const selectedTheta = thetaResults[0].theta;
  thetaResults.sort((a, b) => a.theta - b.theta);
  console.log(`S-map: selected theta=${selectedTheta} from ${cvQueries.length} leave-one-trial-out queries`);

  const edgeDefinitions = [
    {source: 'M1', target: 'M2', label: 'M1 -> M2', coefficient: 'dM2(t+1)/dM1(t)', sourceAxis: 0, targetAxis: 1},
    {source: 'M1', target: 'S1', label: 'M1 -> S1', coefficient: 'dS1(t+1)/dM1(t)', sourceAxis: 0, targetAxis: 2},
    {source: 'M2', target: 'M1', label: 'M2 -> M1', coefficient: 'dM1(t+1)/dM2(t)', sourceAxis: 1, targetAxis: 0},
    {source: 'M2', target: 'S1', label: 'M2 -> S1', coefficient: 'dS1(t+1)/dM2(t)', sourceAxis: 1, targetAxis: 2},
    {source: 'S1', target: 'M1', label: 'S1 -> M1', coefficient: 'dM1(t+1)/dS1(t)', sourceAxis: 2, targetAxis: 0},
    {source: 'S1', target: 'M2', label: 'S1 -> M2', coefficient: 'dM2(t+1)/dS1(t)', sourceAxis: 2, targetAxis: 1},
  ];
  const coefficients = Array.from({length: trialCount}, () => Array(timeCount));
  const effectiveN = Array.from({length: trialCount}, () => Array(timeCount));
  const observed = [[], [], []];
  const predicted = [[], [], []];
  let completed = 0;
  for (let trial = 0; trial < trialCount; trial += 1) {
    for (let time = 0; time < timeCount; time += 1) {
      const query = trial * timeCount + time;
      const fit = localSMap(query, selectedTheta, x, y, trialOf, timeOf, trialCount, timeCount);
      coefficients[trial][time] = edgeDefinitions.map(edge => round(fit.coefficients[(edge.sourceAxis + 1) * 3 + edge.targetAxis], 4));
      effectiveN[trial][time] = round(fit.effectiveN, 1);
      for (let target = 0; target < 3; target += 1) {
        observed[target].push(y[query * 3 + target]);
        predicted[target].push(fit.prediction[target]);
      }
    }
    completed += 1;
    if (completed % 10 === 0) console.log(`  fitted ${completed}/${trialCount} trials`);
  }
  const skillR = observed.map((values, target) => round(pearson(values, predicted[target]), 4));
  const nrmse = observed.map((values, target) => {
    let sum = 0;
    for (let i = 0; i < values.length; i += 1) sum += (values[i] - predicted[target][i]) ** 2;
    return round(Math.sqrt(sum / Math.max(1, values.length)), 4);
  });
  return {
    regions: ['M1', 'M2', 'S1'],
    tax: pop.tax.slice(0, -1),
    lagSeconds: round(pop.tax[1] - pop.tax[0], 4),
    trialCount,
    edges: edgeDefinitions.map(({source, target, label, coefficient}) => ({source, target, label, coefficient})),
    coefficients,
    effectiveN,
    selectedTheta,
    thetaGrid: thetaResults.map(result => ({
      theta: result.theta,
      meanRho: round(result.meanRho, 4),
      rho: result.rho.map(value => round(value, 4)),
      nrmse: round(result.nrmse, 4),
    })),
    predictionSkillR: skillR,
    predictionNrmse: nrmse,
    signalMean: Array.from(mean, value => round(value, 5)),
    signalSd: Array.from(sd, value => round(value, 5)),
    method: 'Multivariate S-map on z-scored M1/M2/S1 population activation; one-step (50 ms) local weighted linear prediction; same-trial library points excluded; theta selected by leave-one-trial-out forecast skill.',
    caveat: 'Coefficients are state-dependent predictive slopes. Without surrogate testing, causal-variable validation, and uncertainty intervals they are candidate directed dynamical dependencies, not proof of causal cortical influence.',
  };
}

function main() {
  const args = parseArgs(process.argv);
  const pop = loadWindowAssignment(path.join(APP_ROOT, 'data', 'pop.js'), 'POP');
  const castle = loadWindowAssignment(path.join(APP_ROOT, 'data', 'castle.js'), 'CASTLE');
  const labelsPath = path.join(args.rawRoot, 'behavior', 'behavioral_data', 'castle-syllables-5class.npy');
  const npy = readNpyInt64(labelsPath);
  if (npy.values.length !== CASTLE_TRIALS * CASTLE_BINS) {
    throw new Error(`Unexpected CASTLE label length: ${npy.values.length}`);
  }
  const labels = Array.from({length: CASTLE_TRIALS}, (_, trial) =>
    Array.from(npy.values.subarray(trial * CASTLE_BINS, (trial + 1) * CASTLE_BINS))
  );
  const decoder = buildDecoder(npy.values, castle.trialIds, castle.units.length);
  const edm = buildSMap(pop);
  const payload = {
    castle: {
      labels,
      trialIds: castle.trialIds,
      rateHz: CASTLE_HZ,
      windowSeconds: [-1, 5],
      source: path.basename(labelsPath),
    },
    decoder,
    edm,
    build: {
      generatedAt: new Date().toISOString(),
      script: 'tools/build_analysis_assets.mjs',
    },
  };
  fs.writeFileSync(args.output, `window.ANALYSIS=${compact(payload)};\n`);
  console.log(`Wrote ${args.output} (${(fs.statSync(args.output).size / 1024 / 1024).toFixed(2)} MB)`);
}

main();
