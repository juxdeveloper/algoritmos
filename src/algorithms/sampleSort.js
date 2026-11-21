/**
 * Sample Sort (Ordenamiento por Muestreo Regular)
 * Modelo: Memoria Distribuida (MPI) / Multiproceso con All-to-All
 * Trabajo T1: O(n log n)
 * Profundidad T_inf: O((n/P) log(n/P) + P log P)
 * Es el estándar en supercómputo y clusters para evitar el desbalance de QuickSort paralelo.
 */

function sortChunkWithMetrics(chunk) {
  const arr = [...chunk];
  let comparisons = 0;
  let swaps = 0;

  for (let i = 1; i < arr.length; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) {
      comparisons++;
      swaps++;
      arr[j + 1] = arr[j];
      j--;
    }
    if (j >= 0) comparisons++;
    arr[j + 1] = key;
  }

  return { sorted: arr, comparisons, swaps };
}

function bucketIndexUsingSplitters(val, splitters) {
  let idx = 0;
  // Strict `<` against each splitter: values < splitters[0] go to P0,
  // [splitters[k-1], splitters[k]) to Pk, and >= splitters[p-2] to P_{p-1}.
  while (idx < splitters.length && !(val < splitters[idx])) {
    idx++;
  }
  return idx;
}

function formatRangeLabel(workerId, p, splitters) {
  if (p <= 1 || splitters.length === 0) return 'Todos';
  if (workerId === 0) return `< ${splitters[0]}`;
  if (workerId === p - 1) return `≥ ${splitters[p - 2]}`;
  return `[${splitters[workerId - 1]}, ${splitters[workerId]})`;
}

export function generateSampleSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  const original = [...initialArray];
  const n = original.length;
  const p = Math.max(1, Math.min(numWorkers, n));

  let totalComps = 0;
  let totalSwaps = 0;
  let parallelDepth = 0;

  // Balanced contiguous partitioning across p processes
  const chunkRanges = [];
  const initialChunks = [];
  const base = Math.floor(n / p);
  const rem = n % p;
  let offset = 0;

  for (let w = 0; w < p; w++) {
    const size = base + (w < rem ? 1 : 0);
    const start = offset;
    const end = start + size;
    chunkRanges.push({ workerId: w, start, end });
    initialChunks.push(original.slice(start, end));
    offset = end;
  }

  // Step 0: Reparto (distribute)
  steps.push({
    stepIndex: 0,
    array: [...original],
    activeWorkers: chunkRanges.map(({ workerId, start, end }) => ({
      workerId,
      state: 'comparing',
      indices: Array.from({ length: end - start }, (_, k) => start + k),
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: false,
    stageName: 'Paso 0: Reparto de Bloques (Distribute)',
    shortLabel: 'Reparto',
    description: `Se distribuyen los ${n} elementos en ${p} procesos MPI en bloques contiguos (${initialChunks.map((c, w) => `P${w}: ${c.length}`).join(', ')}).`,
    highlightCodeLine: 2,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: p,
    },
    sampleData: {
      phase: 'distribute',
      shortLabel: 'Reparto',
      p,
      n,
      original: [...original],
      chunkRanges: chunkRanges.map((r) => ({ ...r })),
      initialChunks: initialChunks.map((c) => [...c]),
      localSortedChunks: [],
      samplesPerWorker: [],
      samples: [],
      gatheredSamplesSorted: [],
      splitters: [],
      splitterSampleIndices: [],
      targetRanges: [],
      beforeChunks: [],
      exchangeFlows: [],
      receivedBlocks: [],
      afterChunks: [],
      bucketRanges: [],
      mergedChunks: [],
      sorted: false,
    },
  });

  // Step 1: Orden local (local_sort)
  parallelDepth++;
  const localSortedChunks = initialChunks.map((chunk) => {
    const res = sortChunkWithMetrics(chunk);
    totalComps += res.comparisons;
    totalSwaps += res.swaps;
    return res.sorted;
  });
  const localSortedArray = localSortedChunks.flat();

  steps.push({
    stepIndex: steps.length,
    array: [...localSortedArray],
    activeWorkers: chunkRanges.map(({ workerId, start, end }) => ({
      workerId,
      state: 'swapping',
      indices: Array.from({ length: end - start }, (_, k) => start + k),
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: 'Paso 1: Ordenamiento Local Independiente',
    shortLabel: 'Orden local',
    description: `Cada uno de los ${p} procesos ordena su bloque local de forma independiente sin comunicación inter-proceso.`,
    highlightCodeLine: 3,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth,
      activeCores: p,
    },
    sampleData: {
      phase: 'local_sort',
      shortLabel: 'Orden local',
      p,
      n,
      original: [...original],
      chunkRanges: chunkRanges.map((r) => ({ ...r })),
      initialChunks: initialChunks.map((c) => [...c]),
      localSortedChunks: localSortedChunks.map((c) => [...c]),
      samplesPerWorker: [],
      samples: [],
      gatheredSamplesSorted: [],
      splitters: [],
      splitterSampleIndices: [],
      targetRanges: [],
      beforeChunks: [],
      exchangeFlows: [],
      receivedBlocks: [],
      afterChunks: [],
      bucketRanges: [],
      mergedChunks: [],
      sorted: false,
    },
  });

  // Step 2: Muestreo (sampling)
  parallelDepth++;
  const samplesPerWorker = [];
  const samples = [];

  for (let w = 0; w < p; w++) {
    const chunk = localSortedChunks[w];
    const m = chunk.length;
    const chunkStart = chunkRanges[w].start;
    const s = m === 0 ? 0 : Math.min(m, Math.max(1, p === 2 ? 2 : Math.min(m, 3)));
    const localIndices = [];
    const globalIndices = [];
    const values = [];

    for (let k = 0; k < s; k++) {
      const localIdx = Math.floor((k * m) / s);
      localIndices.push(localIdx);
      globalIndices.push(chunkStart + localIdx);
      values.push(chunk[localIdx]);
      samples.push(chunk[localIdx]);
    }

    samplesPerWorker.push({
      workerId: w,
      localIndices,
      globalIndices,
      values,
      samples: localIndices.map((localIndex, idx) => ({
        localIndex,
        globalIndex: globalIndices[idx],
        value: values[idx],
      })),
    });
  }

  steps.push({
    stepIndex: steps.length,
    array: [...localSortedArray],
    activeWorkers: samplesPerWorker.map((entry) => ({
      workerId: entry.workerId,
      state: 'comparing',
      indices: [...entry.globalIndices],
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: 'Paso 2: Muestreo Regular (Regular Sampling)',
    shortLabel: 'Muestreo',
    description: `Cada proceso extrae muestras regularmente espaciadas de su bloque ordenado (${samples.length} muestras recolectadas en total).`,
    highlightCodeLine: 4,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth,
      activeCores: p,
    },
    sampleData: {
      phase: 'sampling',
      shortLabel: 'Muestreo',
      p,
      n,
      original: [...original],
      chunkRanges: chunkRanges.map((r) => ({ ...r })),
      initialChunks: initialChunks.map((c) => [...c]),
      localSortedChunks: localSortedChunks.map((c) => [...c]),
      samplesPerWorker: samplesPerWorker.map((entry) => ({
        workerId: entry.workerId,
        localIndices: [...entry.localIndices],
        globalIndices: [...entry.globalIndices],
        values: [...entry.values],
        samples: entry.samples.map((item) => ({ ...item })),
      })),
      samples: [...samples],
      gatheredSamplesSorted: [],
      splitters: [],
      splitterSampleIndices: [],
      targetRanges: [],
      beforeChunks: [],
      exchangeFlows: [],
      receivedBlocks: [],
      afterChunks: [],
      bucketRanges: [],
      mergedChunks: [],
      sorted: false,
    },
  });

  // Step 3: Pivote / Splitters (splitters)
  parallelDepth++;
  const sampleSortRes = sortChunkWithMetrics(samples);
  const gatheredSamplesSorted = sampleSortRes.sorted;
  totalComps += sampleSortRes.comparisons;
  totalSwaps += sampleSortRes.swaps;

  const splitterSampleIndices = [];
  const splitters = [];
  for (let k = 1; k < p; k++) {
    const idx = Math.floor((k * gatheredSamplesSorted.length) / p);
    splitterSampleIndices.push(idx);
    splitters.push(gatheredSamplesSorted[idx]);
  }

  const globalSortedValues = [...localSortedArray].sort((a, b) => a - b);
  const targetRanges = Array.from({ length: p }, (_, w) => ({
    workerId: w,
    label: formatRangeLabel(w, p, splitters),
    min: w === 0 || splitters.length === 0 ? null : splitters[w - 1],
    max: w === p - 1 || splitters.length === 0 ? null : splitters[w],
    minInclusive: w > 0,
    maxInclusive: false,
    values: globalSortedValues.filter((val) => bucketIndexUsingSplitters(val, splitters) === w),
  }));

  steps.push({
    stepIndex: steps.length,
    array: [...localSortedArray],
    activeWorkers: Array.from({ length: p }, (_, id) => ({
      workerId: id,
      state: id === 0 ? 'comparing' : 'idle',
      indices: [],
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: 'Paso 3: Selección de Pivotes / Splitters Globales',
    shortLabel: 'Pivote',
    description:
      splitters.length > 0
        ? `El coordinador P0 ordena las ${gatheredSamplesSorted.length} muestras y elige ${splitters.length} splitter(s) global(es): [${splitters.join(', ')}].`
        : `Con P=1 proceso no se requieren splitters globales.`,
    highlightCodeLine: 6,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth,
      activeCores: 1,
    },
    sampleData: {
      phase: 'splitters',
      shortLabel: 'Pivote',
      p,
      n,
      original: [...original],
      chunkRanges: chunkRanges.map((r) => ({ ...r })),
      initialChunks: initialChunks.map((c) => [...c]),
      localSortedChunks: localSortedChunks.map((c) => [...c]),
      samplesPerWorker: samplesPerWorker.map((entry) => ({
        workerId: entry.workerId,
        localIndices: [...entry.localIndices],
        globalIndices: [...entry.globalIndices],
        values: [...entry.values],
        samples: entry.samples.map((item) => ({ ...item })),
      })),
      samples: [...samples],
      gatheredSamplesSorted: [...gatheredSamplesSorted],
      splitters: [...splitters],
      splitterSampleIndices: [...splitterSampleIndices],
      targetRanges: targetRanges.map((r) => ({ ...r, values: [...r.values] })),
      beforeChunks: [],
      exchangeFlows: [],
      receivedBlocks: [],
      afterChunks: [],
      bucketRanges: [],
      mergedChunks: [],
      sorted: false,
    },
  });

  // Step 4: Intercambio All-to-All (exchange)
  parallelDepth++;
  const beforeChunks = Array.from({ length: p }, () => []);
  // routingMatrix[src][dest] holds sorted values sent from src to dest
  const routingMatrix = Array.from({ length: p }, () =>
    Array.from({ length: p }, () => [])
  );

  for (let src = 0; src < p; src++) {
    for (const val of localSortedChunks[src]) {
      const destOwner = bucketIndexUsingSplitters(val, splitters);
      totalComps += Math.min(destOwner + 1, splitters.length);
      beforeChunks[src].push({ val, destWorker: destOwner });
      routingMatrix[src][destOwner].push(val);
    }
  }

  const exchangeFlows = [];
  for (let src = 0; src < p; src++) {
    for (let dest = 0; dest < p; dest++) {
      if (src !== dest && routingMatrix[src][dest].length > 0) {
        exchangeFlows.push({
          from: src,
          to: dest,
          vals: [...routingMatrix[src][dest]],
        });
      }
    }
  }

  const receivedBlocks = Array.from({ length: p }, (_, dest) => {
    const blocks = [];
    for (let src = 0; src < p; src++) {
      if (routingMatrix[src][dest].length > 0) {
        blocks.push({ from: src, vals: [...routingMatrix[src][dest]] });
      }
    }
    return blocks;
  });

  const afterChunks = receivedBlocks.map((blocks) =>
    blocks.flatMap((block) => block.vals)
  );
  const exchangedArray = afterChunks.flat();
  totalSwaps += exchangedArray.length;

  const bucketRanges = [];
  let bucketOffset = 0;
  for (let dest = 0; dest < p; dest++) {
    const start = bucketOffset;
    const end = start + afterChunks[dest].length;
    bucketRanges.push({ workerId: dest, start, end });
    bucketOffset = end;
  }

  steps.push({
    stepIndex: steps.length,
    array: [...exchangedArray],
    activeWorkers: bucketRanges.map(({ workerId, start, end }) => ({
      workerId,
      state: 'merging',
      indices: Array.from({ length: end - start }, (_, k) => start + k),
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: 'Paso 4: Intercambio All-to-All',
    shortLabel: 'Intercambio',
    description: `Comunicación MPI_Alltoall: cada proceso envía sus sub-bloques clasificados según los splitters al proceso destino correspondiente.`,
    highlightCodeLine: 8,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth,
      activeCores: p,
    },
    sampleData: {
      phase: 'exchange',
      shortLabel: 'Intercambio',
      p,
      n,
      original: [...original],
      chunkRanges: chunkRanges.map((r) => ({ ...r })),
      initialChunks: initialChunks.map((c) => [...c]),
      localSortedChunks: localSortedChunks.map((c) => [...c]),
      samplesPerWorker: samplesPerWorker.map((entry) => ({
        workerId: entry.workerId,
        localIndices: [...entry.localIndices],
        globalIndices: [...entry.globalIndices],
        values: [...entry.values],
        samples: entry.samples.map((item) => ({ ...item })),
      })),
      samples: [...samples],
      gatheredSamplesSorted: [...gatheredSamplesSorted],
      splitters: [...splitters],
      splitterSampleIndices: [...splitterSampleIndices],
      targetRanges: targetRanges.map((r) => ({ ...r, values: [...r.values] })),
      beforeChunks: beforeChunks.map((chunk) => chunk.map((item) => ({ ...item }))),
      exchangeFlows: exchangeFlows.map((f) => ({ ...f, vals: [...f.vals] })),
      receivedBlocks: receivedBlocks.map((blocks) =>
        blocks.map((b) => ({ from: b.from, vals: [...b.vals] }))
      ),
      afterChunks: afterChunks.map((c) => [...c]),
      bucketRanges: bucketRanges.map((r) => ({ ...r })),
      mergedChunks: [],
      sorted: false,
    },
  });

  // Step 5: Fusión Final (merge)
  parallelDepth++;
  const mergedChunks = afterChunks.map((chunk) => {
    const res = sortChunkWithMetrics(chunk);
    totalComps += res.comparisons;
    totalSwaps += res.swaps;
    return res.sorted;
  });
  const finalSortedArray = mergedChunks.flat();

  steps.push({
    stepIndex: steps.length,
    array: [...finalSortedArray],
    activeWorkers: bucketRanges.map(({ workerId, start, end }) => ({
      workerId,
      state: 'merging',
      indices: Array.from({ length: end - start }, (_, k) => start + k),
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: false,
    stageName: 'Paso 5: Fusión Local Final (Completado)',
    shortLabel: 'Fusión',
    description: `Cada proceso fusiona localmente los sub-bloques ordenados recibidos. La concatenación P0..P${p - 1} produce el arreglo global ordenado.`,
    highlightCodeLine: 10,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth,
      activeCores: p,
    },
    sampleData: {
      phase: 'merge',
      shortLabel: 'Fusión',
      p,
      n,
      original: [...original],
      chunkRanges: chunkRanges.map((r) => ({ ...r })),
      initialChunks: initialChunks.map((c) => [...c]),
      localSortedChunks: localSortedChunks.map((c) => [...c]),
      samplesPerWorker: samplesPerWorker.map((entry) => ({
        workerId: entry.workerId,
        localIndices: [...entry.localIndices],
        globalIndices: [...entry.globalIndices],
        values: [...entry.values],
        samples: entry.samples.map((item) => ({ ...item })),
      })),
      samples: [...samples],
      gatheredSamplesSorted: [...gatheredSamplesSorted],
      splitters: [...splitters],
      splitterSampleIndices: [...splitterSampleIndices],
      targetRanges: targetRanges.map((r) => ({ ...r, values: [...r.values] })),
      beforeChunks: beforeChunks.map((chunk) => chunk.map((item) => ({ ...item }))),
      exchangeFlows: exchangeFlows.map((f) => ({ ...f, vals: [...f.vals] })),
      receivedBlocks: receivedBlocks.map((blocks) =>
        blocks.map((b) => ({ from: b.from, vals: [...b.vals] }))
      ),
      afterChunks: afterChunks.map((c) => [...c]),
      bucketRanges: bucketRanges.map((r) => ({ ...r })),
      mergedChunks: mergedChunks.map((c) => [...c]),
      sorted: true,
    },
  });

  return steps;
}
