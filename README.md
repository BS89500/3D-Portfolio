# Shapes Portfolio

A 3D portfolio: draggable raymarched SDF shapes, scroll into project windows, then an About section. Vite + TypeScript, no runtime dependencies.

## Run

```bash
npm install
npm run dev      # local server
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
```

## Where things live

| File | What to edit |
| --- | --- |
| `index.html` | Your name, role, project windows, About text, nav links |
| `project-1.html` ... | Each project's write-up (headings and paragraphs near the bottom) |
| `src/styles/base.css` | Paper colour tokens, Futura font stack, paper texture, Bauhaus thumbnails |
| `src/styles/home.css` | Home page layout |
| `src/styles/project.css` | Project page layout |
| `src/scene/scene.frag` | The shapes themselves (signed distance functions) and lighting |
| `src/scene/scene.ts` | Dragging, physics, scroll camera, theme colours |
| `src/nav.ts` | Top-right nav behaviour |

## Add a project

1. Duplicate `project-3.html` as `project-4.html` and edit the text.
2. Copy one `<a class="win">` block in `index.html` and point `href` at the new page.
3. Add `project4: 'project-4.html'` to `build.rollupOptions.input` in `vite.config.ts`.
4. Update the Previous / Next links at the bottom of the neighbouring project pages.

## Add a nav item

Add a section with an `id` in `index.html`, a `<a href="#id" data-t="id">` in the nav, and the id to the `sections` array in `src/nav.ts`.

## Change the shapes

Ink colours are the `vec3` values in `shade()` in `scene.frag`. Sizes are in each `dN()` function. Positions are set in `layoutHome()` in `scene.ts`. If you change a shape's size, adjust its entry in `RADIUS` at the top of `scene.ts` so dragging still lines up.
