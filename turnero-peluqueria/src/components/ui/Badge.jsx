import './Badge.css';

const STYLES = {
  timer: { text: 'Reservando · 15 min', cls: 'badge--pending' },
  pendiente: { text: 'Pendiente de aprobación', cls: 'badge--pending' },
  confirmado: { text: 'Confirmado', cls: 'badge--success' },
  rechazado: { text: 'Rechazado', cls: 'badge--danger' },
  expirado: { text: 'Expirado', cls: 'badge--danger' },
  cancelado: { text: 'Cancelado', cls: 'badge--danger' },
};

export default function Badge({ tipo }) {
  const s = STYLES[tipo];
  if (!s) return null;
  return <span className={`badge ${s.cls}`}>{s.text}</span>;
}
