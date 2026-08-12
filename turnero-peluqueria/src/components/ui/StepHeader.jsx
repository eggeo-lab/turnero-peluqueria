import { CaretLeft } from '@phosphor-icons/react';
import './StepHeader.css';

const PASOS = ['Servicio', 'Turno', 'Seña', 'Listo'];

export default function StepHeader({ step, onBack, title }) {
  return (
    <header className="step-header">
      <div className="step-header__top">
        <button
          className="step-header__back"
          onClick={onBack}
          disabled={!onBack}
          aria-label="Volver"
        >
          <CaretLeft size={20} weight="bold" />
        </button>
        <div className="step-header__brand">
          <span className="eyebrow">Estudio Navaja</span>
        </div>
        <div className="step-header__spacer" />
      </div>

      <h1 className="step-header__title">{title}</h1>

      <ol className="step-header__dots" aria-label="Progreso de la reserva">
        {PASOS.map((p, i) => (
          <li
            key={p}
            className={
              i < step ? 'is-done' : i === step ? 'is-active' : ''
            }
          >
            <span className="dot" />
            <span className="dot-label">{p}</span>
          </li>
        ))}
      </ol>
    </header>
  );
}
