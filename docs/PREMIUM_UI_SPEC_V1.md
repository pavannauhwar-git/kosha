# Kosha Premium UI Spec v1

Date: 2026-04-03

## Goal

Create a visual and interaction system that sits between Apple-level restraint and Material Expressive clarity.

Target outcomes:
1. Surfaces feel elevated and calm.
2. Navigation feels intentional and alive.
3. Charts are semantically correct and visually harmonious.
4. Motion explains state changes without distraction.

## Product Aesthetic Blend

Use a 70/30 blend:
1. 70% Apple restraint: neutral surfaces, tight hierarchy, subtle typography rhythm.
2. 30% Material Expressive: stronger active states, intentional motion, tactile controls.

## System Rules

### Color Roles

Use role-based color assignment, never ad-hoc hue picking inside components.

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Primary | brand | #0A67D8 | Key actions, active states, focus moments |
| Primary Mid | brandMid | #2B84EC | Secondary brand accents, softer active fills |
| Primary Light | brandLight | #67AEF5 | Comparative chart series, low emphasis brand bars |
| Primary Container | brandContainer | #E7F2FF | Soft active container backgrounds |
| Surface Border | brandBorder | #B9D7FF | Structured separators, not mandatory around every card |
| Contrast Accent | contrast | #FFFF99 | Rare highlights and targeted callouts only |
| Income | chartIncome / income | #23C28A / #12966C | Positive financial movement |
| Expense | chartExpense / expense | #F26A86 / #DF3E62 | Deficit and spend risk |
| Investment | invest | #4D6BEE | Invest and portfolio-specific data |
| Warning | bills | #9A7200 | Caution, threshold proximity |
| Text Primary | ink | #10213F | Core labels and values |
| Text Secondary | inkMuted | #5D6D8F | Metadata, helper labels |

Hard constraints:
1. Do not use contrast yellow for deficit bars.
2. Do not use warning gold for primary comparison series.
3. Limit one chart to at most 3 core semantic hues plus neutral tones.

### Elevation and Surfaces

Card surfaces use depth first, border second.

| Layer | Intent | Shadow Treatment |
| --- | --- | --- |
| Surface | Base canvas and list backgrounds | no drop shadow |
| Raised | Standard cards | soft dual shadow + top highlight |
| Floating | Nav dock, menus, sheets | stronger vertical shadow + blur |

Rules:
1. Avoid bright blue outline borders on cards.
2. Use borders only for internal dividers or state-specific emphasis.
3. Keep one radius family: card 16, hero 24, pill full.

### Motion

Global timings:
1. Fast: 90ms for hover/pressed microstates.
2. Base: 140ms for content state transitions.
3. Emphasis: 220ms for nav active moves and large reveal transitions.

Curves:
1. Standard: ease-out for opacity and small transforms.
2. Expressive: spring only for nav active indicators and modal sheet transitions.

Rules:
1. Motion must indicate hierarchy or status change.
2. Avoid decorative idle animations on data-dense screens.

## Navigation Spec

### Desktop Sidebar

Intent:
1. Feels like a premium structural rail, not a flat utility strip.

Rules:
1. Use translucent neutral gradient surface.
2. Keep subtle right divider and soft lateral shadow.
3. Active item has container fill + left indicator + icon fill change.
4. Footer account module separated by low-contrast divider.

### Mobile Bottom Nav

Intent:
1. Floating dock with clear active state transfer.

Rules:
1. Dock uses elevated shadow and soft border.
2. Active pill animates with spring layout transfer.
3. Active icon and label increase salience via fill + opacity + weight.
4. Hidden-on-scroll behavior must remain smooth and non-jarring.

## Chart Design Spec

### Semantic Mapping

1. Surplus and income: brand or income green.
2. Deficit and spend risk: expense pink/red.
3. Investment: indigo.
4. Historical comparison: primary light or neutral blue tint.
5. Stress scenarios: expense bright or warning, not contrast yellow.

### Composition Rules

1. Default tooltip background should be neutral and consistent.
2. Axis labels stay muted neutral, never bright semantic colors.
3. Legends use the exact data series color tokens.
4. Keep stacked area opacities between 0.35 and 0.55 for readability.

## Execution Plan

### Phase 1: Surface Foundation
Status: In progress

1. Standardize card surface to floating, borderless premium look.
2. Align shared shadow tokens so utility usage matches card system.

### Phase 2: Navigation Premium Pass
Status: In progress

1. Upgrade desktop sidebar visual hierarchy and active indicator.
2. Upgrade bottom dock depth, border treatment, and active pill contrast.

### Phase 3: Chart Color Harmonization
Status: In progress

1. Replace contrast yellow usage in deficit and stress charts.
2. Unify YoY and comparison bars to brand tonal system.

### Phase 4: Motion and Microstates
Status: Planned

1. Normalize motion timings and easing across nav, cards, and sheets.
2. Add clear pressed and focus-visible states to all interactive controls.

### Phase 5: QA and Tuning
Status: Planned

1. Compare visual rhythm on desktop and mobile.
2. Validate chart readability and semantic correctness on all analytics cards.
3. Run contrast spot checks for labels, legends, and active states.

## Definition of Done

The premium pass is complete when:
1. All page-level cards share a single surface language.
2. Sidebar and bottom nav feel cohesive as one navigation system.
3. No chart uses semantically incorrect colors for positive versus negative signals.
4. Motion feels consistent and state-oriented across the app.