import { useMemo, useState } from 'react';
import { generarDiasDisponibles, ANTICIPACION_MAX_HORAS } from '../../lib/slots';
import { useOcupados } from '../../hooks/useTurnos';
import Button from '../ui/Button';
import { ArrowRight } from '@phosphor-icons/react';
import './DateTimeStep.css';

export default function DateTimeStep({ servicio, onConfirm }) {
  const dias = useMemo(() => generarDiasDisponibles(), []);
  const [diaIdx, setDiaIdx] = useState(0);
  const [hora, setHora] = useState(null);

  const dia = dias[diaIdx];

  // Solo { fecha, hora } de los slots activos, desde el endpoint público.
  const ocupadosDelDia = useOcupados(dia?.fecha);

  return (
    <div className="dt-step">
      <p className="dt-step__hint">
        Turnos disponibles dentro de las próximas {ANTICIPACION_MAX_HORAS} hs para{' '}
        <strong>{servicio.nombre}</strong>.
      </p>

      {dias.length > 1 && (
        <div className="dt-step__days">
          {dias.map((d, i) => (
            <button
              key={d.fecha}
              className={`dt-day${i === diaIdx ? ' is-active' : ''}`}
              onClick={() => {
                setDiaIdx(i);
                setHora(null);
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {!dia && <p className="dt-step__empty">No hay horarios disponibles en este momento.</p>}

      {dia && (
        <div className="dt-step__grid">
          {dia.horas.map((h) => {
            const ocupado = ocupadosDelDia.has(h);
            const activo = hora === h;
            return (
              <button
                key={h}
                className={`dt-slot${activo ? ' is-active' : ''}`}
                disabled={ocupado}
                onClick={() => setHora(h)}
              >
                {h}
              </button>
            );
          })}
        </div>
      )}

      <div className="dt-step__cta">
        <Button
          icon={ArrowRight}
          disabled={!hora}
          onClick={() => onConfirm(dia.fecha, hora)}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
