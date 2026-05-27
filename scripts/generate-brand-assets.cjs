/**
 * Generate StoryForge web + Electron icon assets from Storyforge Icon.png.
 * Run: node scripts/generate-brand-assets.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'Storyforge Icon.png');

async function writePng(buffer, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(buffer).png({ compressionLevel: 9 }).toFile(dest);
  console.log('wrote', path.relative(ROOT, dest));
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Missing source image:', SOURCE);
    process.exit(1);
  }

  const source = await sharp(SOURCE).ensureAlpha().toBuffer();

  const targets = [
    { size: 512, dest: 'build-resources/icon.png' },
    { size: 512, dest: 'public/storyforge-icon.png' },
    { size: 512, dest: 'public/storyforge-logo.png' },
    { size: 32, dest: 'public/favicon-32x32.png' },
    { size: 16, dest: 'public/favicon-16x16.png' },
    { size: 180, dest: 'public/apple-touch-icon.png' },
    { size: 512, dest: 'src/app/icon.png' },
    { size: 180, dest: 'src/app/apple-icon.png' },
  ];

  for (const { size, dest } of targets) {
    const resized = await sharp(source).resize(size, size, { fit: 'cover' }).png().toBuffer();
    await writePng(resized, path.join(ROOT, dest));
  }

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map((size) => sharp(source).resize(size, size, { fit: 'cover' }).png().toBuffer()),
  );

  const pngToIcoModule = require('png-to-ico');
  const pngToIco = pngToIcoModule.default ?? pngToIcoModule;

  const icoPath = path.join(ROOT, 'build-resources', 'icon.ico');
  fs.mkdirSync(path.dirname(icoPath), { recursive: true });
  const ico = await pngToIco(icoBuffers);
  fs.writeFileSync(icoPath, ico);
  console.log('wrote', path.relative(ROOT, icoPath));

  const png2icons = require('png2icons');

  const png512 = await sharp(source).resize(512, 512, { fit: 'cover' }).png().toBuffer();
  const icns = png2icons.createICNS(png512, png2icons.BILINEAR, 0);
  if (!icns) {
    throw new Error('png2icons failed to create ICNS');
  }
  const icnsPath = path.join(ROOT, 'build-resources', 'icon.icns');
  fs.writeFileSync(icnsPath, icns);
  console.log('wrote', path.relative(ROOT, icnsPath));

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
