/**
 * Parallel Radix Sort (Radix Sort Paralelo con Parallel Scan / Prefix Sums)
 * Modelo: PRAM CREW / SIMD / GPU
 * Trabajo T1: O(k * n)
 * Profundidad T_inf: O(k * (n/P + log P))
 * Fundamental en arquitecturas GPU (CUDA) y computación de alto rendimiento.
 */

const PASS_LABELS = ['UNIDADES (Derecha)', 'DECENAS (Izquierda)', 'CENTENAS'];
const SHORT_PREFIXES = ['U.', 'D.', 'C.'];

function buildWorkerRanges(n, p) {
  const base = Math.floor(n / p);
  const rem = n % p;
  const ranges = [];
  let start = 0;
  for (let w = 0; w < p; w++) {
    const len = base + (w < rem ? 1 : 0);
    ranges.push([start, start + len]);
    start += len;
  }
  return ranges;
}

function cloneRanges(ranges) {
  return ranges.map(([start, end]) => [start, end]);
}

function formatPaddedDigits(val, padDigits) {
  return String(val).padStart(padDigits, '0').split('').join(',');
}

export function generateParallelRadixSortSteps(initialArray, numWorkers = 4) {
  const steps = [];
  let arr = [...initialArray];
  const n = arr.length;
  const p = Math.max(1, numWorkers);

  let totalComps = 0;
  let totalSwaps = 0;
  let parallelLevel = 0;

  const maxVal = n > 0 ? Math.max(...arr) : 0;
  const numDigits = Math.max(1, String(Math.floor(Math.abs(maxVal))).length);
  const workerRanges = buildWorkerRanges(n, p);

  // Step 0: Initial state
  steps.push({
    stepIndex: 0,
    short: 'Inicio',
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
    description: `Arreglo cargado con ${n} elementos (máximo ${maxVal}, ${numDigits} ${numDigits === 1 ? 'dígito' : 'dígitos'} base 10). Particionado en ${p} bloques contiguos para conteo y escaneo paralelo.`,
    highlightCodeLine: 2,
    metrics: {
      totalComparisons: 0,
      totalSwaps: 0,
      parallelDepth: 0,
      activeCores: 0,
    },
    radixData: {
      phase: 'init',
      shortLabel: 'Inicio',
      pass: 0,
      exp: 1,
      numDigits,
      padDigits: numDigits,
      passLabel: PASS_LABELS[0],
      inputArr: [...arr],
      workerRanges: cloneRanges(workerRanges),
      digitPos: 0,
      maxDigits: numDigits,
    },
  });

  let lastInput = [...arr];
  let finalSlots = arr.map((val, idx) => ({
    val,
    fromCore: 0,
    fromIdx: idx,
    digit: val % 10,
  }));

  for (let d = 0; d < numDigits; d++) {
    const exp = 10 ** d;
    const passLabel = PASS_LABELS[d] || `DÍGITO 10^${d}`;
    const shortPrefix = SHORT_PREFIXES[d] || `D${d}`;

    // Phase 1: Local Histograms in parallel
    parallelLevel++;
    const localHistograms = Array.from({ length: p }, () => Array(10).fill(0));
    const histWorkers = Array.from({ length: p }, (_, id) => ({
      workerId: id,
      state: 'comparing',
      indices: [],
    }));

    for (let w = 0; w < p; w++) {
      const [start, end] = workerRanges[w];
      for (let i = start; i < end; i++) {
        histWorkers[w].indices.push(i);
        const dig = Math.floor(arr[i] / exp) % 10;
        localHistograms[w][dig]++;
        totalComps++;
      }
    }

    const histShort = `${steps.length}. Conteo ${shortPrefix}`;
    steps.push({
      stepIndex: steps.length,
      short: histShort,
      array: [...arr],
      activeWorkers: histWorkers,
      comparisonsInStep: [],
      swapsInStep: [],
      barriers: true,
      stageName: `Pasada ${d + 1} (${passLabel}): Conteo Local`,
      description: `Los ${p} núcleos cuentan en paralelo las frecuencias de los dígitos 0..9 para ${passLabel} (10^${d}) sobre sus fragmentos asignados.`,
      highlightCodeLine: 5,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores: p,
      },
      radixData: {
        phase: 'hist',
        shortLabel: histShort,
        pass: d,
        exp,
        numDigits,
        padDigits: numDigits,
        passLabel,
        inputArr: [...arr],
        workerRanges: cloneRanges(workerRanges),
        histograms: localHistograms.map((row) => [...row]),
        digitPos: d,
      },
    });

    // Phase 2: Parallel Prefix Sum (Scan) across histogram matrix
    parallelLevel++;
    const globalCount = Array(10).fill(0);
    for (let dig = 0; dig <= 9; dig++) {
      for (let w = 0; w < p; w++) {
        globalCount[dig] += localHistograms[w][dig];
      }
    }

    const workerOffsets = Array.from({ length: p }, () => Array(10).fill(0));
    let running = 0;
    for (let dig = 0; dig <= 9; dig++) {
      for (let w = 0; w < p; w++) {
        workerOffsets[w][dig] = running;
        running += localHistograms[w][dig];
      }
    }
    const offsets = [...workerOffsets[0]];

    const scanWorkers = Array.from({ length: p }, (_, id) => ({
      workerId: id,
      state: 'merging',
      indices: [],
    }));

    const scanShort = `${steps.length}. Prefijos ${shortPrefix}`;
    steps.push({
      stepIndex: steps.length,
      short: scanShort,
      array: [...arr],
      activeWorkers: scanWorkers,
      comparisonsInStep: [],
      swapsInStep: [],
      barriers: true,
      stageName: `Pasada ${d + 1} (${passLabel}): Escaneo de Prefijos`,
      description: `Parallel Scan exclusivo por dígito y núcleo: se obtienen las posiciones globales exactas de escritura sin colisiones ni bloqueos.`,
      highlightCodeLine: 7,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores: p,
      },
      radixData: {
        phase: 'scan',
        shortLabel: scanShort,
        pass: d,
        exp,
        numDigits,
        padDigits: numDigits,
        passLabel,
        inputArr: [...arr],
        workerRanges: cloneRanges(workerRanges),
        histograms: localHistograms.map((row) => [...row]),
        globalCount: [...globalCount],
        workerOffsets: workerOffsets.map((row) => [...row]),
        offsets: [...offsets],
        digitPos: d,
      },
    });

    // Phase 3: Parallel Scatter / Permute
    parallelLevel++;
    const inputBeforeScatter = [...arr];
    const outputSlots = Array(n);
    const cursor = workerOffsets.map((row) => [...row]);
    const scatterWorkers = Array.from({ length: p }, (_, id) => ({
      workerId: id,
      state: 'swapping',
      indices: [],
    }));

    for (let w = 0; w < p; w++) {
      const [start, end] = workerRanges[w];
      for (let i = start; i < end; i++) {
        const val = inputBeforeScatter[i];
        const dig = Math.floor(val / exp) % 10;
        const destIdx = cursor[w][dig]++;
        outputSlots[destIdx] = {
          val,
          fromCore: w,
          fromIdx: i,
          digit: dig,
          paddedDigits: formatPaddedDigits(val, numDigits),
        };
        scatterWorkers[w].indices.push(destIdx);
        totalSwaps++;
      }
    }

    arr = outputSlots.map((slot) => slot.val);
    lastInput = inputBeforeScatter;
    finalSlots = outputSlots.map((slot) => ({ ...slot }));

    const scatterShort = `${steps.length}. Mover ${shortPrefix}`;
    steps.push({
      stepIndex: steps.length,
      short: scatterShort,
      array: [...arr],
      activeWorkers: scatterWorkers,
      comparisonsInStep: [],
      swapsInStep: [],
      barriers: true,
      stageName: `Pasada ${d + 1} (${passLabel}): Dispersión Paralela`,
      description: `Dispersión estable concurrente usando los desplazamientos exclusivos de cada núcleo. Barrera de memoria sincronizada.`,
      highlightCodeLine: 9,
      metrics: {
        totalComparisons: totalComps,
        totalSwaps: totalSwaps,
        parallelDepth: parallelLevel,
        activeCores: p,
      },
      radixData: {
        phase: 'scatter',
        shortLabel: scatterShort,
        pass: d,
        exp,
        numDigits,
        padDigits: numDigits,
        passLabel,
        inputArr: inputBeforeScatter,
        workerRanges: cloneRanges(workerRanges),
        histograms: localHistograms.map((row) => [...row]),
        globalCount: [...globalCount],
        workerOffsets: workerOffsets.map((row) => [...row]),
        offsets: [...offsets],
        outputSlots: outputSlots.map((slot) => ({ ...slot })),
        digitPos: d,
      },
    });
  }

  // Final Step
  steps.push({
    stepIndex: steps.length,
    short: 'Finalizado',
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
    description: `Radix Sort Paralelo completado en ${numDigits} ${numDigits === 1 ? 'pasada' : 'pasadas'}. Algoritmo estable en O(k · (n/p + log p)) de profundidad paralela.`,
    highlightCodeLine: 10,
    metrics: {
      totalComparisons: totalComps,
      totalSwaps: totalSwaps,
      parallelDepth: parallelLevel,
      activeCores: 0,
    },
    radixData: {
      phase: 'done',
      shortLabel: 'Finalizado',
      pass: numDigits - 1,
      exp: 10 ** (numDigits - 1),
      numDigits,
      padDigits: numDigits,
      passLabel: 'PROCESO TERMINADO',
      inputArr: lastInput,
      workerRanges: cloneRanges(workerRanges),
      outputSlots: finalSlots,
      totalPasses: numDigits,
      digitPos: numDigits - 1,
    },
  });

  return steps;
}
