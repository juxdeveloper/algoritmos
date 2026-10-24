import React from 'react';
import { WORKER_COLORS } from './Controls';
import { Grid, Network, Layers, GitMerge } from 'lucide-react';

export default function StructureVisualizer({ algoId, step, numWorkers }) {
  if (!step) return null;

  // 1. Shearsort 2D Grid Mesh
  if (algoId === 'shearsort' && step.meshData) {
    const { rows, cols, grid = [], phaseType, round } = step.meshData;

    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}>
          <Grid size={16} color="var(--accent-cyan)" />
          <span>Malla 2D de Procesadores ({rows}x{cols}) · Fase: {phaseType.toUpperCase()}</span>
        </div>

        <div
          className="mesh-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, 54px)` }}
        >
          {grid.map((cell) => {
            const isRowPhase = phaseType === 'rows';
            const isColPhase = phaseType === 'cols';
            const workerId = (isRowPhase ? cell.row : cell.col) % numWorkers;
            const workerColor = WORKER_COLORS[workerId % WORKER_COLORS.length];

            return (
              <div
                key={cell.index}
                className="mesh-cell"
                style={{
                  borderColor: workerColor,
                  backgroundColor: `${workerColor}18`,
                  color: '#ffffff'
                }}
              >
                <span>{cell.val}</span>
                <span className="mesh-arrow" style={{ color: workerColor }}>
                  {cell.dir === 'right' && '→ P' + workerId}
                  {cell.dir === 'left' && '← P' + workerId}
                  {isColPhase && '↓ P' + workerId}
                </span>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '480px' }}>
          En Shearsort, las filas pares se ordenan hacia la derecha y las impares hacia la izquierda.
          Luego, las columnas se ordenan hacia abajo. Esto crea un efecto de cancelación de inversiones a través de la malla 2D.
        </p>
      </div>
    );
  }

  // 2. Sample Sort Buckets & Splitters
  if (algoId === 'samplesort' && step.sampleData) {
    const { phase, splitters = [], bucketRanges = [], samples = [] } = step.sampleData;

    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}>
          <Network size={16} color="var(--accent-cyan)" />
          <span>Esquema de Muestreo & Separadores Globales (MPI Sample Sort)</span>
        </div>

        {/* Splitters display */}
        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
            SEPARADORES GLOBALES (SPLITTERS REGULARES):
          </div>
          {splitters.length > 0 ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {splitters.map((s, idx) => (
                <span
                  key={idx}
                  className="badge"
                  style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}
                >
                  S_{idx + 1} = {s}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Extrayendo muestras locales...
            </span>
          )}
        </div>

        {/* Bucket distribution */}
        {bucketRanges.length > 0 && (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              REDISTRIBUCIÓN ALL-TO-ALL POR WORKER:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bucketRanges.length}, 1fr)`, gap: '0.5rem' }}>
              {bucketRanges.map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    borderLeft: `4px solid ${WORKER_COLORS[idx % WORKER_COLORS.length]}`,
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem'
                  }}
                >
                  <strong style={{ color: WORKER_COLORS[idx % WORKER_COLORS.length] }}>Worker P{idx}:</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {b.end - b.start} elementos asignados
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Parallel Radix Sort Prefix Sum Table
  if (algoId === 'radix' && step.radixData) {
    const { digitPos, exp, histograms, globalCount, offsets } = step.radixData;

    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}>
          <Layers size={16} color="var(--accent-cyan)" />
          <span>Matriz de Histogramas & Prefijos Acumulados (Dígito 10^{digitPos})</span>
        </div>

        {histograms && (
          <div style={{ overflowX: 'auto' }}>
            <table className="algo-specs-table" style={{ textAlign: 'center' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-strong)' }}>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Núcleo</th>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                    <th key={d} style={{ padding: '6px' }}>d={d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {histograms.map((row, wId) => (
                  <tr key={wId}>
                    <td style={{ color: WORKER_COLORS[wId % WORKER_COLORS.length], fontWeight: 700, textAlign: 'left' }}>
                      P{wId}
                    </td>
                    {row.map((count, d) => (
                      <td key={d} style={{ color: count > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                        {count}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {offsets && (
          <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              DESPLAZAMIENTOS CALCULADOS POR ESCANEO DE PREFIJOS (OFFSETS):
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              {offsets.map((off, d) => (
                <span key={d} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '3px' }}>
                  [{d}]: +{off}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. MergeSort / QuickSort Tree
  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}>
        <GitMerge size={16} color="var(--accent-cyan)" />
        <span>Estructura de Subproblemas (Árbol de Reducción / Fork-Join)</span>
      </div>

      <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Nivel de Concurrencia Actual: <strong>Profundidad {step.metrics?.parallelDepth || 1}</strong>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Los subproblemas se ramifican recursivamente sin compartir estado mutable. Cada worker tiene acceso exclusivo a su segmento de memoria compartida o proceso hijo independiente.
        </div>
      </div>
    </div>
  );
}
