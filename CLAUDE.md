@AGENTS.md

# Frontend design rule

Whenever designing, building, reviewing or changing any frontend/UI (pages, components, layout, color, typography, motion), first invoke the `ui-ux-pro-max` skill and follow it. Its search script is run from the project root:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system
```

Use `--domain <ux|style|typography|color|chart|icons>` or `--stack <stack>` for targeted lookups. Skip it only for non-visual work (backend, API, data).

# Animation

Use `framer-motion` (already installed) for UI animation and transitions in frontend work. Respect reduced motion (`useReducedMotion` / `MotionConfig reducedMotion="user"`) and animate transform/opacity only, per the `ui-ux-pro-max` guidance.

# Design skills and tools (use in all Scene044 design work)

- `ui-ux-pro-max`: always first for any UI work (see Frontend design rule above).
- `framer-motion`: default for UI animation (see Animation above).
- `web3d-integration-patterns`: invoke for any 3D, WebGL, scroll-driven or multi-library animation work (Three.js, React Three Fiber, GSAP ScrollTrigger, Motion, React Spring).
- 21st.dev MCP (`21st`): when building a UI component, check it for a suitable existing component before writing one from scratch. Never print or commit its API key.
- `packaging-design-generation`: invoke for packaging, labels, boxes, bags and merch mockups. It calls the each::sense API and needs `EACHLABS_API_KEY` in the environment; ask the user eco vs max mode before generating.
- `brand-guidelines`: this is Anthropic's brand palette and fonts, not Scene044's. Use it only when the user explicitly asks for Anthropic-style output; otherwise follow Scene044's own brand and the design system in this repo.
