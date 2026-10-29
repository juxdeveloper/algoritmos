import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Play, Pause, RotateCcw, Shuffle, Trophy, Cpu, Zap, Award, Layers } from 'lucide-react';
import { PARALLEL_ALGORITHMS } from '../algorithms';
import { WORKER_COLORS } from './Controls';

export default function RaceArena() {
  const [arraySize, setArraySize] = useState(16);
  const [numWorkers, setNumWorkers] = useState(4);
  const [distribution, setDistribution] = useState('random');
  const [speed, setSpeed] = useState(1.5);

  const [selectedAlgos, setSelectedAlgos] = useState([
    'bitonic',
    'oddeven',
    'quicksort',
    'mergesort',
    'samplesort',
    'shearsort'
  ]);

  const [initialData, setInitialData] = useState([]);
  const [raceStates, setRaceStates] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [raceRankings, setRaceRankings] = useState([]);
  const timerRef = useRef(null);

  // Generate initial dataset based on distribution
  const generateData = (size, dist) => {
    let arr = [];
    if (dist === 'reversed') {
      arr = Array.from({ length: size }, (_, i) => size - i);
    } else if (dist === 'nearlySorted') {
      arr = Array.from({ length: size }, (_, i) => i + 1);
      for (let i = 0; i < Math.max(1, Math.floor(size * 0.15)); i++) {
        const a = Math.floor(Math.random() * size);
        const b = Math.floor(Math.random() * size);
        [arr[a], arr[b]] = [arr[b], arr[a]];
      }
    } else if (dist === 'duplicates') {
      arr = Array.from({ length: size }, () => Math.floor(Math.random() * 5) + 1);
    } else if (dist === 'alternating') {
      arr = Array.from({ length: size }, (_, i) => (i % 2 === 0 ? i * 2 + 5 : size * 2 - i * 2));
    } else {
      arr = Array.from({ length: size }, () => Math.floor(Math.random() * 95) + 5);
    }
    return arr;
  };

  // Initialize or reset race
  const initializeRace = (data) => {
    const dataToUse = data || initialData;
    const states = {};

    selectedAlgos.forEach((algoId) => {
      const algoDef = PARALLEL_ALGORITHMS[algoId];
      if (algoDef) {
        const steps = algoDef.generate(dataToUse, numWorkers);
        states[algoId] = {
          steps,
          currentIndex: 0,
          currentStep: steps[0],
          isFinished: false,
          finishRank: null,
          totalSteps: steps.length
        };
      }
    });

    setRaceStates(states);
    setRaceRankings([]);
  };

  // Re-generate fresh data
  const handleShuffle = () => {
    setIsPlaying(false);
    const newData = generateData(arraySize, distribution);
    setInitialData(newData);
    initializeRace(newData);
  };

  // Change parameters
  useEffect(() => {
    const data = generateData(arraySize, distribution);
    setInitialData(data);
    initializeRace(data);
  }, [arraySize, distribution, numWorkers, selectedAlgos]);

  // Race tick animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.max(25, Math.floor(350 / speed));

    timerRef.current = setInterval(() => {
      setRaceStates((prev) => {
        let allDone = true;
        const next = { ...prev };
        const finishedThisTick = [];

        for (const algoId of Object.keys(next)) {
          const racer = next[algoId];
          if (!racer.isFinished) {
            if (racer.currentIndex < racer.totalSteps - 1) {
              allDone = false;
              const nextIdx = racer.currentIndex + 1;
              next[algoId] = {
                ...racer,
                currentIndex: nextIdx,
                currentStep: racer.steps[nextIdx]
              };
            } else {
              finishedThisTick.push(algoId);
            }
          }
        }

        if (finishedThisTick.length > 0) {
          setRaceRankings((prevRank) => {
            const newRank = [...prevRank];
            finishedThisTick.forEach((id) => {
              if (!newRank.includes(id)) {
                newRank.push(id);
                next[id] = {
                  ...next[id],
                  isFinished: true,
                  finishRank: newRank.length
                };
              }
            });
            if (newRank.length === 1) {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
              });
            }
            return newRank;
          });
        }

        if (allDone) {
          setIsPlaying(false);
        }

        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed]);

  const toggleAlgoSelection = (algoId) => {
    if (selectedAlgos.includes(algoId)) {
      if (selectedAlgos.length > 1) {
        setSelectedAlgos(selectedAlgos.filter((id) => id !== algoId));
      }
    } else {
      setSelectedAlgos([...selectedAlgos, algoId]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Race Top Controls */}
      <section className="control-deck">
        <div className="controls-row-top" style={{ alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              ALGORITMOS EN PISTA
            </label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {Object.values(PARALLEL_ALGORITHMS).map((algo) => {
                const active = selectedAlgos.includes(algo.id);
                return (
                  <button
                    key={algo.id}
                    onClick={() => toggleAlgoSelection(algo.id)}
                    style={{
                      background: active ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-surface-elevated)',
                      border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                      color: active ? '#fff' : 'var(--text-muted)',
                      padding: '0.25rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      fontWeight: active ? 700 : 500,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {algo.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              TAMAÑO (N)
            </label>
            <select
              className="custom-select"
              value={arraySize}
              onChange={(e) => setArraySize(Number(e.target.value))}
            >
              <option value={16}>N = 16 elementos</option>
              <option value={32}>N = 32 elementos</option>
              <option value={64}>N = 64 elementos</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              DISTRIBUCIÓN
            </label>
            <select
              className="custom-select"
              value={distribution}
              onChange={(e) => setDistribution(e.target.value)}
            >
              <option value="random">Aleatorio Uniforme</option>
              <option value="reversed">Inverso (Peor Caso)</option>
              <option value="nearlySorted">Casi Ordenado (90%)</option>
              <option value="duplicates">Muchos Duplicados</option>
              <option value="alternating">Picos Alternantes</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              NÚCLEOS (P)
            </label>
            <select
              className="custom-select"
              value={numWorkers}
              onChange={(e) => setNumWorkers(Number(e.target.value))}
            >
              <option value={2}>2 Cores</option>
              <option value={4}>4 Cores</option>
              <option value={8}>8 Cores</option>
            </select>
          </div>
        </div>

        <div className="controls-row-bottom">
          <div className="playback-controls">
            <button
              className="btn-ctrl btn-primary"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pausar Carrera' : 'Iniciar Carrera'}
            </button>

            <button
              className="btn-ctrl"
              onClick={() => {
                setIsPlaying(false);
                initializeRace();
              }}
            >
              <RotateCcw size={15} />
              Reiniciar Pista
            </button>

            <button className="btn-ctrl" onClick={handleShuffle}>
              <Shuffle size={15} />
              Nuevos Datos
            </button>
          </div>

          <div className="slider-group">
            <Zap size={16} color="var(--accent-cyan)" />
            <span>Velocidad: {speed}x</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="custom-slider"
              style={{ width: '120px' }}
            />
          </div>

          {raceRankings.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700 }}>
              <Trophy size={16} />
              Ganador: {PARALLEL_ALGORITHMS[raceRankings[0]]?.name} en {raceStates[raceRankings[0]]?.totalSteps} pasos
            </div>
          )}
        </div>
      </section>

      {/* Racers Grid */}
      <div className="race-grid">
        {selectedAlgos.map((algoId) => {
          const algo = PARALLEL_ALGORITHMS[algoId];
          const racer = raceStates[algoId];
          if (!algo || !racer) return null;

          const step = racer.currentStep || {};
          const currentArray = step.array || initialData;
          const maxVal = Math.max(...currentArray, 1);
          const progressPct = Math.round((racer.currentIndex / (racer.totalSteps - 1 || 1)) * 100);

          const comps = step.metrics?.totalComparisons || 0;
          const swaps = step.metrics?.totalSwaps || 0;
          const rank = raceRankings.indexOf(algoId) + 1;

          return (
            <div
              key={algoId}
              className="race-card"
              style={{
                borderColor: rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : 'var(--border-subtle)',
                boxShadow: rank === 1 ? '0 0 20px rgba(251, 191, 36, 0.2)' : 'none'
              }}
            >
              {/* Header */}
              <div className="race-header">
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {rank === 1 && <span title="1er Lugar">🥇</span>}
                    {rank === 2 && <span title="2do Lugar">🥈</span>}
                    {rank === 3 && <span title="3er Lugar">🥉</span>}
                    {algo.name}
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{algo.model}</span>
                </div>

                <div>
                  {rank > 0 ? (
                    <span
                      className="badge"
                      style={{
                        background: rank === 1 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                        color: rank === 1 ? '#fbbf24' : '#cbd5e1',
                        border: `1px solid ${rank === 1 ? '#fbbf24' : '#64748b'}`
                      }}
                    >
                      <Award size={12} />
                      #{rank} Meta
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-cyan)' }}>
                      Paso {racer.currentIndex + 1}/{racer.totalSteps}
                    </span>
                  )}
                </div>
              </div>

              {/* Mini visualizer bars */}
              <div className="race-bars-mini">
                {currentArray.map((v, i) => {
                  const height = Math.max(8, Math.round((v / maxVal) * 100));
                  const isComparing = step.comparisonsInStep?.some(([a, b]) => a === i || b === i);
                  const isSwapping = step.swapsInStep?.some(([a, b]) => a === i || b === i);

                  let barColor = 'var(--accent-blue)';
                  if (isSwapping) barColor = 'var(--accent-danger)';
                  else if (isComparing) barColor = 'var(--accent-warning)';
                  else if (rank > 0) barColor = 'var(--accent-success)';

                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${height}%`,
                        backgroundColor: barColor,
                        borderRadius: '2px 2px 0 0',
                        transition: 'height 0.15s ease, background-color 0.15s ease'
                      }}
                    />
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  <span>Progreso Paralelo</span>
                  <span>{progressPct}%</span>
                </div>
                <div style={{ height: '4px', background: 'var(--bg-surface-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: '100%',
                      background: rank > 0 ? 'var(--accent-success)' : 'var(--accent-cyan)',
                      transition: 'width 0.15s ease'
                    }}
                  />
                </div>
              </div>

              {/* Live Mini Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'var(--bg-surface-elevated)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.62rem' }}>TRABAJO (T₁)</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{comps + swaps} op</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.62rem' }}>SPAN (T∞)</span>
                  <span style={{ color: 'var(--p1-color)', fontWeight: 700 }}>{step.stepIndex || 0}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.62rem' }}>COMPARA</span>
                  <span style={{ color: 'var(--accent-warning)', fontWeight: 700 }}>{comps}</span>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minHeight: '32px', lineHeight: 1.35 }}>
                {step.description || 'Ordenando concurrentemente...'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard Table */}
      {raceRankings.length > 0 && (
        <section className="visualizer-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={18} color="#fbbf24" />
            Tabla de Posiciones y Eficiencia Concurrente
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="algo-specs-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  <th style={{ padding: '0.5rem' }}>LUGAR</th>
                  <th style={{ padding: '0.5rem' }}>ALGORITMO</th>
                  <th style={{ padding: '0.5rem' }}>MODELO</th>
                  <th style={{ padding: '0.5rem' }}>PASOS PARALELOS (SPAN)</th>
                  <th style={{ padding: '0.5rem' }}>TRABAJO TOTAL (T₁)</th>
                  <th style={{ padding: '0.5rem' }}>COMPARACIONES</th>
                  <th style={{ padding: '0.5rem' }}>COMPLEJIDAD ASINTÓTICA</th>
                </tr>
              </thead>
              <tbody>
                {raceRankings.map((algoId, idx) => {
                  const algo = PARALLEL_ALGORITHMS[algoId];
                  const racer = raceStates[algoId];
                  const lastStep = racer.steps[racer.steps.length - 1];
                  const comps = lastStep?.metrics?.totalComparisons || 0;
                  const swaps = lastStep?.metrics?.totalSwaps || 0;

                  return (
                    <tr key={algoId} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 800, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--text-muted)' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '0.5rem', fontWeight: 700, color: '#fff' }}>{algo.name}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--accent-cyan)' }}>{algo.model}</td>
                      <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--p1-color)' }}>{racer.totalSteps} pasos</td>
                      <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)' }}>{comps + swaps} op</td>
                      <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}>{comps}</td>
                      <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{algo.span}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
