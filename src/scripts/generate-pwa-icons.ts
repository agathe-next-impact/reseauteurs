/**
 * generate-pwa-icons.ts — Icônes PWA dérivées du logo (src/app/icon.svg).
 *
 * Produit dans `public/icons/` les 4 tailles référencées par `src/app/manifest.ts` :
 *   - icon-192.png / icon-512.png            → purpose "any"      (affichées telles quelles)
 *   - icon-maskable-192/512.png              → purpose "maskable" (rognées par le
 *     lanceur Android en cercle / squircle / goutte selon le constructeur)
 *
 * Pourquoi deux jeux : une icône « any » peut occuper toute la surface, alors qu'une
 * « maskable » doit garder son contenu dans la ZONE DE SÉCURITÉ (les 80 % centraux) —
 * sinon les anneaux du logo sont coupés par le masque. D'où deux ratios de remplissage.
 *
 * Le fond est OPAQUE et blanc : les trois anneaux du logo sont bleu clair / bleu marine
 * / jaune ; sur un fond marine le second anneau disparaîtrait, et sur un fond
 * transparent le lanceur composerait un aplat imprévisible.
 *
 * Idempotent : réécrit les 4 fichiers à chaque exécution. À relancer si le logo change.
 *
 * Usage :  pnpm gen:pwa-icons
 */
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import sharp from 'sharp'

/** Le logo de src/app/icon.svg, en données : trois anneaux entrelacés. */
const STROKE_WIDTH = 6
const CIRCLES = [
  { cx: 41, cy: 42, r: 21, stroke: '#8BB4D9' },
  { cx: 59, cy: 42, r: 21, stroke: '#035AA6' },
  { cx: 50, cy: 60, r: 21, stroke: '#F5E050' },
]

/** Fond opaque des icônes — `--ir-surface` (blanc), pas le canvas #F2F2F2 : sur un
 *  écran d'accueil l'icône est vue seule, le blanc franc porte mieux les anneaux. */
const BACKGROUND = '#ffffff'

/** Part de la largeur occupée par le logo. 0.72 pleine surface ; 0.58 pour le masque
 *  (marge de sécurité : le rognage le plus agressif est un cercle inscrit). */
const FILL_RATIO = { any: 0.72, maskable: 0.58 } as const

/** Boîte englobante réelle du logo (anneaux + épaisseur du trait), en unités viewBox. */
function contentBox() {
  const half = STROKE_WIDTH / 2
  const minX = Math.min(...CIRCLES.map((c) => c.cx - c.r - half))
  const maxX = Math.max(...CIRCLES.map((c) => c.cx + c.r + half))
  const minY = Math.min(...CIRCLES.map((c) => c.cy - c.r - half))
  const maxY = Math.max(...CIRCLES.map((c) => c.cy + c.r + half))
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * Compose un SVG carré de `size` px : aplat de fond + logo homothétique centré sur
 * sa boîte englobante (et non sur le viewBox d'origine, dont le contenu est décentré).
 */
function buildSvg(size: number, fillRatio: number): string {
  const box = contentBox()
  const scale = (size * fillRatio) / Math.max(box.width, box.height)
  const centerX = (box.minX + box.maxX) / 2
  const centerY = (box.minY + box.maxY) / 2
  const offsetX = size / 2 - centerX * scale
  const offsetY = size / 2 - centerY * scale

  const rings = CIRCLES.map(
    (c) =>
      `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="${c.stroke}" stroke-width="${STROKE_WIDTH}"/>`,
  ).join('')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="${BACKGROUND}"/>`,
    `<g transform="translate(${offsetX} ${offsetY}) scale(${scale})">${rings}</g>`,
    `</svg>`,
  ].join('')
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, ratio: FILL_RATIO.any },
  { file: 'icon-512.png', size: 512, ratio: FILL_RATIO.any },
  { file: 'icon-maskable-192.png', size: 192, ratio: FILL_RATIO.maskable },
  { file: 'icon-maskable-512.png', size: 512, ratio: FILL_RATIO.maskable },
]

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'icons')
  await mkdir(outDir, { recursive: true })

  console.log('\n=== ICÔNES PWA ===')
  for (const target of TARGETS) {
    const svg = buildSvg(target.size, target.ratio)
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
    await writeFile(path.join(outDir, target.file), png)
    console.log(`  ✓ public/icons/${target.file}  (${target.size}px, logo à ${Math.round(target.ratio * 100)} %)`)
  }
  console.log(`\n${TARGETS.length} icônes écrites.\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
