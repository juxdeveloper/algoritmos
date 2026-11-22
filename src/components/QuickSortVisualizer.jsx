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

export default function QuickSortVisualizer({
  step,
  numWorkers = 4,
  arraySize = 8,
  currentStepIndex = 0,
  totalSteps = 5,
  steps = [],
  onSelectStep,
  onLoadClassicExample
}) {
  const [focusMode, setFocusMode] = useState(false);

  const data = useMemo(
    () => normalizeQuickSortStep(step, steps, numWorkers, arraySize, currentStepIndex),
    [step, steps, numWorkers, arraySize, currentStepIndex]
  );

  const effectiveTotalSteps = Math.max(totalSteps || 0, steps.length || 0, 1);
  const densityClass = getDensityClass(data.n);
  const phaseLabel = PhaseBadgeLabel(data.phase, data.level);

  const renderCells = (values, getVariant, showIndex = true) => {
    if (!Array.isArray(values) || values.length === 0) {
      return <span className="qs-empty-sub">∅ (vacío)</span>;
    }

    return (
      <div className={`qs-array-row ${densityClass}`}>
        {values.map((val, idx) => {
          const variant = getVariant ? getVariant(val, idx) : {};
          const roleClass = variant.role ? `qs-cell-${variant.role}` : '';
          const inlineStyle = variant.style || undefined;
          return (
            <div
              key={`${idx}-${val}`}
              className={`qs-cell ${roleClass}`}
              style={inlineStyle}
              title={`[${idx}] = ${val}`}
            >
              <span className="qs-cell-val">{val}</span>
              {showIndex && values.length <= 32 && (
                <span className="qs-cell-idx">[{idx}]</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`guided-visualizer qs-visualizer ${focusMode ? 'guided-focus-mode' : ''}`}>
      {/* 1. Top Header & Quick Actions */}
      <header className="guided-header">
        <nav className="guided-step-tabs" aria-label="Pasos de QuickSort Paralelo">
          {steps.length > 0 ? (
            steps.map((s, idx) => {
              const shortLabel =
                s?.quicksortData?.shortLabel ||
                (s?.quicksortData?.phase
                  ? PhaseBadgeLabel(s.quicksortData.phase, s.quicksortData.level ?? 1)
                  : s?.stageName || `Paso ${idx + 1}`);
              const isActive = idx === currentStepIndex;
              const isCompleted = idx < currentStepIndex;

              return (
                <button
                  key={idx}
                  type="button"
                  className={`guided-step-tab ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  onClick={() => onSelectStep && onSelectStep(idx)}
                  aria-current={isActive ? 'step' : undefined}
                  title={`Paso ${idx + 1}: ${shortLabel}`}
                >
                  <span className="guided-step-num">{idx + 1}</span>
                  <span className="guided-step-label">{shortLabel}</span>
                </button>
              );
            })
          ) : (
            <span className="guided-step-tab active">
              <span className="guided-step-num">{currentStepIndex + 1}</span>
              <span className="guided-step-label">{phaseLabel}</span>
            </span>
          )}
        </nav>

        <div className="guided-quick-actions">
          {onLoadClassicExample && (
            <button
              type="button"
              className="guided-action-btn guided-classic-btn"
              onClick={onLoadClassicExample}
              title="Cargar ejemplo clásico [8, 3, 1, 7, 5, 2, 9] con 2 hilos"
            >
              <Sparkles size={13} />
              <span>Clásico [8,3,1,7,5,2,9] (2 Hilos)</span>
            </button>
          )}

          <button
            type="button"
            className={`guided-action-btn guided-focus-btn ${focusMode ? 'active' : ''}`}
            onClick={() => setFocusMode((v) => !v)}
            aria-pressed={focusMode}
            title="Activar o desactivar modo exposición"
          >
            {focusMode ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>Exposición</span>
          </button>
        </div>
      </header>

      {/* 2. Stage Banner */}
      <section className="guided-stage-banner">
        <div className="guided-stage-meta">
          <span className="guided-step-counter">
            Paso {currentStepIndex + 1} de {effectiveTotalSteps}
          </span>
          <span className={`guided-phase-badge qs-phase-${data.phase}`}>
            {phaseLabel}
          </span>
        </div>
        <h3 className="guided-stage-title">{data.title}</h3>
        <p className="guided-stage-desc">{data.description}</p>
      </section>

      {/* 3. Interactive Scene per phase */}
      <section className={`guided-scene qs-scene qs-scene-${data.phase}`}>
        {/* PHASE: PIVOT */}
        {data.phase === 'pivot' && (
          <div className="qs-pivot-stage">
            <div className="qs-section-head">
              <span className="qs-section-label">Arreglo original</span>
              <span className="qs-size-chip">N = {data.array.length}</span>
            </div>

            {renderCells(data.array, (_, idx) => {
              if (idx === data.pivotIndex) {
                return {
                  role: 'pivot',
                  style: {
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.16)',
                    color: '#fde68a',
                    boxShadow: '0 0 14px rgba(251, 191, 36, 0.28)'
                  }
                };
              }
              return { role: 'neutral' };
            })}

            <div className="qs-caption-row">
              <span
                className="qs-status-pill qs-pill-amber"
                style={{
                  borderColor: 'rgba(251, 191, 36, 0.45)',
                  backgroundColor: 'rgba(251, 191, 36, 0.14)',
                  color: '#fbbf24'
                }}
              >
                Pivote = {data.pivotVal ?? '—'}
              </span>
            </div>
          </div>
        )}

        {/* PHASE: PARTITION */}
        {data.phase === 'partition' && (
          <div className="qs-partition-stage">
            <div className="qs-split">
              <div
                className="qs-split-group qs-split-left"
                style={{
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  backgroundColor: 'rgba(56, 189, 248, 0.06)'
                }}
              >
                <span className="qs-split-title" style={{ color: '#38bdf8' }}>
                  Menores que {data.pivotVal}
                </span>
                {renderCells(
                  data.left,
                  () => ({
                    role: 'left',
                    style: {
                      borderColor: 'rgba(56, 189, 248, 0.5)',
                      backgroundColor: 'rgba(56, 189, 248, 0.14)',
                      color: '#bae6fd'
                    }
                  }),
                  false
                )}
              </div>

              <div
                className="qs-split-group qs-split-pivot"
                style={{
                  borderColor: 'rgba(251, 191, 36, 0.55)',
                  backgroundColor: 'rgba(251, 191, 36, 0.1)'
                }}
              >
                <span className="qs-split-title" style={{ color: '#fbbf24' }}>
                  Pivote
                </span>
                {renderCells(
                  data.pivotVal !== undefined ? [data.pivotVal] : [],
                  () => ({
                    role: 'pivot',
                    style: {
                      borderColor: '#fbbf24',
                      backgroundColor: 'rgba(251, 191, 36, 0.2)',
                      color: '#fde68a',
                      boxShadow: '0 0 14px rgba(251, 191, 36, 0.28)'
                    }
                  }),
                  false
                )}
              </div>

              <div
                className="qs-split-group qs-split-right"
                style={{
                  borderColor: 'rgba(168, 85, 247, 0.4)',
                  backgroundColor: 'rgba(168, 85, 247, 0.06)'
                }}
              >
                <span className="qs-split-title" style={{ color: '#c084fc' }}>
                  Mayores que {data.pivotVal}
                </span>
                {renderCells(
                  data.right,
                  () => ({
                    role: 'right',
                    style: {
                      borderColor: 'rgba(168, 85, 247, 0.5)',
                      backgroundColor: 'rgba(168, 85, 247, 0.14)',
                      color: '#e9d5ff'
                    }
                  }),
                  false
                )}
              </div>
            </div>

            <div className="qs-caption-row">
              <span
                className="qs-status-pill qs-pill-amber"
                style={{
                  borderColor: 'rgba(251, 191, 36, 0.45)',
                  backgroundColor: 'rgba(251, 191, 36, 0.14)',
                  color: '#fbbf24'
                }}
              >
                Partición completa · {data.pivotVal} en su posición definitiva
              </span>
            </div>
          </div>
        )}

        {/* PHASE: SPAWN */}
        {data.phase === 'spawn' && (
          <div className="qs-spawn-stage">
            <div className="qs-spawn-top">
              <div
                className="qs-spawn-pivot-box"
                style={{
                  borderColor: 'rgba(251, 191, 36, 0.55)',
                  backgroundColor: 'rgba(251, 191, 36, 0.1)'
                }}
              >
                <span className="qs-spawn-pivot-label" style={{ color: '#fbbf24' }}>
                  Pivote fijo
                </span>
                <div
                  className="qs-cell qs-cell-pivot"
                  style={{
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.2)',
                    color: '#fde68a'
                  }}
                >
                  <span className="qs-cell-val">{data.pivotVal}</span>
                </div>
              </div>
            </div>

            {/* SVG Fork Connector */}
            {data.spawnLanes.length > 0 && (
              <div className="qs-fork-wrap" aria-hidden="true">
                <svg
                  className="qs-fork-svg"
                  viewBox="0 0 400 56"
                  preserveAspectRatio="none"
                >
                  <circle cx="200" cy="6" r="4" fill="#fbbf24" />
                  {data.spawnLanes.map((lane, idx) => {
                    const count = data.spawnLanes.length;
                    const targetX = count === 1 ? 200 : ((idx + 0.5) / count) * 400;
                    const workerColor = WORKER_COLORS[lane.workerId % WORKER_COLORS.length];
                    const pathD = `M 200 6 C 200 30, ${targetX} 26, ${targetX} 50`;
                    return (
                      <g key={lane.id}>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={workerColor}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        <circle cx={targetX} cy="50" r="4" fill={workerColor} />
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            <div
              className="qs-spawn-lanes"
              style={{
                gridTemplateColumns:
                  data.spawnLanes.length > 2
                    ? 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))'
                    : undefined
              }}
            >
              {data.spawnLanes.map((lane, idx) => {
                const workerColor = WORKER_COLORS[lane.workerId % WORKER_COLORS.length];
                return (
                  <div
                    key={lane.id}
                    className="qs-spawn-lane"
                    style={{
                      borderColor: hexToRgba(workerColor, 0.45),
                      backgroundColor: hexToRgba(workerColor, 0.06)
                    }}
                  >
                    <div className="qs-lane-header">
                      <span
                        className="qs-worker-badge"
                        style={{
                          backgroundColor: hexToRgba(workerColor, 0.18),
                          color: workerColor,
                          borderColor: hexToRgba(workerColor, 0.45)
                        }}
                      >
                        <Cpu size={12} />
                        <span>
                          HILO {idx + 1} · {lane.label}
                        </span>
                      </span>
                      <span className="qs-worker-core" style={{ color: workerColor }}>
                        P{lane.workerId}
                      </span>
                    </div>

                    {renderCells(
                      lane.values,
                      () => ({
                        role: lane.side === 'right' ? 'right' : 'left',
                        style: {
                          borderColor: hexToRgba(workerColor, 0.55),
                          backgroundColor: hexToRgba(workerColor, 0.14),
                          color: '#f8fafc'
                        }
                      }),
                      false
                    )}
                  </div>
                );
              })}
            </div>

            <div className="qs-caption-row">
              <span className="qs-status-pill qs-pill-parallel">
                <Share2 size={13} />
                <span>Los subarreglos ocupan posiciones distintas: se ejecutan al mismo tiempo</span>
              </span>
            </div>
          </div>
        )}

        {/* PHASE: RECURSE */}
        {data.phase === 'recurse' && (
          <div className="qs-recurse-stage">
            <div className="guided-lanes qs-recurse-lanes">
              {data.recurseTasks.map((task, idx) => {
                const workerColor = WORKER_COLORS[task.workerId % WORKER_COLORS.length];
                const hasSplitGroups = Array.isArray(task.left) || Array.isArray(task.right);

                return (
                  <article
                    key={task.id ?? idx}
                    className="guided-lane qs-recurse-lane"
                    style={{
                      borderColor: hexToRgba(workerColor, 0.45),
                      backgroundColor: hexToRgba(workerColor, 0.05)
                    }}
                  >
                    <header className="guided-lane-header">
                      <span
                        className="qs-worker-badge"
                        style={{
                          backgroundColor: hexToRgba(workerColor, 0.18),
                          color: workerColor,
                          borderColor: hexToRgba(workerColor, 0.45)
                        }}
                      >
                        <Cpu size={12} />
                        <span>
                          {task.label} · P{task.workerId}
                        </span>
                      </span>

                      {task.pivotVal !== undefined && !task.isSorted && (
                        <span className="qs-pivot-note" style={{ color: '#fbbf24' }}>
                          pivote = {task.pivotVal}
                        </span>
                      )}

                      {task.isSorted && (
                        <span
                          className="qs-sorted-tag"
                          style={{
                            color: '#34d399',
                            backgroundColor: 'rgba(52, 211, 153, 0.14)',
                            borderColor: 'rgba(52, 211, 153, 0.4)'
                          }}
                        >
                          ordenado
                        </span>
                      )}
                    </header>

                    {/* Before subarray with local pivot highlighted */}
                    <div className="qs-sub-block">
                      {renderCells(
                        task.beforeSub,
                        (_, cellIdx) => {
                          if (cellIdx === task.pivotIndex) {
                            return {
                              role: 'pivot',
                              style: {
                                borderColor: '#fbbf24',
                                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                                color: '#fde68a'
                              }
                            };
                          }
                          return {
                            role: 'neutral',
                            style: {
                              borderColor: hexToRgba(workerColor, 0.35)
                            }
                          };
                        },
                        false
                      )}
                    </div>

                    {/* Arrow Down */}
                    <div className="qs-arrow-down" aria-hidden="true">
                      ↓
                    </div>

                    {/* After subarray: sorted or partitioned (menores | pivote | mayores) */}
                    <div className="qs-sub-block qs-sub-after">
                      {task.isSorted ? (
                        <div className="qs-after-sorted-wrap">
                          {renderCells(
                            task.afterSub,
                            () => ({
                              role: 'sorted',
                              style: {
                                borderColor: 'rgba(52, 211, 153, 0.55)',
                                backgroundColor: 'rgba(52, 211, 153, 0.14)',
                                color: '#a7f3d0'
                              }
                            }),
                            false
                          )}
                          <span className="qs-sub-caption qs-caption-sorted">ordenado ✓</span>
                        </div>
                      ) : hasSplitGroups ? (
                        <div className="qs-after-groups">
                          <div className="qs-mini-group qs-mini-left">
                            {renderCells(
                              task.left || [],
                              () => ({
                                role: 'left',
                                style: {
                                  borderColor: 'rgba(56, 189, 248, 0.45)',
                                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                  color: '#bae6fd'
                                }
                              }),
                              false
                            )}
                          </div>
                          <span className="qs-group-sep" aria-hidden="true">
                            |
                          </span>
                          <div className="qs-mini-group qs-mini-pivot">
                            {renderCells(
                              task.pivotVal !== undefined ? [task.pivotVal] : [],
                              () => ({
                                role: 'pivot',
                                style: {
                                  borderColor: '#fbbf24',
                                  backgroundColor: 'rgba(251, 191, 36, 0.2)',
                                  color: '#fde68a'
                                }
                              }),
                              false
                            )}
                          </div>
                          <span className="qs-group-sep" aria-hidden="true">
                            |
                          </span>
                          <div className="qs-mini-group qs-mini-right">
                            {renderCells(
                              task.right || [],
                              () => ({
                                role: 'right',
                                style: {
                                  borderColor: 'rgba(168, 85, 247, 0.45)',
                                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                                  color: '#e9d5ff'
                                }
                              }),
                              false
                            )}
                          </div>
                        </div>
                      ) : (
                        renderCells(
                          task.afterSub,
                          (val) => {
                            if (task.pivotVal !== undefined && val === task.pivotVal) {
                              return {
                                role: 'pivot',
                                style: {
                                  borderColor: '#fbbf24',
                                  backgroundColor: 'rgba(251, 191, 36, 0.2)',
                                  color: '#fde68a'
                                }
                              };
                            }
                            if (task.pivotVal !== undefined && val < task.pivotVal) {
                              return {
                                role: 'left',
                                style: {
                                  borderColor: 'rgba(56, 189, 248, 0.45)',
                                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                  color: '#bae6fd'
                                }
                              };
                            }
                            if (task.pivotVal !== undefined && val > task.pivotVal) {
                              return {
                                role: 'right',
                                style: {
                                  borderColor: 'rgba(168, 85, 247, 0.45)',
                                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                                  color: '#e9d5ff'
                                }
                              };
                            }
                            return {
                              role: 'sorted',
                              style: {
                                borderColor: hexToRgba(workerColor, 0.5),
                                backgroundColor: hexToRgba(workerColor, 0.12)
                              }
                            };
                          },
                          false
                        )
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE: DONE */}
        {data.phase === 'done' && (
          <div className="qs-done-stage">
            <div className="qs-caption-row">
              <span
                className="qs-status-pill qs-pill-done"
                style={{
                  borderColor: 'rgba(52, 211, 153, 0.45)',
                  backgroundColor: 'rgba(52, 211, 153, 0.14)',
                  color: '#34d399'
                }}
              >
                <CheckCircle2 size={14} />
                <span>✓ Todos los hilos terminaron</span>
              </span>
            </div>

            {renderCells(data.array, (_, idx) => {
              if (
                typeof data.donePivotIndex === 'number' &&
                data.donePivotIndex >= 0 &&
                data.donePivotIndex < data.array.length
              ) {
                if (idx < data.donePivotIndex) {
                  return {
                    role: 'left',
                    style: {
                      borderColor: 'rgba(56, 189, 248, 0.55)',
                      backgroundColor: 'rgba(56, 189, 248, 0.14)',
                      color: '#bae6fd'
                    }
                  };
                }
                if (idx === data.donePivotIndex) {
                  return {
                    role: 'pivot',
                    style: {
                      borderColor: '#fbbf24',
                      backgroundColor: 'rgba(251, 191, 36, 0.22)',
                      color: '#fde68a',
                      boxShadow: '0 0 14px rgba(251, 191, 36, 0.26)'
                    }
                  };
                }
                return {
                  role: 'right',
                  style: {
                    borderColor: 'rgba(168, 85, 247, 0.55)',
                    backgroundColor: 'rgba(168, 85, 247, 0.14)',
                    color: '#e9d5ff'
                  }
                };
              }

              return {
                role: 'sorted',
                style: {
                  borderColor: 'rgba(52, 211, 153, 0.55)',
                  backgroundColor: 'rgba(52, 211, 153, 0.14)',
                  color: '#a7f3d0'
                }
              };
            })}

            <p className="qs-done-note">
              Cada lado quedó ordenado en su posición original sin necesidad de fusionar.
            </p>
          </div>
        )}
      </section>

      {/* 4. Bottom Summary Cards */}
      <footer className="guided-summary-grid">
        <div className="guided-summary-card">
          <div className="guided-summary-title">
            <Info size={14} color="#38bdf8" />
            <span>Idea clave</span>
          </div>
          <p className="guided-summary-text">
            Primero se particiona respecto al pivote; después, ambos lados independientes se ordenan en paralelo.
          </p>
        </div>

        <div className="guided-summary-card">
          <div className="guided-summary-title">
            <Gauge size={14} color="#c084fc" />
            <span>Complejidad</span>
          </div>
          <p className="guided-summary-text">
            Trabajo medio <strong className="qs-mono">O(n log n)</strong> · Span ideal{' '}
            <strong className="qs-mono">O(log² n)</strong> (O(n) con partición secuencial) · Peor caso{' '}
            <strong className="qs-mono">O(n²)</strong>
          </p>
        </div>
      </footer>
    </div>
  );
}
