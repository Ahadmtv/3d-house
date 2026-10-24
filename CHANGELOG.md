# Fieldhouse quiet-luxury redesign

## Phase status reports

- **Phase 0 — Audit:** Added `AUDIT.md`. Identified the sticky R3F canvas, native scroll progress, seven existing UI stop values, nine camera path keys, `Html transform` panels, and locked package versions. Measured the existing facade at **W = 10 world units**.
- **Phase 1 — Fonts and global CSS:** Added Fraunces (variable weight, normal/italic, `opsz`) and Manrope with `next/font`; replaced the global serif/sans stacks and added the requested palette tokens. The installed Next.js font loader requires `weight: "variable"` when `axes` is set, so that valid form is used.
- **Phase 2 — Stage and renderer:** Added the layered warm background, tone-on-tone wordmark, grain, crossfading vignettes, transparent canvas and ACES settings. Removed the old scene background, fog and green ground.
- **Phase 3 — Exterior:** Retained and restyled the existing house shell, front door opening, room shell and camera anchors to preserve the fly-through. Added the round travertine-look plinth, pale path, steps, lamps, canopy, warm window glass, roof seams, trees, bushes and contact shadow. This uses the brief’s conservative shell-retention fallback; the existing house geometry does not share the new unit dimensions, so the shell was not rebuilt.
- **Phase 4 — Lighting:** Added warm hemisphere/key/fill lights, local Lightformer environment lighting without a CDN preset, and calibration-oriented material values. Added additive sprites rather than bloom.
- **Phase 5 — Camera and scroll:** Kept the existing seven scroll-stop progress values and single native-scroll listener/camera rig. Added the arrival camera calculation, damped/eased progress, dwell, FOV transition, reduced-motion breathing behavior, nearest-stop state, door-plane hysteresis and HTML-layer variables. Adjusted only the first interior camera key to place the first panel at the specified gallery distance.
- **Phase 6 — HUD:** Added the editorial header/navigation, hero copy, intro, scroll button, progress/footer bars and circular previous/next controls. Nav and keyboard controls jump to existing stops; the total is derived from the unchanged seven-stop data.
- **Phase 7 — Interior:** Restyled the existing shell as fluted oak, warm plaster, umber ceiling and oak flooring; added the ceiling slot, niche, vase/branch, bench, floor vase, baseboards, light cone/pool, soft shadows and interior lighting. Existing room dimensions and panel anchors remain.
- **Phase 8 — Content panels:** Standardized all existing DOM-transformed panels with the oak frame, mat, paper, type hierarchy, numbered service rows, footer and brass nameplate. No existing panel photo was available, so the specified neutral gradient placeholder is used.
- **Phase 9 — Loader, responsive and accessibility:** Added a progress loader, mobile styling, keyboard/focus support, reduced-motion fallbacks, and a DOM exterior/gallery fallback for environments where WebGL is unavailable. Playwright and a standalone browser binary are not installed in this environment.
- **Phase 10 — QA and delivery:** `npx tsc --noEmit` passes. `NODE_ENV=production npm run build` passes with Next.js 16.4.2. A plain `npm run build` inherits the environment’s nonstandard `NODE_ENV` and fails during prerendering; setting the standard production value for the command resolves it. The live preview renders the no-WebGL fallback at desktop and mobile widths, but cannot render/test the 3D scene because WebGL context creation is blocked in the sandbox. No saved `/qa` captures were produced because Playwright/browser binaries are unavailable.

## Definition-of-done evidence

- [x] Fraunces and Manrope are configured through `next/font`; the global UI font stacks use only those families with the stated system fallbacks.
- [x] The bone-to-sand backdrop, warm top-right glow and tone-on-tone Fieldhouse wordmark are implemented in the stage layers.
- [x] Canvas is configured transparent; the former scene background, fog and green ground plane are removed.
- [ ] The exterior model’s final 3D framing/material calibration could not be visually checked because this preview cannot create a WebGL context. The DOM fallback composition is visible, but it is not a substitute for validating the rendered model.
- [x] The requested hero copy, intro, scroll control, stop count and Est. MMXVI footer are implemented and driven by scroll progress.
- [x] The single camera rig uses damped/eased movement, existing stop progress values, dwell, and an outside-to-inside FOV transition; visual smoothness could not be checked without WebGL.
- [x] The HUD has separate outside/inside variants, computed stop counts, chapter title, progress track and circular chapter buttons.
- [ ] The interior composition and lighting are implemented against the existing room dimensions but could not be rendered or visually checked in this WebGL-restricted browser.
- [x] Every current content panel shares the same DOM print styling, service numbering, footer and brass nameplate; the panels are not visually verified in 3D.
- [x] CSS grain and outside/inside vignettes are implemented; their appearance is not visually verified over the 3D scene.
- [x] Keyboard arrows, HUD buttons and Story/Work/Contact navigation target existing stops. Runtime interaction beyond the available no-WebGL preview could not be automated.
- [x] 390px-responsive layout rules and a mobile fallback are implemented and the 390px preview renders.
- [x] No package versions or dependencies were changed; production build and TypeScript checks pass with `NODE_ENV=production` for the build.
- [x] This changelog includes changed files, tuning points, assumptions, fallback use and known gaps.

## Files changed

- `AUDIT.md`
- `CHANGELOG.md`
- `app/experience.tsx`
- `app/globals.css`
- `app/house-scene.tsx`
- `app/hud.tsx`
- `app/layout.tsx`
- `src/lib/fh-tokens.ts`
- `src/lib/fh-textures.ts`

No package manifest or lockfile changes were made. Existing content, route, and seven-stop order were retained; the hero strings specified by the brief were added.

## Tuning points

- **Colors:** `src/lib/fh-tokens.ts` and the CSS custom properties in `app/globals.css`.
- **Exterior/interior light intensities:** `app/house-scene.tsx`, in `SceneContents` and `HouseDetails`.
- **Exposure:** `app/house-scene.tsx`, `Canvas` `onCreated` (`toneMappingExposure = 1.05`).
- **Grain:** `.fx-grain` opacity in `app/globals.css`.
- **Arrival framing:** `arrivalCamera()` in `app/house-scene.tsx` (azimuth, elevation, viewport fraction and minimum radius).
- **World scale:** `W` in `src/lib/fh-tokens.ts`; measured from the retained 10-unit front facade.

## Assumptions, fallbacks, and known gaps

- The existing shell is used because its facade opening, interior walls and camera path are coupled. Exterior detailing is layered onto it rather than replacing the geometry.
- No original panel images are present in the project; panel image areas use the brief’s gradient fallback.
- When WebGL is unavailable, the DOM fallback presents the exterior at the arrival and an editorial gallery print at interior stops; it exists to keep the preview usable, not to claim 3D parity.
- The live preview environment reports WebGL context creation errors. Consequently, roof/wall lighting calibration, panel readability at camera stops, full scroll-camera transitions, console behavior during actual WebGL rendering, and `/qa` stop screenshots remain unverified.
- `Playwright` and Chromium/Chrome binaries are unavailable; no new dependency was installed.
- The repository environment emits a nonstandard `NODE_ENV` for plain build commands; the production build succeeds with `NODE_ENV=production npm run build`.
- The requested local branch/phase commits were not created manually because this coding environment manages Git state and disallows manual branch/commit operations.
