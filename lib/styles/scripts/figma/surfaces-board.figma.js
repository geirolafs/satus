/**
 * Repaint the "Foundations — Surfaces (derived, read-only)" canvas board.
 *
 * This is Figma Plugin API code, NOT a repo module (same convention as
 * `export.figma.js`). Run it via a `use_figma` call after any palette change,
 * so the static preview catches up with the live variables.
 *
 * Why static: `--surface`, `--surface-2`, `--line`, `--line-strong` are
 * color-mix() derivations computed in `global.css` — deliberately NOT Figma
 * variables (flattening them into Figma would duplicate and drift; see
 * README "Scope"). This script re-derives them from the CURRENT values of
 * the Color variables using the same OKLab mix math the browser uses, and
 * repaints the swatches. The board stays visibly labeled read-only.
 *
 * Mix recipe mirrored from global.css:
 *   surface      = color-mix(in oklab, secondary  4%, primary)
 *   surface-2    = color-mix(in oklab, secondary  8%, primary)
 *   line         = color-mix(in oklab, secondary 14%, transparent)  → secondary @ 14% alpha
 *   line-strong  = color-mix(in oklab, secondary 28%, transparent)  → secondary @ 28% alpha
 */

const BOARD_NAME = 'Foundations — Surfaces (derived, read-only)'
const THEMES = ['Light', 'Dark', 'Red', 'Evil']

// --- OKLab math (mirrors CSS color-mix in oklab) ---
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
const clamp01 = (c) => Math.min(1, Math.max(0, c))
function rgbToOklab({ r, g, b }) {
  const [lr, lg, lb] = [toLin(r), toLin(g), toLin(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}
function oklabToRgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  return { r: clamp01(toSrgb(lr)), g: clamp01(toSrgb(lg)), b: clamp01(toSrgb(lb)) }
}
const mixOklab = (c1, pct, c2) => {
  const a1 = rgbToOklab(c1)
  const a2 = rgbToOklab(c2)
  const t = pct / 100
  return oklabToRgb({
    L: a1.L * t + a2.L * (1 - t),
    a: a1.a * t + a2.a * (1 - t),
    b: a1.b * t + a2.b * (1 - t),
  })
}

// --- Resolve Color variables (alias → primitive) per theme mode ---
const collections = await figma.variables.getLocalVariableCollectionsAsync()
const colorCol = collections.find((c) => c.name === 'Color')
const primCol = collections.find((c) => c.name === 'Primitives')
const primMode = primCol.modes[0].modeId
const colorVars = {}
for (const id of colorCol.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(id)
  colorVars[v.name] = v
}
async function resolve(v, modeId) {
  const raw = v.valuesByMode[modeId]
  if (raw && raw.type === 'VARIABLE_ALIAS') {
    const prim = await figma.variables.getVariableByIdAsync(raw.id)
    return prim.valuesByMode[primMode]
  }
  return raw
}

// --- Repaint each Theme=X section on the board ---
const board = figma.currentPage.children.find((n) => n.name === BOARD_NAME)
if (!board) throw new Error(`Board "${BOARD_NAME}" not found on the current page`)

// Text-fill mutations can throw on nodes whose fonts aren't loaded in this
// plugin context — load every font the board's text nodes use, up front.
const fonts = new Map()
for (const t of board.query('TEXT')) {
  const f = t.fontName
  if (f !== figma.mixed) fonts.set(`${f.family}/${f.style}`, f)
}
await Promise.all([...fonts.values()].map((f) => figma.loadFontAsync(f)))

const repainted = []
const mutatedNodeIds = []
for (const themeName of THEMES) {
  const mode = colorCol.modes.find((m) => m.name === themeName)
  // node names contain "=" (Theme=Light), which the query selector can't parse
  const section = board.findOne((n) => n.type === 'FRAME' && n.name === `Theme=${themeName}`)
  if (!mode || !section) throw new Error(`Theme "${themeName}": mode or section missing`)

  const primary = await resolve(colorVars.primary, mode.modeId)
  const secondary = await resolve(colorVars.secondary, mode.modeId)
  const p = { r: primary.r, g: primary.g, b: primary.b }
  const s = { r: secondary.r, g: secondary.g, b: secondary.b }

  section.fills = [{ type: 'SOLID', color: p }]
  mutatedNodeIds.push(section.id)
  for (const t of section.query('TEXT')) {
    t.fills = [{ type: 'SOLID', color: s, opacity: 0.6 }]
    mutatedNodeIds.push(t.id)
  }
  for (const [name, pct] of [
    ['surface', 4],
    ['surface-2', 8],
  ]) {
    const rect = section.query(`FRAME[name=${name}] RECTANGLE`).first()
    rect.fills = [{ type: 'SOLID', color: mixOklab(s, pct, p) }]
    mutatedNodeIds.push(rect.id)
  }
  for (const [name, alpha] of [
    ['line', 0.14],
    ['line-strong', 0.28],
  ]) {
    const rule = section.query(`FRAME[name=${name}] RECTANGLE`).first()
    rule.fills = [{ type: 'SOLID', color: s, opacity: alpha }]
    mutatedNodeIds.push(rule.id)
  }
  repainted.push({ theme: themeName, sectionId: section.id })
}

return { repainted, mutatedNodeIds }
