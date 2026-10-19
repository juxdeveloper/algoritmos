/**
 * Sample Sort (Ordenamiento por Muestreo)
 * Modelo: Memoria Distribuida (MPI) / Multiproceso con All-to-All
 * Trabajo T1: O(n log n)
 * Profundidad T_inf: O((n/P) log(n/P) + P log P)
 * Es el estándar en supercómputo y clusters para evitar el desbalance de QuickSort paralelo.
 */
export function generateSampleSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  const arr = [...initialArray];
  const n = arr.length;
  let totalComps = 0;
  let totalSwaps = 0;
  let parallelLevel = 0;
  const p = numWorkers;
  const chunkSize = Math.ceil(n / p);

  // Step 0: Initial state
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
    description: `Arreglo cargado con ${n} elementos. Iniciando Sample Sort para ${p} procesadores distribuidos.`,
    highlightCodeLine: 1,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 0,
    },
    sampleData: { phase: 'initial', splitters: [], buckets: [] }
  });

  // Phase 1: Local Sort of p partitions
  parallelLevel++;
  const phase1Workers = Array.from({ length: p }, (_, id) => ({
    workerId: id,
    state: 'comparing',
    indices: [],
  }));

  for (let w = 0; w < p; w++) {
    const start = w * chunkSize;
    const end = Math.min(start + chunkSize, n);
    for (let i = start; i < end; i++) phase1Workers[w].indices.push(i);

    // Simple local sort
    for (let i = start + 1; i < end; i++) {
      const key = arr[i];
      let j = i - 1;
      while (j >= start && arr[j] > key) {
        totalComps++;
        totalSwaps++;
        arr[j + 1] = arr[j];
        j--;
      }
      if (j >= start) totalComps++;
      arr[j + 1] = key;
    }
  }

  phase1Workers.forEach(w => { if (w.indices.length > 0) w.state = 'swapping'; });

  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: phase1Workers,
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: 'Fase 1: Ordenamiento Local Independiente',
    description: `Los ${p} procesadores ordenaron localmente sus bloques de datos en paralelo. No hay comunicación inter-procesos aún.`,
    highlightCodeLine: 3,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: p,
    },
    sampleData: { phase: 'local_sorted', splitters: [], buckets: [] }
  });

  // Phase 2: Regular Sampling
  parallelLevel++;
  const samples = [];
  const sampleIndices = [];
  for (let w = 0; w < p; w++) {
    const start = w * chunkSize;
    const end = Math.min(start + chunkSize, n);
    const count = end - start;
    if (count > 0) {
      for (let s = 1; s < p; s++) {
        const idx = start + Math.floor((s * count) / p);
        if (idx < end) {
          samples.push(arr[idx]);
          sampleIndices.push(idx);
        }
      }
    }
  }
  totalComps += samples.length;

  const sampleWorkers = Array.from({ length: p }, (_, id) => ({
    workerId: id,
    state: 'comparing',
    indices: sampleIndices.filter(idx => idx >= id * chunkSize && idx < Math.min((id + 1) * chunkSize, n)),
  }));

  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: sampleWorkers,
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: 'Fase 2: Muestreo Regular (Regular Sampling)',
    description: `Cada worker extrajo ${p - 1} muestras representativas de su bloque ordenado (${samples.length} muestras totales recolectadas).`,
    highlightCodeLine: 5,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: p,
    },
    sampleData: { phase: 'sampling', samples, splitters: [] }
  });

  // Phase 3: Global Splitters selection
  parallelLevel++;
  samples.sort((a, b) => a - b);
  totalComps += Math.round(samples.length * Math.log2(samples.length || 1));

  const splitters = [];
  for (let s = 1; s < p; s++) {
    const idx = Math.floor((s * samples.length) / p);
    if (samples[idx] !== undefined) splitters.push(samples[idx]);
  }

  const splitterWorkers = Array.from({ length: p }, (_, id) => ({
    workerId: id,
    state: id === 0 ? 'comparing' : 'idle',
    indices: [],
  }));

  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: splitterWorkers,
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: 'Fase 3: Cálculo de Separadores Globales (Splitters)',
    description: `El nodo coordinador ordenó las muestras y definió los separadores globales: [${splitters.join(', ')}]. Se transmiten a todos los nodos (Broadcast).`,
    highlightCodeLine: 7,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: 1,
    },
    sampleData: { phase: 'splitters', splitters }
  });

  // Phase 4: All-to-all Bucketing and Redistribution
  parallelLevel++;
  const buckets = Array.from({ length: p }, () => []);

  for (let i = 0; i < n; i++) {
    const val = arr[i];
    let bucketIdx = 0;
    while (bucketIdx < splitters.length && val > splitters[bucketIdx]) {
      totalComps++;
      bucketIdx++;
    }
    buckets[bucketIdx].push(val);
  }

  // Flatten rearranged array
  let flatIdx = 0;
  const bucketRanges = [];
  for (let b = 0; b < p; b++) {
    const bStart = flatIdx;
    for (let k = 0; k < buckets[b].length; k++) {
      arr[flatIdx++] = buckets[b][k];
      totalSwaps++;
    }
    bucketRanges.push({ workerId: b, start: bStart, end: flatIdx });
  }

  const exchangeWorkers = Array.from({ length: p }, (_, id) => ({
    workerId: id,
    state: 'merging',
    indices: Array.from(
      { length: (bucketRanges[id]?.end || 0) - (bucketRanges[id]?.start || 0) },
      (_, k) => (bucketRanges[id]?.start || 0) + k
    ),
  }));

  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: exchangeWorkers,
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: 'Fase 4: Redistribución Total (All-to-All Exchange)',
    description: `Intercambio de datos por red: cada worker envía sus elementos al nodo correspondiente según los splitters. Ahora worker i solo tiene elementos del rango [S_{i-1}, S_i].`,
    highlightCodeLine: 9,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: p,
    },
    sampleData: { phase: 'exchange', splitters, bucketRanges }
  });

  // Phase 5: Final Local Sort
  parallelLevel++;
  for (let b = 0; b < p; b++) {
    const range = bucketRanges[b];
    if (!range || range.end - range.start <= 1) continue;
    const bStart = range.start;
    const bEnd = range.end;

    for (let i = bStart + 1; i < bEnd; i++) {
      const key = arr[i];
      let j = i - 1;
      while (j >= bStart && arr[j] > key) {
        totalComps++;
        totalSwaps++;
        arr[j + 1] = arr[j];
        j--;
      }
      if (j >= bStart) totalComps++;
      arr[j + 1] = key;
    }
  }

  const finalSortWorkers = Array.from({ length: p }, (_, id) => ({
    workerId: id,
    state: 'swapping',
    indices: Array.from(
      { length: (bucketRanges[id]?.end || 0) - (bucketRanges[id]?.start || 0) },
      (_, k) => (bucketRanges[id]?.start || 0) + k
    ),
  }));

  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: finalSortWorkers,
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: true,
    stageName: 'Fase 5: Ordenamiento Local Final en Paralelo',
    description: `Cada worker ordena concurrentemente los elementos recibidos en su cubeta. Al finalizar, la concatenación directa de cubetas produce el arreglo global ordenado sin colisiones.`,
    highlightCodeLine: 11,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: p,
    },
    sampleData: { phase: 'completed', splitters, bucketRanges }
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
    description: `Sample Sort finalizado con balance de carga ideal. Se evitó la degradación por desbalance de datos sesgados.`,
    highlightCodeLine: 13,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: 0,
    },
  });

  return steps;
}
