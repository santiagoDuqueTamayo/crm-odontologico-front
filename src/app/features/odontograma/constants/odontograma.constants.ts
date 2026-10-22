export interface ToothCoordinates {
  top: string;
  left: string;
  rotation: string; // ej. 'rotate(15deg)'
}

// Mapa inmutable de coordenadas simulando las dos arcadas (Superior e Inferior)
export const COORDENADAS_HERRADURA: Record<number, ToothCoordinates> = {
  // --- Arcada Superior (Maxilar) ---
  18: { top: '80%', left: '5%', rotation: 'rotate(-45deg)' },
  17: { top: '65%', left: '7%', rotation: 'rotate(-35deg)' },
  16: { top: '50%', left: '10%', rotation: 'rotate(-25deg)' },
  15: { top: '35%', left: '15%', rotation: 'rotate(-15deg)' },
  14: { top: '22%', left: '22%', rotation: 'rotate(-10deg)' },
  13: { top: '12%', left: '30%', rotation: 'rotate(-5deg)' },
  12: { top: '5%', left: '40%', rotation: 'rotate(-2deg)' },
  11: { top: '2%', left: '48%', rotation: 'rotate(0deg)' },
  // Cuadrante 2 (Espejo del 1)
  21: { top: '2%', left: '52%', rotation: 'rotate(0deg)' },
  22: { top: '5%', left: '60%', rotation: 'rotate(2deg)' },
  // ... (Completar hasta el 28, 38 y 48 siguiendo la curva geométrica)
};