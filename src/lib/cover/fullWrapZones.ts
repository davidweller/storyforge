export type WrapRect = { x: number; y: number; width: number; height: number };

/** Default equal horizontal thirds → back | spine | front (typical flattened KDP template). */
export function defaultThirdZones(canvasWidth: number, canvasHeight: number): {
  backZone: WrapRect;
  spineZone: WrapRect;
  frontZone: WrapRect;
} {
  const w = canvasWidth / 3;
  const iw = Math.floor(w);
  return {
    backZone: { x: 0, y: 0, width: iw, height: canvasHeight },
    spineZone: { x: iw, y: 0, width: iw, height: canvasHeight },
    frontZone: { x: iw * 2, y: 0, width: canvasWidth - iw * 2, height: canvasHeight },
  };
}
