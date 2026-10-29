import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import Controls from './components/Controls';
import BarVisualizer from './components/BarVisualizer';
import NetworkVisualizer from './components/NetworkVisualizer';
import GanttVisualizer from './components/GanttVisualizer';
import StructureVisualizer from './components/StructureVisualizer';
import MetricsPanel from './components/MetricsPanel';
import CodeViewer from './components/CodeViewer';
import RaceArena from './components/RaceArena';
import AmdahlLab from './components/AmdahlLab';
import TheoryModal from './components/TheoryModal';
import { PARALLEL_ALGORITHMS } from './algorithms';
import { BarChart3, Clock, Share2, Network, Grid, Terminal } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'race' | 'amdahl' | 'theory'

  // Simulator state
  const [selectedAlgo, setSelectedAlgo] = useState('bitonic');
  const [arraySize, setArraySize] = useState(16);
  const [numWorkers, setNumWorkers] = useState(4);
  const [distribution, setDistribution] = useState('random');
  const [speed, setSpeed] = useState(1.5);
  const [isPlaying, setIsPlaying] = useState(false);

  // Subtab inside simulator visualizer panel
  const [visualizerSubtab, setVisualizerSubtab] = useState('bars'); // 'bars' | 'gantt' | 'network' | 'structure'

  // Generated animation steps
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Timer ref for playback
  const playbackTimerRef = useRef(null);

  // Helper to generate initial data
  const generateInitialData = useCallback((size, dist) => {
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
      arr = Array.from({ length: size }, () => Math.floor(Math.random() * 6) + 1);
    } else if (dist === 'alternating') {
      arr = Array.from({ length: size }, (_, i) => (i % 2 === 0 ? i * 2 + 5 : size * 2 - i * 2));
    } else {
      arr = Array.from({ length: size }, () => Math.floor(Math.random() * 95) + 5);
    }
    return arr;
  }, []);

  // Re-generate steps when algorithm, size, workers, or distribution changes
  const regenerateSteps = useCallback((customData = null) => {
    const algoDef = PARALLEL_ALGORITHMS[selectedAlgo] || PARALLEL_ALGORITHMS.bitonic;

    // Check size validity for algorithm
    let validSize = arraySize;
    if (!algoDef.suitableSizes.includes(validSize)) {
      validSize = algoDef.defaultSize || algoDef.suitableSizes[0];
      setArraySize(validSize);
    }

    const data = customData || generateInitialData(validSize, distribution);
    try {
      const generated = algoDef.generate(data, numWorkers);
      setSteps(generated);
      setCurrentStepIndex(0);
      setIsPlaying(false);
    } catch (err) {
      console.error('Error generating algorithm steps:', err);
    }
  }, [selectedAlgo, arraySize, numWorkers, distribution, generateInitialData]);

  // Handle algorithm switch: reset visualizer subtab if previous tab not supported
  const handleSelectAlgo = (newAlgoId) => {
    setSelectedAlgo(newAlgoId);
    const newAlgoDef = PARALLEL_ALGORITHMS[newAlgoId];
    if (newAlgoDef && !newAlgoDef.suitableSizes.includes(arraySize)) {
      setArraySize(newAlgoDef.defaultSize);
    }
    // If current subtab was network or structure and new algo doesn't have it, fallback to bars
    if (visualizerSubtab === 'network' && !newAlgoDef?.hasNetworkView) {
      setVisualizerSubtab('bars');
    }
  };

  // Initial load & parameter reactions
  useEffect(() => {
    regenerateSteps();
  }, [selectedAlgo, arraySize, numWorkers, distribution]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      return;
    }

    const intervalMs = Math.max(30, Math.floor(400 / speed));
    playbackTimerRef.current = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, intervalMs);

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, speed, steps.length]);

  // Step navigation controls
  const handleStepBack = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
  };

  const handleShuffle = () => {
    setIsPlaying(false);
    const newData = generateInitialData(arraySize, distribution);
    regenerateSteps(newData);
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStepForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStepBack();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [steps.length]);

  const currentStep = steps[currentStepIndex] || null;
  const currentAlgoDef = PARALLEL_ALGORITHMS[selectedAlgo] || PARALLEL_ALGORITHMS.bitonic;

  const hasStructure =
    currentAlgoDef.hasMeshView ||
    currentAlgoDef.hasSampleView ||
    currentAlgoDef.hasRadixView ||
    currentAlgoDef.hasBucketView ||
    currentAlgoDef.hasTreeView;

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Tab Content */}
      {activeTab === 'simulator' && (
        <>
          {/* Controls Deck */}
          <Controls
            selectedAlgo={selectedAlgo}
            setSelectedAlgo={handleSelectAlgo}
            arraySize={arraySize}
            setArraySize={setArraySize}
            numWorkers={numWorkers}
            setNumWorkers={setNumWorkers}
            distribution={distribution}
            setDistribution={setDistribution}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            currentStepIndex={currentStepIndex}
            totalSteps={steps.length || 1}
            onStepBack={handleStepBack}
            onStepForward={handleStepForward}
            onReset={handleReset}
            onShuffle={handleShuffle}
            speed={speed}
            setSpeed={setSpeed}
          />

          {/* Simulator Grid (Visualizer + Specs/Code) */}
          <div className="visualizer-main-grid">
            {/* Left Column: Visualizer + Synchronized Code */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="visualizer-panel">
                {/* Visualizer Panel Header with Subtabs */}
                <div className="panel-header">
                  <h2>
                    <BarChart3 size={17} color="var(--accent-cyan)" />
                    {currentAlgoDef.name} — {currentAlgoDef.subtitle}
                  </h2>

                  <div className="view-subtabs">
                    <button
                      className={`subtab-btn ${visualizerSubtab === 'bars' ? 'active' : ''}`}
                      onClick={() => setVisualizerSubtab('bars')}
                    >
                      <BarChart3 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                      Barras Paralelas
                    </button>

                    <button
                      className={`subtab-btn ${visualizerSubtab === 'gantt' ? 'active' : ''}`}
                      onClick={() => setVisualizerSubtab('gantt')}
                    >
                      <Clock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                      Gantt de Núcleos
                    </button>

                    {currentAlgoDef.hasNetworkView && (
                      <button
                        className={`subtab-btn ${visualizerSubtab === 'network' ? 'active' : ''}`}
                        onClick={() => setVisualizerSubtab('network')}
                      >
                        <Network size={13} style={{ display: 'inline', marginRight: '4px' }} />
                        Red Alambrada
                      </button>
                    )}

                    {hasStructure && (
                      <button
                        className={`subtab-btn ${visualizerSubtab === 'structure' ? 'active' : ''}`}
                        onClick={() => setVisualizerSubtab('structure')}
                      >
                        <Grid size={13} style={{ display: 'inline', marginRight: '4px' }} />
                        Estructura Concurrente
                      </button>
                    )}
                  </div>
                </div>

                {/* Subtab View Content */}
                {visualizerSubtab === 'bars' && (
                  <BarVisualizer step={currentStep} numWorkers={numWorkers} />
                )}

                {visualizerSubtab === 'gantt' && (
                  <GanttVisualizer step={currentStep} numWorkers={numWorkers} />
                )}

                {visualizerSubtab === 'network' && (
                  <NetworkVisualizer step={currentStep} n={arraySize} numWorkers={numWorkers} />
                )}

                {visualizerSubtab === 'structure' && (
                  <StructureVisualizer
                    algoId={selectedAlgo}
                    step={currentStep}
                    numWorkers={numWorkers}
                  />
                )}
              </div>

              {/* Synchronized Code Viewer */}
              <CodeViewer
                selectedAlgo={selectedAlgo}
                activeLine={currentStep?.highlightCodeLine}
              />
            </div>

            {/* Right Column: Execution Metrics & Complexity Specs */}
            <MetricsPanel
              selectedAlgo={selectedAlgo}
              step={currentStep}
              numWorkers={numWorkers}
              arraySize={arraySize}
            />
          </div>
        </>
      )}

      {/* Race Arena Tab */}
      {activeTab === 'race' && <RaceArena />}

      {/* Amdahl's Law & GIL Tab */}
      {activeTab === 'amdahl' && <AmdahlLab />}

      {/* Theoretical Matrix Tab */}
      {activeTab === 'theory' && <TheoryModal />}

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}
      >
        <div>
          <span>Estructuras de Datos y Algoritmos II · Facultad de Ingeniería UNAM</span>
          <span style={{ margin: '0 0.5rem' }}>·</span>
          <span>Equipo: Algoritmos de Ordenamiento Paralelos</span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>Atajos: [Espacio] Play/Pausa · [←/→] Paso · [R] Reset</span>
          <a
            href="https://github.com/UNAM-FI-EDAII-2026-1/eda-2-juxdeveloper/pull/27"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600 }}
          >
            PR #27 (rama simulacion)
          </a>
        </div>
      </footer>
    </div>
  );
}
