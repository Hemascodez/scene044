@AGENTS.md

# Frontend design rule

Whenever designing, building, reviewing or changing any frontend/UI (pages, components, layout, color, typography, motion), first invoke the `ui-ux-pro-max` skill and follow it. Its search script is run from the project root:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system
```

Use `--domain <ux|style|typography|color|chart|icons>` or `--stack <stack>` for targeted lookups. Skip it only for non-visual work (backend, API, data).

# Animation

Use `framer-motion` (already installed) for UI animation and transitions in frontend work. Respect reduced motion (`useReducedMotion` / `MotionConfig reducedMotion="user"`) and animate transform/opacity only, per the `ui-ux-pro-max` guidance.
