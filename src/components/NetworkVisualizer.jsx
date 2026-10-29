import React, { useRef, useEffect } from 'react';
import { WORKER_COLORS } from './Controls';

export default function NetworkVisualizer({ step, n = 16, numWorkers = 4 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !step) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const paddingX = 40;
    const paddingY = 25;
    const availableHeight = height - 2 * paddingY;
    const wireSpacing = availableHeight / (n - 1);

    // 1. Draw horizontal wires for each element
    for (let i = 0; i < n; i++) {
      const y = paddingY + i * wireSpacing;

      // Draw wire
      ctx.beginPath();
      ctx.moveTo(paddingX, y);
      ctx.lineTo(width - paddingX, y);
      ctx.strokeStyle = '#223048';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw wire label [i]
      ctx.fillStyle = '#64748b';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`x[${i}]`, paddingX - 8, y);

      // Draw current value at end
      if (step.array && step.array[i] !== undefined) {
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText(`=${step.array[i]}`, width - paddingX + 8, y);
      }
    }

    // 2. Draw active comparators in this step
    const { comparisonsInStep = [], swapsInStep = [], activeWorkers = [] } = step;

    if (comparisonsInStep.length > 0) {
      const numComps = comparisonsInStep.length;
      const colWidth = (width - 2 * paddingX) / (numComps + 1);

      comparisonsInStep.forEach(([i, j], idx) => {
        const x = paddingX + (idx + 1) * colWidth;
        const y1 = paddingY + i * wireSpacing;
        const y2 = paddingY + j * wireSpacing;

        const isSwapped = swapsInStep.some(
          ([a, b]) => (a === i && b === j) || (a === j && b === i)
        );

        // Find assigned worker
        let workerColor = '#38bdf8';
        for (const w of activeWorkers) {
          if (w.indices && (w.indices.includes(i) || w.indices.includes(j))) {
            workerColor = WORKER_COLORS[w.workerId % WORKER_COLORS.length];
            break;
          }
        }

        // Vertical bridge line
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.strokeStyle = isSwapped ? '#ef4444' : workerColor;
        ctx.lineWidth = isSwapped ? 4 : 3;
        ctx.stroke();

        // Comparator nodes (circles at endpoints)
        [y1, y2].forEach((yPos) => {
          ctx.beginPath();
          ctx.arc(x, yPos, 6, 0, Math.PI * 2);
          ctx.fillStyle = isSwapped ? '#ef4444' : workerColor;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        });

        // Direction indicator arrow / tag
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const midY = (y1 + y2) / 2;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(x - 12, midY - 8, 24, 16);
        ctx.fillStyle = isSwapped ? '#fca5a5' : '#e2e8f0';
        ctx.fillText(isSwapped ? 'SWAP' : 'CMP', x, midY);
      });
    } else {
      // Idle message on canvas
      ctx.fillStyle = '#64748b';
      ctx.font = '13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'Red de comparadores inactiva o etapa de sincronización global',
        width / 2,
        height / 2
      );
    }
  }, [step, n, numWorkers]);

  return (
    <div style={{ padding: '1rem', background: '#050811', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>Alambres de entrada (Datos iniciales)</span>
        <span style={{ color: 'var(--accent-cyan)' }}>Etapa Paralela Concurrente: {step?.stageName}</span>
        <span>Alambres de salida</span>
      </div>
      <canvas
        ref={canvasRef}
        width={780}
        height={320}
        className="network-canvas"
      />
    </div>
  );
}
