/**
 * Parallel Bucket Sort (Ordenamiento por Cubetas Paralelo)
 * Modelo: PRAM CREW / Memoria Compartida
 * Trabajo T1: O(n + k) caso promedio; O(n^2) peor caso
 * Profundidad T_inf: O(n/P + log P)
 */
export function generateParallelBucketSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  const arr = [...initialArray];
  const n = arr.length;
  let totalComps = 0;
  let totalSwaps = 0;
  let parallelLevel = 0;
  const p = numWorkers;

  const minVal = Math.min(...arr);
  const maxVal = Math.max(...arr);
  const range = maxVal - minVal + 1;

  // Initial step
  steps.push({
    stepIndex: 0,
    array: [...arr],
    activeWorkers: Array.from({ length: p }, (_, id) => ({
      workerId: id,
      state: 'idle',
      indices: [],
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: false,
    stageName: 'Estado Inicial',
    description: `Arreglo cargado con ${n} elementos. Rango de valores [${minVal} .. ${maxVal}]. Distribuyendo en ${p} cubetas paralelas.`,
    highlightCodeLine: 1,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 0,
    },
    bucketData: { phase: 'init', buckets: [] }
  });

  // Phase 1: Parallel Scatter into p buckets
  parallelLevel++;
  const buckets = Array.from({ length: p }, () => []);
  const scatterWorkers = Array.from({ length: p }, (_, id) => ({
    workerId: id,
    state: 'partitioning',
    indices: [],
  }));

  const chunkSize = Math.ceil(n / p);
  for (let w = 0; w < p; w++) {
    const start = w * chunkSize;
    const end = Math.min(start + chunkSize, n);
    for (let i = start; i < end; i++) {
      scatterWorkers[w].indices.push(i);
      const val = arr[i];
      let bIdx = Math.floor(((val - minVal) / range) * p);
      if (bIdx >= p) bIdx = p - 1;
      buckets[bIdx].push(val);
      totalComps++;
    }
  }

  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: scatterWorkers,
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: `Fase 1: Dispersión Concurrente en ${p} Cubetas`,
    description: `Cada hilo clasificó sus elementos en los intervalos de cubeta correspondientes sin colisiones en memoria local.`,
    highlightCodeLine: 4,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: p,
    },
    bucketData: { phase: 'scattered', buckets: buckets.map((b, idx) => ({ id: idx, items: [...b] })) }
  });

  // Phase 2: Parallel Local Sort of each bucket
  parallelLevel++;
  const sortWorkers = Array.from({ length: p }, (_, id) => ({
    workerId: id,
    state: 'comparing',
    indices: [],
  }));

  for (let b = 0; b < p; b++) {
    buckets[b].sort((x, y) => x - y);
    totalComps += Math.round(buckets[b].length * Math.log2(buckets[b].length || 1));
  }

  // Flatten back into arr
  let ptr = 0;
  const bucketIntervals = [];
  for (let b = 0; b < p; b++) {
    const bStart = ptr;
    for (let k = 0; k < buckets[b].length; k++) {
      if (arr[ptr] !== buckets[b][k]) {
        totalSwaps++;
        arr[ptr] = buckets[b][k];
      }
      sortWorkers[b].indices.push(ptr);
      ptr++;
    }
    bucketIntervals.push({ bucketId: b, start: bStart, end: ptr });
  }

  sortWorkers.forEach(w => { if (w.indices.length > 0) w.state = 'swapping'; });

  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: sortWorkers,
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: `Fase 2: Ordenamiento Interno de Cubetas en Paralelo`,
    description: `Los ${p} hilos ordenaron sus cubetas asignadas independientemente y las escribieron de vuelta en el búfer global contiguo.`,
    highlightCodeLine: 8,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: p,
    },
    bucketData: { phase: 'sorted', buckets: buckets.map((b, idx) => ({ id: idx, items: [...b] })), bucketIntervals }
  });

  // Completed
  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: Array.from({ length: p }, (_, id) => ({
      workerId: id,
      state: 'idle',
      indices: [],
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: false,
    stageName: 'Ordenamiento Completado',
    description: `Bucket Sort Paralelo finalizado. Rendimiento lineal O(n/p) en datos uniformemente distribuidos.`,
    highlightCodeLine: 12,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: 0,
    },
  });

  return steps;
}
