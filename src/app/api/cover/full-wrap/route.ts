import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import * as q from '@/lib/db/queries';
import { slugify } from '@/lib/utils';
import type { CoverFullWrapDocument, CoverImagePayload } from '@/types';
import {
  compositeFullWrapToPng,
  rasterPngTopdfSheet,
  renderSpinePng,
  type SpineConfig,
  type WrapRect,
} from '@/lib/cover/fullWrapComposite';
import { defaultThirdZones } from '@/lib/cover/fullWrapZones';

// Parity with generateWrapForJob in generateAllJob.ts: canvas + zones derive from stored KDP template
// via sharp metadata and equal-thirds layout — do not trust client-supplied geometry.

export const maxDuration = 120;

const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const BodySchema = z.object({
  projectId: z.string().uuid(),
  frontCoverImageId: z.string().uuid(),
  backCoverImageId: z.string().uuid(),
  spineConfig: z.object({
    titleText: z.string().min(1),
    authorText: z.string().min(1),
    seriesText: z.string().nullable().optional(),
    backgroundColour: z.string().min(4),
    textColour: z.string().min(4),
    logoImageData: z.string().nullable().optional(),
  }),
  templateDimensions: z.object({
    canvasWidth: z.number().positive(),
    canvasHeight: z.number().positive(),
    frontZone: RectSchema,
    backZone: RectSchema,
    spineZone: RectSchema,
    bleedPx: z.number().nonnegative().optional().default(0),
  }),
  outputFormat: z.enum(['pdf', 'png']),
});

async function payloadFromDoc(id: string, projectId: string, surface: 'front' | 'back'): Promise<CoverImagePayload | null> {
  const doc = await q.getDocument(id);
  if (!doc?.content || doc.projectId !== projectId) return null;
  try {
    const p = JSON.parse(doc.content) as CoverImagePayload;
    return p.surface === surface ? p : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    const { projectId, frontCoverImageId, backCoverImageId, spineConfig, outputFormat } = parsed.data;

    const project = await q.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const templateB64 = project.kdpTemplateImageData?.trim();
    if (!templateB64) {
      return NextResponse.json(
        { error: 'Upload a KDP template image first (stored on the project under Cover > Advanced Wrap).' },
        { status: 400 }
      );
    }

    let cw: number;
    let ch: number;
    let bz: WrapRect;
    let sz: WrapRect;
    let fz: WrapRect;
    try {
      const meta = await sharp(Buffer.from(templateB64, 'base64')).metadata();
      if (!meta.width || !meta.height) {
        return NextResponse.json({ error: 'Could not read template image dimensions.' }, { status: 400 });
      }
      cw = Math.round(meta.width);
      ch = Math.round(meta.height);
      const thirds = defaultThirdZones(cw, ch);
      bz = roundRect(thirds.backZone);
      sz = roundRect(thirds.spineZone);
      fz = roundRect(thirds.frontZone);
    } catch {
      return NextResponse.json({ error: 'Invalid or corrupted template image on project.' }, { status: 400 });
    }

    const spineCfg: SpineConfig = {
      titleText: spineConfig.titleText,
      authorText: spineConfig.authorText,
      seriesText: spineConfig.seriesText ?? null,
      backgroundColour: spineConfig.backgroundColour,
      textColour: spineConfig.textColour,
    };

    const front = await payloadFromDoc(frontCoverImageId, projectId, 'front');
    const back = await payloadFromDoc(backCoverImageId, projectId, 'back');
    if (!front?.imageData || !back?.imageData) {
      return NextResponse.json({ error: 'Missing front or back cover document' }, { status: 404 });
    }

    const spineBuf = await renderSpinePng(sz.width, sz.height, spineCfg);

    let spineFinal = spineBuf;
    const logoRaw = spineConfig.logoImageData?.trim();
    if (logoRaw) {
      try {
        const logos = Buffer.from(logoRaw, 'base64');
        const lh = Math.max(40, Math.floor(sz.height / 12));
        const lw = lh;
        const logoResized = await sharp(logos).resize(lw, lh, { fit: 'contain' }).png().toBuffer();
        const logoLeft = Math.max(0, Math.floor(sz.width / 2 - lw / 2));
        const logoTop = Math.max(0, sz.height - lh - Math.floor(sz.height * 0.06));
        spineFinal = await sharp(spineBuf)
          .composite([{ input: logoResized, left: logoLeft, top: logoTop }])
          .png()
          .toBuffer();
      } catch {
        spineFinal = spineBuf;
      }
    }

    const png = await compositeFullWrapToPng({
      canvasWidth: cw,
      canvasHeight: ch,
      backZone: bz,
      spineZone: sz,
      frontZone: fz,
      backImageB64: back.imageData,
      spinePngBuffer: spineFinal,
      frontImageB64: front.imageData,
    });

    const slug = slugify(project.title ?? project.genre ?? 'novel');
    const ver = `${Date.now()}`;
    let outBody: BodyInit;
    let contentType: string;
    let filename: string;

    if (outputFormat === 'pdf') {
      const pdfBuf = await rasterPngTopdfSheet(png, cw, ch);
      outBody = new Uint8Array(pdfBuf);
      contentType = 'application/pdf';
      filename = `${slug}-full-wrap-v${ver.slice(-6)}.pdf`;
    } else {
      outBody = new Uint8Array(png);
      contentType = 'image/png';
      filename = `${slug}-full-wrap-v${ver.slice(-6)}.png`;
    }

    const wrapDoc: CoverFullWrapDocument = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      frontCoverImageId,
      backCoverImageId,
      spineConfig: {
        titleText: spineCfg.titleText,
        authorText: spineCfg.authorText,
        seriesText: spineCfg.seriesText,
        backgroundColour: spineCfg.backgroundColour,
        textColour: spineCfg.textColour,
        logoImageData: spineConfig.logoImageData ?? null,
      },
      templateSource: {
        uploadedAt: new Date().toISOString(),
        detectedDimensions: {
          canvasWidth: cw,
          canvasHeight: ch,
          frontZone: fz,
          backZone: bz,
          spineZone: sz,
          bleedPx: 0,
        },
        dimensionsUserConfirmed: false,
      },
      exportedAt: new Date().toISOString(),
      exportFilename: filename,
    };

    await q.createDocument({
      projectId,
      type: 'cover-full-wrap',
      content: JSON.stringify(wrapDoc),
      version: 1,
      approved: false,
    });

    return new NextResponse(outBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'full-wrap failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function roundRect(z: WrapRect): WrapRect {
  return {
    x: Math.round(z.x),
    y: Math.round(z.y),
    width: Math.round(z.width),
    height: Math.round(z.height),
  };
}
