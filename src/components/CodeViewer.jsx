import React, { useState } from 'react';
import { Code2, Copy, Check } from 'lucide-react';
import { PARALLEL_ALGORITHMS } from '../algorithms';

export default function CodeViewer({ selectedAlgo, activeLine }) {
  const algo = PARALLEL_ALGORITHMS[selectedAlgo] || PARALLEL_ALGORITHMS.bitonic;
  const codeLines = algo.code || [];
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-viewer-container">
      <div className="code-viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Code2 size={14} color="var(--accent-cyan)" />
          <span>{algo.id}_paralelo.py</span>
          {activeLine && (
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.2)',
                color: 'var(--accent-cyan)'
              }}
            >
              Línea {activeLine}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? 'var(--accent-success)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.72rem'
          }}
          title="Copiar código fuente"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>

      <div className="code-lines">
        {codeLines.map((line, idx) => {
          const lineNum = idx + 1;
          const isActive = activeLine === lineNum;
          return (
            <div
              key={idx}
              className={`code-line ${isActive ? 'active' : ''}`}
            >
              <span className="line-no">{lineNum}</span>
              <span style={{ color: line.trim().startsWith('#') ? '#64748b' : undefined }}>
                {line}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
