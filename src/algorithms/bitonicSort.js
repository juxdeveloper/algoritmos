/**
 * Bitonic Sort (Red de Ordenamiento de Batcher)
 * Modelo: Redes de Comparadores / PRAM EREW
 * Trabajo T1: O(n log^2 n)
 * Profundidad T_inf: O(log^2 n)
 * Con N=16: 10 etapas paralelas
 */
export function generateBitonicSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  const arr = [...initialArray];
  const n = arr.length;
  let totalComps = 0;
  let totalSwaps = 0;
  let stageCounter = 0;

  // Initial snapshot
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
    description: `Arreglo cargado con ${n} elementos. Preparando red de Batcher para ${numWorkers} núcleos de procesamiento.`,
    highlightCodeLine: 1,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 0,
    },
    networkStage: { stageIndex: 0, totalStages: Math.round((Math.log2(n) * (Math.log2(n) + 1)) / 2) }
  });

  // Stages k = 2, 4, 8, ... n
  for (let k = 2; k <= n; k *= 2) {
    for (let j = Math.floor(k / 2); j > 0; j = Math.floor(j / 2)) {
      stageCounter++;
      const compsThisStep = [];
      const swapsThisStep = [];
      const workerAssignments = Array.from({ length: numWorkers }, (_, id) => ({
        workerId: id,
        state: 'comparing',
        indices: [],
      }));

      let compIdx = 0;
      for (let i = 0; i < n; i++) {
        const l = i ^ j;
        if (l > i) {
          const ascending = (i & k) === 0;
          compsThisStep.push([i, l]);
          totalComps++;

          const assignedWorker = compIdx % numWorkers;
          workerAssignments[assignedWorker].indices.push(i, l);
          compIdx++;

          const shouldSwap = ascending ? arr[i] > arr[l] : arr[i] < arr[l];
          if (shouldSwap) {
            swapsThisStep.push([i, l]);
            const temp = arr[i];
            arr[i] = arr[l];
            arr[l] = temp;
            totalSwaps++;
          }
        }
      }

      // Mark workers that swapped
      workerAssignments.forEach(w => {
        if (w.indices.length === 0) {
          w.state = 'idle';
        } else {
          const hasSwap = swapsThisStep.some(([a, b]) => w.indices.includes(a) || w.indices.includes(b));
          w.state = hasSwap ? 'swapping' : 'comparing';
        }
      });

      steps.push({
        stepIndex: steps.length,
        array: [...arr],
        activeWorkers: workerAssignments,
        comparisonsInStep: compsThisStep,
        swapsInStep: swapsThisStep,
        barriers: true,
        stageName: `Fase k=${k}, Sub-etapa j=${j} (Etapa Paralela ${stageCounter})`,
        description: `Comparación paralela simultánea en ${compsThisStep.length} pares con salto j=${j}. Se realizaron ${swapsThisStep.length} intercambios coordinados. Barrera de sincronización activa.`,
        highlightCodeLine: 6,
        metrics: {
          totalComparisons: totalComps,
          totalSwaps: totalSwaps,
          parallelDepth: stageCounter,
          activeCores: workerAssignments.filter(w => w.state !== 'idle').length,
        },
        networkStage: {
          k,
          j,
          stageIndex: stageCounter,
          totalStages: Math.round((Math.log2(n) * (Math.log2(n) + 1)) / 2)
        }
      });
    }
  }

  // Final sorted state
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
    description: `Red Bitónica finalizada en ${stageCounter} pasos paralelos (profundidad O(log² n)). Todos los elementos están en orden ascendente garantizado por la red de Batcher.`,
    highlightCodeLine: 12,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: stageCounter,
      activeCores: 0,
    },
    networkStage: { stageIndex: stageCounter, totalStages: stageCounter }
  });

  return steps;
}
