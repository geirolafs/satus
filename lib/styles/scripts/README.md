# Style Generation Scripts

Generate CSS from TypeScript config. Run with `bun setup:styles`.

## Scripts

| Script | Output |
|--------|--------|
| `setup-styles.ts` | Orchestrates all generation |
| `generate-root.ts` | → `css/root.css` |
| `generate-tailwind.ts` | → `css/tailwind.css` |
| `generate-scale.ts` | Scale utilities |
| `postcss-functions.mjs` | `mobile-vw()`, `columns()`, etc. |
| `figma/` | Figma → repo token sync (upstream of everything above) — see [figma/README.md](./figma/README.md) |

## Build Flow

```
Figma Variables → figma-tokens.json → figma/import.ts → TypeScript Config
                                                              │
                                        Generation Scripts → CSS Variables → PostCSS → Output
```

1. Figma-owned tokens (palette, themes, layout, typography, motion): edit in
   Figma, export, `bun run figma:import` — it regenerates `colors.ts`,
   `layout.mjs`, `typography.figma.ts`, `motion.ts` and runs `setup:styles`.
2. Code-owned config (easings, breakpoints, `typography.ts` overrides): edit
   directly, then `bun setup:styles`.
3. Generated CSS is used by PostCSS.

## Best Practices

- Never hand-edit generated files: `css/root.css`, `css/tailwind.css`, and the
  Figma-generated `colors.ts` / `layout.mjs` / `typography.figma.ts` / `motion.ts`
- Run `bun run check` after a Figma import (WCAG contrast gate)
- Use `bun dev` for development (includes style watching)
