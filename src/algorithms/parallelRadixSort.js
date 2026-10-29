/**
 * Parallel Radix Sort (Radix Sort Paralelo con Parallel Scan / Prefix Sums)
 * Modelo: PRAM CREW / SIMD / GPU
 * Trabajo T1: O(k * n)
 * Profundidad T_inf: O(k * (n/P + log P))
 * Fundamental en arquitecturas GPU (CUDA) y computación de alto rendimiento.
 */
export function generateParallelRadixSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  const arr = [...initialArray];
  const n = arr.length;
  let totalComps = 0;
  let totalSwaps = 0;
  let parallelLevel = 0;
  const p = numWorkers;
  const chunkSize = Math.ceil(n / p);

  const maxVal = Math.max(...arr, 1);
  const numDigits = Math.max(1, Math.floor(Math.log10(maxVal)) + 1);

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
    description: `Arreglo cargado con ${n} elementos. Valor máximo ${maxVal} (${numDigits} dígitos base 10). Usando ${p} hilos para conteo y escaneo paralelo.`,
    highlightCodeLine: 1,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 0,
    },
    radixData: { digitPos: 0, maxDigits: numDigits }
  });

  let exp = 1;
  for (let d = 0; d < numDigits; d++) {
    // Phase 1: Local Histograms in parallel
    parallelLevel++;
    const localHistograms = Array.from({ length: p }, () => Array(10).fill(0));
    const histWorkers = Array.from({ length: p }, (_, id) => ({
      workerId: id,
      state: 'comparing',
      indices: [],
    }));

    for (let w = 0; w < p; w++) {
      const start = w * chunkSize;
      const end = Math.min(start + chunkSize, n);
      for (let i = start; i < end; i++) {
        histWorkers[w].indices.push(i);
        const digit = Math.floor(arr[i] / exp) % 10;
        localHistograms[w][digit]++;
        totalComps++;
      }
    }

    steps.push({
      stepIndex: steps.length,
      array: [...arr],
      activeWorkers: histWorkers,
      comparisonsInStep: [],
      swapsInStep: [],
      barriers: true,
      stageName: `Dígito 10^${d}: Fase 1 - Histogramas Locales Concurrente`,
      description: `Los ${p} núcleos procesaron en paralelo su fragmento de datos, contando las frecuencias de los dígitos 0..9 para la posición 10^${d}.`,
      highlightCodeLine: 4,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores: p,
      },
      radixData: { digitPos: d, exp, histograms: localHistograms }
    });

    // Phase 2: Parallel Prefix Sum (Scan) across histogram matrix
    parallelLevel++;
    const globalCount = Array(10).fill(0);
    for (let digit = 0; digit < 10; digit++) {
      for (let w = 0; w < p; w++) {
        globalCount[digit] += localHistograms[w][digit];
      }
    }

    // Cumulative offsets
    const offsets = Array(10).fill(0);
    for (let digit = 1; digit < 10; digit++) {
      offsets[digit] = offsets[digit - 1] + globalCount[digit - 1];
    }

    // Worker local offsets
    const workerOffsets = Array.from({ length: p }, () => Array(10).fill(0));
    for (let digit = 0; digit < 10; digit++) {
      let running = offsets[digit];
      for (let w = 0; w < p; w++) {
        workerOffsets[w][digit] = running;
        running += localHistograms[w][digit];
      }
    }

    const scanWorkers = Array.from({ length: p }, (_, id) => ({
      workerId: id,
      state: 'merging',
      indices: [],
    }));

    steps.push({
      stepIndex: steps.length,
      array: [...arr],
      activeWorkers: scanWorkers,
      comparisonsInStep: [],
      swapsInStep: [],
      barriers: true,
      stageName: `Dígito 10^${d}: Fase 2 - Escaneo de Prefijos Paralelo (Parallel Scan)`,
      description: `Algoritmo de Blelloch/Hillis-Steele: se calcularon las posiciones globales de escritura sin conflicto de bus ni bloqueos atómicos.`,
      highlightCodeLine: 6,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores: p,
      },
      radixData: { digitPos: d, exp, globalCount, offsets }
    });

    // Phase 3: Parallel Scatter / Permute
    parallelLevel++;
    const output = Array(n).fill(0);
    const scatterOffsets = workerOffsets.map(o => [...o]);
    const scatterWorkers = Array.from({ length: p }, (_, id) => ({
      workerId: id,
      state: 'swapping',
      indices: [],
    }));

    for (let w = 0; w < p; w++) {
      const start = w * chunkSize;
      const end = Math.min(start + chunkSize, n);
      for (let i = start; i < end; i++) {
        const val = arr[i];
        const digit = Math.floor(val / exp) % 10;
        const targetPos = scatterOffsets[w][digit]++;
        output[targetPos] = val;
        scatterWorkers[w].indices.push(targetPos);
        totalSwaps++;
      }
    }

    // Update arr with output
    for (let i = 0; i < n; i++) arr[i] = output[i];

    steps.push({
      stepIndex: steps.length,
      array: [...arr],
      activeWorkers: scatterWorkers,
      comparisonsInStep: [],
      swapsInStep: [],
      barriers: true,
      stageName: `Dígito 10^${d}: Fase 3 - Dispersión Paralela (Parallel Scatter)`,
      description: `Dispersión concurrente a memoria compartida. Los elementos fueron reubicados según su dígito sin colisiones. Barrera de memoria ejecutada.`,
      highlightCodeLine: 8,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores: p,
      },
      radixData: { digitPos: d, exp }
    });

    exp *= 10;
  }

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
    description: `Radix Sort Paralelo completado con éxito. Algoritmo estable en O(k * (n/P + log P)) tiempo paralelo.`,
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
