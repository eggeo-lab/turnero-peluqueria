import { Scissors, Faders, PaintBrush } from '@phosphor-icons/react';

// El backend guarda solo el nombre del ícono (string); acá lo mapeamos
// al componente real de Phosphor.
export const SERVICE_ICONS = {
  Scissors,
  Razor: Scissors,
  Faders,
  PaintBrush,
};
