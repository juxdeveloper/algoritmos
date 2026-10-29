import React from 'react';
import { BookOpen, Cpu, Grid, Network, Layers, GitMerge, CheckCircle, ShieldCheck, Zap } from 'lucide-react';
import { PARALLEL_ALGORITHMS } from '../algorithms';

export default function TheoryModal() {
  const allAlgos = Object.values(PARALLEL_ALGORITHMS);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Introduction */}
      <section className="visualizer-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem' }}>
          <BookOpen size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            Matriz Teórica: Modelos de Cómputo Paralelo & Teorema de Brent
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '1050px', lineHeight: 1.55 }}>
          El análisis de algoritmos paralelos en Ciencias de la Computación trasciende la notación Big-O secuencial.
          Se fundamenta en el <strong>modelo Trabajo-Lapso (Work-Span)</strong> y en arquitecturas formales como{' '}
          <strong>PRAM</strong>, <strong>Redes de Comparadores Alambradas</strong>, <strong>Mallas Sistólicas</strong>{' '}
          y <strong>Sistemas Distribuidos MPI</strong>.
        </p>
      </section>

      {/* Brent's Theorem Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="visualizer-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-cyan)' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={16} color="var(--accent-cyan)" />
            Teorema de Brent (Brent's Scheduling Principle)
          </h3>
          <div className="formula-card" style={{ margin: '0.5rem 0' }}>
            T₁ / p ≤ T_p ≤ (T₁ - T∞)/p + T∞ ≤ T₁/p + T∞
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Establece los límites inferior y superior de tiempo al ejecutar un algoritmo con trabajo <strong>T₁</strong> y lapso crítico <strong>T∞</strong> sobre <strong>p</strong> procesadores ideales con un planificador voraz (Greedy Scheduler).
          </p>
        </div>

        <div className="visualizer-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--p1-color)' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={16} color="var(--p1-color)" />
            Taxonomía PRAM (Parallel Random Access Machine)
          </h3>
          <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', listStyleType: 'disc', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li><strong>EREW:</strong> Lectura y escritura exclusivas (Batcher, Odd-Even).</li>
            <li><strong>CREW:</strong> Lectura concurrente, escritura exclusiva (QuickSort, MergeSort).</li>
            <li><strong>CRCW:</strong> Lectura y escritura concurrentes (resueltas por Common, Arbitrary o Priority).</li>
          </ul>
        </div>

        <div className="visualizer-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-warning)' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle size={16} color="var(--accent-warning)" />
            Principio Cero-Uno (0-1 Sorting Lemma)
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Demostrado por Knuth: Si una red de comparadores (o un algoritmo insensible a los datos como Shearsort o Bitonic) ordena correctamente todas las <strong>2ⁿ</strong> secuencias posibles compuestas únicamente por ceros y unos, entonces garantiza ordenar cualquier arreglo de números reales arbitrarios.
          </p>
        </div>
      </div>

      {/* Complete Asymptotic Comparison Table */}
      <section className="visualizer-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={18} color="var(--accent-cyan)" />
          Matriz Comparativa de Algoritmos Paralelos (8 Implementaciones)
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table className="algo-specs-table" style={{ width: '100%', minWidth: '850px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-strong)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                <th style={{ padding: '0.65rem 0.5rem' }}>ALGORITMO</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>ARQUITECTURA / MODELO</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>TRABAJO T₁(n)</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>LAPSO T∞(n)</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>SPEEDUP S_p</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>EFICIENCIA E_p</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>ESTABILIDAD</th>
                <th style={{ padding: '0.65rem 0.5rem' }}>CASO DE USO ÓPTIMO</th>
              </tr>
            </thead>
            <tbody>
              {allAlgos.map((algo) => (
                <tr key={algo.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                  <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: '#fff' }}>
                    {algo.name}
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem', color: 'var(--accent-cyan)' }}>
                    {algo.model}
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {algo.work}
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--p1-color)' }}>
                    {algo.span}
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-success)' }}>
                    {algo.speedup}
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--p0-color)' }}>
                    {algo.efficiency}
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem' }}>
                    <span
                      style={{
                        color: algo.stability.startsWith('Estable')
                          ? 'var(--accent-success)'
                          : 'var(--text-secondary)'
                      }}
                    >
                      {algo.stability}
                    </span>
                  </td>
                  <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                    {algo.id === 'bitonic' && 'FPGAs, ASICs y Bitonic Sort en shaders compute HLSL/GLSL'}
                    {algo.id === 'oddeven' && 'Arreglos sistólicos lineales y computación cuántica/óptica'}
                    {algo.id === 'quicksort' && 'CPUs multinúcleo con memoria compartida y multiprocessing'}
                    {algo.id === 'mergesort' && 'Sistemas de bases de datos externas con streaming en paralelo'}
                    {algo.id === 'samplesort' && 'Clusters de supercómputo y librerías de paso de mensajes MPI'}
                    {algo.id === 'radix' && 'Tarjetas gráficas masivas NVIDIA CUDA (CUB / Thrust)'}
                    {algo.id === 'shearsort' && 'Procesadores en malla 2D y redes en chip (Network-on-Chip)'}
                    {algo.id === 'bucket' && 'Motores analíticos SQL distribuidos en memoria uniforme'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Architectural deep dives */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
        <div className="visualizer-panel" style={{ padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
            1. Redes de Comparadores (Bitonic Sort)
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            A diferencia de los algoritmos basados en ramas condicionales en software, una red de ordenamiento está cableada en hardware. No sufre penalizaciones por predicción de saltos errónea (branch misprediction). Esto la hace ideal para GPUs y pipelines de alta frecuencia.
          </p>
        </div>

        <div className="visualizer-panel" style={{ padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--p1-color)', marginBottom: '0.5rem' }}>
            2. Redes de Interconexión 2D (Shearsort)
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Shearsort es el algoritmo clásico en topologías bidimensionales (mesh). Al ordenar filas adyacentes en sentidos opuestos (serpentina) y columnas hacia abajo, cada fase reduce el número de filas "sucias" (filas con ceros y unos mezclados) a la mitad, convergiendo en O(√n log n).
          </p>
        </div>

        <div className="visualizer-panel" style={{ padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-warning)', marginBottom: '0.5rem' }}>
            3. Algoritmo de Blelloch (Parallel Radix Sort)
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Radix Sort paralelo elimina las comparaciones directas. Usa un escaneo de prefijos en 2 pasadas (Up-sweep hacia la raíz y Down-sweep hacia las hojas) para calcular los desplazamientos exactos de memoria en tiempo O(log n), permitiendo dispersiones libres de cerrojos (lock-free).
          </p>
        </div>
      </div>
    </div>
  );
}
