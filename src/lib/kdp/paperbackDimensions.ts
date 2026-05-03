/**
 * KDP paperback spine and full-wrap canvas math (300 dpi).
 * Aligns with docs/cover-generation-feature-spec.md §3 Stage F.
 */

export const BLEED_INCHES = 0.125;
export const DPI = 300;

export type KdpPaperType =
  | 'White 60lb'
  | 'Cream 60lb'
  | 'White 50lb (premium)'
  | 'Cream 50lb (premium)';

/** KDP Cover Creator paper thickness per page (inches per page). */
export const PAPER_THICKNESS_PER_PAGE: Record<KdpPaperType, number> = {
  'White 60lb': 0.002252,
  'Cream 60lb': 0.0025,
  'White 50lb (premium)': 0.002143,
  'Cream 50lb (premium)': 0.002381,
};

/** Trim label → width × height inches (non-custom presets). */
export const KDP_TRIM_PRESETS: Record<
  string,
  { label: string; widthIn: number; heightIn: number }
> = {
  '5x8': { label: '5 × 8', widthIn: 5, heightIn: 8 },
  '5.25x8': { label: '5.25 × 8', widthIn: 5.25, heightIn: 8 },
  '5.5x8.5': { label: '5.5 × 8.5', widthIn: 5.5, heightIn: 8.5 },
  '6x9': { label: '6 × 9', widthIn: 6, heightIn: 9 },
  '6.14x9.21': { label: '6.14 × 9.21', widthIn: 6.14, heightIn: 9.21 },
  '6.69x9.61': { label: '6.69 × 9.61', widthIn: 6.69, heightIn: 9.61 },
  '7x10': { label: '7 × 10', widthIn: 7, heightIn: 10 },
  '8x10': { label: '8 × 10', widthIn: 8, heightIn: 10 },
  '8.25x10.25': { label: '8.25 × 10.25', widthIn: 8.25, heightIn: 10.25 },
  a4: { label: '8.27 × 11.69 (A4)', widthIn: 8.27, heightIn: 11.69 },
};

/** Words-per-page estimates for interior pre-fill by trim (spec table). */
export const WORDS_PER_PAGE_BY_TRIM_KEY: Record<string, number> = {
  '5x8': 250,
  '5.25x8': 260,
  '5.5x8.5': 275,
  '6x9': 300,
  '6.14x9.21': 310,
  '6.69x9.61': 330,
  '7x10': 350,
  '8x10': 390,
  '8.25x10.25': 400,
  a4: 440,
};

export function wordsPerPageForTrim(trimsKey: keyof typeof KDP_TRIM_PRESETS): number {
  return WORDS_PER_PAGE_BY_TRIM_KEY[trimsKey] ?? 300;
}

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaperbackCanvasComputed {
  bleedPx: number;
  trimWidthPx: number;
  trimHeightPx: number;
  spineWidthPx: number;
  spineWidthInches: number;
  canvasWidthPx: number;
  canvasHeightPx: number;
  frontPanelRect: PanelRect;
  spineRect: PanelRect;
  backPanelRect: PanelRect;
}

/**
 * KDP minimum spine width for text (spec). We only colour-fill the spine in v1 — kept for display notes.
 */
export const KDP_MIN_SPINE_WIDTH_INCHES = 0.0625;

export function computeSpineWidthInches(pageCount: number, paperType: KdpPaperType): number {
  const per = PAPER_THICKNESS_PER_PAGE[paperType];
  return Math.max(KDP_MIN_SPINE_WIDTH_INCHES, pageCount * per);
}

export function computePaperbackCanvas(params: {
  trimWidthInches: number;
  trimHeightInches: number;
  pageCount: number;
  paperType: KdpPaperType;
  /** When set, overrides formula spine width (px) but trim/page/paper still used elsewhere. */
  spineWidthPxOverride?: number | null;
}): PaperbackCanvasComputed {
  const { trimWidthInches, trimHeightInches, pageCount, paperType } = params;
  const spineWidthInches = computeSpineWidthInches(pageCount, paperType);

  const bleedPx = Math.round(BLEED_INCHES * DPI);
  const trimWidthPx = Math.round(trimWidthInches * DPI);
  const trimHeightPx = Math.round(trimHeightInches * DPI);
  let spineWidthPx = Math.round(spineWidthInches * DPI);
  if (typeof params.spineWidthPxOverride === 'number' && params.spineWidthPxOverride > 0) {
    spineWidthPx = Math.round(params.spineWidthPxOverride);
  }

  const canvasWidthInches =
    BLEED_INCHES + trimWidthInches + spineWidthInches + trimWidthInches + BLEED_INCHES;
  const canvasHeightInches = BLEED_INCHES + trimHeightInches + BLEED_INCHES;

  const canvasWidthPx = Math.round(canvasWidthInches * DPI);
  const canvasHeightPx = Math.round(canvasHeightInches * DPI);

  const backPanelRect: PanelRect = {
    x: bleedPx,
    y: bleedPx,
    width: trimWidthPx,
    height: trimHeightPx,
  };
  const spineRect: PanelRect = {
    x: bleedPx + trimWidthPx,
    y: bleedPx,
    width: spineWidthPx,
    height: trimHeightPx,
  };
  const frontPanelRect: PanelRect = {
    x: bleedPx + trimWidthPx + spineWidthPx,
    y: bleedPx,
    width: trimWidthPx,
    height: trimHeightPx,
  };

  return {
    bleedPx,
    trimWidthPx,
    trimHeightPx,
    spineWidthPx,
    spineWidthInches,
    canvasWidthPx,
    canvasHeightPx,
    frontPanelRect,
    spineRect,
    backPanelRect,
  };
}
