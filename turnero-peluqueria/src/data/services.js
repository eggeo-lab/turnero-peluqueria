import { Scissors, Faders, PaintBrush } from '@phosphor-icons/react';

// Datos de la cuenta para transferencia — reemplazar por los reales
// (más adelante puede vivir en el backend, en una tabla de config).
export const CUENTA_TRANSFERENCIA = {
  titular: 'Estudio Navaja S.R.L.',
  alias: 'estudio.navaja.mp',
  cbu: '0000003100012345678901',
};

// El backend guarda solo el nombre del ícono (string); acá lo mapeamos
// al componente real de Phosphor.
export const SERVICE_ICONS = {
  Scissors,
  Razor: Scissors,
  Faders,
  PaintBrush,
};
