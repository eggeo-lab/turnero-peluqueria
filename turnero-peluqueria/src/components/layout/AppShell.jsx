import { Scissors, ShieldCheck, Clock, ChatCircleDots } from '@phosphor-icons/react';
import { NEGOCIO } from '../../data/negocio';
import './AppShell.css';

const FEATURES = [
  { icon: ShieldCheck, text: 'Turno bloqueado apenas transferís la seña' },
  { icon: Clock, text: 'Reservá con hasta 24 hs de anticipación' },
  { icon: ChatCircleDots, text: 'Confirmación directa por WhatsApp' },
];

export default function AppShell({ children, variant = 'client' }) {
  return (
    <div className={`app-shell app-shell--${variant}`}>
      {variant === 'client' && (
        <aside className="app-shell__brand">
          <div className="app-shell__brand-mark">
            <Scissors size={20} weight="bold" />
            <span>{NEGOCIO.nombre}</span>
          </div>

          <h1 className="app-shell__headline">
            Tu turno,
            <br />
            sin ida y vuelta.
          </h1>
          <p className="app-shell__copy">
            Elegí día y horario, transferí la seña y listo. Nosotros nos encargamos de avisarle
            al peluquero.
          </p>

          <ul className="app-shell__features">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={18} weight="bold" />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <div className="app-shell__stripes" aria-hidden="true" />
        </aside>
      )}

      <div className="app-shell__frame">
        <div className="app-shell__screen">{children}</div>
      </div>
    </div>
  );
}
