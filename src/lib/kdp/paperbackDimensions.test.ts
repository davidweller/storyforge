import { describe, it, expect } from 'vitest';
import { computePaperbackCanvas } from './paperbackDimensions';

describe('computePaperbackCanvas', () => {
  it('matches spec fixture: 250 pages, 6×9, White 60lb', () => {
    const c = computePaperbackCanvas({
      trimWidthInches: 6,
      trimHeightInches: 9,
      pageCount: 250,
      paperType: 'White 60lb',
    });
    const spineIn = 250 * 0.002252;
    expect(Math.abs(c.spineWidthInches - spineIn)).toBeLessThan(1e-9);

    const widthIn = 0.125 + 6 + spineIn + 6 + 0.125;
    const heightIn = 0.125 + 9 + 0.125;
    expect(c.canvasWidthPx).toBe(Math.round(widthIn * 300));
    expect(c.canvasHeightPx).toBe(Math.round(heightIn * 300));

    expect(c.bleedPx).toBe(38);
    expect(c.frontPanelRect.x).toBe(c.backPanelRect.width + c.bleedPx + c.spineRect.width);
  });

  it('matches spec fixture: 400 pages, 5.5×8.5, Cream 60lb', () => {
    const c = computePaperbackCanvas({
      trimWidthInches: 5.5,
      trimHeightInches: 8.5,
      pageCount: 400,
      paperType: 'Cream 60lb',
    });
    expect(c.spineWidthInches).toBe(400 * 0.0025);
    const spineIn = 1;
    const widthIn = 0.125 + 5.5 + spineIn + 5.5 + 0.125;
    const heightIn = 0.125 + 8.5 + 0.125;
    expect(c.canvasWidthPx).toBe(Math.round(widthIn * 300));
    expect(c.canvasHeightPx).toBe(Math.round(heightIn * 300));
  });

  it('matches spec fixture: 150 pages, 5×8, White 60lb', () => {
    const c = computePaperbackCanvas({
      trimWidthInches: 5,
      trimHeightInches: 8,
      pageCount: 150,
      paperType: 'White 60lb',
    });
    const spineRaw = 150 * 0.002252;
    expect(c.spineWidthInches).toBeGreaterThanOrEqual(0.0625);
    expect(Math.abs(c.spineWidthInches - Math.max(0.0625, spineRaw))).toBeLessThan(1e-9);

    const spineIn = c.spineWidthInches;
    const widthIn = 0.125 + 5 + spineIn + 5 + 0.125;
    const heightIn = 0.125 + 8 + 0.125;
    expect(c.canvasWidthPx).toBe(Math.round(widthIn * 300));
    expect(c.canvasHeightPx).toBe(Math.round(heightIn * 300));
  });

  it('honours spineWidthPxOverride', () => {
    const a = computePaperbackCanvas({
      trimWidthInches: 6,
      trimHeightInches: 9,
      pageCount: 250,
      paperType: 'White 60lb',
      spineWidthPxOverride: 999,
    });
    expect(a.spineRect.width).toBe(999);
  });
});
