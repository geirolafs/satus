# Styles

Hybrid styling for Satūs: **Tailwind CSS v4** (CSS-based config via `@theme`),
**CSS Modules** for complex/animated components, and custom **PostCSS functions**
+ **`dr-*` utilities** for viewport-relative responsive sizing.

## Which tool for which job?

Reach for the lightest tool that does the job. In rough order of preference:

| Use… | When | Example |
|------|------|---------|
| **Tailwind utilities** | Layout, spacing, fl/grid, color, simple states. The default. | `className="flex items-center gap-4 p-6"` |
| **`dr-*` utilities** | Sizing that must **scale with the viewport** (px-perfect to a design) | `className="dr-w-150 dr-h-100"` |
| **PostCSS fns in CSS** | Viewport/column math inside a CSS Module | `width: desktop-vw(320);` |
| **CSS Modules** | Complex layouts, keyframes, pseudo-elements, deep specificity | `import s from './x.module.css'` |
| **Inline `style`** | **Only** dynamic runtime values (a computed `--progress`) | `style={{ '--p': pct } as CSSProperties}` |

Rules of thumb: never hand-write spacing/colors Tailwind already gives you;
animate only `transform`/`opacity`; compose classes with `cn()` (from `clsx`),
and keep classes **sorted** (Biome enforces `useSortedClasses`).

## A component using all three

```tsx
import cn from 'clsx'
import type { ComponentProps } from 'react'
import s from './card.module.css'

interface CardProps extends ComponentProps<'article'> {
  featured?: boolean
}

export function Card({ featured = false, className, ...props }: CardProps) {
  return (
    <article
      // Tailwind atoms + dr-* responsive width + a CSS Module class (conditional)
      className={cn('flex flex-col gap-4', s.root, featured && s.isFeatured, className)}
      {...props}
    />
  )
}
```

```css
/* card.module.css — CamelCase class names, `s.root` import convention */
.root {
  width: desktop-vw(320);          /* PostCSS: 320px at the desktop viewport */
  padding: desktop-vw(24);
  background: var(--color-primary); /* design token (theme-aware) */
  border-radius: desktop-vw(8);
}

.isFeatured {
  border: 1px solid var(--color-contrast);
}
```

## PostCSS functions

```css
.element {
  width: mobile-vw(375);     /* 375px at the mobile viewport */
  height: desktop-vh(100);   /* 100px at the desktop viewport */
}
.sidebar {
  width: columns(3);         /* spans 3 grid columns + gaps */
}
```

Available: `mobile-vw()`, `mobile-vh()`, `desktop-vw()`, `desktop-vh()`, `columns(n)`.

## Custom `dr-*` utilities

```tsx
<div className="dr-w-150 dr-h-100" />  {/* viewport-scaled width/height */}
<div className="dr-w-col-4" />          {/* 4 columns wide */}
<div className="dr-grid" />             {/* 4 cols mobile, 12 cols desktop */}
```

See the generated `css/tailwind.css` for the full generated set.

## Breakpoints

```css
@media (--mobile)  { /* <= 799px */ }
@media (--desktop) { /* >= 800px (desktop breakpoint) */ }
```

## Design tokens

**Figma is the source of truth** for colors, themes, layout, typography, and
motion: designers edit Figma Variables (or the Foundations canvas boards bound
to them), the export lands in `scripts/figma/figma-tokens.json`, and
`bun run figma:import` regenerates the source config. Full workflow:
[`scripts/figma/README.md`](./scripts/figma/README.md). Easings and breakpoints
stay code-owned.

Layout tokens are generated into `css/root.css`. Color and font tokens are
registered with Tailwind via `@theme` in `css/tailwind.css`. Easing tokens live
in the hand-authored `css/easings.css`. Key families:

- **Color** — `@theme` in `css/tailwind.css` is the single source of truth for
  the raw palette (`--color-red`, `--color-blue`, …) plus **theme-aware**
  `--color-primary` / `--color-secondary` / `--color-contrast`, which are remapped
  per theme (`light`, `dark`, `evil`, `red`). Tailwind v4 compiles `@theme` into
  `:root` custom properties, so there is no separate `:root` copy. Set the active
  theme via the Theme wrapper (e.g. `<Wrapper theme="dark">`), then reference the
  semantic tokens — never hard-code a hex in a component.
- **Easing** — `--ease-out-expo`, `--ease-in-out-cubic`, `--ease-gleasing`, … are
  defined in `css/easings.css` as a hand-authored `@theme` block (static
  cubic-bezier strings, no generation needed). Easing tokens live only in
  `css/easings.css` — no `@theme` duplication in `css/tailwind.css`.
- **Layout** — `--gap`, `--device-width`, and the column grid that powers
  `columns()` and `dr-*-col-*`.
- **Motion** — `--duration-fast` / `--duration` / `--duration-slow` in
  `css/root.css`, Figma-sourced via `motion.ts`.
- **Surfaces & lines** — `--surface`, `--surface-2`, `--line`, `--line-strong`
  are **derived** in `css/global.css` via `color-mix` from the active theme's
  colors. Not tokens to edit — they adapt automatically when the palette changes.

## Adding a design token

Where the edit happens depends on who owns the token:

**Figma-owned** (palette, themes, layout, typography, motion) — edit in Figma,
then sync. Hand-edits to `colors.ts` & co. are overwritten by the next import.

```bash
# 1. Add/edit the Variable in the Figma file (or drag it on a Foundations board)
# 2. Export → scripts/figma/figma-tokens.json (see scripts/figma/README.md)
bun run figma:import   # regenerates colors.ts, layout.mjs, typography.figma.ts, motion.ts
bun run check          # WCAG contrast gate + types + tests
# 3. Use it
#    CSS:      color: var(--color-brand);
#    Tailwind: className="text-(--color-brand)"
```

**Code-owned** (easings, breakpoints, typography overrides) — edit the source
file directly, then `bun setup:styles`.

| File | Owner | Purpose |
|------|-------|---------|
| `colors.ts` | Figma (generated) | Color palette & per-theme semantic mapping |
| `layout.mjs` | Figma (generated) | Grid, spacing, device widths — except `breakpoints`, which is code-owned and preserved across syncs |
| `typography.figma.ts` | Figma (generated) | Raw type ramp |
| `motion.ts` | Figma (generated) | Durations |
| `typography.ts` | Code | Override shell merged over `typography.figma.ts` (overrides win; import warns on masking) |
| `easings.ts` | Code | Easing values as a JS object (animation utilities). CSS authority is `css/easings.css`. |
| `fonts.ts` | Code | Font loading |
| `config.ts` | Code | Aggregates the above (imported as `@/config`) |

## Generated files — do not edit

`css/root.css` (layout custom properties) and `css/tailwind.css` (`@theme` + utilities)
are **generated** by `bun setup:styles`; `colors.ts`, `layout.mjs`,
`typography.figma.ts`, and `motion.ts` are generated by `bun run figma:import`
(they carry a `GENERATED` banner). Hand-edits are overwritten on the next run.

`css/easings.css` and `css/global.css` are **not generated** — edit them directly.

- `css/easings.css` — hand-authored `@theme` block for all `--ease-*` custom
  properties. Static cubic-bezier strings; update by editing this file directly.
  Values must stay in sync with `easings.ts` (the JS object exported via the
  `@/styles` barrel).
- `css/global.css` — the derived surface/line tokens (`--surface`,
  `--surface-2`, `--line`, `--line-strong` via `color-mix`), selection/focus
  styling, the `[data-reveal]` reveal-animation contract (used by `useReveal`),
  and the global `prefers-reduced-motion` neutralizer.

## Troubleshooting

- **Tokens missing / `var(--color-*)` resolves to nothing, `dr-*` classes do nothing, or `mobile-vw()` is left unparsed** — the generated CSS is stale. `bun dev` runs the generator in **watch mode** and `bun run build` runs it first, so this normally self-heals; if the watcher isn't running (CI, a one-off script, or it didn't pick up a change), regenerate manually with `bun setup:styles`.
- **A token edit "didn't apply"** — for Figma-owned tokens (palette, themes, layout, typography, motion) the source is Figma: hand-edits to `colors.ts` & co. are overwritten by `bun run figma:import`. For code-owned config, confirm you changed the source in `lib/styles/*`, not the generated `css/*`, then re-run `bun setup:styles`.
- **Unsorted-class lint error** — let Biome fix it: `bun lint:fix`.
