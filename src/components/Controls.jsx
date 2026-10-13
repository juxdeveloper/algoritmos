import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Shuffle,
  Cpu,
  Sliders,
  Gauge
} from 'lucide-react';
import { PARALLEL_ALGORITHMS } from '../algorithms';

export const WORKER_COLORS = [
  '#38bdf8', // P0: Sky
  '#a855f7', // P1: Violet
  '#34d399', // P2: Mint
  '#fbbf24', // P3: Amber
  '#f43f5e', // P4: Rose
  '#06b6d4', // P5: Teal
  '#818cf8', // P6: Indigo
  '#e879f9', // P7: Fuchsia
];

export default function Controls({
  selectedAlgo,
  setSelectedAlgo,
  arraySize,
  setArraySize,
  numWorkers,
  setNumWorkers,
  distribution,
  setDistribution,
  isPlaying,
  setIsPlaying,
  currentStepIndex,
  totalSteps,
  onStepBack,
  onStepForward,
  onReset,
  onShuffle,
  speed,
  setSpeed,
}) {
  const currentAlgoMeta = PARALLEL_ALGORITHMS[selectedAlgo];

  return (
    <section className="control-deck">
      {/* Top row: Selectors */}
      <div className="controls-row-top">
        <div className="algo-select-group">
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              ALGORITMO PARALELO
            </label>
            <select
              className="custom-select"
              value={selectedAlgo}
              onChange={(e) => setSelectedAlgo(e.target.value)}
            >
              {Object.values(PARALLEL_ALGORITHMS).map((algo) => (
                <option key={algo.id} value={algo.id}>
                  {algo.name} — {algo.subtitle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              DISTRIBUCIÓN DE DATOS
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
              <option value="alternating">Picos Alternantes (Valles)</option>
            </select>
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
              {currentAlgoMeta.suitableSizes.map((size) => (
                <option key={size} value={size}>
                  N = {size} elementos
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
              NÚCLEOS / WORKERS (P)
            </label>
            <select
              className="custom-select"
              value={numWorkers}
              onChange={(e) => setNumWorkers(Number(e.target.value))}
            >
              <option value={2}>2 Procesadores (P0, P1)</option>
              <option value={4}>4 Procesadores (P0 .. P3)</option>
              <option value={8}>8 Procesadores (P0 .. P7)</option>
            </select>
          </div>
        </div>

        {/* Worker color legend */}
        <div className="worker-legend">
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>ASIGNACIÓN DE NÚCLEOS:</span>
          {Array.from({ length: numWorkers }, (_, i) => (
            <span
              key={i}
              className="worker-pill"
              style={{
                borderColor: WORKER_COLORS[i % WORKER_COLORS.length],
                color: WORKER_COLORS[i % WORKER_COLORS.length]
              }}
            >
              <Cpu size={12} />
              P{i}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom row: Playback actions and speed */}
      <div className="controls-row-bottom">
        <div className="playback-controls">
          <button
            className="btn-ctrl btn-primary"
            onClick={() => setIsPlaying(!isPlaying)}
            title="Reproducir o pausar animación (Espacio)"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? 'Pausar' : 'Iniciar'}
          </button>

          <button
            className="btn-ctrl"
            onClick={onStepBack}
            disabled={currentStepIndex <= 0}
            title="Paso anterior (Flecha Izq)"
          >
            <SkipBack size={15} />
            Anterior
          </button>

          <button
            className="btn-ctrl"
            onClick={onStepForward}
            disabled={currentStepIndex >= totalSteps - 1}
            title="Paso siguiente (Flecha Der)"
          >
            <SkipForward size={15} />
            Siguiente
          </button>

          <button
            className="btn-ctrl"
            onClick={onReset}
            title="Reiniciar algoritmo (R)"
          >
            <RotateCcw size={15} />
            Reiniciar
          </button>

          <button
            className="btn-ctrl"
            onClick={onShuffle}
            title="Generar nuevos datos"
          >
            <Shuffle size={15} />
            Rebarajar
          </button>
        </div>

        {/* Speed Slider */}
        <div className="slider-group">
          <Gauge size={16} color="var(--accent-cyan)" />
          <span>Velocidad: {speed}x</span>
          <input
            type="range"
            min="0.25"
            max="4"
            step="0.25"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="custom-slider"
            style={{ width: '130px' }}
          />
        </div>

        {/* Progress indicator */}
        <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          Paso {currentStepIndex + 1} de {totalSteps}
        </div>
      </div>
    </section>
  );
}
