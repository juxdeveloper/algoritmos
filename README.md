# PARASORT · Laboratorio Interactivo de Algoritmos de Ordenamiento Paralelos

**Estructuras de Datos y Algoritmos II · Facultad de Ingeniería, UNAM (Semestre 2026-1)**  
**Equipo:** Algoritmos de ordenamiento paralelos  
**Pull Request:** [#27 (equipo/paralelos → simulacion)](https://github.com/UNAM-FI-EDAII-2026-1/eda-2-juxdeveloper/pull/27)  
**Sitio en Vivo (GitHub Pages):** [https://juxdeveloper.github.io/algoritmos/](https://juxdeveloper.github.io/algoritmos/)

---

## 🌟 Descripción General

**PARASORT** es una plataforma educativa interactiva de alto rendimiento desarrollada con **React**, **Vite** y **HTML5/Canvas/CSS** diseñada para ilustrar de forma clara, intuitiva y rigurosa el funcionamiento de los algoritmos de ordenamiento paralelos y distribuidos más importantes de la computación moderna.

El proyecto permite no solo ver el movimiento de los datos paso a paso o en tiempo real, sino también analizar cómo se distribuye la carga de trabajo entre múltiples procesadores / hilos ($P_0, P_1, \dots, P_{p-1}$), inspeccionar barreras de sincronización, redes de comparadores alambrados, mallas bidimensionales y estudiar los límites teóricos impuestos por la **Ley de Amdahl**, la **Ley de Gustafson** y el **Global Interpreter Lock (GIL)** de Python.

---

## 🚀 Los 6 Algoritmos Paralelos Implementados

| Algoritmo | Modelo / Arquitectura | Trabajo $T_1(n)$ | Lapso $T_\infty(n)$ | Aceleración $S_p$ | Eficiencia $E_p$ | Estabilidad | Caso Óptimo |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Parallel MergeSort** | Reducción Binaria / Memoria Local | $O(n \log n)$ | $O(n/p + \log n)$ | $O(p)$ | $O(1)$ | Sí | Streaming paralelo y bases de datos |
| **Parallel QuickSort** | Fork-Join / PRAM CREW / ProcessPool | $O(n \log n)$ | $O(\log^2 n)$ | $O(p / \log p)$ | $O(1 / \log p)$ | No | CPUs multinúcleo compartidas |
| **Parallel Bucket Sort** | Memoria Compartida / PRAM CREW | $O(n + k)$ | $O(n/p + \log p)$ | $O(p)$ | $O(1)$ | Sí (con sub-sort estable) | Motores analíticos SQL |
| **Parallel Radix Sort** | SIMD / GPU / Blelloch Prefix Sum | $O(k \cdot n)$ | $O(k(n/p + \log p))$ | $O(p / \log p)$ | $O(1 / \log p)$ | Sí | NVIDIA CUDA (CUB / Thrust) |
| **Sample Sort** | Memoria Distribuida / MPI Clusters | $O(n \log n)$ | $O((n/p)\log(n/p) + p\log p)$ | $O(p)$ | $O(1)$ | No | Supercómputo y clusters MPI |
| **Bitonic Sort** | Red de Comparadores / PRAM EREW | $O(n \log^2 n)$ | $O(\log^2 n)$ | $O(n)$ | $O(1 / \log n)$ | No | FPGAs, ASICs, GPUs |

---

## 🔬 Módulos Principales de la Aplicación

### 1. Simulador Principal Multivista
- **Visualizador de Barras Concurrente:** Cada barra indica su valor numérico, índice y el núcleo asignado ($P_i$). Identifica operaciones de comparación (amarillo) e intercambio (rojo) simultáneas.
- **Línea de Tiempo Gantt:** Muestra la utilización y estado exacto de cada hilo en cada instante de tiempo (comparando, particionando, mezclando, barrera de sincronización o inactivo).
- **Red de Comparadores Alambrada (Sorting Network):** Dibuja los cables de datos horizontales y los comparadores verticales concurrentes para Bitonic Sort.
- **Vistas Guiadas Interactivas Paso a Paso (`Mapa Bitónico` y `Vista Guiada`):** vistas didácticas con ejemplos clásicos precargables, navegación directa por etapas y explicación sincronizada del estado de cada núcleo:
  - **Mapa Bitónico Guiado (Bitonic Sort):** inicia con el ejemplo clásico de 8 elementos ($N = 8$) y organiza cada etapa según el tamaño de bloque $k$ (`↑ Asc` / `↓ Desc`) y el salto de comparación $d$:
    - *Fila original de referencia y selector `Antes` / `Después`:* conserva el arreglo original como referencia fija y permite alternar entre el estado previo y posterior al paso actual.
    - *Arcos mariposa (SVG):* traza arcos SVG entre cada pareja comparada a distancia $d$ dentro de cada bloque, destacando intercambios efectivos y comparaciones sin cambio.
    - *Tarjetas por núcleo ($P_i$):* muestra las parejas asignadas a cada procesador, su dirección (`↑ Asc` o `↓ Desc`) y el resultado de cada comparación concurrente.
  - **Vista Guiada de Parallel QuickSort:** árbol Fork-Join interactivo sobre el ejemplo clásico de 7 elementos con 2 núcleos ($P_0, P_1$), mostrando la elección de pivote, la partición en subarreglos menores/mayores, el despacho concurrente de ramas y su ensamblado final.
  - **Vista Guiada de Parallel Radix Sort:** simulador paso a paso por dígito (unidades y decenas) sobre el ejemplo clásico de 8 elementos con 2 núcleos, ilustrando el histograma local de conteo, la matriz de sumas de prefijo (*Parallel Scan*) y la dispersión concurrente a posiciones exactas.
  - **Vista Guiada de Sample Sort (MPI):** recorrido guiado por fases distribuidas sobre el ejemplo clásico de 8 elementos con 2 procesos, visualizando el ordenamiento local, el muestreo regular, los separadores globales (*splitters*), el intercambio *All-to-All* y la mezcla final.
- **Estructura Concurrente (MergeSort y Bucket Sort):**
  - *Árbol de Reducción / Fork-Join (Parallel MergeSort):* visualiza la jerarquía de subproblemas divididos y las etapas de fusión binaria concurrente.
  - *Distribución en Cubetas (Parallel Bucket Sort):* muestra los rangos asignados por cubeta, la dispersión paralela y el ordenamiento local sin contención.
- **Consola de Código Sincronizada:** Muestra la implementación canónica en Python/pseudocódigo resaltando la línea exacta en ejecución en cada paso.

### 2. Arena de Carreras (Side-by-Side Race Arena)
- Permite enfrentar hasta 6 algoritmos paralelos en simultáneo sobre el **mismo conjunto de datos idéntico**.
- Selección de distribuciones: Aleatorio Uniforme, Inverso (Peor Caso), Casi Ordenado (90%), Muchos Duplicados, y Picos Alternantes.
- Podio de ganadores evaluado por lapso paralelo ($T_\infty$) y trabajo total ($T_1$), con animación de confeti para el vencedor.

### 3. Laboratorio de Ley de Amdahl & GIL
- Controles interactivos con deslizadores para la fracción paralelizable ($P \in [50\%, 99.9\%]$), número de núcleos ($p \in [1, 64]$) y costo de sobrecarga de comunicación/IPC ($\kappa$).
- Gráfica SVG en tiempo real que traza la curva de Speedup de Amdahl, la cota asíntota teórica $1/(1-P)$ y la recta ideal lineal $S = p$.
- Comparación con la **Ley de Gustafson** (escalabilidad de tamaño variable) y cálculo de la **Métrica de Karp-Flatt** ($e$).
- Análisis didáctico sobre por qué `threading` en Python es insuficiente para algoritmos de CPU bound debido al **GIL (Global Interpreter Lock)** y cómo `multiprocessing.ProcessPoolExecutor` resuelve la contención a costa de la serialización (pickle) e IPC.

### 4. Matriz Teórica
- Análisis formal del **Teorema de Brent (Brent's Scheduling Principle)**: $T_p \le T_1/p + T_\infty$.
- Taxonomía PRAM (EREW, CREW, CRCW).
- Principio Cero-Uno (0-1 Sorting Lemma) de Knuth.

---

## ⌨️ Atajos de Teclado
- **Espacio:** Iniciar / Pausar reproducción.
- **Flecha Izquierda ($\leftarrow$):** Retroceder un paso.
- **Flecha Derecha ($\rightarrow$):** Avanzar un paso.
- **R:** Reiniciar el algoritmo al estado inicial.

---

## 🛠️ Ejecución Local

```bash
# Entrar a la carpeta del proyecto
cd Proyecto

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo local
npm run dev

# Generar build de producción optimizada
npm run build

# Previsualizar build de producción
npm run preview
```

---

## 🌐 Despliegue Automatizado con GitHub Actions

El repositorio cuenta con un flujo de integración continua en `.github/workflows/deploy.yml` que compila automáticamente la aplicación React con Vite y la despliega a **GitHub Pages** en cada `git push`.
