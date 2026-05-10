export interface KdpTrimSizeOption {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
}

export const KDP_TRIM_SIZES: KdpTrimSizeOption[] = [
  { id: '5x8', label: '5 x 8 in', widthIn: 5, heightIn: 8 },
  { id: '5.06x7.81', label: '5.06 x 7.81 in (A5)', widthIn: 5.06, heightIn: 7.81 },
  { id: '5.25x8', label: '5.25 x 8 in', widthIn: 5.25, heightIn: 8 },
  { id: '5.5x8.5', label: '5.5 x 8.5 in', widthIn: 5.5, heightIn: 8.5 },
  { id: '6x9', label: '6 x 9 in', widthIn: 6, heightIn: 9 },
  { id: '6.14x9.21', label: '6.14 x 9.21 in', widthIn: 6.14, heightIn: 9.21 },
  { id: '6.69x9.61', label: '6.69 x 9.61 in', widthIn: 6.69, heightIn: 9.61 },
  { id: '7x10', label: '7 x 10 in', widthIn: 7, heightIn: 10 },
  { id: '7.44x9.69', label: '7.44 x 9.69 in', widthIn: 7.44, heightIn: 9.69 },
  { id: '7.5x9.25', label: '7.5 x 9.25 in', widthIn: 7.5, heightIn: 9.25 },
  { id: '8x10', label: '8 x 10 in', widthIn: 8, heightIn: 10 },
  { id: '8.25x6', label: '8.25 x 6 in (landscape)', widthIn: 8.25, heightIn: 6 },
  { id: '8.5x8.5', label: '8.5 x 8.5 in', widthIn: 8.5, heightIn: 8.5 },
  { id: '8.5x11', label: '8.5 x 11 in', widthIn: 8.5, heightIn: 11 },
];

export const DEFAULT_KDP_TRIM_SIZE_ID = '6x9';

export function getKdpTrimSizeById(id: string): KdpTrimSizeOption | null {
  return KDP_TRIM_SIZES.find((opt) => opt.id === id) ?? null;
}

export function estimateWrapDimensionsFromTrimSize(params: {
  trimWidthIn: number;
  trimHeightIn: number;
  dpi?: number;
  estimatedSpineWidthIn?: number;
}): { canvasWidth: number; canvasHeight: number } {
  const dpi = params.dpi ?? 300;
  const bleedIn = 0.125;
  const spineIn = params.estimatedSpineWidthIn ?? 0.35;
  const canvasWidthIn = params.trimWidthIn * 2 + spineIn + bleedIn * 2;
  const canvasHeightIn = params.trimHeightIn + bleedIn * 2;
  return {
    canvasWidth: Math.max(600, Math.round(canvasWidthIn * dpi)),
    canvasHeight: Math.max(600, Math.round(canvasHeightIn * dpi)),
  };
}
