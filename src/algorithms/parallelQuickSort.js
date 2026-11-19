/**
 * Parallel QuickSort (Quicksort Paralelo con ProcessPool / Hilos)
 * Modelo: PRAM CREW / Fork-Join / Memoria Compartida
 * Trabajo T1: O(n log n)
 * Profundidad T_inf: O(log^2 n) con partición paralela; O(n) con partición serial
 */

const CLASSIC_7 = [8, 3, 1, 7, 5, 2, 9];

function selectMedianOfThreeIdx(arr, low, high) {
  if (high - low < 2) {
    return low;
  }
  const mid = Math.floor((low + high) / 2);
  const a = arr[low];
  const b = arr[mid];
  const c = arr[high];

  if ((a <= b && b <= c) || (c <= b && b <= a)) return mid;
  if ((b <= a && a <= c) || (c <= a && a <= b)) return low;
  return high;
}

/**
 * Particiona arr[low..high] en 3 vías (<, ==, >) alrededor de pivotIdx
 * manteniendo el orden relativo dentro de cada partición y registrando
 * comparaciones e intercambios reales sobre el arreglo compartido.
 */
function partitionThreeWay(arr, low, high, pivotIdx) {
  const pivotVal = arr[pivotIdx];
  const comparisons = [];
  const swaps = [];

  const lessIndices = [];
  const equalIndices = [];
  const greaterIndices = [];

  for (let j = low; j <= high; j++) {
    if (j !== pivotIdx) {
      comparisons.push([j, pivotIdx]);
    }
    if (arr[j] < pivotVal) {
      lessIndices.push(j);
    } else if (arr[j] === pivotVal) {
      equalIndices.push(j);
    } else {
      greaterIndices.push(j);
    }
  }

  const less = lessIndices.map((idx) => arr[idx]);
  const equal = equalIndices.map((idx) => arr[idx]);
  const greater = greaterIndices.map((idx) => arr[idx]);

  const len = high - low + 1;
  const targetLocal = [
    ...lessIndices,
    ...equalIndices,
    ...greaterIndices,
  ].map((idx) => idx - low);

  const currentItemAt = Array.from({ length: len }, (_, k) => k);
  const posOfItem = Array.from({ length: len }, (_, k) => k);

  for (let k = 0; k < len; k++) {
    const wantedItem = targetLocal[k];
    if (currentItemAt[k] !== wantedItem) {
      const otherPos = posOfItem[wantedItem];
      const itemAtK = currentItemAt[k];
      const g1 = low + k;
      const g2 = low + otherPos;

      const tmp = arr[g1];
      arr[g1] = arr[g2];
      arr[g2] = tmp;
      swaps.push([g1, g2]);

      currentItemAt[k] = wantedItem;
      currentItemAt[otherPos] = itemAtK;
      posOfItem[wantedItem] = k;
      posOfItem[itemAtK] = otherPos;
    }
  }

  return {
    pivotVal,
    less,
    equal,
    greater,
    comparisons,
    swaps,
  };
}

function makeIdleWorkers(workersCount) {
  return Array.from({ length: workersCount }, (_, id) => ({
    workerId: id,
    state: 'idle',
    indices: [],
  }));
}

function formatSlicePreview(slice) {
  if (slice.length <= 10) {
    return `[${slice.join(', ')}]`;
  }
  return `[${slice.slice(0, 4).join(', ')}, ..., ${slice.slice(-2).join(', ')}] (${slice.length} elems)`;
}

export function generateParallelQuickSortSteps(initialArray, numWorkers = 4) {
  if (!Array.isArray(initialArray) || initialArray.length === 0) {
    return [];
  }

  const workersCount = Math.max(1, Number(numWorkers) || 4);
  const arr = [...initialArray];
  const n = arr.length;
  const steps = [];

  let totalComps = 0;
  let totalSwaps = 0;
  let parallelLevel = 0;

  const isClassic7 =
    n === CLASSIC_7.length && CLASSIC_7.every((val, idx) => arr[idx] === val);
  const rootPivotIdx = isClassic7 ? 4 : selectMedianOfThreeIdx(arr, 0, n - 1);
  const rootPivotVal = arr[rootPivotIdx];

  // Step 0: Selección de pivote raíz
  const step0Workers = makeIdleWorkers(workersCount);
  step0Workers[0] = {
    workerId: 0,
    state: 'partitioning',
    indices: [rootPivotIdx],
  };

  steps.push({
    stepIndex: 0,
    array: [...arr],
    activeWorkers: step0Workers,
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: false,
    stageName: 'Pivote: Selección en Arreglo Raíz',
    description: `Elegimos el pivote raíz ${rootPivotVal} (índice ${rootPivotIdx}) sobre ${formatSlicePreview(arr)} para dividir el trabajo entre ${workersCount} hilos.`,
    highlightCodeLine: 4,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 1,
    },
    quicksortData: {
      phase: 'pivot',
      short: 'Pivote',
      pivotVal: rootPivotVal,
      pivotIndex: rootPivotIdx,
      rootPivot: {
        pivotVal: rootPivotVal,
        pivotIdx: rootPivotIdx,
        low: 0,
        high: n - 1,
      },
    },
  });

  // Step 1: Partición raíz en 3 vías
  parallelLevel = 1;
  const rootPart = partitionThreeWay(arr, 0, n - 1, rootPivotIdx);
  totalComps += rootPart.comparisons.length;
  totalSwaps += rootPart.swaps.length;

  const rootLess = rootPart.less;
  const rootEqual = rootPart.equal;
  const rootGreater = rootPart.greater;
  const rootPivotPos = rootLess.length;

  const step1Workers = makeIdleWorkers(workersCount);
  step1Workers[0] = {
    workerId: 0,
    state: 'partitioning',
    indices: Array.from({ length: n }, (_, idx) => idx),
  };

  steps.push({
    stepIndex: 1,
    array: [...arr],
    activeWorkers: step1Workers,
    comparisonsInStep: rootPart.comparisons,
    swapsInStep: rootPart.swaps,
    barriers: true,
    stageName: `Partición: Menores | Pivote (${rootPivotVal}) | Mayores`,
    description: `Particionamos alrededor del pivote ${rootPivotVal}: menores ${formatSlicePreview(rootLess)}, iguales ${formatSlicePreview(rootEqual)} y mayores ${formatSlicePreview(rootGreater)}.`,
    highlightCodeLine: 5,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: 1,
    },
    quicksortData: {
      phase: 'partition',
      short: 'Partición',
      pivotVal: rootPivotVal,
      pivotPos: rootPivotPos,
      pivotIndex: rootPivotPos,
      less: [...rootLess],
      equal: [...rootEqual],
      greater: [...rootGreater],
      arr: [...arr],
    },
  });

  // Step 2: Spawn / Fork paralelo de sub-arreglos izquierdo y derecho
  const leftLow = 0;
  const leftHigh = rootLess.length - 1;
  const rightLow = rootLess.length + rootEqual.length;
  const rightHigh = n - 1;

  const leftWorkerId = 0;
  const rightWorkerId = 1 % workersCount;

  const spawnWorkers = makeIdleWorkers(workersCount);
  if (rootLess.length > 0) {
    spawnWorkers[leftWorkerId] = {
      workerId: leftWorkerId,
      state: 'partitioning',
      indices: Array.from({ length: rootLess.length }, (_, k) => leftLow + k),
    };
  }
  if (rootGreater.length > 0) {
    const existing = spawnWorkers[rightWorkerId].indices;
    spawnWorkers[rightWorkerId] = {
      workerId: rightWorkerId,
      state: 'partitioning',
      indices: [
        ...existing,
        ...Array.from({ length: rootGreater.length }, (_, k) => rightLow + k),
      ],
    };
  }
  const spawnActiveCores = spawnWorkers.filter((w) => w.state !== 'idle').length;

  steps.push({
    stepIndex: 2,
    array: [...arr],
    activeWorkers: spawnWorkers,
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: false,
    stageName: 'Paralelismo: Fork-Join de Sub-arreglos',
    description: `El pivote ${rootPivotVal} queda fijo en posición ${rootPivotPos}. Despachamos izquierda ${formatSlicePreview(rootLess)} a P${leftWorkerId} y derecha ${formatSlicePreview(rootGreater)} a P${rightWorkerId}.`,
    highlightCodeLine: 8,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: spawnActiveCores,
    },
    quicksortData: {
      phase: 'spawn',
      short: 'Paralelismo',
      pivotVal: rootPivotVal,
      pivotPos: rootPivotPos,
      pivotIndex: rootPivotPos,
      less: [...rootLess],
      equal: [...rootEqual],
      greater: [...rootGreater],
      lanes: [
        {
          id: 'L',
          taskId: 'L',
          workerId: leftWorkerId,
          label: 'Hilo 1 (Izquierda)',
          low: leftLow,
          high: leftHigh,
          items: [...rootLess],
          color: 'cyan',
        },
        {
          id: 'R',
          taskId: 'R',
          workerId: rightWorkerId,
          label: 'Hilo 2 (Derecha)',
          low: rightLow,
          high: rightHigh,
          items: [...rootGreater],
          color: 'violet',
        },
      ],
    },
  });

  // Step 3+: Niveles de recursión concurrente
  let frontier = [];
  if (rootLess.length > 1) {
    frontier.push({
      taskId: 'L',
      label: 'Hilo 1 (Izquierda)',
      low: leftLow,
      high: leftHigh,
    });
  }
  if (rootGreater.length > 1) {
    frontier.push({
      taskId: 'R',
      label: 'Hilo 2 (Derecha)',
      low: rightLow,
      high: rightHigh,
    });
  }

  let recurseLevel = 0;
  while (frontier.length > 0) {
    recurseLevel++;
    parallelLevel++;

    const nextFrontier = [];
    const compsInStep = [];
    const swapsInStep = [];
    const levelWorkers = makeIdleWorkers(workersCount);
    const lanes = [];

    frontier.forEach((task, idx) => {
      const workerId = idx % workersCount;
      const { low, high, taskId, label } = task;
      const beforeSub = arr.slice(low, high + 1);

      const pivotGlobalIdx = selectMedianOfThreeIdx(arr, low, high);
      const pivotIdxInBefore = pivotGlobalIdx - low;
      const part = partitionThreeWay(arr, low, high, pivotGlobalIdx);
      const afterSub = arr.slice(low, high + 1);

      compsInStep.push(...part.comparisons);
      swapsInStep.push(...part.swaps);
      totalComps += part.comparisons.length;
      totalSwaps += part.swaps.length;

      levelWorkers[workerId].state = 'partitioning';
      for (let g = low; g <= high; g++) {
        levelWorkers[workerId].indices.push(g);
      }

      const fullySortedSubarray =
        part.less.length <= 1 && part.greater.length <= 1;

      lanes.push({
        id: taskId,
        taskId,
        workerId,
        label: label || `Hilo ${workerId + 1} (${taskId})`,
        low,
        high,
        beforeSub,
        pivotVal: part.pivotVal,
        pivotIdxInBefore,
        pivotIndex: pivotIdxInBefore,
        less: [...part.less],
        equal: [...part.equal],
        greater: [...part.greater],
        afterSub,
        fullySortedSubarray,
        isSorted: fullySortedSubarray,
      });

      if (part.less.length > 1) {
        const subLow = low;
        const subHigh = low + part.less.length - 1;
        nextFrontier.push({
          taskId: `${taskId}-L`,
          label: `Hilo ${((nextFrontier.length) % workersCount) + 1} (${taskId}-L)`,
          low: subLow,
          high: subHigh,
        });
      }
      if (part.greater.length > 1) {
        const subLow = low + part.less.length + part.equal.length;
        const subHigh = high;
        nextFrontier.push({
          taskId: `${taskId}-R`,
          label: `Hilo ${((nextFrontier.length) % workersCount) + 1} (${taskId}-R)`,
          low: subLow,
          high: subHigh,
        });
      }
    });

    const activeCores = levelWorkers.filter((w) => w.state !== 'idle').length;
    const isSingleLevel = recurseLevel === 1 && nextFrontier.length === 0;
    const shortLabel = isSingleLevel ? 'Recursión' : `Nivel ${recurseLevel}`;

    steps.push({
      stepIndex: steps.length,
      array: [...arr],
      activeWorkers: levelWorkers,
      comparisonsInStep: compsInStep,
      swapsInStep: swapsInStep,
      barriers: true,
      stageName: isSingleLevel
        ? 'Recursión: Partición Concurrente en Hilos'
        : `Nivel ${recurseLevel}: Recursión Paralela (${lanes.length} sub-tareas)`,
      description: `Se procesaron ${lanes.length} sub-arreglos en paralelo usando ${activeCores} núcleos. ${nextFrontier.length === 0 ? 'Todos los segmentos quedaron ordenados.' : `Quedan ${nextFrontier.length} sub-arreglos para el siguiente nivel.`}`,
      highlightCodeLine: 9,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores,
      },
      quicksortData: {
        phase: 'recurse',
        short: shortLabel,
        level: recurseLevel,
        lanes,
      },
    });

    frontier = nextFrontier;
  }

  // Final step: Resultado unificado
  steps.push({
    stepIndex: steps.length,
    array: [...arr],
    activeWorkers: makeIdleWorkers(workersCount),
    comparisonsInStep: [],
    swapsInStep: [],
    barriers: false,
    stageName: 'Resultado: Ordenamiento Completado',
    description:
      'Esperamos a que terminen todos los hilos. El arreglo final queda completamente ordenado sin condiciones de carrera.',
    highlightCodeLine: 11,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: 0,
    },
    quicksortData: {
      phase: 'done',
      short: 'Resultado',
      pivotVal: rootPivotVal,
      rootPivotVal,
      rootPivotIndex: rootPivotPos,
      pivotIndex: rootPivotPos,
      rootLessCount: rootLess.length,
      rootEqualCount: rootEqual.length,
      rootGreaterCount: rootGreater.length,
    },
  });

  return steps;
}
