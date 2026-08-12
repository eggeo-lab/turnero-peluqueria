import { useState } from 'react';
import { ArrowRight, Lock } from '@phosphor-icons/react';
import TicketCard from '../ui/TicketCard';
import Button from '../ui/Button';
import './ClientInfoStep.css';

export default function ClientInfoStep({ servicio, fecha, hora, onConfirm, error }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  const valido = nombre.trim().length > 1 && telefono.trim().length > 5;

  return (
    <div className="info-step">
      <TicketCard servicio={servicio} fecha={fecha} hora={hora} />

      <form
        className="info-step__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) onConfirm({ nombre: nombre.trim(), telefono: telefono.trim() });
        }}
      >
        <label>
          <span>Nombre y apellido</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Martina Gómez"
            autoComplete="name"
          />
        </label>
        <label>
          <span>WhatsApp</span>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Ej: 351 555 1234"
            inputMode="tel"
            autoComplete="tel"
          />
        </label>

        {error && <p className="info-step__error">{error}</p>}

        <p className="info-step__lock-note">
          <Lock size={14} />
          Al continuar, este horario queda bloqueado para vos por 15 minutos.
        </p>

        <Button type="submit" icon={ArrowRight} disabled={!valido}>
          Reservar y bloquear turno
        </Button>
      </form>
    </div>
  );
}
