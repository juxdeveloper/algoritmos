/**
 * Parallel QuickSort (Quicksort Paralelo con ProcessPool / Hilos)
 * Modelo: PRAM CREW / Fork-Join / Memoria Compartida
 * Trabajo T1: O(n log n)
 * Profundidad T_inf: O(log^2 n) con partición paralela; O(n) con partición serial
 */
export function generateParallelQuickSortSteps(initialArray, numWorkers = 4) {
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
    description: `Arreglo cargado con ${n} elementos. Preparando QuickSort paralelo con particionado y asignación dinámica a ${numWorkers} workers.`,
    highlightCodeLine: 1,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 0,
    },
    treeNodes: [{ id: 'root', range: [0, n - 1], depth: 0, workerId: 0, status: 'pending' }]
  });

  // Track sub-problems to process in parallel rounds
  let currentTasks = [{ low: 0, high: n - 1, id: 'root', depth: 0 }];

  while (currentTasks.length > 0) {
    parallelLevel++;
    const nextTasks = [];
    const compsThisStep = [];
    const swapsThisStep = [];
    const workerAssignments = Array.from({ length: numWorkers }, (_, id) => ({
      workerId: id,
      state: 'idle',
      indices: [],
    }));

    // Assign tasks to available workers
    currentTasks.forEach((task, idx) => {
      const workerId = idx % numWorkers;
      const { low, high } = task;

      if (low < high) {
        workerAssignments[workerId].state = 'partitioning';

        // Select pivot: median or end
        const pivotVal = arr[high];
        let i = low - 1;

        for (let j = low; j < high; j++) {
          compsThisStep.push([j, high]);
          totalComps++;
          workerAssignments[workerId].indices.push(j);

          if (arr[j] <= pivotVal) {
            i++;
            if (i !== j) {
              swapsThisStep.push([i, j]);
              const temp = arr[i];
              arr[i] = arr[j];
              arr[j] = temp;
              totalSwaps++;
            }
          }
        }

        // Place pivot in its final position
        i++;
        if (i !== high) {
          swapsThisStep.push([i, high]);
          const temp = arr[i];
          arr[i] = arr[high];
          arr[high] = temp;
          totalSwaps++;
        }

        const pivotIndex = i;
        workerAssignments[workerId].indices.push(pivotIndex);

        if (pivotIndex - 1 > low) {
          nextTasks.push({ low, high: pivotIndex - 1, id: `${task.id}-L`, depth: task.depth + 1 });
        }
        if (pivotIndex + 1 < high) {
          nextTasks.push({ low: pivotIndex + 1, high, id: `${task.id}-R`, depth: task.depth + 1 });
        }
      }
    });

    const activeCores = workerAssignments.filter(w => w.state !== 'idle').length;

    if (compsThisStep.length > 0 || swapsThisStep.length > 0) {
      steps.push({
        stepIndex: steps.length,
        array: [...arr],
        activeWorkers: workerAssignments,
        comparisonsInStep: compsThisStep,
        swapsInStep: swapsThisStep,
        barriers: true,
        stageName: `Ronda Paralela ${parallelLevel}: Partición Concurrente (${currentTasks.length} sub-tareas)`,
        description: `Se ejecutaron particiones en paralelo en ${currentTasks.length} sub-arreglos usando ${activeCores} núcleos. Pivotes fijados y rangos divididos. Barrera de unión (join) alcanzada.`,
        highlightCodeLine: 5,
        metrics: {
          totalComparisons: totalComps,
          totalSwaps: totalSwaps,
          parallelDepth: parallelLevel,
          activeCores,
        },
        treeNodes: currentTasks.map(t => ({
          id: t.id,
          range: [t.low, t.high],
          depth: t.depth,
          status: 'completed'
        }))
      });
    }

    currentTasks = nextTasks;
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
    description: `Árbol de Fork-Join de QuickSort resuelto con éxito. Todos los sub-arreglos se han ordenado independientemente sin condiciones de carrera.`,
    highlightCodeLine: 10,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: 0,
    },
  });

  return steps;
}
