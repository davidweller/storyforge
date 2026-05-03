import sharp from 'sharp';
import type { PaperbackSpecPayload } from '@/types';

const ISBN_BARCODE_W_PX = Math.round(2 * 300);
const ISBN_BARCODE_H_PX = Math.round(1.25 * 300);
/** ~0.32" margin inside back panel toward trim. */
const BARCODE_MARGIN_PX = Math.round(0.32 * 300);

/** Place front/back in panel rects; spine as vertical gradient; barcode reserve on back. */
export async function compositePaperbackFullWrap(params: {
  spec: PaperbackSpecPayload;
  frontB64: string;
  backB64: string;
  spineTopHex?: string;
  spineBottomHex?: string;
}): Promise<Buffer> {
  const {
    spec,
    frontB64,
    backB64,
    spineTopHex = '#2d3748',
    spineBottomHex = '#1a202c',
  } = params;

  const w = spec.canvasWidthPx;
  const h = spec.canvasHeightPx;

  const frontBuf = Buffer.from(frontB64, 'base64');
  const backBuf = Buffer.from(backB64, 'base64');

  const frontPlaced = await fitImageToPanel(frontBuf, spec.frontPanelRect);
  const backPlaced = await fitImageToPanel(backBuf, spec.backPanelRect);

  const spineSvg = buildSpineGradientSvg(spec.spineRect.width, spec.spineRect.height, spineTopHex, spineBottomHex);
  const spineBuf = await sharp(Buffer.from(spineSvg)).png().toBuffer();

  const composites: sharp.OverlayOptions[] = [
    { input: backPlaced, left: spec.backPanelRect.x, top: spec.backPanelRect.y },
    { input: spineBuf, left: spec.spineRect.x, top: spec.spineRect.y },
    { input: frontPlaced, left: spec.frontPanelRect.x, top: spec.frontPanelRect.y },
  ];

  const back = spec.backPanelRect;
  const bx = back.x + back.width - BARCODE_MARGIN_PX - ISBN_BARCODE_W_PX;
  const by = back.y + back.height - BARCODE_MARGIN_PX - ISBN_BARCODE_H_PX;
  const barcodeSvg = `<svg width="${ISBN_BARCODE_W_PX}" height="${ISBN_BARCODE_H_PX}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
</svg>`;
  composites.push({
    input: await sharp(Buffer.from(barcodeSvg)).png().toBuffer(),
    left: bx,
    top: by,
  });

  const base = sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: '#ffffff',
    },
  }).png();

  return base.composite(composites).toBuffer();
}

async function fitImageToPanel(
  imgBuf: Buffer,
  rect: PaperbackSpecPayload['frontPanelRect']
): Promise<Buffer> {
  return sharp(imgBuf)
    .resize({
      width: rect.width,
      height: rect.height,
      fit: 'cover',
      position: sharp.strategy.attention,
    })
    .png()
    .toBuffer();
}

function buildSpineGradientSvg(w: number, h: number, top: string, bottom: string): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${top}"/>
      <stop offset="100%" stop-color="${bottom}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`;
}
