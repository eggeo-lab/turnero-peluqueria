import { useEffect, useState } from 'react';
import StepHeader from '../components/ui/StepHeader';
import ServiceStep from '../components/client/ServiceStep';
import DateTimeStep from '../components/client/DateTimeStep';
import ClientInfoStep from '../components/client/ClientInfoStep';
import PaymentStep from '../components/client/PaymentStep';
import WaitingStep from '../components/client/WaitingStep';
import { useTurnos, useTurno } from '../hooks/useTurnos';
import { api } from '../lib/api';
import './ClientBookingPage.css';

const TITULOS = ['Elegí tu servicio', 'Elegí día y horario', 'Confirmá tus datos', 'Tu turno'];

const MENSAJES_ERROR = {
  slot_ocupado: 'Justo alguien más reservó ese horario. Elegí otro, por favor.',
  fuera_de_ventana: 'Ese horario ya no está disponible.',
  servicio_invalido: 'Ese servicio ya no está disponible.',
  red: 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
};

export default function ClientBookingPage() {
  const { turnos, reservarSlot, subirComprobante, cancelarTurno } = useTurnos();
  const [servicios, setServicios] = useState([]);
  const [cargandoServicios, setCargandoServicios] = useState(true);
  const [errorServicios, setErrorServicios] = useState(false);

  const [step, setStep] = useState('SERVICIO');
  const [servicio, setServicio] = useState(null);
  const [fechaHora, setFechaHora] = useState(null);
  const [turnoId, setTurnoId] = useState(null);
  const [errorReserva, setErrorReserva] = useState(null);

  // Se suscribe (polling) al turno activo para reflejar cuando el
  // peluquero aprueba/rechaza desde su propio link.
  const { turno: turnoActivo, refrescar: refrescarTurnoActivo } = useTurno(turnoId);

  useEffect(() => {
    api
      .getServicios()
      .then((data) => setServicios(data))
      .catch(() => setErrorServicios(true))
      .finally(() => setCargandoServicios(false));
  }, []);

  const reiniciar = () => {
    setStep('SERVICIO');
    setServicio(null);
    setFechaHora(null);
    setTurnoId(null);
    setErrorReserva(null);
  };

  const handleConfirmarDatos = async (cliente) => {
    const { turno, error, mensaje } = await reservarSlot(servicio, fechaHora.fecha, fechaHora.hora, cliente);
    if (!turno) {
      setErrorReserva(mensaje || MENSAJES_ERROR[error] || 'No pudimos reservar el turno.');
      setStep('FECHA_HORA');
      return;
    }
    setErrorReserva(null);
    setTurnoId(turno.id);
    setStep('PAGO');
  };

  const handleComprobanteListo = async (file) => {
    const { turno, error } = await subirComprobante(turnoId, file);
    if (!turno) {
      if (error === 'timer_vencido') setStep('PAGO'); // el propio PaymentStep ya muestra "vencido"
      return false;
    }
    setStep('ESPERA');
    return true;
  };

  const handleCancelar = async (id) => {
    const { turno } = await cancelarTurno(id);
    if (!turno) return false;
    await refrescarTurnoActivo();
    return true;
  };

  let contenido = null;
  let titulo = TITULOS[0];
  let progresoStep = 0;
  let onBack = null;

  if (step === 'SERVICIO') {
    titulo = TITULOS[0];
    progresoStep = 0;
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
    titulo = TITULOS[1];
    progresoStep = 1;
    onBack = () => setStep('SERVICIO');
    contenido = (
      <DateTimeStep
        servicio={servicio}
        turnos={turnos}
        onConfirm={(fecha, hora) => {
          setFechaHora({ fecha, hora });
          setStep('DATOS');
        }}
      />
    );
  } else if (step === 'DATOS') {
    titulo = TITULOS[2];
    progresoStep = 2;
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
  } else if (step === 'PAGO' && turnoActivo) {
    titulo = 'Transferí la seña';
    progresoStep = 2;
    contenido = (
      <PaymentStep
        turno={turnoActivo}
        onComprobanteListo={handleComprobanteListo}
        onExpirado={reiniciar}
      />
    );
  } else if (step === 'ESPERA' && turnoActivo) {
    titulo = TITULOS[3];
    progresoStep = 3;
    contenido = <WaitingStep turno={turnoActivo} onNuevoTurno={reiniciar} onCancelar={handleCancelar} />;
  }

  return (
    <div className="page">
      <StepHeader step={progresoStep} onBack={onBack} title={titulo} />
      <main className="page__body">{contenido}</main>
    </div>
  );
}
