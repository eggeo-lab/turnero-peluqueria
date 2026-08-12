import { Link } from 'react-router-dom';
import { Scissors, ArrowRight } from '@phosphor-icons/react';
import { useTurnos } from '../hooks/useTurnos';
import Badge from '../components/ui/Badge';
import './AdminConfirmPage.css';
import './AdminInboxPage.css';

const BADGE_POR_ESTADO = {
  RESERVANDO_CON_TIMER: 'timer',
  PENDIENTE_COMPROBANTE: 'pendiente',
  CONFIRMADO: 'confirmado',
  RECHAZADO: 'rechazado',
  EXPIRADO: 'expirado',
};

export default function AdminInboxPage() {
  const { turnos } = useTurnos();

  return (
    <div className="page">
      <header className="admin-header">
        <Scissors size={18} weight="bold" />
        <span>Bandeja de turnos (demo)</span>
      </header>
      <main className="page__body">
        <p className="admin-inbox__hint">
          En producción este listado no existe: el peluquero recibe un link directo por
          WhatsApp/email por cada turno. Esta bandeja es solo para probar el flujo end-to-end
          sin tener que copiar el link a mano.
        </p>
        {turnos.length === 0 && <p className="admin-inbox__empty">Todavía no hay turnos.</p>}
        <ul className="admin-inbox__list">
          {turnos.map((t) => (
            <li key={t.id}>
              <Link to={`/admin/confirmar/${t.id}?t=${t.adminToken}`} className="admin-inbox__item">
                <div>
                  <strong>{t.cliente?.nombre}</strong>
                  <span>
                    {t.servicio?.nombre} · {t.fecha} {t.hora}hs
                  </span>
                </div>
                <Badge tipo={BADGE_POR_ESTADO[t.estado]} />
                <ArrowRight size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
