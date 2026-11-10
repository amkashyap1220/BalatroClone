// Renders public/icons/icon.svg into the PNG sizes the web app manifest and iOS need.
// Run with: node scripts/make-icons.cjs   (needs Playwright with Chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  // Maskable: the art already sits inside the central 80% safe zone, and the felt fills the bleed.
  { file: 'icon-maskable-512.png', size: 512, pad: 0 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const t of targets) {
    await page.setViewportSize({ width: t.size, height: t.size });
    const inner = Math.round(t.size * (1 - t.pad * 2));
    await page.setContent(`<html><body style="margin:0;background:#052820;display:grid;place-items:center;width:${t.size}px;height:${t.size}px;overflow:hidden">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
    await page.screenshot({ path: path.join(dir, t.file), omitBackground: false });
    console.log('wrote', t.file);
  }
  await browser.close();
})();
