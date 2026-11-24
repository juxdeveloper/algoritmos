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

export default function SampleSortVisualizer() {
  return null;
}
