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

export default function BitonicVisualizer({
  step,
  numWorkers = 4,
  arraySize = 8,
  currentStepIndex = 0,
  totalSteps = 1,
  onStepForward,
  onLoadClassicExample
}) {
  const [showOriginal, setShowOriginal] = useState(true);
  const [showAfter, setShowAfter] = useState(true);
  const [focusedPair, setFocusedPair] = useState(null);
  const [showRuleHelp, setShowRuleHelp] = useState(false);

  useEffect(() => {
    setShowAfter(true);
    setFocusedPair(null);
  }, [step?.stepIndex]);

  useEffect(() => {
    if (!showRuleHelp) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowRuleHelp(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showRuleHelp]);

  const data = useMemo(
    () => normalizeBitonicStep(step, numWorkers, arraySize, currentStepIndex),
    [step, numWorkers, arraySize, currentStepIndex]
  );

  const scheduleRows = useMemo(() => buildScheduleForN(data.n), [data.n]);

  if (!step) return null;

  const {
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
  } = data;

  const isStaticPhase = phase === 'initial' || phase === 'completed';
  const activeArr = isStaticPhase ? after : showAfter ? after : before;

  // Map index -> comparison for quick lookup
  const idxToComp = {};
  comparisons.forEach((c) => {
    idxToComp[c.i] = c;
    idxToComp[c.j] = c;
  });

  const toggleFocus = (pairIdx) => {
    if (pairIdx === null || pairIdx === undefined) return;
    setFocusedPair((prev) => (prev === pairIdx ? null : pairIdx));
  };

  // Fallback worker assignment when an element isn't in an active comparison
  const getFallbackWorkerId = (idx) => {
    const chunkSize = Math.max(1, Math.ceil(n / Math.max(1, numWorkers)));
    return Math.min(Math.floor(idx / chunkSize), Math.max(0, numWorkers - 1));
  };

  // Block brackets computation for active stage
  const brackets = [];
  if (phase === 'stage' && k >= 2) {
    const numBlocks = Math.ceil(n / k);
    for (let b = 0; b < numBlocks; b++) {
      const span = Math.min(k, n - b * k);
      brackets.push({
        idx: b,
        span,
        isAsc: b % 2 === 0
      });
    }
  }

  // Grid template & horizontal scroll threshold (>16 elements)
  const needsScroll = n > 16;
  const gridColsStyle = {
    gridTemplateColumns: needsScroll
      ? `repeat(${n}, minmax(40px, 1fr))`
      : `repeat(${n}, minmax(0, 1fr))`
  };
  const trackMinWidth = needsScroll ? `${n * 44}px` : undefined;

  // SVG coordinate space aligned 1-to-1 with CSS grid columns
  const svgWidth = needsScroll ? n * 44 : 800;
  const colW = svgWidth / n;
  const topY = 8;
  const maxSpan = comparisons.reduce((acc, c) => Math.max(acc, c.j - c.i), 1);
  const maxLog = Math.log2(Math.max(2, maxSpan));
  const maxControlY = topY + 42 + maxLog * 22 + 14;
  const svgHeight = Math.max(92, Math.ceil((topY + maxControlY) / 2) + 26);

  const pillW = n >= 64 ? 32 : n >= 32 ? 36 : n >= 16 ? 40 : 50;
  const pillH = n >= 16 ? 18 : 20;
  const pillFontSize = n >= 64 ? 8.5 : n >= 32 ? 9.5 : n >= 16 ? 10 : 11;

  // Stage badge label
  let stageBadgeText = `Etapa ${stageIndex} de ${totalStages}`;
  let stageBadgeClass = 'bitonic-badge-stage';
  if (phase === 'initial') {
    stageBadgeText = 'Estado Inicial';
    stageBadgeClass = 'bitonic-badge-initial';
  } else if (phase === 'completed') {
    stageBadgeText = 'Completado ✓';
    stageBadgeClass = 'bitonic-badge-completed';
  }

  // Rule summary chip
  const ruleChipText =
    phase === 'initial'
      ? `N = ${n} • ${totalStages} etapas`
      : phase === 'completed'
        ? `N = ${n} • Red finalizada`
        : `Bloque k = ${k} • Salto d = ${d}`;

  return (
    <div className="bitonic-visualizer">
      {/* 1. Top Pedagogical Header & Action Toolbar */}
      <section className="bitonic-header-card">
        <div className="bitonic-toolbar">
          <div className="bitonic-pills-left">
            <span className={`bitonic-stage-badge ${stageBadgeClass}`}>
              {stageBadgeText}
            </span>
            <span className="bitonic-rule-chip">{ruleChipText}</span>
            <button
              type="button"
              className="bitonic-help-btn"
              onClick={() => setShowRuleHelp(true)}
            >
              <HelpCircle size={13} />
              <span>¿Regla?</span>
            </button>
          </div>

          <div className="bitonic-actions-right">
            <button
              type="button"
              className={`bitonic-toggle-orig-btn ${showOriginal ? 'active' : ''}`}
              onClick={() => setShowOriginal((v) => !v)}
              aria-pressed={showOriginal}
            >
              {showOriginal ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{showOriginal ? 'Ocultar original' : 'Ver original'}</span>
            </button>

            <div
              className={`bitonic-segmented-switch ${isStaticPhase ? 'disabled' : ''}`}
              role="group"
              aria-label="Comparar estado antes y después del paso"
            >
              <button
                type="button"
                disabled={isStaticPhase}
                className={`bitonic-seg-btn ${!isStaticPhase && !showAfter ? 'active-before' : ''}`}
                onClick={() => setShowAfter(false)}
              >
                Antes
              </button>
              <button
                type="button"
                disabled={isStaticPhase}
                className={`bitonic-seg-btn ${!isStaticPhase && showAfter ? 'active-after' : ''}`}
                onClick={() => setShowAfter(true)}
              >
                Después ✓
              </button>
            </div>

            {onLoadClassicExample && (
              <button
                type="button"
                className="bitonic-classic-btn"
                onClick={onLoadClassicExample}
                title="Cargar ejemplo clásico [27, 32, 18, 24, 22, 4, 43, 30] con N=8"
              >
                <Sparkles size={13} />
                <span>Clásico [27, 32, 18...]</span>
              </button>
            )}
          </div>
        </div>

        <div className="bitonic-explanation-row">
          <p className="bitonic-explanation-text">
            {renderHighlightedExplanation(explanation)}
          </p>

          {phase === 'initial' && onStepForward && (
            <button
              type="button"
              className="bitonic-cta-btn"
              onClick={onStepForward}
            >
              <span>Ir al Paso 1</span>
              <ArrowRight size={13} />
            </button>
          )}

          {phase === 'completed' && (
            <span className="bitonic-completed-hint">
              <RotateCcw size={12} />
              <span>Usa Reiniciar [R] para volver al inicio</span>
            </span>
          )}
        </div>
      </section>

      {/* 2. Aligned Visualization Area */}
      <section className="bitonic-stage-card">
        <div className="bitonic-array-meta">
          <span className="bitonic-section-label">
            Arreglo Actual ({n} en fila)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {focusedPair !== null && (
              <button
                type="button"
                className="bitonic-reset-focus-chip"
                onClick={() => setFocusedPair(null)}
              >
                Ver todos
              </button>
            )}
            <span
              className={`bitonic-state-badge ${
                phase === 'initial'
                  ? 'state-initial'
                  : phase === 'completed'
                    ? 'state-after'
                    : showAfter
                      ? 'state-after'
                      : 'state-before'
              }`}
            >
              {phase === 'initial'
                ? 'ESTADO INICIAL'
                : phase === 'completed'
                  ? 'ORDENADO ✓'
                  : showAfter
                    ? 'DESPUÉS del paso ✓'
                    : 'ANTES del paso'}
            </span>
          </div>
        </div>

        <div className={needsScroll ? 'bitonic-scroll-wrapper' : 'bitonic-fit-wrapper'}>
          <div
            className="bitonic-aligned-track"
            style={trackMinWidth ? { minWidth: trackMinWidth } : undefined}
          >
            {/* 2A. Optional Original Reference Row */}
            {showOriginal && (
              <div className="bitonic-original-section">
                <div className="bitonic-original-label">
                  Arreglo Original (Referencia)
                </div>
                <div className="bitonic-grid" style={gridColsStyle}>
                  {originalArray.map((val, idx) => (
                    <div key={idx} className="bitonic-orig-cell">
                      <span className="bitonic-orig-val">{val}</span>
                      <span className="bitonic-orig-idx">[{idx}]</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2B. Block Brackets (k) */}
            {brackets.length > 0 && (
              <div className="bitonic-grid bitonic-brackets-grid" style={gridColsStyle}>
                {brackets.map((b) => (
                  <div
                    key={b.idx}
                    className={`bitonic-bracket ${b.isAsc ? 'asc' : 'desc'}`}
                    style={{ gridColumn: `span ${b.span} / span ${b.span}` }}
                  >
                    <span>{b.isAsc ? '↑' : '↓'}</span>
                    <span className="bitonic-bracket-label">
                      {b.isAsc ? (k === n ? 'Todo Asc' : 'Asc') : 'Desc'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 2C. Single Array Row ([0]..[n-1]) */}
            <div className="bitonic-grid" style={gridColsStyle}>
              {activeArr.map((val, idx) => {
                const comp = idxToComp[idx];
                const workerId = comp ? comp.workerId : getFallbackWorkerId(idx);
                const workerColor = WORKER_COLORS[workerId % WORKER_COLORS.length];
                const isFocused = Boolean(comp && focusedPair === comp.pairIdx);
                const isDimmed = focusedPair !== null && !isFocused;
                const isSwappedHighlight = Boolean(
                  phase === 'stage' && showAfter && comp?.swapped && focusedPair === null
                );
                const isAscBlock = k >= 2 ? Math.floor(idx / k) % 2 === 0 : true;

                const cellStyle = {};
                if (isFocused) {
                  cellStyle.borderColor = workerColor;
                  cellStyle.backgroundColor = hexToRgba(workerColor, 0.16);
                  cellStyle.boxShadow = `0 0 0 2px ${hexToRgba(workerColor, 0.45)}, 0 6px 16px ${hexToRgba(workerColor, 0.22)}`;
                  cellStyle.transform = 'scale(1.04)';
                  cellStyle.zIndex = 5;
                } else if (isDimmed) {
                  cellStyle.opacity = 0.38;
                }

                let cellClass = 'bitonic-cell';
                if (comp) cellClass += ' clickable';
                if (isFocused) cellClass += ' focused';
                else if (isSwappedHighlight) cellClass += ' swapped';
                else if (phase === 'completed') cellClass += ' completed';
                else if (phase === 'stage') cellClass += isAscBlock ? ' block-asc' : ' block-desc';

                const pillStyle = isFocused
                  ? { backgroundColor: workerColor, color: '#090d16' }
                  : isSwappedHighlight
                    ? { backgroundColor: '#34d399', color: '#090d16' }
                    : {
                        backgroundColor: hexToRgba(workerColor, 0.16),
                        color: workerColor
                      };

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!comp}
                    onClick={() => comp && toggleFocus(comp.pairIdx)}
                    className={cellClass}
                    style={cellStyle}
                    title={
                      comp
                        ? `P${workerId}: compara [${comp.i}] y [${comp.j}]`
                        : `Elemento [${idx}] = ${val}`
                    }
                  >
                    <span className="bitonic-cell-worker" style={pillStyle}>
                      P{workerId}
                    </span>
                    <span className="bitonic-cell-val">{val}</span>
                    <span className="bitonic-cell-idx">[{idx}]</span>
                  </button>
                );
              })}
            </div>

            {/* 2D. SVG Butterfly Arcs */}
            {comparisons.length > 0 ? (
              <div className="bitonic-svg-wrap">
                <svg
                  className="bitonic-butterfly-svg"
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  preserveAspectRatio="none"
                  style={{ height: `${svgHeight}px` }}
                >
                  {comparisons.map((c) => {
                    const x1 = (c.i + 0.5) * colW;
                    const x2 = (c.j + 0.5) * colW;
                    const midX = (x1 + x2) / 2;
                    const span = Math.max(1, c.j - c.i);
                    const depth = 42 + Math.log2(span) * 22;
                    const stagger = c.i % 2 === 1 && span >= 2 ? 12 : 0;
                    const controlY = topY + depth + stagger;

                    const workerColor = WORKER_COLORS[c.workerId % WORKER_COLORS.length];
                    const isFocused = focusedPair === c.pairIdx;
                    const isDimmed = focusedPair !== null && !isFocused;

                    const strokeColor = isFocused
                      ? workerColor
                      : c.swapped
                        ? '#34d399'
                        : '#64748b';
                    const strokeWidth = isFocused ? 3.8 : c.swapped ? 2.8 : 2;
                    const dashArray = !c.swapped && !isFocused ? '5,4' : undefined;

                    const pathD = `M ${x1} ${topY} Q ${midX} ${controlY}, ${x2} ${topY}`;
                    const labelY = (topY + controlY) / 2 + 4;
                    const pillFill = isFocused
                      ? workerColor
                      : c.swapped
                        ? '#064e3b'
                        : '#162036';
                    const textFill = isFocused
                      ? '#090d16'
                      : c.swapped
                        ? '#6ee7b7'
                        : '#94a3b8';
                    const pillLabel = c.swapped
                      ? n >= 64
                        ? `P${c.workerId}⇄`
                        : `P${c.workerId} ⇄`
                      : `P${c.workerId}`;

                    return (
                      <g
                        key={c.pairIdx}
                        onClick={() => toggleFocus(c.pairIdx)}
                        style={{
                          cursor: 'pointer',
                          opacity: isDimmed ? 0.22 : 1,
                          transition: 'opacity 0.2s ease'
                        }}
                      >
                        {/* Wider invisible hit target */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={14}
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={dashArray}
                        />
                        <circle
                          cx={x1}
                          cy={topY}
                          r={isFocused ? 5.2 : 4}
                          fill={strokeColor}
                        />
                        <circle
                          cx={x2}
                          cy={topY}
                          r={isFocused ? 5.2 : 4}
                          fill={strokeColor}
                        />
                        <rect
                          x={midX - pillW / 2}
                          y={labelY - pillH / 2}
                          width={pillW}
                          height={pillH}
                          rx={pillH / 2}
                          fill={pillFill}
                          stroke={strokeColor}
                          strokeWidth={1.6}
                        />
                        <text
                          x={midX}
                          y={labelY + 3.5}
                          textAnchor="middle"
                          fontSize={pillFontSize}
                          fontWeight="800"
                          fontFamily="JetBrains Mono, monospace"
                          fill={textFill}
                        >
                          {pillLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="bitonic-empty-arcs">
                {phase === 'initial'
                  ? 'Sin comparadores activos todavía — los arcos de Batcher aparecerán en la Etapa 1.'
                  : `Red Bitónica completada: secuencia de ${n} elementos ordenada de forma ascendente ✓`}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. Parallel Core Comparisons List */}
      <section className="bitonic-cores-card">
        <div className="bitonic-cores-header">
          <div className="bitonic-cores-title">
            <span className="bitonic-live-dot" />
            <span>Comparaciones por Núcleo en Paralelo</span>
            {comparisons.length > 0 && (
              <span className="bitonic-cores-hint">
                (Toca una fila o celda para resaltar)
              </span>
            )}
          </div>

          {focusedPair !== null && (
            <button
              type="button"
              className="bitonic-todos-btn"
              onClick={() => setFocusedPair(null)}
            >
              Ver todos
            </button>
          )}
        </div>

        {comparisons.length > 0 ? (
          <div className="bitonic-cores-grid">
            {comparisons.map((c) => {
              const workerColor = WORKER_COLORS[c.workerId % WORKER_COLORS.length];
              const isFocused = focusedPair === c.pairIdx;
              const isDimmed = focusedPair !== null && !isFocused;
              const isAsc = c.dir === 'asc';

              const cardStyle = {};
              if (isFocused) {
                cardStyle.borderColor = workerColor;
                cardStyle.backgroundColor = hexToRgba(workerColor, 0.14);
                cardStyle.boxShadow = `0 0 0 1px ${hexToRgba(workerColor, 0.4)}`;
              } else if (isDimmed) {
                cardStyle.opacity = 0.45;
              }

              return (
                <button
                  key={c.pairIdx}
                  type="button"
                  onClick={() => toggleFocus(c.pairIdx)}
                  className={`bitonic-core-card ${isFocused ? 'focused' : c.swapped ? 'swapped' : ''}`}
                  style={cardStyle}
                >
                  <div className="bitonic-core-left">
                    <span
                      className="bitonic-core-badge"
                      style={{
                        backgroundColor: hexToRgba(workerColor, 0.2),
                        color: workerColor,
                        border: `1px solid ${hexToRgba(workerColor, 0.45)}`
                      }}
                    >
                      P{c.workerId}
                    </span>

                    <span className={`bitonic-dir-pill ${isAsc ? 'asc' : 'desc'}`}>
                      {isAsc ? '↑' : '↓'}
                    </span>

                    <span className="bitonic-core-indices">
                      [{c.i}] vs [{c.j}]
                    </span>
                    <span className="bitonic-core-sep">·</span>
                    <span className="bitonic-core-vals">
                      {c.valI} vs {c.valJ}
                    </span>
                  </div>

                  {c.swapped ? (
                    <span className="bitonic-status-pill swapped">
                      Intercambio ({c.newI}, {c.newJ})
                    </span>
                  ) : (
                    <span className="bitonic-status-pill kept">Se queda</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bitonic-cores-empty">
            {phase === 'initial' ? (
              <>
                <span>
                  En el Estado Inicial aún no se ejecutan comparaciones. Avanza a la{' '}
                  <strong>Etapa 1</strong> para observar a los {numWorkers} núcleos trabajando en paralelo.
                </span>
                {onStepForward && (
                  <button
                    type="button"
                    className="bitonic-cta-btn"
                    onClick={onStepForward}
                  >
                    <span>Ir al Paso 1</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </>
            ) : (
              <span>
                Todos los comparadores terminaron su trabajo: el arreglo final de {n}{' '}
                elementos está verificado en orden ascendente (↑).
              </span>
            )}
          </div>
        )}
      </section>

      {/* 4. Rule Help Modal (k and d schedule for active N) */}
      {showRuleHelp && (
        <div
          className="bitonic-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bitonic-rule-modal-title"
          onClick={() => setShowRuleHelp(false)}
        >
          <div
            className="bitonic-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bitonic-modal-header">
              <h3 id="bitonic-rule-modal-title">
                Regla de los {totalStages} pasos ({n} números)
              </h3>
              <button
                type="button"
                className="bitonic-modal-close"
                onClick={() => setShowRuleHelp(false)}
                aria-label="Cerrar explicación"
              >
                <X size={15} />
              </button>
            </div>

            <p className="bitonic-modal-desc">
              El tamaño del bloque (<strong className="mono-cyan">k</strong>) crece en
              potencias de 2 (<span className="mono">2, 4, ..., {n}</span>), y en cada
              bloque el salto (<strong className="mono-purple">d</strong>) empieza a la
              mitad (<span className="mono">k / 2</span>) y se divide entre 2 hasta llegar a{' '}
              <span className="mono">1</span>:
            </p>

            <div className="bitonic-schedule-list">
              {scheduleRows.map((row) => {
                const isActiveK = phase === 'stage' && k === row.k;
                const stepRange =
                  row.startStep === row.endStep
                    ? `Etapa ${row.startStep}`
                    : `Etapas ${row.startStep}–${row.endStep}`;

                return (
                  <div
                    key={row.k}
                    className={`bitonic-schedule-row ${isActiveK ? 'active' : ''}`}
                  >
                    <span className="bitonic-schedule-k">
                      {stepRange}: k = {row.k}
                    </span>
                    <span className="bitonic-schedule-d">
                      d = {row.dList.join(' → ')} ({row.dirs})
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="bitonic-modal-confirm"
              onClick={() => setShowRuleHelp(false)}
            >
              <Check size={14} />
              <span>¡Entendido!</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
