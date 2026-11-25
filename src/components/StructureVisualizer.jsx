import React from 'react';
import { GitMerge } from 'lucide-react';
import QuickSortVisualizer from './QuickSortVisualizer';
import RadixVisualizer from './RadixVisualizer';
import SampleSortVisualizer from './SampleSortVisualizer';

export default function StructureVisualizer({
  algoId,
  step,
  numWorkers = 4,
  arraySize = 8,
  currentStepIndex = 0,
  totalSteps = 1,
  steps = [],
  onSelectStep,
  onLoadClassicExample,
}) {
  if (!step) return null;

  if (algoId === 'quicksort') {
    return (
      <QuickSortVisualizer
        step={step}
        numWorkers={numWorkers}
        arraySize={arraySize}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        steps={steps}
        onSelectStep={onSelectStep}
        onLoadClassicExample={onLoadClassicExample}
      />
    );
  }

  if (algoId === 'radix') {
    return (
      <RadixVisualizer
        step={step}
        numWorkers={numWorkers}
        arraySize={arraySize}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        steps={steps}
        onSelectStep={onSelectStep}
        onLoadClassicExample={onLoadClassicExample}
      />
    );
  }

  if (algoId === 'samplesort') {
    return (
      <SampleSortVisualizer
        step={step}
        numWorkers={numWorkers}
        arraySize={arraySize}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        steps={steps}
        onSelectStep={onSelectStep}
        onLoadClassicExample={onLoadClassicExample}
      />
    );
  }

  // Generic MergeSort / Bucket Sort fallback card
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
