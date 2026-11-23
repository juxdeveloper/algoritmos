import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Maximize2,
  Minimize2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { WORKER_COLORS } from './Controls';

function hexToRgba(hex, alpha) {
  const clean = (hex || '#38bdf8').replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDigitMeta(digitPos, maxDigits) {
  if (digitPos === 0) {
    return { label: 'UNIDADES', short: 'U.', dir: '(Derecha)' };
  }
  if (digitPos === 1) {
    return {
      label: 'DECENAS',
      short: 'D.',
      dir: maxDigits <= 2 ? '(Izquierda)' : '(10¹)',
    };
  }
  if (digitPos === 2) {
    return {
      label: 'CENTENAS',
      short: 'C.',
      dir: maxDigits === 3 ? '(Izquierda)' : '(10²)',
    };
  }
  if (digitPos === 3) {
    return {
      label: 'MILLARES',
      short: 'M.',
      dir: maxDigits === 4 ? '(Izquierda)' : '(10³)',
    };
  }
  return {
    label: `DÍGITO 10^${digitPos}`,
    short: `10^${digitPos}`,
    dir: digitPos === maxDigits - 1 ? '(Izquierda)' : '',
  };
}

function inferStepPhase(s, idx, total) {
  const rd = s?.radixData || {};
  if (
    rd.phase === 'init' ||
    rd.phase === 'hist' ||
    rd.phase === 'scan' ||
    rd.phase === 'scatter' ||
    rd.phase === 'done'
  ) {
    return rd.phase;
  }

  const name = (s?.stageName || '').toLowerCase();
  if (name.includes('inicial') || (idx === 0 && rd.exp == null)) return 'init';
  if (name.includes('completado') || (idx === total - 1 && !s?.radixData)) return 'done';
  if (name.includes('fase 1') || name.includes('histograma') || name.includes('conteo')) {
    return 'hist';
  }
  if (name.includes('fase 2') || name.includes('escaneo') || name.includes('prefijo')) {
    return 'scan';
  }
  if (name.includes('fase 3') || name.includes('dispersión') || name.includes('dispersion') || name.includes('mover')) {
    return 'scatter';
  }

  if (idx === 0) return 'init';
  if (idx === total - 1) return 'done';
  return ['hist', 'scan', 'scatter'][(idx - 1) % 3];
}

function computeLocalHistograms(arr, p, chunkSize, exp) {
  const histograms = Array.from({ length: p }, () => Array(10).fill(0));
  for (let w = 0; w < p; w++) {
    const start = w * chunkSize;
    const end = Math.min(start + chunkSize, arr.length);
    for (let i = start; i < end; i++) {
      const digit = Math.floor(Math.abs(arr[i]) / exp) % 10;
      histograms[w][digit]++;
    }
  }
  return histograms;
}

function computePrefixMatrices(histograms, p) {
  const globalCount = Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    for (let w = 0; w < p; w++) {
      globalCount[d] += histograms[w]?.[d] || 0;
    }
  }

  const offsets = Array(10).fill(0);
  for (let d = 1; d < 10; d++) {
    offsets[d] = offsets[d - 1] + globalCount[d - 1];
  }

  const workerOffsets = Array.from({ length: p }, () => Array(10).fill(0));
  for (let d = 0; d < 10; d++) {
    let running = offsets[d];
    for (let w = 0; w < p; w++) {
      workerOffsets[w][d] = running;
      running += histograms[w]?.[d] || 0;
    }
  }

  return { globalCount, offsets, workerOffsets };
}

function normalizeRadixStep(step, steps, currentStepIndex, numWorkers, arraySize) {
  const effectiveSteps = steps && steps.length > 0 ? steps : step ? [step] : [];
  const total = Math.max(effectiveSteps.length, 1);
  const safeIdx = Math.max(0, Math.min(currentStepIndex, total - 1));
  const rd = step?.radixData || {};

  const phase = inferStepPhase(step, safeIdx, total);
  const digitPos =
    rd.digitPos ??
    (phase === 'init' ? 0 : Math.max(0, Math.floor(Math.max(0, safeIdx - 1) / 3)));
  const exp = rd.exp ?? Math.pow(10, digitPos);

  let inputArray = Array.isArray(rd.inputArray) ? rd.inputArray : null;
  if (!inputArray) {
    if (phase === 'scatter' && safeIdx > 0 && Array.isArray(effectiveSteps[safeIdx - 1]?.array)) {
      inputArray = effectiveSteps[safeIdx - 1].array;
    } else {
      inputArray = step?.array || [];
    }
  }

  const n = inputArray.length || step?.array?.length || arraySize || 8;
  const p = Math.max(1, numWorkers || 4);
  const chunkSize = Math.max(1, Math.ceil(n / p));

  const maxVal = Math.max(...inputArray, ...(step?.array || []), 1);
  const maxDigits =
    rd.maxDigits ??
    rd.numDigits ??
    effectiveSteps[0]?.radixData?.maxDigits ??
    effectiveSteps[0]?.radixData?.numDigits ??
    Math.max(1, Math.floor(Math.log10(maxVal)) + 1);

  const workerRanges = [];
  for (let w = 0; w < p; w++) {
    const start = w * chunkSize;
    if (start >= n) break;
    const end = Math.min(start + chunkSize, n) - 1;
    workerRanges.push({
      workerId: w,
      start,
      end,
      label: start === end ? `P${w} (Índice ${start})` : `P${w} (Índices ${start}–${end})`,
    });
  }

  let histograms = rd.histograms;
  if (!histograms && phase !== 'init' && phase !== 'done') {
    for (let lookback = 1; lookback <= 2; lookback++) {
      const prev = effectiveSteps[safeIdx - lookback];
      if (prev?.radixData?.digitPos === digitPos && prev?.radixData?.histograms) {
        histograms = prev.radixData.histograms;
        break;
      }
    }
  }
  if (!histograms) {
    histograms = computeLocalHistograms(inputArray, p, chunkSize, exp);
  }

  const computed = computePrefixMatrices(histograms, p);
  const globalCount = rd.globalCount || computed.globalCount;
  const offsets = rd.offsets || computed.offsets;
  const workerOffsets = rd.workerOffsets || computed.workerOffsets;

  let destItems = null;
  if (phase === 'scatter') {
    if (Array.isArray(rd.destItems)) {
      destItems = rd.destItems;
    } else {
      const output = Array(n).fill(null);
      const runningOffsets = workerOffsets.map((row) => [...row]);
      for (let w = 0; w < p; w++) {
        const start = w * chunkSize;
        const end = Math.min(start + chunkSize, n);
        for (let i = start; i < end; i++) {
          const val = inputArray[i];
          const d = Math.floor(Math.abs(val) / exp) % 10;
          const destIdx = runningOffsets[w][d]++;
          output[destIdx] = { value: val, fromCore: w, destIdx };
        }
      }
      destItems = output.map((item, idx) =>
        item || { value: step?.array?.[idx] ?? 0, fromCore: 0, destIdx: idx }
      );
    }
  } else if (phase === 'done') {
    const finalArr = step?.array || inputArray;
    destItems = finalArr.map((val, idx) => ({
      value: val,
      fromCore: null,
      destIdx: idx,
      ok: true,
    }));
  }

  return {
    phase,
    digitPos,
    exp,
    maxDigits,
    padWidth: Math.max(2, maxDigits),
    n,
    p,
    chunkSize,
    inputArray,
    workerRanges,
    histograms,
    globalCount,
    offsets,
    workerOffsets,
    destItems,
    effectiveSteps,
    safeIdx,
  };
}

function renderDigitValue(val, padWidth, digitPos, highlightActive) {
  const cleanVal = Math.max(0, Math.floor(Number(val) || 0));
  const str = String(cleanVal).padStart(padWidth, '0');
  const activeCharIdx = str.length - 1 - digitPos;

  return str.split('').map((ch, idx) => {
    const isActive = highlightActive && idx === activeCharIdx;
    return (
      <span key={idx} className={isActive ? 'radix-digit-highlight' : undefined}>
        {ch}
      </span>
    );
  });
}

export default function RadixVisualizer() {
  return null;
}
