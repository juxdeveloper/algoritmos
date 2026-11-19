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

export function generateParallelQuickSortSteps() {
  return [];
}
