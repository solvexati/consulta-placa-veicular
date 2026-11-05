// Gera os ícones PNG do PWA a partir de public/icon.svg
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

await sharp(svg).resize(192, 192).png().toFile(out('pwa-192x192.png'));
await sharp(svg).resize(512, 512).png().toFile(out('pwa-512x512.png'));
await sharp(svg).resize(180, 180).flatten({ background: '#0f172a' }).png().toFile(out('apple-touch-icon.png'));

// Maskable: ícone com ~20% de margem de segurança sobre fundo sólido
const inner = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0f172a' } })
  .composite([{ input: inner, top: 76, left: 76 }])
  .png()
  .toFile(out('pwa-maskable-512x512.png'));

console.log('Ícones gerados em public/');
