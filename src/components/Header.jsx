import React from 'react';
import { Cpu, GitPullRequest, BookOpen, Zap, Layers, Trophy } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  return (
    <header className="nav-bar">
      <div className="brand-section">
        <div className="brand-icon">
          <Cpu size={24} color="#ffffff" />
        </div>
        <div className="brand-titles">
          <h1>PARASORT · Laboratorio de Algoritmos Paralelos</h1>
          <p>Estructuras de Datos y Algoritmos II · Facultad de Ingeniería UNAM</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span className="badge badge-course">EDA II · Semestre 2026</span>
        <a
          href="https://github.com/UNAM-FI-EDAII-2026-1/eda-2-juxdeveloper/pull/27"
          target="_blank"
          rel="noreferrer"
          className="badge badge-pr"
          title="Ver PR #27 en GitHub"
        >
          <GitPullRequest size={13} />
          PR #27: equipo/paralelos → simulacion
        </a>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >
          <Zap size={15} />
          Simulador Principal
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'race' ? 'active' : ''}`}
          onClick={() => setActiveTab('race')}
        >
          <Trophy size={15} />
          Arena de Carreras
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'amdahl' ? 'active' : ''}`}
          onClick={() => setActiveTab('amdahl')}
        >
          <Layers size={15} />
          Ley de Amdahl & GIL
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'theory' ? 'active' : ''}`}
          onClick={() => setActiveTab('theory')}
        >
          <BookOpen size={15} />
          Matriz Teórica
        </button>
      </nav>
    </header>
  );
}
