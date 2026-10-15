import { useEffect, useState } from 'react';
import StepHeader from '../components/ui/StepHeader';
import ServiceStep from '../components/client/ServiceStep';
import DateTimeStep from '../components/client/DateTimeStep';
import ClientInfoStep from '../components/client/ClientInfoStep';
import PaymentStep from '../components/client/PaymentStep';
import WaitingStep from '../components/client/WaitingStep';
import { useTurno, acciones } from '../hooks/useTurnos';
import { api } from '../lib/api';
import './ClientBookingPage.css';

// Una pantalla por paso de la barra de progreso (PASOS en StepHeader).
const TITULOS = ['Elegí tu servicio', 'Elegí día y horario', 'Confirmá tus datos', 'Transferí la seña', 'Tu turno'];
const PASO_POR_STEP = {
  SERVICIO: 0,
  FECHA_HORA: 1,
  DATOS: 2,
  PAGO: 3,
  ESPERA: 4,
  RESTAURANDO: 3, // transitorio: resuelve a PAGO (3) o ESPERA (4) al cargar el turno
};

const MENSAJES_ERROR = {
  slot_ocupado: 'Justo alguien más reservó ese horario. Elegí otro, por favor.',
  fuera_de_ventana: 'Ese horario ya no está disponible.',
  fuera_de_horario: 'Ese horario está fuera del horario de atención.',
  servicio_invalido: 'Ese servicio ya no está disponible.',
  red: 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
};

// Turno en curso guardado en sessionStorage ({ id, token }) para que una
// recarga de la pestaña no pierda la reserva. Se borra al llegar a un
// estado terminal o al empezar un turno nuevo.
const SESION_KEY = 'turnero:turno';
const ESTADOS_TERMINALES = new Set(['CONFIRMADO', 'RECHAZADO', 'CANCELADO', 'EXPIRADO']);

function leerSesion() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESION_KEY));
    return s?.id && s?.token ? { id: s.id, token: s.token } : null;
  } catch {
    return null;
  }
}

function guardarSesion(sesion) {
  try {
    sessionStorage.setItem(SESION_KEY, JSON.stringify(sesion));
  } catch {
    /* storage bloqueado: la reserva sigue funcionando, solo no sobrevive a una recarga */
  }
}

function borrarSesion() {
  try {
    sessionStorage.removeItem(SESION_KEY);
  } catch {
    /* idem */
  }
}

export default function ClientBookingPage() {
  const [servicios, setServicios] = useState([]);
  const [cargandoServicios, setCargandoServicios] = useState(true);
  const [errorServicios, setErrorServicios] = useState(false);

  const [sesion, setSesion] = useState(leerSesion);
  const [step, setStep] = useState(() => (sesion ? 'RESTAURANDO' : 'SERVICIO'));
  const [servicio, setServicio] = useState(null);
  const [fechaHora, setFechaHora] = useState(null);
  const [errorReserva, setErrorReserva] = useState(null);

  // Polling del turno activo (con el token del cliente) para reflejar
  // cuando el peluquero aprueba/rechaza desde su propio link.
  const {
    turno: turnoActivo,
    error: errorTurno,
    refrescar: refrescarTurnoActivo,
  } = useTurno(sesion?.id, { clientToken: sesion?.token });

  useEffect(() => {
    api
      .getServicios()
      .then((data) => setServicios(data))
      .catch(() => setErrorServicios(true))
      .finally(() => setCargandoServicios(false));
  }, []);

  const reiniciar = () => {
    borrarSesion();
    setSesion(null);
    setStep('SERVICIO');
    setServicio(null);
    setFechaHora(null);
    setErrorReserva(null);
  };

  // Al recargar: decide en qué paso retomar según el estado real.
  useEffect(() => {
    if (step !== 'RESTAURANDO') return;
    if (errorTurno || turnoActivo?.estado === 'EXPIRADO') {
      reiniciar();
    } else if (turnoActivo) {
      setStep(turnoActivo.estado === 'RESERVANDO_CON_TIMER' ? 'PAGO' : 'ESPERA');
    }
  }, [step, turnoActivo, errorTurno]);

  // Estado terminal: la sesión ya no hace falta tras una recarga. El
  // token sigue en memoria, así que en esta pestaña todavía se puede
  // cancelar un CONFIRMADO.
  useEffect(() => {
    if (turnoActivo && ESTADOS_TERMINALES.has(turnoActivo.estado)) borrarSesion();
  }, [turnoActivo]);

  const handleConfirmarDatos = async (cliente) => {
    const { turno, error, mensaje } = await acciones.reservar(servicio, fechaHora.fecha, fechaHora.hora, cliente);
    if (!turno) {
      setErrorReserva(mensaje || MENSAJES_ERROR[error] || 'No pudimos reservar el turno.');
      setStep('FECHA_HORA');
      return;
    }
    const nueva = { id: turno.id, token: turno.clientToken };
    guardarSesion(nueva);
    setSesion(nueva);
    setErrorReserva(null);
    setStep('PAGO');
  };

  const handleComprobanteListo = async (file) => {
    const { turno, error } = await acciones.subirComprobante(sesion.id, sesion.token, file);
    if (!turno) {
      if (error === 'timer_vencido') setStep('PAGO'); // el propio PaymentStep ya muestra "vencido"
      return false;
    }
    await refrescarTurnoActivo();
    setStep('ESPERA');
    return true;
  };

  const handleCancelar = async (id) => {
    const { turno } = await acciones.cancelar(id, sesion.token);
    if (!turno) return false;
    await refrescarTurnoActivo();
    return true;
  };

  // Título y paso salen del step, no del contenido: así no saltan a
  // "Servicio" mientras se carga el turno en PAGO/ESPERA.
  const progresoStep = PASO_POR_STEP[step];
  const titulo = step === 'RESTAURANDO' ? 'Tu turno' : TITULOS[progresoStep];
  let contenido = null;
  let onBack = null;

  if (step === 'SERVICIO') {
    contenido = (
      <ServiceStep
        servicios={servicios}
        loading={cargandoServicios}
        error={errorServicios}
        onSelect={(s) => {
          setServicio(s);
          setStep('FECHA_HORA');
        }}
      />
    );
  } else if (step === 'FECHA_HORA') {
    onBack = () => setStep('SERVICIO');
    contenido = (
      <DateTimeStep
        servicio={servicio}
        onConfirm={(fecha, hora) => {
          setFechaHora({ fecha, hora });
          setStep('DATOS');
        }}
      />
    );
  } else if (step === 'DATOS') {
    onBack = () => setStep('FECHA_HORA');
    contenido = (
      <ClientInfoStep
        servicio={servicio}
        fecha={fechaHora.fecha}
        hora={fechaHora.hora}
        error={errorReserva}
        onConfirm={handleConfirmarDatos}
      />
    );
  } else if (step === 'RESTAURANDO') {
    contenido = <p className="page__loading">Recuperando tu turno…</p>;
  } else if (step === 'PAGO' && turnoActivo) {
    contenido = (
      <PaymentStep
        turno={turnoActivo}
        onComprobanteListo={handleComprobanteListo}
        onExpirado={reiniciar}
      />
    );
  } else if (step === 'ESPERA' && turnoActivo) {
    contenido = <WaitingStep turno={turnoActivo} onNuevoTurno={reiniciar} onCancelar={handleCancelar} />;
  } else {
    // PAGO/ESPERA mientras llega la primera respuesta del turno.
    contenido = <p className="page__loading">Cargando tu turno…</p>;
  }

  return (
    <div className="page">
      <StepHeader step={progresoStep} onBack={onBack} title={titulo} />
      <main className="page__body">{contenido}</main>
    </div>
  );
}
