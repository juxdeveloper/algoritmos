/**
 * Bitonic Sort (Red de Ordenamiento de Batcher)
 * Modelo: Redes de Comparadores / PRAM EREW
 * Trabajo T1: O(n log^2 n)
 * Profundidad T_inf: O(log^2 n)
 * Con N=16: 10 etapas paralelas
 */
function buildStageExplanation(k, d, n, swapCount) {
  if (k === 2 && d === 1) {
    return 'Parejas de 2: alternamos subida (↑) y bajada (↓) para armar las primeras mini-montañas bitónicas.';
  }
  if (k === n && d === Math.floor(n / 2)) {
    return `Bloque completo de ${n} (↑): salto mitad d = ${d}, comparamos la mitad izquierda contra la mitad derecha.`;
  }
  if (k === n && d === 1) {
    return `Bloque completo de ${n} (↑): salto final d = 1, último ajuste de vecinos para dejar todo ordenado.`;
  }
  if (d === Math.floor(k / 2)) {
    return `Bloques de ${k} (salto mitad d = ${d}): cruzamos mitades para formar bloques que suben (↑) y bajan (↓).`;
  }
  if (d === 1) {
    return `Mismos bloques de ${k} (salto vecinos d = 1): ajustamos parejas adyacentes para consolidar bloques más grandes.`;
  }
  return `Bloques de ${k} (salto d = ${d}): acercamos cada valor a su mitad correspondiente (${swapCount} intercambios).`;
}

export function generateBitonicSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  const original = [...initialArray];
  const arr = [...initialArray];
  const n = arr.length;
  const totalStages = Math.round((Math.log2(n) * (Math.log2(n) + 1)) / 2);
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
    networkStage: { stageIndex: 0, totalStages },
    bitonicData: {
      phase: 'initial',
      k: 2,
      d: 1,
      stageIndex: 0,
      totalStages,
      original,
      before: [...arr],
      after: [...arr],
      explanation: `Arreglo original de ${n} elementos listo. Avanza al Paso 1 para empezar con bloques de tamaño k = 2 y salto d = 1.`,
      comparisons: [],
      isFinalStage: false
    }
  });

  // Stages k = 2, 4, 8, ... n
  for (let k = 2; k <= n; k *= 2) {
    for (let j = Math.floor(k / 2); j > 0; j = Math.floor(j / 2)) {
      stageCounter++;
      const compsThisStep = [];
      const swapsThisStep = [];
      const detailedComparisons = [];
      const workerAssignments = Array.from({ length: numWorkers }, (_, id) => ({
        workerId: id,
        state: 'comparing',
        indices: [],
      }));

      const beforeArr = [...arr];
      let compIdx = 0;
      for (let i = 0; i < n; i++) {
        const l = i ^ j;
        if (l > i) {
          const ascending = (i & k) === 0;
          compsThisStep.push([i, l]);
          totalComps++;

          const pairIdx = compIdx;
          const assignedWorker = pairIdx % numWorkers;
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

          detailedComparisons.push({
            pairIdx,
            workerId: assignedWorker,
            i,
            j: l,
            dir: ascending ? 'asc' : 'desc',
            valI: beforeArr[i],
            valJ: beforeArr[l],
            newI: arr[i],
            newJ: arr[l],
            swapped: shouldSwap
          });
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
          totalStages
        },
        bitonicData: {
          phase: 'stage',
          k,
          d: j,
          stageIndex: stageCounter,
          totalStages,
          original,
          before: beforeArr,
          after: [...arr],
          explanation: buildStageExplanation(k, j, n, swapsThisStep.length),
          comparisons: detailedComparisons,
          isFinalStage: k === n
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
    networkStage: { stageIndex: stageCounter, totalStages: stageCounter },
    bitonicData: {
      phase: 'completed',
      k: n,
      d: 1,
      stageIndex: stageCounter,
      totalStages: stageCounter,
      original,
      before: [...arr],
      after: [...arr],
      explanation: `¡Ordenamiento completo! En ${stageCounter} etapas paralelas la red de Batcher dejó los ${n} elementos ordenados ascendentemente (↑).`,
      comparisons: [],
      isFinalStage: true
    }
  });

  return steps;
}
