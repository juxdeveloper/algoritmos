import { generateBitonicSortSteps } from './bitonicSort.js';
import { generateOddEvenSortSteps } from './oddEvenSort.js';
import { generateParallelQuickSortSteps } from './parallelQuickSort.js';
import { generateParallelMergeSortSteps } from './parallelMergeSort.js';
import { generateSampleSortSteps } from './sampleSort.js';
import { generateParallelRadixSortSteps } from './parallelRadixSort.js';
import { generateShearSortSteps } from './shearSort.js';
import { generateParallelBucketSortSteps } from './parallelBucketSort.js';

export const PARALLEL_ALGORITHMS = {
  bitonic: {
    id: 'bitonic',
    name: 'Bitonic Sort',
    subtitle: 'Red de Ordenamiento de Batcher',
    model: 'Redes de Comparadores / PRAM EREW',
    work: 'O(n log² n)',
    span: 'O(log² n)',
    speedup: 'O(n)',
    efficiency: 'O(1 / log n)',
    stability: 'No estable',
    suitableSizes: [8, 16, 32, 64],
    defaultSize: 16,
    generate: generateBitonicSortSteps,
    hasNetworkView: true,
    description:
      'Diseñado por Ken Batcher en 1968. Transforma recursivamente secuencias arbitrarias en secuencias bitónicas (primero crecen, luego decrecen) y las fusiona en paralelo con comparadores alambrados en etapas logarítmicas.',
    keyInsights: [
      'Independiente de los datos (Data-oblivious): el orden de comparaciones es idéntico para cualquier entrada.',
      'Profundidad paralela de solo (log₂ n)(log₂ n + 1) / 2 etapas.',
      'Base de los clasificadores hardware y shaders en GPUs modernas.'
    ],
    code: [
      '# Red de Ordenamiento Bitónico (Batcher)',
      'def bitonic_sort_paralelo(arr, n, p):',
      '    k = 2',
      '    while k <= n:',
      '        j = k // 2',
      '        while j > 0:',
      '            # En paralelo sobre n/2 comparadores:',
      '            for i in parallel_range(0, n):',
      '                l = i ^ j',
      '                if l > i:',
      '                    dir_asc = (i & k) == 0',
      '                    compare_exchange(arr, i, l, dir_asc)',
      '            barrier_sync()',
      '            j //= 2',
      '        k *= 2'
    ]
  },
  oddeven: {
    id: 'oddeven',
    name: 'Odd-Even Transposition',
    subtitle: 'Ordenamiento Par-Impar en Malla 1D',
    model: 'Arreglo Sistólico 1D / PRAM EREW',
    work: 'O(n²)',
    span: 'O(n)',
    speedup: 'O(n)',
    efficiency: 'O(1)',
    stability: 'Estable',
    suitableSizes: [8, 16, 32, 64],
    defaultSize: 16,
    generate: generateOddEvenSortSteps,
    hasNetworkView: true,
    description:
      'Extensión paralela del ordenamiento burbuja. Alterna entre fases pares (comparar [2i, 2i+1]) e impares (comparar [2i+1, 2i+2]) sin conflicto de acceso. Ideal para cadenas lineales de procesadores conectados a vecinos inmediatos.',
    keyInsights: [
      'Solo requiere comunicación punto a punto entre vecinos adyacentes.',
      'Converge en a lo sumo n pasos paralelos con n procesadores.',
      'Excelente para hardware sistólico y computación óptica.'
    ],
    code: [
      '# Ordenamiento Par-Impar (Odd-Even Transposition)',
      'def odd_even_paralelo(arr, n, n_workers):',
      '    for fase in range(n):',
      '        inicio = 0 if fase % 2 == 0 else 1',
      '        # Paralelización sin condición de carrera:',
      '        with Pool(n_workers) as pool:',
      '            pool.map(compare_swap, [',
      '                (i, i+1) for i in range(inicio, n-1, 2)',
      '            ])',
      '        barrier()  # Sincronización de memoria'
    ]
  },
  quicksort: {
    id: 'quicksort',
    name: 'Parallel QuickSort',
    subtitle: 'Divide y Vencerás con ProcessPool',
    model: 'PRAM CREW / Fork-Join / Hilos',
    work: 'O(n log n)',
    span: 'O(log² n)',
    speedup: 'O(p / log p)',
    efficiency: 'O(1 / log p)',
    stability: 'No estable',
    suitableSizes: [8, 16, 32, 64],
    defaultSize: 16,
    generate: generateParallelQuickSortSteps,
    hasTreeView: true,
    description:
      'Particiona el arreglo y lanza sub-tareas en paralelo en un ProcessPool. Cuando el tamaño del sub-arreglo cae por debajo de un umbral, cambia a quicksort serial para amortizar el costo de creación de procesos (Tarea 6 EDA II).',
    keyInsights: [
      'Evita crear demasiados procesos usando un umbral mínimo de partición.',
      'Aprovecha múltiples núcleos reales de CPU sin bloqueo de GIL usando multiprocessing.',
      'El desbalance del pivote puede afectar la concurrencia en el peor caso.'
    ],
    code: [
      '# QuickSort Paralelo con Umbral (multiprocessing)',
      'def quicksort_paralelo(arr, umbral=10_000):',
      '    if len(arr) <= umbral:',
      '        return quicksort_serial(arr)',
      '    pivote = arr[-1]',
      '    menores = [x for x in arr[:-1] if x <= pivote]',
      '    mayores = [x for x in arr[:-1] if x > pivote]',
      '    with ProcessPoolExecutor(max_workers=2) as executor:',
      '        fut_izq = executor.submit(quicksort_paralelo, menores, umbral)',
      '        fut_der = executor.submit(quicksort_paralelo, mayores, umbral)',
      '        return fut_izq.result() + [pivote] + fut_der.result()'
    ]
  },
  mergesort: {
    id: 'mergesort',
    name: 'Parallel MergeSort',
    subtitle: 'Árbol Fork-Join & Fusión Concurrente',
    model: 'Fork-Join / PRAM CREW / Reducción Binaria',
    work: 'O(n log n)',
    span: 'O(n/p + log n)',
    speedup: 'O(p)',
    efficiency: 'O(1)',
    stability: 'Estable',
    suitableSizes: [8, 16, 32, 64],
    defaultSize: 16,
    generate: generateParallelMergeSortSteps,
    hasTreeView: true,
    description:
      'Divide el arreglo en p fragmentos contiguos. Cada núcleo ordena su fragmento en memoria local sin contención. Luego, un árbol de mezcla binaria reduce las mitades concurrentemente.',
    keyInsights: [
      'Fase 1 totalmente desacoplada: cada hilo trabaja en su propia memoria caché L1/L2.',
      'Árbol de reducción sincronizado por barreras de memoria.',
      'Garantiza estabilidad y tiempo O(n log n) en cualquier distribución.'
    ],
    code: [
      '# MergeSort Paralelo en 2 Fases',
      'def mergesort_paralelo(arr, p=4):',
      '    chunk_size = len(arr) // p',
      '    # Fase 1: Ordenamiento local concurrente',
      '    with ProcessPoolExecutor(p) as pool:',
      '        bloques = list(pool.map(sort_local, chunks(arr, chunk_size)))',
      '    # Fase 2: Reducción binaria paralela de mezclas',
      '    while len(bloques) > 1:',
      '        with ProcessPoolExecutor(len(bloques)//2) as pool:',
      '            bloques = list(pool.map(merge_pair, pares(bloques)))',
      '    return bloques[0]'
    ]
  },
  samplesort: {
    id: 'samplesort',
    name: 'Sample Sort',
    subtitle: 'Ordenamiento por Muestreo Regular (MPI)',
    model: 'Memoria Distribuida / MPI / Clusters',
    work: 'O(n log n)',
    span: 'O((n/p) log(n/p) + p log p)',
    speedup: 'O(p)',
    efficiency: 'O(1)',
    stability: 'No estable',
    suitableSizes: [8, 16, 32, 64],
    defaultSize: 16,
    generate: generateSampleSortSteps,
    hasSampleView: true,
    description:
      'El algoritmo estándar en supercómputo y librerías MPI. Cada proceso extrae muestras locales; un coordinador determina p-1 separadores globales para balancear la carga perfectamente y evitar el cuello de botella del pivote único.',
    keyInsights: [
      'Elimina el desbalance de QuickSort paralelo eligiendo separadores globales de muestra.',
      'Minimiza la comunicación a un único intercambio All-to-All global.',
      'Escala linealmente a miles de procesadores distribuidos.'
    ],
    code: [
      '# Sample Sort (MPI / Distribuido)',
      'def sample_sort(local_arr, rank, p):',
      '    local_arr.sort()  # Fase 1: ordenamiento local',
      '    muestras = local_arr[::len(local_arr)//p]  # Fase 2: muestreo',
      '    todas_muestras = comm.allgather(muestras)',
      '    splitters = elegir_separadores(todas_muestras, p)',
      '    cubetas = clasificar(local_arr, splitters)',
      '    recibidos = comm.alltoall(cubetas)  # Fase 4: intercambio de red',
      '    recibidos.sort()  # Fase 5: orden final local',
      '    return recibidos'
    ]
  },
  radix: {
    id: 'radix',
    name: 'Parallel Radix Sort',
    subtitle: 'Conteo y Escaneo de Prefijos (CUDA/SIMD)',
    model: 'SIMD / GPU / PRAM CREW',
    work: 'O(k · n)',
    span: 'O(k · (n/p + log p))',
    speedup: 'O(p / log p)',
    efficiency: 'O(1 / log p)',
    stability: 'Estable',
    suitableSizes: [8, 16, 32, 64],
    defaultSize: 16,
    generate: generateParallelRadixSortSteps,
    hasRadixView: true,
    description:
      'La base de las librerías de aceleración en GPU (como CUB / Thrust de CUDA). Descompone los números en dígitos y calcula las posiciones exactas de escritura sin bloqueos mediante un escaneo de prefijos paralelo (Prefix Sum).',
    keyInsights: [
      'No realiza comparaciones entre elementos, opera a nivel de bits o dígitos.',
      'Usa el algoritmo de Blelloch para cálculo concurrente de prefijos acumulados.',
      'Permite dispersión masivamente paralela a memoria sin carreras críticas.'
    ],
    code: [
      '# Radix Sort Paralelo con Prefijos (Blelloch Scan)',
      'def radix_sort_paralelo(arr, n, p):',
      '    for d in range(num_digitos):',
      '        # 1. Conteo de histogramas locales en hilos',
      '        hist = parallel_histogram(arr, d, p)',
      '        # 2. Escaneo de prefijos acumulados (Parallel Scan)',
      '        offsets = parallel_prefix_sum(hist)',
      '        # 3. Dispersión concurrente a búfer auxiliar',
      '        parallel_scatter(arr, offsets, d)',
      '        barrier()'
    ]
  },
  shearsort: {
    id: 'shearsort',
    name: 'Shearsort',
    subtitle: 'Ordenamiento Serpenteante en Malla 2D',
    model: 'Malla Bidimensional / Arquitectura Toroidal',
    work: 'O(n log n)',
    span: 'O(√n log n)',
    speedup: 'O(√n)',
    efficiency: 'O(1 / √n)',
    stability: 'No estable',
    suitableSizes: [16, 36, 64],
    defaultSize: 16,
    generate: generateShearSortSteps,
    hasMeshView: true,
    description:
      'Organiza los procesadores en una cuadrícula 2D (r × c). Alterna entre ordenar filas en direcciones opuestas (creando un camino en serpentina) y ordenar columnas hacia abajo. Converge en log₂(r) + 1 rondas.',
    keyInsights: [
      'Las filas pares e impares se ordenan en sentidos contrarios para aniquilar pares invertidos.',
      'La ordenación de columnas arrastra los ceros arriba y los unos abajo (teorema 0-1).',
      'Ideal para matrices procesadoras y redes en chip (NoC).'
    ],
    code: [
      '# Shearsort en Malla 2D (Filas serpiente + Columnas)',
      'def shearsort_2d(matriz, r, c):',
      '    rondas = ceil(log2(r)) + 1',
      '    for _ in range(rondas):',
      '        # Filas en paralelo (pares derecha, impares izquierda)',
      '        parallel_for fila in range(r):',
      '            if fila % 2 == 0: sort_ascendente(matriz[fila])',
      '            else: sort_descendente(matriz[fila])',
      '        # Columnas en paralelo hacia abajo',
      '        parallel_for col in range(c):',
      '            sort_columna_abajo(matriz, col)'
    ]
  },
  bucket: {
    id: 'bucket',
    name: 'Parallel Bucket Sort',
    subtitle: 'Distribución Concurrente por Rangos',
    model: 'Memoria Compartida / PRAM CREW',
    work: 'O(n + k)',
    span: 'O(n/p + log p)',
    speedup: 'O(p)',
    efficiency: 'O(1)',
    stability: 'Estable con sub-algoritmo estable',
    suitableSizes: [8, 16, 32, 64],
    defaultSize: 16,
    generate: generateParallelBucketSortSteps,
    hasBucketView: true,
    description:
      'Divide el rango numérico [min, max] en cubetas independientes asignadas a distintos hilos. Los hilos dispersan sus datos y luego ordenan su cubeta localmente sin interferencia de otros hilos.',
    keyInsights: [
      'Complejidad lineal promedio O(n/p) en distribuciones uniformes.',
      'Excelente afinidad de caché cuando las cubetas caben en el caché del procesador.',
      'Ampliamente utilizado en bases de datos paralelas y motores analíticos SQL.'
    ],
    code: [
      '# Bucket Sort Concurrente con Memoria Compartida',
      'def bucket_sort_paralelo(arr, p=4):',
      '    min_v, max_v = parallel_min_max(arr)',
      '    cubetas = [[] for _ in range(p)]',
      '    # Dispersión en paralelo',
      '    parallel_for x in arr:',
      '        idx = min(p - 1, int(((x - min_v) / (max_v - min_v + 1)) * p))',
      '        atomic_append(cubetas[idx], x)',
      '    # Ordenamiento concurrente de cubetas',
      '    parallel_for b in cubetas:',
      '        b.sort()',
      '    return concatenar(cubetas)'
    ]
  }
};
