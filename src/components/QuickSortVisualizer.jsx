import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Eye,
  EyeOff,
  Cpu,
  CheckCircle2,
  Gauge,
  Info,
  Share2
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

function getDensityClass(len) {
  if (len >= 48) return 'qs-density-xl';
  if (len >= 24) return 'qs-density-lg';
  if (len >= 12) return 'qs-density-md';
  return 'qs-density-sm';
}

function findRootPivotMeta(steps, currentStep) {
  const list = Array.isArray(steps) && steps.length > 0 ? steps : currentStep ? [currentStep] : [];
  let rootPivotVal;
  let rootPivotIndex = null;
  let left = null;
  let right = null;

  for (const s of list) {
    const qd = s?.quicksortData;
    if (!qd) continue;

    if (qd.phase === 'partition' || qd.phase === 'spawn') {
      if (qd.pivotVal !== undefined || qd.pivot !== undefined) {
        rootPivotVal = qd.pivotVal ?? qd.pivot;
      }
      const l = qd.left || qd.less || qd.menores;
      const r = qd.right || qd.greater || qd.mayores;
      if (Array.isArray(l)) left = l;
      if (Array.isArray(r)) right = r;
      if (typeof qd.pivotIndex === 'number') {
        rootPivotIndex = qd.pivotIndex;
      } else if (Array.isArray(l)) {
        rootPivotIndex = l.length;
      }
      if (rootPivotVal !== undefined && rootPivotIndex !== null) break;
    }

    if (qd.phase === 'pivot' && rootPivotVal === undefined) {
      const arr = qd.array || qd.originalArray || s.array || [];
      if (qd.pivotVal !== undefined || qd.pivot !== undefined) {
        rootPivotVal = qd.pivotVal ?? qd.pivot;
      } else if (typeof qd.pivotIndex === 'number' && arr[qd.pivotIndex] !== undefined) {
        rootPivotVal = arr[qd.pivotIndex];
      }
    }
  }

  return { rootPivotVal, rootPivotIndex, left, right };
}

function buildFallbackTitle(phase, level) {
  switch (phase) {
    case 'pivot':
      return 'Elección del pivote raíz';
    case 'partition':
      return 'Partición respecto al pivote';
    case 'spawn':
      return 'Despacho paralelo de subarreglos';
    case 'recurse':
      return `Recursión paralela · Nivel ${level}`;
    case 'done':
      return 'Arreglo completamente ordenado';
    default:
      return 'QuickSort Paralelo';
  }
}

function buildFallbackDescription(phase, pivotVal, n) {
  switch (phase) {
    case 'pivot':
      return `Se selecciona el pivote ${pivotVal ?? ''} como referencia para dividir los ${n} elementos del arreglo.`;
    case 'partition':
      return `Todos los valores menores se agrupan a la izquierda y los mayores a la derecha; el pivote ${pivotVal ?? ''} queda en su lugar definitivo.`;
    case 'spawn':
      return 'Cada subarreglo ocupa una región independiente en memoria, por lo que distintos hilos los procesan simultáneamente.';
    case 'recurse':
      return 'Cada hilo aplica la misma estrategia de pivote y partición de forma concurrente sobre su subarreglo asignado.';
    case 'done':
      return 'Todos los hilos finalizaron su trabajo; la unión natural de posiciones deja el arreglo ordenado sin fase de mezcla.';
    default:
      return 'Simulación paso a paso de QuickSort paralelo.';
  }
}

function normalizeQuickSortStep(step, steps, numWorkers, arraySize, currentStepIndex) {
  const qd = step?.quicksortData || {};
  const fallbackArr = Array.isArray(step?.array) ? step.array : [];
  const effectiveTotal = Math.max(steps?.length || 0, 1);

  let phase = qd.phase;
  if (!phase) {
    if (currentStepIndex === 0) phase = 'pivot';
    else if (effectiveTotal > 1 && currentStepIndex >= effectiveTotal - 1) phase = 'done';
    else phase = 'recurse';
  }

  const rootMeta = findRootPivotMeta(steps, step);
  const level = qd.level ?? step?.metrics?.parallelDepth ?? 1;
  const safeWorkers = Math.max(1, numWorkers || 2);

  const rawArray = qd.array || qd.originalArray || fallbackArr;
  const n = rawArray.length || arraySize || 8;

  // Pivot phase data
  let pivotIndex = typeof qd.pivotIndex === 'number' ? qd.pivotIndex : null;
  let pivotVal = qd.pivotVal ?? qd.pivot;
  if (phase === 'pivot') {
    if (pivotIndex === null && pivotVal !== undefined) {
      const found = rawArray.indexOf(pivotVal);
      pivotIndex = found >= 0 ? found : Math.max(0, rawArray.length - 1);
    } else if (pivotIndex === null) {
      pivotIndex = Math.max(0, rawArray.length - 1);
    }
    if (pivotVal === undefined && rawArray.length > 0) {
      pivotVal = rawArray[pivotIndex];
    }
  }

  // Partition phase data
  let left = qd.left || qd.less || qd.menores || null;
  let right = qd.right || qd.greater || qd.mayores || null;
  if (phase === 'partition') {
    if (pivotVal === undefined) {
      pivotVal =
        rootMeta.rootPivotVal ??
        (typeof qd.pivotIndex === 'number' ? rawArray[qd.pivotIndex] : rawArray[rawArray.length - 1]);
    }
    if (!Array.isArray(left) || !Array.isArray(right)) {
      if (typeof qd.pivotIndex === 'number' && qd.pivotIndex >= 0 && qd.pivotIndex < rawArray.length) {
        left = rawArray.slice(0, qd.pivotIndex);
        right = rawArray.slice(qd.pivotIndex + 1);
      } else {
        let skippedPivot = false;
        const derivedLeft = [];
        const derivedRight = [];
        for (const v of rawArray) {
          if (!skippedPivot && v === pivotVal) {
            skippedPivot = true;
            continue;
          }
          if (v <= pivotVal) derivedLeft.push(v);
          else derivedRight.push(v);
        }
        left = derivedLeft;
        right = derivedRight;
      }
    }
  }

  // Spawn phase data
  let spawnLanes = [];
  if (phase === 'spawn') {
    if (pivotVal === undefined) {
      pivotVal = rootMeta.rootPivotVal ?? rawArray[Math.floor(rawArray.length / 2)];
    }
    const rawLanes = qd.lanes || qd.tasks || qd.branches;
    if (Array.isArray(rawLanes) && rawLanes.length > 0) {
      spawnLanes = rawLanes.map((lane, idx) => {
        const wId = typeof lane.workerId === 'number' ? lane.workerId : idx % safeWorkers;
        const side = lane.side || (idx === 0 ? 'left' : idx === 1 ? 'right' : `branch-${idx}`);
        const label =
          lane.label ||
          lane.sideLabel ||
          (idx === 0 ? 'izquierda' : idx === 1 ? 'derecha' : `subarreglo ${idx + 1}`);
        return {
          id: lane.id ?? idx,
          workerId: wId,
          side,
          label,
          values: lane.values || lane.array || lane.subarray || lane.items || []
        };
      });
    } else {
      const leftVals = Array.isArray(left) ? left : rootMeta.left || [];
      const rightVals = Array.isArray(right) ? right : rootMeta.right || [];
      spawnLanes = [
        {
          id: 'left',
          workerId: 0,
          side: 'left',
          label: 'izquierda',
          values: leftVals
        },
        {
          id: 'right',
          workerId: 1 % safeWorkers,
          side: 'right',
          label: 'derecha',
          values: rightVals
        }
      ];
    }
  }

  // Recurse phase data
  let recurseTasks = [];
  if (phase === 'recurse') {
    const rawTasks = qd.tasks || qd.lanes || qd.subtasks || [];
    if (Array.isArray(rawTasks) && rawTasks.length > 0) {
      recurseTasks = rawTasks.map((t, idx) => {
        const workerId = typeof t.workerId === 'number' ? t.workerId : idx % safeWorkers;
        const beforeSub = Array.isArray(t.beforeSub)
          ? t.beforeSub
          : Array.isArray(t.before)
            ? t.before
            : Array.isArray(t.input)
              ? t.input
              : [];
        const afterSub = Array.isArray(t.afterSub)
          ? t.afterSub
          : Array.isArray(t.after)
            ? t.after
            : Array.isArray(t.output)
              ? t.output
              : beforeSub;
        const localPivotVal =
          t.pivotVal ?? t.pivot ?? (beforeSub.length > 0 ? beforeSub[beforeSub.length - 1] : undefined);
        let localPivotIdx =
          typeof t.pivotIndex === 'number'
            ? t.pivotIndex
            : typeof t.localPivotIndex === 'number'
              ? t.localPivotIndex
              : -1;
        if (localPivotIdx < 0 && localPivotVal !== undefined) {
          localPivotIdx = beforeSub.indexOf(localPivotVal);
        }
        const isSorted = Boolean(
          t.isSorted ?? t.sorted ?? (t.status === 'sorted' || t.status === 'ordenado')
        );
        const tLeft = Array.isArray(t.left || t.less || t.menores) ? t.left || t.less || t.menores : null;
        const tRight = Array.isArray(t.right || t.greater || t.mayores)
          ? t.right || t.greater || t.mayores
          : null;

        return {
          id: t.id ?? idx,
          workerId,
          label: t.label || t.sideLabel || `HILO ${workerId + 1}`,
          beforeSub,
          afterSub,
          pivotVal: localPivotVal,
          pivotIndex: localPivotIdx,
          left: tLeft,
          right: tRight,
          isSorted,
          statusLabel: t.statusLabel || (isSorted ? 'ordenado' : null)
        };
      });
    } else if (Array.isArray(step?.treeNodes) && step.treeNodes.length > 0) {
      recurseTasks = step.treeNodes.map((node, idx) => {
        const [low = 0, high = Math.max(0, rawArray.length - 1)] = node.range || [];
        const sub = rawArray.slice(low, high + 1);
        const workerId = typeof node.workerId === 'number' ? node.workerId : idx % safeWorkers;
        const localPivotVal = sub.length > 0 ? sub[sub.length - 1] : undefined;
        return {
          id: node.id ?? idx,
          workerId,
          label: `HILO ${workerId + 1}`,
          beforeSub: sub,
          afterSub: [...sub].sort((a, b) => a - b),
          pivotVal: localPivotVal,
          pivotIndex: sub.length > 0 ? sub.length - 1 : -1,
          left: null,
          right: null,
          isSorted: sub.length <= 2,
          statusLabel: sub.length <= 2 ? 'ordenado' : null
        };
      });
    }
  }

  // Done phase data
  let donePivotIndex = null;
  let donePivotVal = qd.rootPivotVal ?? qd.pivotVal ?? qd.pivot ?? rootMeta.rootPivotVal;
  if (phase === 'done') {
    if (typeof qd.rootPivotIndex === 'number') {
      donePivotIndex = qd.rootPivotIndex;
    } else if (typeof qd.pivotIndex === 'number') {
      donePivotIndex = qd.pivotIndex;
    } else if (typeof rootMeta.rootPivotIndex === 'number') {
      donePivotIndex = rootMeta.rootPivotIndex;
    } else if (donePivotVal !== undefined) {
      const idx = rawArray.indexOf(donePivotVal);
      donePivotIndex = idx >= 0 ? idx : null;
    }
  }

  const title = qd.title || qd.heading || step?.stageName || buildFallbackTitle(phase, level);
  const description =
    qd.description || step?.description || buildFallbackDescription(phase, pivotVal, n);

  return {
    phase,
    level,
    title,
    description,
    array: rawArray,
    n,
    pivotIndex,
    pivotVal,
    left: left || [],
    right: right || [],
    spawnLanes,
    recurseTasks,
    donePivotIndex,
    donePivotVal
  };
}

function PhaseBadgeLabel(phase, level) {
  switch (phase) {
    case 'pivot':
      return 'Pivote';
    case 'partition':
      return 'Partición';
    case 'spawn':
      return 'Paralelismo';
    case 'recurse':
      return `Nivel ${level}`;
    case 'done':
      return 'Resultado';
    default:
      return 'QuickSort';
  }
}

export default function QuickSortVisualizer() {
  return null;
}
