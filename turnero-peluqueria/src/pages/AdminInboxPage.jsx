import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scissors, ArrowRight, Key } from '@phosphor-icons/react';
import { useTurnosAdmin } from '../hooks/useTurnos';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import './AdminConfirmPage.css';
import './AdminInboxPage.css';

const BADGE_POR_ESTADO = {
  RESERVANDO_CON_TIMER: 'timer',
  PENDIENTE_COMPROBANTE: 'pendiente',
  CONFIRMADO: 'confirmado',
  RECHAZADO: 'rechazado',
  EXPIRADO: 'expirado',
  CANCELADO: 'cancelado',
};

// La ADMIN_KEY la ingresa el peluquero a mano y queda solo en este
// navegador. Nunca va en el bundle (nada de VITE_ADMIN_KEY).
const KEY_STORAGE = 'turnero:adminKey';

function leerClave() {
  try {
    return localStorage.getItem(KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

function guardarClave(clave) {
  try {
    if (clave) localStorage.setItem(KEY_STORAGE, clave);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage bloqueado: la clave vive solo mientras la pestaña esté abierta */
  }
}

const MENSAJES_ERROR = {
  no_autorizado: 'La clave no es correcta.',
  admin_deshabilitado: 'La bandeja está deshabilitada: falta configurar ADMIN_KEY en el servidor.',
  demasiados_intentos: 'Demasiados intentos fallidos. Esperá unos minutos y probá de nuevo.',
  red: 'No pudimos conectar con el servidor.',
};

function ClaveForm({ error, onSubmit }) {
  const [valor, setValor] = useState('');
  return (
    <form
      className="admin-inbox__key"
      onSubmit={(e) => {
        e.preventDefault();
        if (valor.trim()) onSubmit(valor.trim());
      }}
    >
      <label>
        <span>Clave de administración</span>
        <input
          type="password"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && <p className="admin-inbox__error">{MENSAJES_ERROR[error] || 'No pudimos cargar los turnos.'}</p>}
      <Button type="submit" icon={Key} disabled={!valor.trim()}>
        Entrar
      </Button>
    </form>
  );
}

export default function AdminInboxPage() {
  const [clave, setClave] = useState(leerClave);
  const [errorClave, setErrorClave] = useState(null);
  const { turnos, error } = useTurnosAdmin(clave);

  // Clave rechazada (o servidor sin ADMIN_KEY): se olvida y se vuelve a pedir.
  useEffect(() => {
    if (error && error !== 'red') {
      setErrorClave(error);
      guardarClave('');
      setClave('');
    }
  }, [error]);

  const ingresar = (valor) => {
    setErrorClave(null);
    guardarClave(valor);
    setClave(valor);
  };

  return (
    <div className="page">
      <header className="admin-header">
        <Scissors size={18} weight="bold" />
        <span>Bandeja de turnos</span>
      </header>
      <main className="page__body">
        <p className="admin-inbox__hint">
          Mientras WhatsApp no esté conectado, esta bandeja es la forma de ver los turnos pendientes.
          Cuando lo esté, el peluquero recibe un link directo por cada turno.
        </p>

        {!clave ? (
          <ClaveForm error={errorClave} onSubmit={ingresar} />
        ) : (
          <>
            {error === 'red' && <p className="admin-inbox__error">{MENSAJES_ERROR.red}</p>}
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
            <button className="admin-inbox__logout" onClick={() => ingresar('')}>
              Cerrar sesión
            </button>
          </>
        )}
      </main>
    </div>
  );
}
