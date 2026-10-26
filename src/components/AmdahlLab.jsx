import React, { useState } from 'react';
import { Cpu, Zap, Activity, Info, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

export default function AmdahlLab() {
  const [parallelFraction, setParallelFraction] = useState(0.85); // P (85%)
  const [numCores, setNumCores] = useState(8); // p
  const [overhead, setOverhead] = useState(0.02); // k overhead fraction (communication/IPC)

  // Calculations
  const P = parallelFraction;
  const S_serial = 1 - P;
  const p = numCores;

  // Standard Amdahl's Speedup: S = 1 / ((1 - P) + P/p + overhead*(p-1)/p)
  const speedupAmdahl = 1 / (S_serial + P / p + overhead * ((p - 1) / p));
  const maxTheoreticalSpeedup = 1 / S_serial;
  const efficiency = (speedupAmdahl / p) * 100;

  // Gustafson's Law (scaled speedup): S_g = p - S_serial * (p - 1)
  const gustafsonSpeedup = p - S_serial * (p - 1);

  // Karp-Flatt Metric: e = (1/S - 1/p) / (1 - 1/p)
  const karpFlatt = p > 1 ? (1 / speedupAmdahl - 1 / p) / (1 - 1 / p) : S_serial;

  // Generate SVG curve points for p in [1..64]
  const plotCores = [1, 2, 4, 8, 12, 16, 24, 32, 48, 64];
  const maxPlotY = Math.min(35, Math.max(12, maxTheoreticalSpeedup * 1.2));

  const svgWidth = 560;
  const svgHeight = 240;
  const padLeft = 45;
  const padBottom = 30;
  const padTop = 20;
  const padRight = 20;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const scaleX = (core) => padLeft + ((core - 1) / (64 - 1)) * chartW;
  const scaleY = (speed) => padTop + chartH - (Math.min(speed, maxPlotY) / maxPlotY) * chartH;

  // Amdahl line points
  const amdahlPoints = [];
  for (let c = 1; c <= 64; c++) {
    const s = 1 / (S_serial + P / c + overhead * ((c - 1) / c));
    amdahlPoints.push(`${scaleX(c)},${scaleY(s)}`);
  }

  // Linear ideal points
  const idealPoints = [];
  for (let c = 1; c <= 64; c++) {
    idealPoints.push(`${scaleX(c)},${scaleY(c)}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner / Explanation */}
      <section className="visualizer-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem' }}>
          <Cpu size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            Laboratorio de Escalabilidad: Ley de Amdahl, Gustafson & el GIL de Python
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '1000px', lineHeight: 1.55 }}>
          En computación paralela, agregar más núcleos o hilos no reduce el tiempo a cero. La{' '}
          <strong>Ley de Amdahl (1967)</strong> demuestra que la porción estrictamente secuencial de un algoritmo
          actúa como un techo insuperable para la aceleración (Speedup). Además, en entornos como CPython, el{' '}
          <strong>GIL (Global Interpreter Lock)</strong> y el costo de serialización (IPC) imponen barreras adicionales.
        </p>
      </section>

      {/* Main Interactive Grid */}
      <div className="amdahl-grid">
        {/* Left: Controls & Parameter Sliders */}
        <div className="visualizer-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={16} color="var(--accent-warning)" />
            Parámetros del Sistema Paralelo
          </h3>

          {/* Fraction Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600 }}>Fracción Paralelizable (P):</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {(P * 100).toFixed(1)}% (Secuencial: {(S_serial * 100).toFixed(1)}%)
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="0.999"
              step="0.005"
              value={parallelFraction}
              onChange={(e) => setParallelFraction(Number(e.target.value))}
              className="custom-slider"
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>50% (Poco paralelo)</span>
              <span>95% (Sort típico)</span>
              <span>99.9% (Ideal)</span>
            </div>
          </div>

          {/* Cores Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600 }}>Número de Núcleos (p):</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--p1-color)', fontWeight: 700 }}>
                {p} Cores
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="64"
              step="1"
              value={numCores}
              onChange={(e) => setNumCores(Number(e.target.value))}
              className="custom-slider"
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>1 Core</span>
              <span>8 Cores (PC)</span>
              <span>64 Cores (Servidor)</span>
            </div>
          </div>

          {/* IPC / Comm Overhead Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600 }}>Sobrecarga de Sincronización / IPC (κ):</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-danger)', fontWeight: 700 }}>
                {(overhead * 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.1"
              step="0.005"
              value={overhead}
              onChange={(e) => setOverhead(Number(e.target.value))}
              className="custom-slider"
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>0% (Memoria PRAM pura)</span>
              <span>5% (MPI / Pickle IPC)</span>
            </div>
          </div>

          {/* Computed Results Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div className="metric-box">
              <span className="label">Speedup Real S(p)</span>
              <span className="val" style={{ color: 'var(--accent-success)' }}>
                {speedupAmdahl.toFixed(2)}x
              </span>
              <span className="sub">Con {p} procesadores</span>
            </div>

            <div className="metric-box">
              <span className="label">Límite Amdahl (p→∞)</span>
              <span className="val" style={{ color: 'var(--accent-warning)' }}>
                {maxTheoreticalSpeedup.toFixed(2)}x
              </span>
              <span className="sub">1 / (1 - P)</span>
            </div>

            <div className="metric-box">
              <span className="label">Eficiencia E(p)</span>
              <span className="val" style={{ color: 'var(--accent-cyan)' }}>
                {efficiency.toFixed(1)}%
              </span>
              <span className="sub">S(p) / p</span>
            </div>

            <div className="metric-box">
              <span className="label">Métrica Karp-Flatt (e)</span>
              <span className="val" style={{ color: 'var(--p1-color)' }}>
                {(karpFlatt * 100).toFixed(2)}%
              </span>
              <span className="sub">Fricción serial efectiva</span>
            </div>
          </div>
        </div>

        {/* Right: SVG Graph & Comparative Law Explanations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Interactive Chart */}
          <div className="visualizer-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                Curva de Rendimiento: Speedup vs Número de Procesadores (1 a 64 Cores)
              </h3>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}>
                  ── Ley de Amdahl S(p)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                  ┈┈ Ideal Lineal (S=p)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-warning)' }}>
                  ╍╍ Asíntota Máxima
                </span>
              </div>
            </div>

            {/* SVG Plot */}
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', background: '#050811', borderRadius: '8px' }}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const y = padTop + chartH * (1 - pct);
                  const val = (pct * maxPlotY).toFixed(0);
                  return (
                    <g key={i}>
                      <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="#1e293b" strokeDasharray="3,3" />
                      <text x={padLeft - 6} y={y + 3} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                        {val}x
                      </text>
                    </g>
                  );
                })}

                {/* X Axis ticks */}
                {[1, 8, 16, 32, 48, 64].map((core) => {
                  const x = scaleX(core);
                  return (
                    <g key={core}>
                      <line x1={x} y1={padTop} x2={x} y2={padTop + chartH} stroke="#1e293b" strokeDasharray="2,2" />
                      <text x={x} y={svgHeight - 10} fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">
                        {core}p
                      </text>
                    </g>
                  );
                })}

                {/* Max Theoretical Asymptote (Amdahl Limit) */}
                {maxTheoreticalSpeedup < maxPlotY && (
                  <line
                    x1={padLeft}
                    y1={scaleY(maxTheoreticalSpeedup)}
                    x2={svgWidth - padRight}
                    y2={scaleY(maxTheoreticalSpeedup)}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                  />
                )}

                {/* Ideal Linear Line */}
                <polyline
                  points={idealPoints.join(' ')}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />

                {/* Amdahl Curve */}
                <polyline
                  points={amdahlPoints.join(' ')}
                  fill="none"
                  stroke="var(--accent-cyan)"
                  strokeWidth="2.5"
                />

                {/* Current Operating Point */}
                <circle
                  cx={scaleX(p)}
                  cy={scaleY(speedupAmdahl)}
                  r="6"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={Math.min(svgWidth - 90, scaleX(p) + 10)}
                  y={Math.max(30, scaleY(speedupAmdahl) - 10)}
                  fill="#38bdf8"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  ({p} cores, {speedupAmdahl.toFixed(2)}x)
                </text>
              </svg>
            </div>
          </div>

          {/* Formulas and Laws Comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="formula-card">
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Ley de Amdahl (Carga Fija)
              </span>
              <div style={{ color: '#fff', fontSize: '0.95rem', margin: '4px 0' }}>
                S(p) = 1 / ((1 - P) + P/p)
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Asume que el tamaño del problema N es constante. Si el 15% del código es serial, el speedup nunca excederá 6.67x sin importar cuántos núcleos se usen.
              </p>
            </div>

            <div className="formula-card">
              <span style={{ color: 'var(--p1-color)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Ley de Gustafson (Carga Escalada)
              </span>
              <div style={{ color: '#fff', fontSize: '0.95rem', margin: '4px 0' }}>
                S_G(p) = p - α(p - 1)
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Al tener más procesadores, resolvemos problemas mucho más grandes en el mismo tiempo. La fracción paralela crece con N, permitiendo escalabilidad lineal masiva.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deep Educational Section: Python GIL & Multiprocessing */}
      <section className="visualizer-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
          <AlertTriangle size={18} color="var(--accent-warning)" />
          El Gran Dilema en Python: GIL, Hilos vs Procesos en Tarea 6 EDA II
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', fontSize: '0.82rem', lineHeight: 1.55 }}>
          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '3px solid #ef4444' }}>
            <h4 style={{ color: '#ef4444', fontWeight: 700, marginBottom: '0.4rem' }}>
              1. Por qué `threading` no paraleliza QuickSort en Python
            </h4>
            <p style={{ color: 'var(--text-secondary)' }}>
              En CPython, el <strong>Global Interpreter Lock (GIL)</strong> es un mutex que protege la gestión interna de memoria y el conteo de referencias. Solo <em>un hilo</em> puede ejecutar código bytecode de Python a la vez. En algoritmos intensivos de CPU (como comparar e intercambiar enteros en QuickSort), crear múltiples hilos produce <strong>desaceleración</strong> por el constante cambio de contexto y contención del cerrojo.
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-success)' }}>
            <h4 style={{ color: 'var(--accent-success)', fontWeight: 700, marginBottom: '0.4rem' }}>
              2. La Solución: `multiprocessing` y `ProcessPoolExecutor`
            </h4>
            <p style={{ color: 'var(--text-secondary)' }}>
              Para utilizar el 100% de los núcleos físicos de la computadora, se recurre a <strong>multiprocesos</strong>. Cada proceso tiene su propio intérprete de Python, su propio espacio de memoria virtual y su propio GIL independiente. Esto permite ejecución verdaderamente paralela en múltiples núcleos físicos de CPU sin colisión de cerrojos.
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-warning)' }}>
            <h4 style={{ color: 'var(--accent-warning)', fontWeight: 700, marginBottom: '0.4rem' }}>
              3. El Costo Oculto: IPC y el Umbral Mínimo (Threshold)
            </h4>
            <p style={{ color: 'var(--text-secondary)' }}>
              Comunicar arreglos entre procesos requiere <strong>serialización (pickle)</strong> y llamadas al sistema (IPC por sockets o tuberías). Si se crea un sub-proceso para particionar arreglos de solo 10 elementos, el tiempo de serializar datos supera con creces el tiempo de ordenar. Por ello, la <strong>Tarea 6 de EDA II</strong> implementa un <em>umbral</em>: por debajo de cierto tamaño (ej. 10,000 elementos), se ejecuta QuickSort serial inmediato.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
