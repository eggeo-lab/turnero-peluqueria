import { useRef, useState } from 'react';
import {
  Copy,
  Check,
  UploadSimple,
  Image as ImageIcon,
  WarningCircle,
} from '@phosphor-icons/react';
import { useCountdown } from '../../hooks/useCountdown';
import { RESERVA_TIMER_MIN } from '../../lib/slots';
import { NEGOCIO } from '../../data/negocio';
import CountdownRing from '../ui/CountdownRing';
import TicketCard from '../ui/TicketCard';
import Button from '../ui/Button';
import './PaymentStep.css';

function CopyField({ label, value }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard no disponible: el usuario puede seleccionar el texto igual */
    }
  };
  return (
    <div className="copy-field">
      <div>
        <span className="copy-field__label">{label}</span>
        <span className="copy-field__value">{value}</span>
      </div>
      <button className="copy-field__btn" onClick={copiar} aria-label={`Copiar ${label}`}>
        {copiado ? <Check size={17} weight="bold" /> : <Copy size={17} />}
      </button>
    </div>
  );
}

export default function PaymentStep({ turno, onComprobanteListo, onExpirado }) {
  const { label, msRestante, vencido } = useCountdown(turno.reservadoHasta);
  const progreso = Math.max(0, Math.min(1, msRestante / (RESERVA_TIMER_MIN * 60 * 1000)));
  const urgente = msRestante > 0 && msRestante < 60 * 1000;
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);

  if (vencido && !preview) {
    return (
      <div className="payment-step payment-step--expirado">
        <WarningCircle size={40} weight="fill" color="var(--danger)" />
        <h2>Se venció el tiempo de reserva</h2>
        <p>No llegó el comprobante a tiempo y liberamos el horario para otras personas.</p>
        <Button variant="ghost" onClick={onExpirado}>
          Elegir otro turno
        </Button>
      </div>
    );
  }

  const manejarArchivo = (file) => {
    if (!file) return;
    setArchivo(file);
    setErrorEnvio(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const confirmarEnvio = async () => {
    setSubiendo(true);
    setErrorEnvio(null);
    const ok = await onComprobanteListo(archivo);
    if (!ok) {
      setSubiendo(false);
      setErrorEnvio('No pudimos enviar el comprobante. Probá de nuevo.');
    }
  };

  return (
    <div className="payment-step">
      <TicketCard
        servicio={turno.servicio}
        fecha={turno.fecha}
        hora={turno.hora}
      />

      <div className="payment-step__timer">
        <CountdownRing label={label} progreso={progreso} urgente={urgente} />
        <p className="payment-step__timer-copy">
          Guardamos tu horario por <strong>{RESERVA_TIMER_MIN} minutos</strong>. Transferí la seña y
          subí el comprobante antes de que se acabe el tiempo.
        </p>
      </div>

      <div className="payment-step__cuenta">
        <span className="eyebrow">Transferir seña · ${turno.servicio.senia.toLocaleString('es-AR')}</span>
        <CopyField label="Alias" value={NEGOCIO.cuenta.alias} />
        <CopyField label="CBU" value={NEGOCIO.cuenta.cbu} />
        <CopyField label="Titular" value={NEGOCIO.cuenta.titular} />
      </div>

      <div className="payment-step__upload">
        <span className="eyebrow">Comprobante de transferencia</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={(e) => manejarArchivo(e.target.files?.[0])}
        />

        {!preview ? (
          <button className="upload-box" onClick={() => fileRef.current?.click()}>
            <UploadSimple size={22} />
            <span>Adjuntar foto o captura</span>
          </button>
        ) : (
          <div className="upload-preview">
            <img src={preview} alt="Comprobante adjunto" />
            <button className="upload-preview__change" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={15} /> Cambiar imagen
            </button>
          </div>
        )}
      </div>

      {errorEnvio && <p className="payment-step__error">{errorEnvio}</p>}

      <Button disabled={!archivo || subiendo} onClick={confirmarEnvio}>
        {subiendo ? 'Enviando…' : 'Enviar comprobante'}
      </Button>
    </div>
  );
}
