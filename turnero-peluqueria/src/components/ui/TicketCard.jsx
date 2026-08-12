import { Scissors, CalendarBlank, Clock } from '@phosphor-icons/react';
import './TicketCard.css';

export default function TicketCard({ servicio, fecha, hora, estadoBadge }) {
  return (
    <div className="ticket">
      <div className="ticket__main">
        <div className="ticket__row">
          <Scissors size={17} weight="bold" />
          <span className="ticket__service">{servicio.nombre}</span>
        </div>
        <div className="ticket__meta">
          <span>
            <CalendarBlank size={15} /> {fecha}
          </span>
          <span>
            <Clock size={15} /> {hora}hs
          </span>
        </div>
        {estadoBadge}
      </div>
      <div className="ticket__notch ticket__notch--left" />
      <div className="ticket__notch ticket__notch--right" />
      <div className="ticket__stub">
        <span className="ticket__price">${servicio.precio.toLocaleString('es-AR')}</span>
        <span className="ticket__duration">{servicio.duracionMin}'</span>
      </div>
    </div>
  );
}
