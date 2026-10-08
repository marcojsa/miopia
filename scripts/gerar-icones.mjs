// Gera os ícones do Lumi (coruja no céu noturno) a partir do mesmo desenho do app
// (apps/mobile/src/components/lumi/LumiOwl.tsx). Usa o Chrome instalado via puppeteer-core.
// Uso: node scripts/gerar-icones.mjs <pasta-com-node_modules-do-puppeteer-core>
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.argv[2] ?? process.cwd()
const require = createRequire(path.join(path.resolve(base), 'package.json'))
const puppeteer = require('puppeteer-core')
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'mobile', 'assets', 'images')
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

// Coruja: viewBox 0 0 200 220 (igual ao LumiOwl).
const owl = (mono = false) => {
  if (mono) {
    return `
  <defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="220">
    <rect width="200" height="220" fill="#000"/>
    <path d="M60 40 L73 16 L86 42 Z" fill="#fff"/><path d="M114 42 L127 16 L140 40 Z" fill="#fff"/>
    <ellipse cx="100" cy="122" rx="66" ry="78" fill="#fff"/>
    <ellipse cx="41" cy="138" rx="15" ry="33" fill="#fff" transform="rotate(16 41 138)"/>
    <ellipse cx="159" cy="138" rx="15" ry="33" fill="#fff" transform="rotate(-16 159 138)"/>
    <ellipse cx="84" cy="199" rx="10" ry="6" fill="#fff"/><ellipse cx="116" cy="199" rx="10" ry="6" fill="#fff"/>
    <circle cx="76" cy="92" r="21" fill="#000"/><circle cx="124" cy="92" r="21" fill="#000"/>
    <circle cx="80" cy="95" r="9" fill="#fff"/><circle cx="128" cy="95" r="9" fill="#fff"/>
    <path d="M91 111 L109 111 L100 127 Z" fill="#000"/>
    <ellipse cx="100" cy="158" rx="34" ry="30" fill="#000"/>
  </mask></defs>
  <rect width="200" height="220" fill="#fff" mask="url(#m)"/>`
  }
  const c = { tuft: '#7C70D6', body: '#5B4FB5', wing: '#453A94', belly: '#EDEBFF', plume: '#C9C2EE', eyeOut: '#6F63C8', eye: '#FFFFFF', pupil: '#241D4F', glint: '#FFFFFF', coral: '#F4976C' }
  return `
  <path d="M60 40 L73 16 L86 42 Z" fill="${c.tuft}"/><path d="M114 42 L127 16 L140 40 Z" fill="${c.tuft}"/>
  <ellipse cx="100" cy="122" rx="66" ry="78" fill="${c.body}"/>
  <ellipse cx="41" cy="138" rx="15" ry="33" fill="${c.wing}" transform="rotate(16 41 138)"/>
  <ellipse cx="159" cy="138" rx="15" ry="33" fill="${c.wing}" transform="rotate(-16 159 138)"/>
  <ellipse cx="100" cy="155" rx="40" ry="37" fill="${c.belly}"/>
  <path d="M84 142 Q92 150 100 142" fill="none" stroke="${c.plume}" stroke-width="3" stroke-linecap="round"/>
  <path d="M100 142 Q108 150 116 142" fill="none" stroke="${c.plume}" stroke-width="3" stroke-linecap="round"/>
  <path d="M92 158 Q100 166 108 158" fill="none" stroke="${c.plume}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="76" cy="92" r="30" fill="${c.eyeOut}"/><circle cx="124" cy="92" r="30" fill="${c.eyeOut}"/>
  <circle cx="76" cy="92" r="22" fill="${c.eye}"/><circle cx="124" cy="92" r="22" fill="${c.eye}"/>
  <circle cx="79" cy="94" r="10" fill="${c.pupil}"/><circle cx="127" cy="94" r="10" fill="${c.pupil}"/>
  <circle cx="82.5" cy="90.5" r="3.5" fill="${c.glint}"/><circle cx="130.5" cy="90.5" r="3.5" fill="${c.glint}"/>
  <path d="M92 112 L108 112 L100 125 Z" fill="${c.coral}"/>
  <ellipse cx="84" cy="199" rx="10" ry="6" fill="${c.coral}"/><ellipse cx="116" cy="199" rx="10" ry="6" fill="${c.coral}"/>`
}

// Céu noturno com estrelas fixas (posições em % do quadro).
const STARS = [[14, 18, 9], [82, 14, 12], [90, 40, 6], [8, 52, 7], [22, 82, 6], [78, 80, 9], [50, 8, 6], [68, 26, 5], [30, 30, 5], [92, 66, 5], [12, 34, 4]]
const sky = s => `
  <defs><radialGradient id="g" cx="50%" cy="38%" r="75%">
    <stop offset="0" stop-color="#4A3FA0"/><stop offset="0.55" stop-color="#2A2350"/><stop offset="1" stop-color="#1D1840"/>
  </radialGradient></defs>
  <rect width="${s}" height="${s}" fill="url(#g)"/>
  ${STARS.map(([x, y, r]) => `<circle cx="${(x / 100) * s}" cy="${(y / 100) * s}" r="${(r / 1024) * s}" fill="#FFE9A8" opacity="${r > 8 ? 0.95 : 0.7}"/>`).join('')}`

// Coruja centralizada ocupando `frac` da altura do quadro.
const placed = (s, frac, mono = false, dy = 0) => {
  const h = s * frac, w = (h * 200) / 220
  return `<svg x="${(s - w) / 2}" y="${(s - h) / 2 + dy * s}" width="${w}" height="${h}" viewBox="0 0 200 220">${owl(mono)}</svg>`
}
const svg = (s, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${inner}</svg>`

// No ícone adaptativo do Android só os 66% centrais ficam visíveis com certeza.
const ARQUIVOS = [
  ['icon.png', 1024, false, s => sky(s) + placed(s, 0.66, false, 0.02)],
  ['android-icon-background.png', 1024, false, s => sky(s)],
  ['android-icon-foreground.png', 1024, true, s => placed(s, 0.5, false, 0.01)],
  ['android-icon-monochrome.png', 1024, true, s => placed(s, 0.5, true, 0.01)],
  ['splash-icon.png', 768, true, s => placed(s, 0.92)],
  ['notification-icon.png', 96, true, s => placed(s, 0.96, true)],
  ['favicon.png', 96, false, s => sky(s) + placed(s, 0.78, false, 0.02)],
]

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const page = await browser.newPage()
  for (const [nome, s, transparente, desenho] of ARQUIVOS) {
    await page.setViewport({ width: s, height: s, deviceScaleFactor: 1 })
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(s, desenho(s))}</body></html>`)
    await page.screenshot({ path: path.join(OUT, nome), omitBackground: transparente, clip: { x: 0, y: 0, width: s, height: s } })
    console.log('ok', nome, s)
  }
} finally {
  await browser.close()
}
