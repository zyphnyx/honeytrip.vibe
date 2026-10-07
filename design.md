# Design — HoneyTrip 🍯

Locked design system for HoneyTrip (Anti-AI-slop / Hallmark redesign).
Every page and component reads and adheres to this system.

## Genre
**playful** (warm-tactile / post-Linear friendly school)
- Designed for close-knit groups planning trips together.
- Tactile surfaces, warm honey-amber palette, crisp borders, purposeful microinteractions.
- Never childish, no gratuitous bounce, no emoji-as-iconography substitution.

## Macrostructure Family
- **App & Room Hub**: Workbench / Interactive Hub (`05-workbench`) — structured panels, interactive heatmap calendar, live participant chips, and contextual drawer/tab for editing.
- **Landing & Create**: Dialogue Card — clean single-task elevation with recent room recall.

## Tokens & Palette (OKLCH)
```css
:root {
  /* Paper / Surfaces */
  --color-paper:        oklch(98.8% 0.012 85);   /* Warm honeycomb cream background */
  --color-paper-2:      oklch(99.6% 0.006 85);   /* Crisp white card surface */
  --color-paper-3:      oklch(95.5% 0.018 85);   /* Slightly recessed input/chip background */
  --color-paper-hover:  oklch(94.0% 0.024 85);   /* Active / hover surface */

  /* Ink / Text */
  --color-ink:          oklch(22.0% 0.025 50);   /* Warm espresso text, high contrast */
  --color-ink-2:        oklch(46.0% 0.025 50);   /* Secondary slate-warm text (passes 4.5:1) */
  --color-ink-3:        oklch(62.0% 0.020 50);   /* Subtle helper text / meta */

  /* Borders & Rules */
  --color-rule:         oklch(88.5% 0.025 80);   /* Crisp warm hairline border */
  --color-rule-strong:  oklch(76.0% 0.045 75);   /* Focus/active borders */

  /* Accent (Honey Amber) */
  --color-accent:       oklch(78.0% 0.155 75);   /* Rich warm golden amber */
  --color-accent-hover: oklch(72.0% 0.165 75);   /* Hover amber */
  --color-accent-ink:   oklch(20.0% 0.030 50);   /* Dark readable text on accent */
  --color-focus:        oklch(65.0% 0.170 75);   /* Focus ring */

  /* Semantic Tints */
  --color-success:      oklch(62.0% 0.140 145);  /* Natural moss green */
  --color-success-bg:   oklch(95.0% 0.040 145);  /* Light green tint */
  --color-warn:         oklch(75.0% 0.140 65);   /* Warm orange */
  --color-warn-bg:      oklch(95.0% 0.040 65);
  --color-danger:       oklch(58.0% 0.190 25);   /* Crimson */
  --color-danger-bg:    oklch(95.0% 0.040 25);

  /* Spacing Scale (4-point system) */
  --space-3xs: 0.25rem;  /* 4px */
  --space-2xs: 0.5rem;   /* 8px */
  --space-xs:  0.75rem;  /* 12px */
  --space-sm:  1.0rem;   /* 16px */
  --space-md:  1.5rem;   /* 24px */
  --space-lg:  2.0rem;   /* 32px */
  --space-xl:  3.0rem;   /* 48px */

  /* Typography */
  --font-display: var(--font-noto-thai), system-ui, sans-serif;
  --font-body:    var(--font-noto-thai), system-ui, sans-serif;

  /* Geometry & Radii */
  --radius-card:  16px;
  --radius-btn:   12px;
  --radius-input: 12px;
  --radius-chip:  9999px;

  /* Motion */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 180ms;
}
```

## Typography
- Display: Noto Sans Thai / System font, Weight 700 / 600, Roman (never italic headers).
- Body: Noto Sans Thai, Weight 400 / 500, lineHeight 1.55.
- Number/Stats: tabular figures (`font-variant-numeric: tabular-nums`).

## Microinteractions & UX Discipline
1. **Tooltips & Hover Hints (Mandatory UX upgrade)**:
   - Calendar heatmap cells show date, count, and names of people free on hover/tap.
   - Member avatars reveal their budget, duration, carpool status, and note.
   - Duration bars reveal who prefers each duration.
   - Carpool indicator breaks down drivers, seats, and passengers.
   - Action buttons explain their purpose (e.g. sharing room link privacy).
   - Tooltips are accessible (`role="tooltip"`), support keyboard focus, and dismiss on Escape.
2. **Tactile Feedback**:
   - Buttons scale to `0.98` on `:active` with smooth `120ms` recovery.
   - Cards have subtle 1px border with gentle depth (`0 4px 16px -4px oklch(22% 0.025 50 / 0.05)`).
   - Instant focus-visible rings with 2px offset.
3. **Silent Success**:
   - Copying the link or LINE summary transforms the button label into "✓ คัดลอกเรียบร้อย" in-place for 2 seconds without annoying popup toasts.

## CTA Voice
- Primary: Warm amber pill/rounded button with tactile press state.
- Secondary: Warm white card with hairline rule and hover background tint.
