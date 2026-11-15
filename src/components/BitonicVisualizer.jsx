import React, { useState, useEffect, useMemo } from 'react';
import {
  HelpCircle,
  Eye,
  EyeOff,
  ArrowRight,
  RotateCcw,
  Sparkles,
  X,
  Check
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

function buildScheduleForN(n) {
  const safeN = Math.max(2, n || 8);
  const rows = [];
  let stepCounter = 1;

  for (let k = 2; k <= safeN; k *= 2) {
    const startStep = stepCounter;
    const dList = [];
    for (let d = Math.floor(k / 2); d >= 1; d = Math.floor(d / 2)) {
      dList.push(d);
      stepCounter++;
    }
    const endStep = stepCounter - 1;
    const numBlocks = Math.max(1, Math.floor(safeN / k));
    const dirList = Array.from({ length: Math.min(4, numBlocks) }, (_, b) =>
      b % 2 === 0 ? '↑' : '↓'
    ).join(' ');
    const dirs = numBlocks > 4 ? `${dirList} …` : dirList;

    rows.push({
      k,
      dList,
      startStep,
      endStep,
      dirs,
      isFinal: k === safeN
    });
  }

  return rows;
}

function buildFallbackExplanation(phase, k, d, n, totalStages) {
  if (phase === 'initial') {
    return `Arreglo inicial de ${n} elementos listo. La red de Batcher ordenará todo en ${totalStages} etapas paralelas alternando subida (↑) y bajada (↓).`;
  }
  if (phase === 'completed') {
    return `¡Listo! Tras completar la etapa final con k = ${n} (↑), todos los ${n} elementos quedaron ordenados de menor a mayor.`;
  }
  if (k === 2 && d === 1) {
    return `Agrupamos de 2 en 2 alternando subida (↑) y bajada (↓) para crear las primeras mini-montañas bitónicas.`;
  }
  if (k === n) {
    if (d === Math.floor(k / 2)) {
      return `Bloque completo de ${n} (↑) con salto mitad d = ${d}: comparamos la mitad izquierda contra la derecha.`;
    }
    if (d === 1) {
      return `Bloque completo de ${n} (↑) con salto final d = 1: último ajuste de vecinos para dejar todo ordenado.`;
    }
    return `Bloque completo de ${n} (↑) con salto d = ${d}: acercamos cada número a su posición ordenada.`;
  }
  if (d === Math.floor(k / 2)) {
    return `Bloques de ${k} (salto mitad d = ${d}): cruzamos mitades para formar secuencias que suben (↑) y bajan (↓).`;
  }
  if (d === 1) {
    return `Mismos bloques de ${k} (salto vecinos d = 1): ajustamos parejas para consolidar cada bloque ↑ y ↓.`;
  }
  return `Bloques de ${k} (salto d = ${d}): refinamos el orden interno alternando subida (↑) y bajada (↓).`;
}

function renderHighlightedExplanation(text) {
  if (!text) return null;
  const parts = String(text).split(/(↑|↓)/g);
  return parts.map((part, idx) => {
    if (part === '↑') {
      return (
        <strong key={idx} className="bitonic-dir-asc">
          ↑
        </strong>
      );
    }
    if (part === '↓') {
      return (
        <strong key={idx} className="bitonic-dir-desc">
          ↓
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function normalizeBitonicStep(step, numWorkers, arraySize, currentStepIndex) {
  const bd = step?.bitonicData || {};
  const fallbackArr = step?.array || [];
  const after = bd.after || fallbackArr;
  const before = bd.before || fallbackArr;
  const originalArray = bd.original || bd.originalArray || before;
  const n = after.length || before.length || arraySize || 8;

  const k = bd.k ?? step?.networkStage?.k ?? n;
  const d = bd.d ?? bd.j ?? step?.networkStage?.j ?? 0;
  const totalStages =
    bd.totalStages ??
    step?.networkStage?.totalStages ??
    Math.max(1, Math.round((Math.log2(n) * (Math.log2(n) + 1)) / 2));
  const stageIndex = bd.stageIndex ?? step?.networkStage?.stageIndex ?? currentStepIndex;

  let comparisons = [];
  if (Array.isArray(bd.comparisons)) {
    comparisons = bd.comparisons.map((c, idx) => ({
      pairIdx: c.pairIdx ?? idx,
      workerId: c.workerId ?? c.coreId ?? idx % numWorkers,
      i: c.i,
      j: c.j,
      dir: c.dir || ((c.i & k) === 0 ? 'asc' : 'desc'),
      valI: c.valI ?? before[c.i],
      valJ: c.valJ ?? before[c.j],
      newI: c.newI ?? after[c.i],
      newJ: c.newJ ?? after[c.j],
      swapped: Boolean(c.swapped)
    }));
  } else if (Array.isArray(step?.comparisonsInStep) && step.comparisonsInStep.length > 0) {
    const swaps = step.swapsInStep || [];
    const activeWorkers = step.activeWorkers || [];
    comparisons = step.comparisonsInStep.map(([i, j], idx) => {
      let workerId = idx % numWorkers;
      for (const w of activeWorkers) {
        if (w.indices && (w.indices.includes(i) || w.indices.includes(j))) {
          workerId = w.workerId;
          break;
        }
      }
      const swapped = swaps.some(([a, b]) => (a === i && b === j) || (a === j && b === i));
      const dir = (i & k) === 0 ? 'asc' : 'desc';
      return {
        pairIdx: idx,
        workerId,
        i,
        j,
        dir,
        valI: before[i],
        valJ: before[j],
        newI: after[i],
        newJ: after[j],
        swapped
      };
    });
  }

  let phase = bd.phase;
  if (phase !== 'initial' && phase !== 'completed' && phase !== 'stage') {
    if (comparisons.length === 0) {
      phase = (step?.stepIndex ?? currentStepIndex) === 0 ? 'initial' : 'completed';
    } else {
      phase = 'stage';
    }
  }

  const explanation =
    bd.explanation || buildFallbackExplanation(phase, k, d, n, totalStages);

  return {
    phase,
    n,
    k,
    d,
    stageIndex,
    totalStages,
    originalArray,
    before,
    after,
    comparisons,
    explanation
  };
}

export default function BitonicVisualizer() {
  return null;
}
