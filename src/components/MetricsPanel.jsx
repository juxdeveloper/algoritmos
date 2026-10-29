import React from 'react';
import { Cpu, Zap, Activity, ShieldCheck, Gauge, Layers, Info } from 'lucide-react';
import { PARALLEL_ALGORITHMS } from '../algorithms';

export default function MetricsPanel({ selectedAlgo, step, numWorkers, arraySize }) {
  const algo = PARALLEL_ALGORITHMS[selectedAlgo] || PARALLEL_ALGORITHMS.bitonic;

  if (!step) {
    return (
      <aside className="side-column">
        <div className="visualizer-panel" style={{ padding: '1rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Cargando métricas...</p>
        </div>
      </aside>
    );
  }

  const activeWorkers = step.activeWorkers || [];
  const activeCoresCount = activeWorkers.filter((w) => w.state && w.state !== 'idle').length;
  const coreUtilization = Math.round((activeCoresCount / numWorkers) * 100);

  const totalComps = step.metrics?.totalComparisons ?? 0;
  const totalSwaps = step.metrics?.totalSwaps ?? 0;
  const parallelDepth = step.metrics?.parallelDepth ?? step.stepIndex ?? 0;

  // Theoretical speedup estimate for current parameters
  let theoreticalSpeedup = '—';
  let efficiency = '—';
  if (numWorkers > 0) {
    if (selectedAlgo === 'bitonic') {
      const sp = Math.min(numWorkers, arraySize / 2);
      theoreticalSpeedup = `${sp.toFixed(1)}x`;
      efficiency = `${Math.round((sp / numWorkers) * 100)}%`;
    } else if (selectedAlgo === 'oddeven') {
      const sp = Math.min(numWorkers, arraySize / 2);
      theoreticalSpeedup = `${sp.toFixed(1)}x`;
      efficiency = `${Math.round((sp / numWorkers) * 100)}%`;
    } else if (selectedAlgo === 'quicksort') {
      const sp = Math.min(numWorkers, Math.log2(numWorkers + 1) * 1.5);
      theoreticalSpeedup = `${sp.toFixed(1)}x`;
      efficiency = `${Math.round((sp / numWorkers) * 100)}%`;
    } else if (selectedAlgo === 'shearsort') {
      const sp = Math.min(numWorkers, Math.sqrt(arraySize));
      theoreticalSpeedup = `${sp.toFixed(1)}x`;
      efficiency = `${Math.round((sp / numWorkers) * 100)}%`;
    } else {
      const sp = numWorkers * 0.85;
      theoreticalSpeedup = `${sp.toFixed(1)}x`;
      efficiency = `${Math.round((sp / numWorkers) * 100)}%`;
    }
  }

  return (
    <aside className="side-column">
      {/* Metric Cards Grid */}
      <div className="metric-card-grid">
        <div className="metric-box">
          <span className="label">Núcleos Activos</span>
          <span className="val" style={{ color: 'var(--accent-cyan)' }}>
            {activeCoresCount} / {numWorkers}
          </span>
          <span className="sub">{coreUtilization}% Utilización CPU</span>
        </div>

        <div className="metric-box">
          <span className="label">Profundidad (Span T∞)</span>
          <span className="val" style={{ color: 'var(--p1-color)' }}>
            {parallelDepth}
          </span>
          <span className="sub">Pasos paralelos</span>
        </div>

        <div className="metric-box">
          <span className="label">Comparaciones</span>
          <span className="val" style={{ color: 'var(--accent-warning)' }}>
            {totalComps}
          </span>
          <span className="sub">Operaciones de red</span>
        </div>

        <div className="metric-box">
          <span className="label">Intercambios (Swaps)</span>
          <span className="val" style={{ color: 'var(--accent-danger)' }}>
            {totalSwaps}
          </span>
          <span className="sub">Movimientos en memoria</span>
        </div>

        <div className="metric-box">
          <span className="label">Speedup Estimado (Sp)</span>
          <span className="val" style={{ color: 'var(--accent-success)' }}>
            {theoreticalSpeedup}
          </span>
          <span className="sub">T₁ / T_p teórico</span>
        </div>

        <div className="metric-box">
          <span className="label">Eficiencia (Ep)</span>
          <span className="val" style={{ color: 'var(--p0-color)' }}>
            {efficiency}
          </span>
          <span className="sub">Sp / p asignados</span>
        </div>
      </div>

      {/* Algorithm Specs Table */}
      <div className="visualizer-panel" style={{ padding: '1rem 1.15rem' }}>
        <h3
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            color: 'var(--text-primary)'
          }}
        >
          <Gauge size={16} color="var(--accent-cyan)" />
          Especificación Teórica (Brent / PRAM)
        </h3>

        <table className="algo-specs-table">
          <tbody>
            <tr>
              <td>Modelo Concurrente</td>
              <td style={{ color: 'var(--accent-cyan)' }}>{algo.model}</td>
            </tr>
            <tr>
              <td>Trabajo Total T₁(n)</td>
              <td>{algo.work}</td>
            </tr>
            <tr>
              <td>Lapso Paralelo T∞(n)</td>
              <td>{algo.span}</td>
            </tr>
            <tr>
              <td>Speedup Asintótico</td>
              <td>{algo.speedup}</td>
            </tr>
            <tr>
              <td>Eficiencia Paralela</td>
              <td>{algo.efficiency}</td>
            </tr>
            <tr>
              <td>Estabilidad</td>
              <td>
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
            </tr>
          </tbody>
        </table>
      </div>

      {/* Key Insights */}
      {algo.keyInsights && (
        <div className="visualizer-panel" style={{ padding: '1rem 1.15rem' }}>
          <h3
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              marginBottom: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: 'var(--text-primary)'
            }}
          >
            <Info size={16} color="var(--p1-color)" />
            Principios de Arquitectura
          </h3>
          <ul
            style={{
              listStyleType: 'disc',
              paddingLeft: '1.15rem',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              lineHeight: 1.45
            }}
          >
            {algo.keyInsights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
