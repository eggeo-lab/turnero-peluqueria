import { useState } from 'react';
import {
  User,
  Scissors,
  CalendarBlank,
  Clock,
  Check,
  X,
  CheckCircle,
  XCircle,
  ClockCountdown,
} from '@phosphor-icons/react';
import Button from '../ui/Button';
import { API_ORIGIN } from '../../lib/api';
import './AdminApproval.css';

export default function AdminApproval({ turno, loading, token, onAprobar, onRechazar }) {
  const [procesando, setProcesando] = useState(null);
  const [error, setError] = useState(null);

  if (loading) {
    return (
      <div className="admin-approval admin-approval--empty">
        <ClockCountdown size={40} />
        <h2>Cargando turno…</h2>
      </div>
    );
  }

  if (!turno) {
    return (
      <div className="admin-approval admin-approval--empty">
        <ClockCountdown size={40} />
        <h2>Turno no encontrado</h2>
        <p>Este link ya no es válido o el turno fue eliminado.</p>
      </div>
    );
  }

  if (!token && turno.estado === 'PENDIENTE_COMPROBANTE') {
    return (
      <div className="admin-approval admin-approval--empty">
        <XCircle size={44} weight="fill" color="var(--danger)" />
        <h2>Link incompleto</h2>
        <p>
          A este link le falta el código de autorización. Usá el link completo que llegó por
          WhatsApp, no solo la URL del turno.
        </p>
      </div>
    );
  }

  if (turno.estado === 'CONFIRMADO') {
    return (
      <div className="admin-approval admin-approval--empty">
        <CheckCircle size={44} weight="fill" color="var(--success)" />
        <h2>Turno ya confirmado</h2>
        <p>Vos aprobaste este turno. No hace falta ninguna otra acción.</p>
      </div>
    );
  }

  if (turno.estado === 'RECHAZADO') {
    return (
      <div className="admin-approval admin-approval--empty">
        <XCircle size={44} weight="fill" color="var(--danger)" />
        <h2>Turno rechazado</h2>
        <p>Ya marcaste este turno como rechazado.</p>
      </div>
    );
  }

  if (turno.estado !== 'PENDIENTE_COMPROBANTE') {
    return (
      <div className="admin-approval admin-approval--empty">
        <ClockCountdown size={40} />
        <h2>Todavía sin comprobante</h2>
        <p>El cliente está dentro de la ventana de 15 minutos para adjuntarlo.</p>
      </div>
    );
  }

  const confirmar = async (accion) => {
    setProcesando(accion);
    setError(null);
    const result =
      accion === 'aprobar' ? await onAprobar(turno.id) : await onRechazar(turno.id, 'Comprobante no válido');
    if (result?.error) {
      const mensaje =
        result.error === 'no_autorizado'
          ? 'El código de este link no es válido.'
          : 'No pudimos procesar la acción. Probá de nuevo.';
      setError(mensaje);
      setProcesando(null);
    }
  };

  return (
    <div className="admin-approval">
      <span className="eyebrow">Turno pendiente de aprobación</span>

      <div className="admin-approval__datos">
        <div className="admin-approval__row">
          <User size={17} />
          <div>
            <strong>{turno.cliente?.nombre}</strong>
            <span>{turno.cliente?.telefono}</span>
          </div>
        </div>
        <div className="admin-approval__row">
          <Scissors size={17} />
          <div>
            <strong>{turno.servicio?.nombre}</strong>
            <span>${turno.servicio?.precio.toLocaleString('es-AR')} · seña ${turno.servicio?.senia.toLocaleString('es-AR')}</span>
          </div>
        </div>
        <div className="admin-approval__row">
          <CalendarBlank size={17} />
          <div>
            <strong>{turno.fecha}</strong>
          </div>
        </div>
        <div className="admin-approval__row">
          <Clock size={17} />
          <div>
            <strong>{turno.hora} hs</strong>
          </div>
        </div>
      </div>

      <div className="admin-approval__comprobante">
        <span className="eyebrow">Comprobante</span>
        <img
          src={`${API_ORIGIN}${turno.comprobanteUrl}`}
          alt="Comprobante de transferencia enviado por el cliente"
        />
      </div>

      {error && <p className="admin-approval__error">{error}</p>}

      <div className="admin-approval__actions">
        <Button
          variant="danger"
          icon={X}
          full={false}
          disabled={!!procesando}
          onClick={() => confirmar('rechazar')}
        >
          Rechazar
        </Button>
        <Button
          variant="success"
          icon={Check}
          full={false}
          disabled={!!procesando}
          onClick={() => confirmar('aprobar')}
        >
          Aprobar turno
        </Button>
      </div>
    </div>
  );
}
