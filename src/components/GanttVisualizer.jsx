import React from 'react';
import { WORKER_COLORS } from './Controls';
import { Cpu, CheckCircle, Clock, Zap } from 'lucide-react';

export default function GanttVisualizer({ step, numWorkers }) {
  if (!step) return null;

  const { activeWorkers = [], barriers } = step;

  const getStateLabel = (state) => {
    switch (state) {
      case 'comparing': return 'Comparando';
      case 'swapping': return 'Intercambio';
      case 'partitioning': return 'Particionando';
      case 'merging': return 'Mezclando';
      case 'barrier': return 'Barrera Sync';
      case 'idle': return 'Inactivo (Idle)';
      default: return 'Inactivo';
    }
  };

  const getStateColor = (state, workerId) => {
    const baseColor = WORKER_COLORS[workerId % WORKER_COLORS.length];
    switch (state) {
      case 'comparing': return baseColor;
      case 'swapping': return '#ef4444';
      case 'partitioning': return '#a855f7';
      case 'merging': return '#06b6d4';
      case 'barrier': return '#f59e0b';
      case 'idle': return '#1e293b';
      default: return '#1e293b';
    }
  };

  const activeCoresCount = activeWorkers.filter(w => w.state !== 'idle').length;
  const utilizationPct = Math.round((activeCoresCount / numWorkers) * 100);

  return (
    <div className="gantt-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}>
          <Clock size={15} color="var(--accent-cyan)" />
          <span>Líneas de Ejecución de Hilos / Núcleos (Gantt Concurrente)</span>
        </div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
          Utilización de CPU: {utilizationPct}% ({activeCoresCount}/{numWorkers} cores)
        </div>
      </div>

      {Array.from({ length: numWorkers }, (_, id) => {
        const worker = activeWorkers.find(w => w.workerId === id) || { state: 'idle', indices: [] };
        const stateColor = getStateColor(worker.state, id);
        const stateLabel = getStateLabel(worker.state);
        const isActive = worker.state !== 'idle';

        return (
          <div key={id} className="gantt-lane">
            <div
              className="gantt-worker-label"
              style={{ color: WORKER_COLORS[id % WORKER_COLORS.length] }}
            >
              <Cpu size={12} style={{ display: 'inline', marginRight: '4px' }} />
              P{id}
            </div>

            <div className="gantt-track">
              {isActive ? (
                <div
                  className="gantt-block"
                  style={{
                    width: '100%',
                    backgroundColor: stateColor,
                    boxShadow: `0 0 10px ${stateColor}44`,
                  }}
                >
                  <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                    {stateLabel} {worker.indices?.length > 0 ? `· elems [${worker.indices.slice(0, 4).join(', ')}${worker.indices.length > 4 ? '...' : ''}]` : ''}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', paddingLeft: '8px', fontStyle: 'italic' }}>
                  En espera / Sincronizado
                </span>
              )}
            </div>
          </div>
        );
      })}

      {barriers && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.85rem',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: '#fbbf24'
          }}
        >
          <Zap size={14} />
          <span>
            <strong>Barrera de Memoria Global (Barrier):</strong> Ningún procesador puede avanzar al siguiente ciclo hasta que todos los hilos concluyan su fase actual.
          </span>
        </div>
      )}
    </div>
  );
}
