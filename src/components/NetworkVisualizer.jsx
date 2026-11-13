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
    const bitonicComps = step.bitonicData?.comparisons || [];

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

        const bitonicComp = bitonicComps.find((c) => {
          const ci = c.i ?? c.a ?? c[0];
          const cj = c.j ?? c.b ?? c[1];
          return (ci === i && cj === j) || (ci === j && cj === i);
        });
        let direction = null;
        if (bitonicComp) {
          if (bitonicComp.direction === 'asc' || bitonicComp.direction === 'desc') {
            direction = bitonicComp.direction;
          } else if (bitonicComp.dir === 'asc' || bitonicComp.dir === 'desc') {
            direction = bitonicComp.dir;
          } else if (typeof bitonicComp.ascending === 'boolean') {
            direction = bitonicComp.ascending ? 'asc' : 'desc';
          }
        }
        const isAsc = direction === 'asc';
        const isDesc = direction === 'desc';

        // Find assigned worker
        let workerColor = '#38bdf8';
        for (const w of activeWorkers) {
          if (w.indices && (w.indices.includes(i) || w.indices.includes(j))) {
            workerColor = WORKER_COLORS[w.workerId % WORKER_COLORS.length];
            break;
          }
        }

        const bridgeColor = direction
          ? isAsc
            ? isSwapped
              ? '#10b981'
              : '#22d3ee'
            : isSwapped
              ? '#fb7185'
              : '#a78bfa'
          : isSwapped
            ? '#ef4444'
            : workerColor;

        // Vertical bridge line
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.strokeStyle = bridgeColor;
        ctx.lineWidth = isSwapped ? 4 : 3;
        ctx.stroke();

        // Comparator nodes (circles at endpoints)
        [y1, y2].forEach((yPos) => {
          ctx.beginPath();
          ctx.arc(x, yPos, 6, 0, Math.PI * 2);
          ctx.fillStyle = direction ? bridgeColor : isSwapped ? '#ef4444' : workerColor;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = direction ? (isAsc ? '#a5f3fc' : '#ddd6fe') : '#ffffff';
          ctx.stroke();
        });

        // Subtle directional arrow cue when bridge is tall enough
        if (direction && Math.abs(y2 - y1) >= 34) {
          const arrowY = y2 > y1 ? y2 - 11 : y2 + 11;
          const arrowDir = isAsc ? -1 : 1; // ▲ for ascending, ▼ for descending
          ctx.beginPath();
          ctx.moveTo(x, arrowY + arrowDir * 3);
          ctx.lineTo(x - 3.5, arrowY - arrowDir * 2.5);
          ctx.lineTo(x + 3.5, arrowY - arrowDir * 2.5);
          ctx.closePath();
          ctx.fillStyle = bridgeColor;
          ctx.fill();
        }

        // Direction indicator arrow / tag
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const midY = (y1 + y2) / 2;
        if (direction) {
          const pillW = 38;
          const pillH = 16;
          ctx.fillStyle = isAsc
            ? isSwapped
              ? 'rgba(6, 78, 59, 0.92)'
              : 'rgba(8, 51, 68, 0.92)'
            : isSwapped
              ? 'rgba(76, 5, 25, 0.92)'
              : 'rgba(46, 16, 101, 0.92)';
          ctx.fillRect(x - pillW / 2, midY - pillH / 2, pillW, pillH);
          ctx.lineWidth = 1;
          ctx.strokeStyle = bridgeColor;
          ctx.strokeRect(x - pillW / 2, midY - pillH / 2, pillW, pillH);
          ctx.fillStyle = isAsc
            ? isSwapped
              ? '#6ee7b7'
              : '#67e8f9'
            : isSwapped
              ? '#fda4af'
              : '#ddd6fe';
          const arrowChar = isAsc ? '↑' : '↓';
          ctx.fillText(`${arrowChar} ${isSwapped ? 'SWAP' : 'CMP'}`, x, midY);
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(x - 12, midY - 8, 24, 16);
          ctx.fillStyle = isSwapped ? '#fca5a5' : '#e2e8f0';
          ctx.fillText(isSwapped ? 'SWAP' : 'CMP', x, midY);
        }
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
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>Alambres de entrada (Datos iniciales)</span>
        <span style={{ color: 'var(--accent-cyan)', textAlign: 'center' }}>
          Etapa Paralela Concurrente: {step?.stageName}
          {step?.bitonicData?.k != null && (
            <span style={{ color: '#a5b4fc', marginLeft: '8px', fontFamily: 'var(--font-mono)' }}>
              · Bloque k={step.bitonicData.k} · Salto d={step.bitonicData.d}
            </span>
          )}
        </span>
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
