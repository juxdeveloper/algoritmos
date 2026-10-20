import React from 'react';
import { WORKER_COLORS } from './Controls';
import { Activity, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function BarVisualizer({ step, numWorkers }) {
  if (!step) return null;

  const {
    array,
    activeWorkers = [],
    comparisonsInStep = [],
    swapsInStep = [],
    stageName,
    description,
    barriers
  } = step;

  const maxVal = Math.max(...array, 1);

  // Helper to map index to worker and status
  const getIndexWorkerInfo = (idx) => {
    for (const w of activeWorkers) {
      if (w.indices && w.indices.includes(idx)) {
        return {
          workerId: w.workerId,
          state: w.state,
          color: WORKER_COLORS[w.workerId % WORKER_COLORS.length]
        };
      }
    }
    // Default assignment based on chunk if idle
    const chunkSize = Math.ceil(array.length / numWorkers);
    const defaultWorker = Math.min(Math.floor(idx / chunkSize), numWorkers - 1);
    return {
      workerId: defaultWorker,
      state: 'idle',
      color: WORKER_COLORS[defaultWorker % WORKER_COLORS.length]
    };
  };

  const isIndexComparing = (idx) =>
    comparisonsInStep.some(([a, b]) => a === idx || b === idx);

  const isIndexSwapping = (idx) =>
    swapsInStep.some(([a, b]) => a === idx || b === idx);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Bars Area */}
      <div className="bars-canvas-container">
        <div className="bars-row">
          {array.map((val, idx) => {
            const workerInfo = getIndexWorkerInfo(idx);
            const comparing = isIndexComparing(idx);
            const swapping = isIndexSwapping(idx);
            const heightPct = Math.max(12, Math.round((val / maxVal) * 92));

            // Dynamic color treatment
            let barBg = workerInfo.color;
            if (swapping) {
              barBg = 'var(--accent-danger)';
            } else if (comparing) {
              barBg = 'var(--accent-warning)';
            }

            return (
              <div key={idx} className="bar-col">
                {/* Worker indicator on top */}
                <span
                  className="bar-tag-top"
                  style={{
                    color: swapping ? '#ef4444' : comparing ? '#f59e0b' : workerInfo.color
                  }}
                >
                  {swapping ? '⚡' : comparing ? '?' : `P${workerInfo.workerId}`}
                </span>

                {/* The vertical bar */}
                <div
                  className={`bar-element ${swapping ? 'swapping' : comparing ? 'comparing' : ''}`}
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: barBg,
                    border: `1px solid ${workerInfo.color}`
                  }}
                >
                  {array.length <= 32 && (
                    <span className="bar-val-text">{val}</span>
                  )}
                </div>

                {/* Index label */}
                <span className="bar-index-bottom">[{idx}]</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Narrative & Synchronization Note */}
      <div className="step-narrative">
        <div className="step-narrative-header">
          <h4>{stageName}</h4>
          {barriers && (
            <span
              className="badge"
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}
            >
              <Activity size={12} />
              Barrera de Sincronización (Join)
            </span>
          )}
        </div>
        <p>{description}</p>
      </div>
    </div>
  );
}
