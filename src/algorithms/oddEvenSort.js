/**
 * Odd-Even Transposition Sort (Ordenamiento Par-Impar)
 * Modelo: Arreglo Sistólico 1D / PRAM EREW
 * Trabajo T1: O(n^2)
 * Profundidad T_inf: O(n) etapas paralelas con n procesadores
 */
export function generateOddEvenSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  const arr = [...initialArray];
  const n = arr.length;
  let totalComps = 0;
  let totalSwaps = 0;
  let isSorted = false;
  let phase = 0;

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
    description: `Arreglo cargado con ${n} elementos. Iniciando ordenamiento por transposición par-impar sobre ${numWorkers} núcleos.`,
    highlightCodeLine: 1,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 0,
    },
  });

  while (!isSorted && phase < n + 2) {
    isSorted = true;
    const isEvenPhase = phase % 2 === 0;
    const startIndex = isEvenPhase ? 0 : 1;
    const compsThisStep = [];
    const swapsThisStep = [];
    const workerAssignments = Array.from({ length: numWorkers }, (_, id) => ({
      workerId: id,
      state: 'comparing',
      indices: [],
    }));

    let compIdx = 0;
    for (let i = startIndex; i < n - 1; i += 2) {
      compsThisStep.push([i, i + 1]);
      totalComps++;

      const assignedWorker = compIdx % numWorkers;
      workerAssignments[assignedWorker].indices.push(i, i + 1);
      compIdx++;

      if (arr[i] > arr[i + 1]) {
        swapsThisStep.push([i, i + 1]);
        const temp = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = temp;
        totalSwaps++;
        isSorted = false;
      }
    }

    workerAssignments.forEach(w => {
      if (w.indices.length === 0) {
        w.state = 'idle';
      } else {
        const hasSwap = swapsThisStep.some(([a, b]) => w.indices.includes(a) || w.indices.includes(b));
        w.state = hasSwap ? 'swapping' : 'comparing';
      }
    });

    phase++;

    steps.push({
      stepIndex: steps.length,
      array: [...arr],
      activeWorkers: workerAssignments,
      comparisonsInStep: compsThisStep,
      swapsInStep: swapsThisStep,
      barriers: true,
      stageName: isEvenPhase ? `Fase Par (Paso Paralelo ${phase})` : `Fase Impar (Paso Paralelo ${phase})`,
      description: isEvenPhase
        ? `Comparadores en posiciones pares (0-1, 2-3, ...) comparan en paralelo. ${swapsThisStep.length} intercambios locales.`
        : `Comparadores en posiciones impares (1-2, 3-4, ...) comparan en paralelo cruzando límites locales. ${swapsThisStep.length} intercambios locales.`,
      highlightCodeLine: isEvenPhase ? 4 : 8,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: phase,
        activeCores: workerAssignments.filter(w => w.state !== 'idle').length,
      },
      oddEvenPhase: { isEven: isEvenPhase, phaseNumber: phase }
    });
  }

  // Final step
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
    description: `El arreglo convergió y está totalmente ordenado tras ${phase} rondas paralelas de transposición. Concurrencia par-impar sin colisiones.`,
    highlightCodeLine: 12,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: phase,
      activeCores: 0,
    },
  });

  return steps;
}
