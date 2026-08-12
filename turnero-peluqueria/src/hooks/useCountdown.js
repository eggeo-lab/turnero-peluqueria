import { useEffect, useState } from 'react';

// Cuenta regresiva basada en un timestamp objetivo absoluto (no en un
// contador relativo), así sigue siendo correcta si la pestaña estuvo
// en background o si se reabre la página.
export function useCountdown(targetTimestamp) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!targetTimestamp) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [targetTimestamp]);

  if (!targetTimestamp) {
    return { msRestante: 0, vencido: true, label: '00:00', progreso: 0 };
  }

  const msRestante = Math.max(0, targetTimestamp - now);
  const vencido = msRestante <= 0;
  const totalSeg = Math.ceil(msRestante / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  const label = `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;

  return { msRestante, vencido, label, min, seg };
}
