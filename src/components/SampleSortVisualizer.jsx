import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Cpu,
  Network
} from 'lucide-react';
import { WORKER_COLORS } from './Controls';

const PHASE_FALLBACK_LABELS = {
  distribute: 'Reparto',
  local_sort: 'Orden local',
  sampling: 'Muestreo',
  splitters: 'Pivote',
  exchange: 'Intercambio',
  merge: 'Fusión'
};

function hexToRgba(hex, alpha) {
  const clean = (hex || '#38bdf8').replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getWorkerColor(workerId) {
  return WORKER_COLORS[Math.abs(workerId) % WORKER_COLORS.length];
}

function normalizePhase(rawPhase, stepIndex = 0) {
  switch (rawPhase) {
    case 'distribute':
    case 'initial':
      return 'distribute';
    case 'local_sort':
    case 'local_sorted':
      return 'local_sort';
    case 'sampling':
      return 'sampling';
    case 'splitters':
      return 'splitters';
    case 'exchange':
      return 'exchange';
    case 'merge':
    case 'completed':
      return 'merge';
    default: {
      const order = ['distribute', 'local_sort', 'sampling', 'splitters', 'exchange', 'merge'];
      return order[Math.min(order.length - 1, Math.max(0, stepIndex))];
    }
  }
}

function getDestWorker(val, splitters) {
  let bucketIdx = 0;
  while (bucketIdx < splitters.length && !(val < splitters[bucketIdx])) {
    bucketIdx++;
  }
  return bucketIdx;
}

function formatRangeLabel(workerIdx, splitters, numWorkers) {
  if (numWorkers <= 1 || !splitters || splitters.length === 0) {
    return 'todos los valores';
  }
  if (workerIdx === 0) {
    return `< ${splitters[0]}`;
  }
  if (workerIdx === numWorkers - 1) {
    return `≥ ${splitters[splitters.length - 1]}`;
  }
  return `[${splitters[workerIdx - 1]}, ${splitters[workerIdx]})`;
}

function deriveSceneData(step, steps, numWorkers, arraySize) {
  const sd = step?.sampleData || {};
  const p = Math.max(1, sd.p || numWorkers || 4);

  const originalArray =
    sd.original ||
    sd.originalArray ||
    steps?.[0]?.sampleData?.original ||
    steps?.[0]?.sampleData?.originalArray ||
    steps?.[0]?.array ||
    step?.array ||
    [];

  const n = sd.n || originalArray.length || arraySize || 8;

  const chunkRanges = Array.isArray(sd.chunkRanges) && sd.chunkRanges.length === p
    ? sd.chunkRanges
    : (() => {
        const base = Math.floor(originalArray.length / p);
        const rem = originalArray.length % p;
        let offset = 0;
        return Array.from({ length: p }, (_, w) => {
          const size = base + (w < rem ? 1 : 0);
          const start = offset;
          const end = start + size;
          offset = end;
          return { workerId: w, start, end };
        });
      })();

  const unsortedChunks =
    Array.isArray(sd.initialChunks) && sd.initialChunks.length > 0
      ? sd.initialChunks
      : Array.isArray(sd.unsortedChunks) && sd.unsortedChunks.length > 0
        ? sd.unsortedChunks
        : Array.isArray(sd.chunks) && sd.chunks.length > 0
          ? sd.chunks
          : chunkRanges.map(({ start, end }) => originalArray.slice(start, end));

  const sortedChunks =
    Array.isArray(sd.localSortedChunks) && sd.localSortedChunks.length > 0
      ? sd.localSortedChunks
      : Array.isArray(sd.sortedChunks) && sd.sortedChunks.length > 0
        ? sd.sortedChunks
        : unsortedChunks.map((chunk) => [...chunk].sort((a, b) => a - b));

  const samplingStep =
    steps?.find((s) => normalizePhase(s?.sampleData?.phase, s?.stepIndex) === 'sampling') || step;

  const samplesPerWorkerSource =
    Array.isArray(sd.samplesPerWorker) && sd.samplesPerWorker.length > 0
      ? sd.samplesPerWorker
      : samplingStep?.sampleData?.samplesPerWorker;

  const sampledPositions =
    Array.isArray(samplesPerWorkerSource) && samplesPerWorkerSource.length > 0
      ? samplesPerWorkerSource.map((entry) => entry.localIndices || [])
      : Array.isArray(sd.sampledPositions) && Array.isArray(sd.sampledPositions[0])
        ? sd.sampledPositions
        : Array.isArray(sd.sampledIndicesByWorker)
          ? sd.sampledIndicesByWorker
          : sortedChunks.map((chunk, w) => {
              if (chunk.length === 0) return [];
              const flatSampled = Array.isArray(sd.sampledPositions) ? sd.sampledPositions : null;
              const activeIndices = flatSampled || samplingStep?.activeWorkers?.[w]?.indices;
              const startOffset = chunkRanges[w]?.start ?? 0;
              if (Array.isArray(activeIndices) && activeIndices.length > 0) {
                const mapped = activeIndices
                  .map((gIdx) => gIdx - startOffset)
                  .filter((localIdx) => localIdx >= 0 && localIdx < chunk.length);
                if (mapped.length > 0) return [...new Set(mapped)].sort((a, b) => a - b);
              }
              const idxs = [];
              for (let s = 1; s < p; s++) {
                const localIdx = Math.floor((s * chunk.length) / p);
                if (localIdx >= 0 && localIdx < chunk.length && !idxs.includes(localIdx)) {
                  idxs.push(localIdx);
                }
              }
              return idxs;
            });

  const rawSamples =
    Array.isArray(sd.samples) && sd.samples.length > 0
      ? sd.samples
      : Array.isArray(samplingStep?.sampleData?.samples) && samplingStep.sampleData.samples.length > 0
        ? samplingStep.sampleData.samples
        : sampledPositions
            .flatMap((idxs, w) => idxs.map((idx) => sortedChunks[w]?.[idx]))
            .filter((v) => v !== undefined);

  const sortedSamples =
    Array.isArray(sd.gatheredSamplesSorted) && sd.gatheredSamplesSorted.length > 0
      ? sd.gatheredSamplesSorted
      : Array.isArray(sd.sortedSamples) && sd.sortedSamples.length > 0
        ? sd.sortedSamples
        : [...rawSamples].sort((a, b) => a - b);

  const splitterStep = steps?.find(
    (s) => Array.isArray(s?.sampleData?.splitters) && s.sampleData.splitters.length > 0
  );

  let splitters =
    Array.isArray(sd.splitters) && sd.splitters.length > 0
      ? sd.splitters
      : splitterStep?.sampleData?.splitters || [];

  if (splitters.length === 0 && p > 1 && sortedSamples.length > 0) {
    const computed = [];
    for (let s = 1; s < p; s++) {
      const idx = Math.floor((s * sortedSamples.length) / p);
      if (sortedSamples[idx] !== undefined) computed.push(sortedSamples[idx]);
    }
    splitters = computed;
  }

  const splitterSampleIndices =
    Array.isArray(sd.splitterSampleIndices) && sd.splitterSampleIndices.length > 0
      ? sd.splitterSampleIndices
      : Array.isArray(sd.splitterIndices) && sd.splitterIndices.length > 0
        ? sd.splitterIndices
        : (() => {
            const idxs = [];
            for (let s = 1; s < p; s++) {
              const idx = Math.floor((s * sortedSamples.length) / p);
              if (idx >= 0 && idx < sortedSamples.length && !idxs.includes(idx)) {
                idxs.push(idx);
              }
            }
            return idxs;
          })();

  const targetRanges =
    Array.isArray(sd.targetRanges) && sd.targetRanges.length > 0
      ? sd.targetRanges
      : Array.from({ length: p }, (_, w) => ({
          workerId: w,
          label: formatRangeLabel(w, splitters, p)
        }));

  const rawBefore =
    Array.isArray(sd.beforeChunks) && sd.beforeChunks.length > 0
      ? sd.beforeChunks
      : Array.isArray(sd.beforeExchange) && sd.beforeExchange.length > 0
        ? sd.beforeExchange
        : null;

  const beforeExchangeLanes = rawBefore
    ? rawBefore.map((lane, srcWorker) =>
        (Array.isArray(lane) ? lane : []).map((item) =>
          typeof item === 'object' && item !== null
            ? {
                val: item.val ?? item.value ?? 0,
                srcWorker: item.srcWorker ?? item.from ?? srcWorker,
                destWorker:
                  item.destWorker ??
                  item.dest ??
                  getDestWorker(item.val ?? item.value ?? 0, splitters)
              }
            : {
                val: item,
                srcWorker,
                destWorker: getDestWorker(item, splitters)
              }
        )
      )
    : sortedChunks.map((chunk, srcWorker) =>
        chunk.map((val) => ({
          val,
          srcWorker,
          destWorker: getDestWorker(val, splitters)
        }))
      );

  const rawMoves =
    Array.isArray(sd.exchangeFlows) && sd.exchangeFlows.length > 0
      ? sd.exchangeFlows
      : Array.isArray(sd.moves) && sd.moves.length > 0
        ? sd.moves
        : null;

  const moves = rawMoves
    ? rawMoves.map((m) => ({
        from: m.from,
        to: m.to,
        values: m.vals ?? m.values ?? []
      }))
    : (() => {
        const map = new Map();
        beforeExchangeLanes.forEach((lane, src) => {
          lane.forEach((item) => {
            if (item.destWorker !== src) {
              const key = `${src}->${item.destWorker}`;
              if (!map.has(key)) {
                map.set(key, { from: src, to: item.destWorker, values: [] });
              }
              map.get(key).values.push(item.val);
            }
          });
        });
        return Array.from(map.values());
      })();

  const receivedBlocksByWorker =
    Array.isArray(sd.receivedBlocks) && sd.receivedBlocks.length > 0
      ? sd.receivedBlocks.map((workerBlocks) =>
          (Array.isArray(workerBlocks) ? workerBlocks : []).map((b, idx) =>
            Array.isArray(b)
              ? { from: idx, values: b }
              : { from: b?.from ?? idx, values: b?.vals ?? b?.values ?? [] }
          )
        )
      : Array.from({ length: p }, (_, dst) => {
          const blocks = [];
          for (let src = 0; src < p; src++) {
            const vals = (beforeExchangeLanes[src] || [])
              .filter((item) => item.destWorker === dst)
              .map((item) => item.val)
              .sort((a, b) => a - b);
            if (vals.length > 0) {
              blocks.push({ from: src, values: vals });
            }
          }
          return blocks;
        });

  const mergedLanes =
    Array.isArray(sd.mergedChunks) && sd.mergedChunks.length > 0
      ? sd.mergedChunks
      : Array.isArray(sd.mergedLanes) && sd.mergedLanes.length > 0
        ? sd.mergedLanes
        : receivedBlocksByWorker.map((blocks) =>
            blocks.flatMap((b) => b.values).sort((a, b) => a - b)
          );

  const globalOrdered =
    Array.isArray(sd.globalArray) && sd.globalArray.length > 0
      ? sd.globalArray.map((item) =>
          typeof item === 'object' && item !== null
            ? {
                val: item.val ?? item.value ?? 0,
                workerId: item.workerId ?? item.worker ?? 0
              }
            : {
                val: item,
                workerId: getDestWorker(item, splitters)
              }
        )
      : mergedLanes.flatMap((vals, w) => vals.map((val) => ({ val, workerId: w })));

  return {
    p,
    n,
    originalArray,
    chunkRanges,
    unsortedChunks,
    sortedChunks,
    sampledPositions,
    rawSamples,
    sortedSamples,
    splitters,
    splitterSampleIndices,
    targetRanges,
    beforeExchangeLanes,
    moves,
    receivedBlocksByWorker,
    mergedLanes,
    globalOrdered
  };
}

function ForkConnector({ numWorkers }) {
  const p = Math.max(1, numWorkers);
  const width = 400;
  const height = 44;
  const centerX = width / 2;
  const targets = Array.from({ length: p }, (_, i) => ((i + 0.5) / p) * width);
  const leftX = targets[0];
  const rightX = targets[targets.length - 1];

  return (
    <div className="sample-fork-wrap" aria-hidden="true">
      <svg
        className="sample-fork-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <line
          x1={centerX}
          y1={0}
          x2={centerX}
          y2={18}
          stroke="rgba(56, 189, 248, 0.55)"
          strokeWidth={2}
        />
        {p > 1 && (
          <line
            x1={leftX}
            y1={18}
            x2={rightX}
            y2={18}
            stroke="rgba(148, 163, 184, 0.45)"
            strokeWidth={2}
          />
        )}
        {targets.map((tx, idx) => {
          const color = getWorkerColor(idx);
          return (
            <g key={idx}>
              <line
                x1={tx}
                y1={18}
                x2={tx}
                y2={height - 4}
                stroke={color}
                strokeWidth={2}
                strokeOpacity={0.8}
              />
              <circle cx={tx} cy={height - 4} r={3.5} fill={color} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const SAMPLE_VISUALIZER_STYLES = `
:where(.guided-visualizer.sample-visualizer) {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  padding: 1rem 1.15rem 1.2rem;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: var(--text-primary, #f8fafc);
}

:where(.guided-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.65rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-subtle, #1e293b);
}

:where(.guided-tabs) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
}

:where(.guided-tab) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--border-strong, #334155);
  background: var(--bg-surface-elevated, #162036);
  color: var(--text-secondary, #94a3b8);
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.16s ease;
}

:where(.guided-tab:hover) {
  border-color: #38bdf8;
  color: var(--text-primary, #f8fafc);
}

:where(.guided-tab.done) {
  border-color: rgba(52, 211, 153, 0.35);
  background: rgba(52, 211, 153, 0.08);
  color: #6ee7b7;
}

:where(.guided-tab.active) {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.18);
  color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25);
}

:where(.guided-tab-num) {
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  opacity: 0.85;
}

:where(.guided-actions) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

:where(.guided-classic-btn),
:where(.guided-focus-btn) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.68rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.73rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.16s ease;
}

:where(.guided-classic-btn) {
  border: 1px solid rgba(168, 85, 247, 0.4);
  background: rgba(168, 85, 247, 0.14);
  color: #d8b4fe;
}

:where(.guided-classic-btn:hover) {
  background: rgba(168, 85, 247, 0.24);
  border-color: #a855f7;
  color: #f3e8ff;
}

:where(.guided-focus-btn) {
  border: 1px solid var(--border-strong, #334155);
  background: var(--bg-surface-elevated, #162036);
  color: var(--text-secondary, #94a3b8);
}

:where(.guided-focus-btn:hover),
:where(.guided-focus-btn.active) {
  border-color: rgba(56, 189, 248, 0.5);
  background: rgba(56, 189, 248, 0.14);
  color: #38bdf8;
}

:where(.guided-stage-banner) {
  background: var(--bg-surface-elevated, #162036);
  border: 1px solid var(--border-subtle, #1e293b);
  border-radius: var(--radius-md, 10px);
  padding: 0.75rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

:where(.guided-stage-top) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}

:where(.guided-stage-counter) {
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  font-weight: 800;
  padding: 0.16rem 0.55rem;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.14);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.35);
}

:where(.guided-stage-title) {
  font-size: 0.96rem;
  font-weight: 800;
  color: var(--text-primary, #f8fafc);
  letter-spacing: -0.01em;
}

:where(.guided-stage-desc) {
  font-size: 0.81rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.45;
}

:where(.guided-scene) {
  background: rgba(9, 13, 22, 0.65);
  border: 1px solid var(--border-subtle, #1e293b);
  border-radius: var(--radius-md, 10px);
  padding: 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}

:where(.sample-section-block) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  min-width: 0;
}

:where(.sample-section-label) {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted, #64748b);
  text-align: center;
}

:where(.sample-array-row),
:where(.sample-global-row) {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  max-width: 100%;
}

:where(.sample-cell) {
  position: relative;
  min-width: 42px;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 1.5px solid var(--border-strong, #334155);
  background: var(--bg-surface-elevated, #162036);
  color: var(--text-primary, #f8fafc);
  font-family: var(--font-mono, monospace);
  font-size: 0.92rem;
  font-weight: 800;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.1;
  transition: transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease;
}

:where(.sample-visualizer.compact .sample-cell) {
  min-width: 32px;
  padding: 0.3rem 0.36rem;
  font-size: 0.76rem;
  border-radius: 6px;
}

:where(.sample-visualizer.focus-mode .sample-cell) {
  min-width: 52px;
  padding: 0.58rem 0.7rem;
  font-size: 1.08rem;
  border-radius: 10px;
}

:where(.sample-visualizer.focus-mode.compact .sample-cell) {
  min-width: 38px;
  padding: 0.38rem 0.44rem;
  font-size: 0.86rem;
}

:where(.sample-cell.pivot),
:where(.sample-cell.sample) {
  border-color: #f59e0b !important;
  background: rgba(245, 158, 11, 0.18) !important;
  color: #fde68a;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.22);
}

:where(.sample-cell-dot) {
  position: absolute;
  top: -6px;
  right: 4px;
  font-size: 0.85rem;
  line-height: 1;
  color: #fbbf24;
  text-shadow: 0 0 6px rgba(251, 191, 36, 0.75);
}

:where(.sample-cell-sub) {
  font-size: 0.56rem;
  font-weight: 700;
  opacity: 0.88;
  margin-top: 2px;
}

:where(.sample-fork-wrap) {
  width: min(560px, 92%);
  margin: 0 auto;
}

:where(.sample-fork-svg) {
  width: 100%;
  height: 44px;
  display: block;
}

:where(.sample-lanes) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.65rem;
  width: 100%;
  min-width: 0;
}

:where(.sample-lane) {
  background: var(--bg-surface, #0f172a);
  border: 1.5px solid var(--border-strong, #334155);
  border-radius: var(--radius-md, 10px);
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

:where(.sample-lane-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.03em;
}

:where(.sample-lane-cells) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

:where(.sample-arrow-down) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: #38bdf8;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 0.15rem 0;
}

:where(.sample-tag) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  align-self: center;
  text-align: center;
  max-width: 100%;
  flex-wrap: wrap;
  justify-content: center;
}

:where(.sample-tag.amber) {
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}

:where(.sample-tag.emerald) {
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #34d399;
}

:where(.sample-note) {
  font-size: 0.75rem;
  color: var(--text-secondary, #94a3b8);
  text-align: center;
  font-style: italic;
}

:where(.sample-exchange-flow) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm, 6px);
  border: 1px dashed rgba(56, 189, 248, 0.4);
  background: rgba(56, 189, 248, 0.06);
}

:where(.sample-flow-pill) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.24rem 0.6rem;
  border-radius: 999px;
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--bg-surface-elevated, #162036);
  border: 1px solid var(--border-strong, #334155);
  color: var(--text-primary, #f8fafc);
}

:where(.sample-blocks-meta) {
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  color: var(--text-secondary, #94a3b8);
  word-break: break-word;
}

:where(.sample-empty-pill) {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
  font-style: italic;
}

:where(.guided-summary-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
}

:where(.guided-summary-card) {
  background: var(--bg-surface-elevated, #162036);
  border: 1px solid var(--border-subtle, #1e293b);
  border-radius: var(--radius-md, 10px);
  padding: 0.75rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

:where(.guided-summary-label) {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #38bdf8;
}

:where(.guided-summary-value) {
  font-size: 0.79rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.45;
}

:where(.guided-hint-footer) {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
  text-align: center;
  padding-top: 0.2rem;
}

@media (max-width: 640px) {
  :where(.guided-visualizer.sample-visualizer) {
    padding: 0.65rem;
    gap: 0.7rem;
  }

  :where(.guided-scene) {
    padding: 0.65rem;
  }

  :where(.sample-lanes) {
    grid-template-columns: 1fr;
  }

  :where(.guided-summary-grid) {
    grid-template-columns: 1fr;
  }

  :where(.sample-cell) {
    min-width: 34px;
    padding: 0.34rem 0.42rem;
    font-size: 0.8rem;
  }

  :where(.sample-visualizer.compact .sample-cell) {
    min-width: 28px;
    padding: 0.24rem 0.28rem;
    font-size: 0.7rem;
  }
}
`;

export default function SampleSortVisualizer() {
  return null;
}
