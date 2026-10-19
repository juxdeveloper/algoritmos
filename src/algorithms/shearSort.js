/**
 * Shearsort (Ordenamiento en Malla 2D / Serpenteante)
 * Modelo: Malla Bidimensional (2D Mesh Architecture)
 * Trabajo T1: O(n log n)
 * Profundidad T_inf: O(sqrt(n) log n)
 * Clásico para redes de interconexión física matriciales (Toros y Mallas 2D).
 */
export function generateShearSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  const arr = [...initialArray];
  const n = arr.length;
  let totalComps = 0;
  let totalSwaps = 0;
  let parallelLevel = 0;

  // Find suitable grid dimensions r x c (preferably 4x4 for 16, or nearest factors)
  let r = Math.floor(Math.sqrt(n));
  while (n % r !== 0 && r > 1) {
    r--;
  }
  let c = Math.floor(n / r);

  const numRounds = Math.ceil(Math.log2(r)) + 1;

  // Helper to extract 2D grid representation
  const getGridSnapshot = (directions = {}) => {
    const grid = [];
    for (let row = 0; row < r; row++) {
      for (let col = 0; col < c; col++) {
        const idx = row * c + col;
        grid.push({
          row,
          col,
          index: idx,
          val: arr[idx],
          dir: directions[row] || 'none',
        });
      }
    }
    return grid;
  };

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
    description: `Arreglo cargado con ${n} elementos. Mapeado a una malla 2D de ${r}x${c} procesadores. Iniciando Shearsort.`,
    highlightCodeLine: 1,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 0,
    },
    meshData: { rows: r, cols: c, grid: getGridSnapshot(), phaseType: 'init' }
  });

  for (let round = 1; round <= numRounds; round++) {
    // 1. Sort Rows in Parallel (Serpentine: even rows -> right, odd rows <- left)
    parallelLevel++;
    const rowWorkers = Array.from({ length: numWorkers }, (_, id) => ({
      workerId: id,
      state: 'comparing',
      indices: [],
    }));

    const rowDirections = {};
    for (let row = 0; row < r; row++) {
      const isEven = row % 2 === 0;
      rowDirections[row] = isEven ? 'right' : 'left';
      const wId = row % numWorkers;

      const rowIndices = [];
      const rowVals = [];
      for (let col = 0; col < c; col++) {
        const idx = row * c + col;
        rowIndices.push(idx);
        rowVals.push(arr[idx]);
        rowWorkers[wId].indices.push(idx);
      }

      // Sort row values
      rowVals.sort((a, b) => (isEven ? a - b : b - a));
      totalComps += Math.round(c * Math.log2(c || 1));

      for (let col = 0; col < c; col++) {
        const idx = row * c + col;
        if (arr[idx] !== rowVals[col]) {
          totalSwaps++;
          arr[idx] = rowVals[col];
        }
      }
    }

    rowWorkers.forEach(w => { if (w.indices.length > 0) w.state = 'swapping'; });

    steps.push({
      stepIndex: steps.length,
      array: [...arr],
      activeWorkers: rowWorkers,
      comparisonsInStep: [],
      swapsInStep: [],
      barriers: true,
      stageName: `Ronda ${round}/${numRounds}: Ordenamiento Concurrente de Filas (Serpenteante)`,
      description: `Todas las filas se ordenaron en paralelo. Filas pares hacia la derecha (→) y filas impares hacia la izquierda (←).`,
      highlightCodeLine: 4,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores: Math.min(r, numWorkers),
      },
      meshData: { rows: r, cols: c, grid: getGridSnapshot(rowDirections), phaseType: 'rows', round }
    });

    // 2. Sort Columns in Parallel (Top to Bottom)
    parallelLevel++;
    const colWorkers = Array.from({ length: numWorkers }, (_, id) => ({
      workerId: id,
      state: 'comparing',
      indices: [],
    }));

    for (let col = 0; col < c; col++) {
      const wId = col % numWorkers;
      const colIndices = [];
      const colVals = [];

      for (let row = 0; row < r; row++) {
        const idx = row * c + col;
        colIndices.push(idx);
        colVals.push(arr[idx]);
        colWorkers[wId].indices.push(idx);
      }

      colVals.sort((a, b) => a - b);
      totalComps += Math.round(r * Math.log2(r || 1));

      for (let row = 0; row < r; row++) {
        const idx = row * c + col;
        if (arr[idx] !== colVals[row]) {
          totalSwaps++;
          arr[idx] = colVals[row];
        }
      }
    }

    colWorkers.forEach(w => { if (w.indices.length > 0) w.state = 'swapping'; });

    steps.push({
      stepIndex: steps.length,
      array: [...arr],
      activeWorkers: colWorkers,
      comparisonsInStep: [],
      swapsInStep: [],
      barriers: true,
      stageName: `Ronda ${round}/${numRounds}: Ordenamiento Concurrente de Columnas (Hacia Abajo)`,
      description: `Todas las columnas se ordenaron simultáneamente de arriba hacia abajo (↓). Los valores menores suben y los mayores descienden en la malla.`,
      highlightCodeLine: 8,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores: Math.min(c, numWorkers),
      },
      meshData: { rows: r, cols: c, grid: getGridSnapshot(), phaseType: 'cols', round }
    });
  }

  // Final sweep: ensure rows sorted left to right
  for (let row = 1; row < r; row += 2) {
    const rowVals = [];
    for (let col = 0; col < c; col++) rowVals.push(arr[row * c + col]);
    rowVals.reverse();
    for (let col = 0; col < c; col++) arr[row * c + col] = rowVals[col];
  }

  // Completed
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
    description: `Malla 2D convergida. La matriz y el arreglo lineal resultante se encuentran completamente ordenados.`,
    highlightCodeLine: 12,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: 0,
    },
    meshData: { rows: r, cols: c, grid: getGridSnapshot(), phaseType: 'completed' }
  });

  return steps;
}
