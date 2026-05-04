import { PDFDocument as PDFLibDoc } from 'pdf-lib';
import sharp from 'sharp';

import type { WrapRect } from '@/lib/cover/fullWrapZones';
export type { WrapRect } from '@/lib/cover/fullWrapZones';

export type SpineConfig = {
  titleText: string;
  authorText: string;
  seriesText: string | null;
  backgroundColour: string;
  textColour: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Rough dominant colour mean from cover image (RGB hex). */
export async function dominantHexFromCoverB64(imageDataBase64: string): Promise<string> {
  try {
    const buf = Buffer.from(imageDataBase64, 'base64');
    const stats = await sharp(buf).resize(40, 60).stats();
    const r = Math.round(stats.channels[0]?.mean ?? 45);
    const g = Math.round(stats.channels[1]?.mean ?? 45);
    const b = Math.round(stats.channels[2]?.mean ?? 55);
    const hx = (n: number) => n.toString(16).padStart(2, '0');
    return `#${hx(r)}${hx(g)}${hx(b)}`;
  } catch {
    return '#1e293b';
  }
}

export async function renderSpinePng(widthPx: number, heightPx: number, cfg: SpineConfig): Promise<Buffer> {
  const cx = widthPx / 2;
  const cy = heightPx / 2;
  const titleFs = Math.max(10, Math.min(40, Math.floor(heightPx / 32)));
  const authorFs = Math.max(9, Math.floor(titleFs * 0.55));
  const series = cfg.seriesText?.trim() ? escapeXml(cfg.seriesText) : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">
  <rect width="100%" height="100%" fill="${escapeXml(cfg.backgroundColour)}"/>
  <text x="${cx}" y="${cy - titleFs * 0.6}" font-family="Georgia, serif" font-weight="700"
        font-size="${titleFs}" fill="${escapeXml(cfg.textColour)}" text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(-90, ${cx}, ${cy})">${escapeXml(cfg.titleText)}</text>
  <text x="${cx}" y="${cy + titleFs}" font-family="Georgia, serif" font-weight="400"
        font-size="${authorFs}" fill="${escapeXml(cfg.textColour)}" text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(-90, ${cx}, ${cy})">${escapeXml(cfg.authorText)}</text>
  ${
    series
      ? `<text x="${cx}" y="${cy + titleFs + authorFs * 1.4}" font-family="Georgia, serif" font-weight="400"
           font-size="${authorFs}" fill="${escapeXml(cfg.textColour)}" text-anchor="middle"
           dominant-baseline="middle"
           transform="rotate(-90, ${cx}, ${cy})">${series}</text>`
      : ''
  }
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function compositeFullWrapToPng(params: {
  canvasWidth: number;
  canvasHeight: number;
  backZone: WrapRect;
  spineZone: WrapRect;
  frontZone: WrapRect;
  backImageB64: string;
  spinePngBuffer: Buffer;
  frontImageB64: string;
}): Promise<Buffer> {
  const { canvasWidth: cw, canvasHeight: ch } = params;
  const backResized = await sharp(Buffer.from(params.backImageB64, 'base64'))
    .resize(Math.round(params.backZone.width), Math.round(params.backZone.height), { fit: 'fill' })
    .png()
    .toBuffer();
  const spineResized = await sharp(params.spinePngBuffer)
    .resize(Math.round(params.spineZone.width), Math.round(params.spineZone.height), { fit: 'fill' })
    .png()
    .toBuffer();
  const frontResized = await sharp(Buffer.from(params.frontImageB64, 'base64'))
    .resize(Math.round(params.frontZone.width), Math.round(params.frontZone.height), { fit: 'fill' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: cw,
      height: ch,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: backResized, left: Math.round(params.backZone.x), top: Math.round(params.backZone.y) },
      { input: spineResized, left: Math.round(params.spineZone.x), top: Math.round(params.spineZone.y) },
      { input: frontResized, left: Math.round(params.frontZone.x), top: Math.round(params.frontZone.y) },
    ])
    .png()
    .toBuffer();
}

export async function rasterPngTopdfSheet(png: Buffer, widthPx: number, heightPx: number): Promise<Buffer> {
  const doc = await PDFLibDoc.create();
  const img = await doc.embedPng(png);
  const page = doc.addPage([widthPx, heightPx]);
  page.drawImage(img, { x: 0, y: 0, width: widthPx, height: heightPx });
  return Buffer.from(await doc.save());
}
