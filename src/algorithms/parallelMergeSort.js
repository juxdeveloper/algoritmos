/**
 * Parallel MergeSort (MergeSort Paralelo con Árbol de Reducción)
 * Modelo: Fork-Join / PRAM CREW / Reducción Binaria
 * Trabajo T1: O(n log n)
 * Profundidad T_inf: O(log^3 n) con mezcla paralela; O(n/P + log n) con mezcla serial por niveles
 */
export function generateParallelMergeSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  const arr = [...initialArray];
  const n = arr.length;
  let totalComps = 0;
  let totalSwaps = 0;
  let parallelLevel = 0;

  // Initial step
  steps.push({
    stepIndex: 0,
    array: [...arr],
    activeWorkers: Array.from({ length: numWorkers }, (_, id) => ({
      workerId: id,
      state: 'idle',
      indices: [],
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: false,
    stageName: 'Estado Inicial',
    description: `Arreglo cargado con ${n} elementos. Dividiendo en ${numWorkers} bloques contiguos para ordenamiento local concurrente.`,
    highlightCodeLine: 1,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 0,
    },
  });

  // Step 1: Local sorting of P chunks in parallel
  parallelLevel++;
  const chunkSize = Math.ceil(n / numWorkers);
  const workerAssignments = Array.from({ length: numWorkers }, (_, id) => ({
    workerId: id,
    state: 'comparing',
    indices: [],
  }));

  const localComps = [];
  const localSwaps = [];

  for (let w = 0; w < numWorkers; w++) {
    const start = w * chunkSize;
    const end = Math.min(start + chunkSize, n);
    if (start >= n) continue;

    for (let i = start; i < end; i++) {
      workerAssignments[w].indices.push(i);
    }

    // Local sort using insertion or quicksort
    for (let i = start + 1; i < end; i++) {
      const key = arr[i];
      let j = i - 1;
      while (j >= start && arr[j] > key) {
        localComps.push([j, j + 1]);
        localSwaps.push([j, j + 1]);
        totalComps++;
        totalSwaps++;
        arr[j + 1] = arr[j];
        j--;
      }
      if (j >= start) {
        localComps.push([j, i]);
        totalComps++;
      }
      arr[j + 1] = key;
    }
  }

  workerAssignments.forEach(w => {
    if (w.indices.length > 0) w.state = 'swapping';
  });

  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: workerAssignments,
    comparisonsInStep: localComps.slice(0, 8),
    swapsInStep: localSwaps.slice(0, 8),
    barriers: true,
    stageName: `Fase 1: Ordenamiento Local Concurrente (${numWorkers} Cores)`,
    description: `Cada núcleo ordenó su sub-arreglo de tamaño ~${chunkSize} de manera 100% independiente en su propia memoria caché, sin contención de bus.`,
    highlightCodeLine: 3,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: numWorkers,
    },
    mergeChunks: Array.from({ length: numWorkers }, (_, i) => ({
      start: i * chunkSize,
      end: Math.min((i + 1) * chunkSize, n)
    }))
  });

  // Step 2: Binary Merge Tree (Tree reduction across cores)
  let currentBlockSize = chunkSize;
  while (currentBlockSize < n) {
    parallelLevel++;
    const mergeComps = [];
    const mergeSwaps = [];
    const treeAssignments = Array.from({ length: numWorkers }, (_, id) => ({
      workerId: id,
      state: 'idle',
      indices: [],
    }));

    let activeMergers = 0;
    for (let i = 0; i < n; i += 2 * currentBlockSize) {
      const leftStart = i;
      const leftEnd = Math.min(i + currentBlockSize, n);
      const rightEnd = Math.min(i + 2 * currentBlockSize, n);

      if (leftEnd >= rightEnd) continue;

      const workerId = activeMergers % numWorkers;
      activeMergers++;
      treeAssignments[workerId].state = 'merging';

      // Merge left [leftStart..leftEnd-1] with right [leftEnd..rightEnd-1]
      const merged = [];
      let p1 = leftStart;
      let p2 = leftEnd;

      for (let idx = leftStart; idx < rightEnd; idx++) {
        treeAssignments[workerId].indices.push(idx);
      }

      while (p1 < leftEnd && p2 < rightEnd) {
        mergeComps.push([p1, p2]);
        totalComps++;
        if (arr[p1] <= arr[p2]) {
          merged.push(arr[p1++]);
        } else {
          merged.push(arr[p2++]);
        }
      }
      while (p1 < leftEnd) merged.push(arr[p1++]);
      while (p2 < rightEnd) merged.push(arr[p2++]);

      for (let k = 0; k < merged.length; k++) {
        if (arr[leftStart + k] !== merged[k]) {
          mergeSwaps.push([leftStart + k, leftStart + k]);
          totalSwaps++;
          arr[leftStart + k] = merged[k];
        }
      }
    }

    steps.push({
      stepIndex: steps.length,
      array: [...arr],
      activeWorkers: treeAssignments,
      comparisonsInStep: mergeComps.slice(0, 10),
      swapsInStep: mergeSwaps.slice(0, 10),
      barriers: true,
      stageName: `Árbol de Mezcla: Fusión de Bloques de Tamaño ${currentBlockSize * 2}`,
      description: `${activeMergers} mezclas ejecutadas en paralelo por núcleos designados. Se sincronizan en barrera de memoria antes del siguiente nivel del árbol.`,
      highlightCodeLine: 7,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores: activeMergers,
      },
      mergeChunks: Array.from({ length: Math.ceil(n / (2 * currentBlockSize)) }, (_, i) => ({
        start: i * 2 * currentBlockSize,
        end: Math.min((i + 1) * 2 * currentBlockSize, n)
      }))
    });

    currentBlockSize *= 2;
  }

  // Final sorted step
  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: Array.from({ length: numWorkers }, (_, id) => ({
      workerId: id,
      state: 'idle',
      indices: [],
    })),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: false,
    stageName: 'Ordenamiento Completado',
    description: `Árbol de reducción completado. El arreglo global está totalmente unificado y ordenado en tiempo paralelo óptimo O(n/p + log n).`,
    highlightCodeLine: 11,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: 0,
    },
  });

  return steps;
}
