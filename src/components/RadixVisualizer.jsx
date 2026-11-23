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

const FALLBACK_CSS = `
:where(.guided-visualizer.radix-visualizer) {
  padding: 1rem 1.15rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  background: var(--bg-deep, #090d16);
  color: var(--text-primary, #f8fafc);
  min-width: 0;
}
:where(.guided-visualizer.guided-focus-mode) {
  background: radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 55%), var(--bg-deep, #090d16);
}
:where(.guided-card) {
  background: var(--bg-surface, #0f172a);
  border: 1px solid var(--border-subtle, #1e293b);
  border-radius: var(--radius-lg, 16px);
  padding: 0.95rem 1.05rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}
:where(.guided-focus-mode .guided-card) {
  border-color: rgba(56, 189, 248, 0.25);
  box-shadow: 0 8px 28px rgba(2, 6, 23, 0.55);
}
:where(.guided-stepbar-card) {
  background: var(--bg-surface, #0f172a);
  border: 1px solid var(--border-subtle, #1e293b);
  border-radius: var(--radius-lg, 16px);
  padding: 0.75rem 0.95rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  min-width: 0;
}
:where(.guided-step-pills) {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  flex: 1 1 320px;
  min-width: 0;
}
:where(.guided-step-pill) {
  appearance: none;
  border: 1px solid var(--border-strong, #334155);
  background: var(--bg-surface-elevated, #162036);
  color: var(--text-secondary, #94a3b8);
  font-family: var(--font-sans, sans-serif);
  font-size: 0.73rem;
  font-weight: 700;
  padding: 0.34rem 0.65rem;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.16s ease;
}
:where(.guided-step-pill:hover) {
  color: var(--text-primary, #f8fafc);
  border-color: rgba(56, 189, 248, 0.5);
}
:where(.guided-step-pill.done) {
  background: rgba(51, 65, 85, 0.55);
  border-color: rgba(100, 116, 139, 0.55);
  color: #cbd5e1;
}
:where(.guided-step-pill.active) {
  background: rgba(6, 182, 212, 0.18);
  border-color: #38bdf8;
  color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35), 0 4px 12px rgba(6, 182, 212, 0.18);
}
:where(.guided-step-actions) {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}
:where(.guided-classic-btn),
:where(.guided-focus-btn) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.36rem 0.72rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
  border: 1px solid var(--border-strong, #334155);
}
:where(.guided-classic-btn) {
  background: rgba(168, 85, 247, 0.14);
  color: #d8b4fe;
  border-color: rgba(168, 85, 247, 0.42);
}
:where(.guided-classic-btn:hover:not(:disabled)) {
  background: rgba(168, 85, 247, 0.26);
  color: #f3e8ff;
  border-color: #a855f7;
}
:where(.guided-classic-btn:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}
:where(.guided-focus-btn) {
  background: var(--bg-surface-elevated, #162036);
  color: var(--text-secondary, #94a3b8);
}
:where(.guided-focus-btn:hover) {
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.45);
}
:where(.guided-focus-btn.active) {
  background: rgba(56, 189, 248, 0.16);
  color: #38bdf8;
  border-color: #38bdf8;
}
:where(.guided-card-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
}
:where(.guided-card-title) {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-primary, #f8fafc);
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
:where(.radix-pass-badge) {
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.16);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
  letter-spacing: 0.02em;
}
:where(.radix-pass-badge.done) {
  background: rgba(16, 185, 129, 0.16);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.45);
}
:where(.radix-worker-legend) {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}
:where(.radix-worker-chip) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid transparent;
}
:where(.radix-worker-dot) {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}
:where(.radix-array-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(66px, 1fr));
  gap: 0.5rem;
  width: 100%;
}
:where(.radix-array-grid.cols-8) {
  grid-template-columns: repeat(8, minmax(0, 1fr));
}
:where(.radix-array-grid.scrollable) {
  max-height: 290px;
  overflow-y: auto;
  padding-right: 0.2rem;
}
:where(.radix-el-card),
:where(.radix-dest-card-item) {
  background: var(--bg-surface-elevated, #162036);
  border: 1px solid var(--border-strong, #334155);
  border-radius: var(--radius-md, 10px);
  padding: 0.45rem 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.22rem;
  min-width: 0;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
:where(.radix-dest-card-item.done) {
  border-color: rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.07);
}
:where(.radix-worker-pill) {
  font-family: var(--font-mono, monospace);
  font-size: 0.64rem;
  font-weight: 800;
  padding: 0.08rem 0.38rem;
  border-radius: 999px;
  line-height: 1.3;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:where(.radix-el-val) {
  font-family: var(--font-mono, monospace);
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--text-primary, #f8fafc);
}
:where(.guided-focus-mode .radix-el-val) {
  font-size: 1.22rem;
}
:where(.radix-digit-highlight) {
  color: #fde047;
  background: rgba(245, 158, 11, 0.25);
  border-bottom: 2px solid #fbbf24;
  border-radius: 4px;
  padding: 0 2px;
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.45);
}
:where(.radix-el-idx) {
  font-family: var(--font-mono, monospace);
  font-size: 0.65rem;
  color: var(--text-muted, #64748b);
}
:where(.radix-init-prompt) {
  background: rgba(56, 189, 248, 0.07);
  border: 1px dashed rgba(56, 189, 248, 0.35);
  border-radius: var(--radius-md, 10px);
  padding: 1rem 1.1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  flex-wrap: wrap;
}
:where(.radix-init-prompt-text) {
  font-size: 0.82rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.5;
}
:where(.radix-init-prompt-text strong) {
  color: #38bdf8;
}
:where(.radix-next-cta) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.82rem;
  border-radius: var(--radius-sm, 6px);
  background: linear-gradient(135deg, #0284c7, #06b6d4);
  color: #f8fafc;
  border: none;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
}
:where(.radix-done-metrics) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}
:where(.radix-metric-box) {
  background: var(--bg-surface-elevated, #162036);
  border: 1px solid rgba(16, 185, 129, 0.28);
  border-radius: var(--radius-md, 10px);
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
}
:where(.radix-metric-label) {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted, #64748b);
}
:where(.radix-metric-value) {
  font-family: var(--font-mono, monospace);
  font-size: 0.95rem;
  font-weight: 800;
  color: #34d399;
}
:where(.radix-table-scroll) {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--border-subtle, #1e293b);
  border-radius: var(--radius-md, 10px);
  background: #0b1222;
}
:where(.radix-matrix-table) {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-family: var(--font-mono, monospace);
  font-size: 0.76rem;
  text-align: center;
}
:where(.radix-matrix-table th),
:where(.radix-matrix-table td) {
  padding: 0.44rem 0.35rem;
  border-bottom: 1px solid rgba(30, 41, 59, 0.85);
}
:where(.radix-matrix-table th) {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted, #64748b);
  background: rgba(15, 23, 42, 0.9);
}
:where(.radix-matrix-table th.active-digit) {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.12);
}
:where(.radix-matrix-table td.active-col) {
  background: rgba(56, 189, 248, 0.05);
}
:where(.radix-row-label) {
  text-align: left !important;
  padding-left: 0.7rem !important;
  font-weight: 800;
  white-space: nowrap;
}
:where(.radix-count-cell) {
  color: var(--text-muted, #64748b);
}
:where(.radix-count-cell.has-count) {
  color: #f8fafc;
  font-weight: 800;
}
:where(.radix-offset-row td) {
  background: rgba(16, 185, 129, 0.06);
  border-top: 1px solid rgba(16, 185, 129, 0.18);
}
:where(.radix-offset-label) {
  color: #34d399;
}
:where(.radix-offset-pill) {
  display: inline-block;
  padding: 0.08rem 0.35rem;
  border-radius: 5px;
  background: rgba(16, 185, 129, 0.18);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.38);
  font-weight: 800;
}
:where(.radix-offset-empty) {
  color: #475569;
}
:where(.radix-barrier-pill) {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.24rem 0.65rem;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.16);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.42);
}
:where(.radix-waiting-pill) {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted, #64748b);
  padding: 0.22rem 0.6rem;
  border-radius: 999px;
  background: var(--bg-surface-elevated, #162036);
  border: 1px solid var(--border-subtle, #1e293b);
}
:where(.radix-dest-empty) {
  border: 1.5px dashed var(--border-strong, #334155);
  border-radius: var(--radius-md, 10px);
  padding: 0.58rem 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.18rem;
  background: rgba(15, 23, 42, 0.45);
  color: var(--text-muted, #64748b);
  font-family: var(--font-mono, monospace);
  min-width: 0;
}
:where(.radix-dest-empty-word) {
  font-size: 0.7rem;
  font-style: italic;
}
:where(.guided-narrative-card) {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(22, 32, 54, 0.92));
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: var(--radius-lg, 16px);
  padding: 0.95rem 1.05rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
:where(.guided-narrative-top) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}
:where(.guided-step-counter) {
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.22rem 0.6rem;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.16);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.35);
  white-space: nowrap;
}
:where(.guided-narrative-title) {
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--text-primary, #f8fafc);
  margin-bottom: 0.2rem;
}
:where(.guided-narrative-desc) {
  font-size: 0.82rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.5;
}
:where(.guided-keypoints-grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--border-subtle, #1e293b);
}
:where(.guided-keypoint-item) {
  background: rgba(9, 13, 22, 0.55);
  border: 1px solid var(--border-subtle, #1e293b);
  border-radius: var(--radius-md, 10px);
  padding: 0.6rem 0.72rem;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}
:where(.guided-keypoint-title) {
  font-size: 0.74rem;
  font-weight: 800;
  color: #38bdf8;
}
:where(.guided-keypoint-body) {
  font-size: 0.73rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.4;
}
@media (max-width: 768px) {
  :where(.radix-done-metrics),
  :where(.guided-keypoints-grid) {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  :where(.guided-visualizer.radix-visualizer) {
    padding: 0.7rem 0.65rem 0.9rem;
    gap: 0.75rem;
  }
  :where(.guided-card),
  :where(.guided-stepbar-card),
  :where(.guided-narrative-card) {
    padding: 0.75rem;
  }
  :where(.radix-array-grid.cols-8) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  :where(.radix-array-grid) {
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: 0.38rem;
  }
  :where(.guided-step-pills) {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }
}
`;

export default function RadixVisualizer() {
  return null;
}
