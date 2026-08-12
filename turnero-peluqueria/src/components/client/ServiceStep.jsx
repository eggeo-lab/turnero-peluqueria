import { Scissors, ArrowRight } from '@phosphor-icons/react';
import { SERVICE_ICONS } from '../../data/services';
import './ServiceStep.css';

export default function ServiceStep({ servicios, loading, error, onSelect }) {
  if (loading) {
    return (
      <div className="service-step">
        <ul className="service-step__list">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="service-card service-card--skeleton" />
          ))}
        </ul>
      </div>
    );
  }

  if (error) {
    return (
      <div className="service-step">
        <p className="service-step__error">
          No pudimos cargar los servicios. Verificá que el backend esté corriendo y volvé a
          intentar.
        </p>
      </div>
    );
  }

  return (
    <div className="service-step">
      <p className="service-step__hint">Elegí el servicio para tu turno.</p>
      <ul className="service-step__list">
        {servicios.map((s) => {
          const Icon = SERVICE_ICONS[s.icon] || Scissors;
          return (
            <li key={s.id}>
              <button className="service-card" onClick={() => onSelect(s)}>
                <span className="service-card__icon">
                  <Icon size={22} weight="bold" />
                </span>
                <span className="service-card__info">
                  <span className="service-card__name">{s.nombre}</span>
                  <span className="service-card__meta">
                    {s.duracionMin} min · ${s.precio.toLocaleString('es-AR')}
                  </span>
                </span>
                <ArrowRight size={18} className="service-card__arrow" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
