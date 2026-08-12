import { useState } from 'react';
import { HourglassMedium, CheckCircle, XCircle, Prohibit } from '@phosphor-icons/react';
import TicketCard from '../ui/TicketCard';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { puedeCancelar, CANCELACION_MIN_HORAS } from '../../lib/slots';
import './WaitingStep.css';

const CONTENIDO = {
  PENDIENTE_COMPROBANTE: {
    icon: <HourglassMedium size={40} weight="fill" color="var(--pending)" />,
    titulo: 'Turno solicitado',
    texto: 'Le avisamos al peluquero. En cuanto revise tu comprobante vas a recibir la confirmación.',
    badge: 'pendiente',
  },
  CONFIRMADO: {
    icon: <CheckCircle size={44} weight="fill" color="var(--success)" />,
    titulo: '¡Turno confirmado!',
    texto: 'Te esperamos en el horario reservado. Guardá este comprobante como recordatorio.',
    badge: 'confirmado',
  },
  RECHAZADO: {
    icon: <XCircle size={44} weight="fill" color="var(--danger)" />,
    titulo: 'Turno rechazado',
    texto: 'El peluquero no pudo validar el comprobante. Podés intentar reservar de nuevo.',
    badge: 'rechazado',
  },
  CANCELADO: {
    icon: <Prohibit size={44} weight="fill" color="var(--danger)" />,
    titulo: 'Turno cancelado',
    texto: 'Cancelaste este turno. Cuando quieras podés reservar uno nuevo.',
    badge: 'cancelado',
  },
};

const CANCELABLES = new Set(['PENDIENTE_COMPROBANTE', 'CONFIRMADO']);

export default function WaitingStep({ turno, onNuevoTurno, onCancelar }) {
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState(null);

  const c = CONTENIDO[turno.estado] || CONTENIDO.PENDIENTE_COMPROBANTE;
  const habilitaCancelar = CANCELABLES.has(turno.estado) && puedeCancelar(turno.fecha, turno.hora);

  const confirmarCancelacion = async () => {
    setCancelando(true);
    setErrorCancelar(null);
    const ok = await onCancelar(turno.id);
    setCancelando(false);
    if (!ok) {
      setErrorCancelar('No pudimos cancelar el turno. Probá de nuevo.');
      return;
    }
    setConfirmando(false);
  };

  return (
    <div className="waiting-step">
      <div className="waiting-step__icon">{c.icon}</div>
      <h2>{c.titulo}</h2>
      <p>{c.texto}</p>

      <TicketCard
        servicio={turno.servicio}
        fecha={turno.fecha}
        hora={turno.hora}
        estadoBadge={<Badge tipo={c.badge} />}
      />

      {turno.estado !== 'PENDIENTE_COMPROBANTE' && (
        <Button variant="ghost" onClick={onNuevoTurno}>
          Reservar otro turno
        </Button>
      )}

      {CANCELABLES.has(turno.estado) && !confirmando && (
        <div className="waiting-step__cancel-zone">
          {habilitaCancelar ? (
            <button className="waiting-step__cancel-link" onClick={() => setConfirmando(true)}>
              Cancelar turno
            </button>
          ) : (
            <p className="waiting-step__cancel-hint">
              Ya no se puede cancelar desde acá: falta menos de {CANCELACION_MIN_HORAS}hs para el
              turno. Escribinos directamente si necesitás avisar.
            </p>
          )}
        </div>
      )}

      {confirmando && (
        <div className="waiting-step__confirm">
          <p>¿Seguro que querés cancelar este turno? No se puede deshacer.</p>
          {errorCancelar && <p className="waiting-step__confirm-error">{errorCancelar}</p>}
          <div className="waiting-step__confirm-actions">
            <Button variant="ghost" full={false} disabled={cancelando} onClick={() => setConfirmando(false)}>
              Volver
            </Button>
            <Button variant="danger" full={false} disabled={cancelando} onClick={confirmarCancelacion}>
              {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
