const fs = require('fs');
let code = fs.readFileSync('src/components/CategorySpendingChart.jsx', 'utf8');

// Update SVG Arc bar to add pacing indicator
const originalSvg = `function SvgArcBar({ pct, color, overBudget = false }) {
  const W = 100
  const H = 8
  const R = H / 2
  const max = W - R * 2
  const fill = Math.max(0, Math.min(pct, 100)) / 100 * max
  const barColor = overBudget ? C.expense : color
  return (
    <svg width="100%" height={H} viewBox={\`0 0 \${W} \${H}\`} preserveAspectRatio="none">
      <line x1={R} y1={R} x2={W - R} y2={R}
        stroke={C.brandBorder} strokeWidth={H} strokeLinecap="round" />
      {fill > 0 && (
        <line x1={R} y1={R} x2={R + fill} y2={R}
          stroke={barColor} strokeWidth={H} strokeLinecap="round" />
      )}
    </svg>
  )
}`;

const newSvg = `function SvgArcBar({ pct, color, overBudget = false, pacePct = null }) {
  const W = 100
  const H = 8
  const R = H / 2
  const max = W - R * 2
  const fill = Math.max(0, Math.min(pct, 100)) / 100 * max
  const barColor = overBudget ? C.expense : color
  
  // Pace indicator position
  let paceMarker = null;
  if (pacePct !== null) {
     const pacePos = Math.max(0, Math.min(pacePct, 100)) / 100 * max;
     paceMarker = <line x1={R + pacePos} y1={0} x2={R + pacePos} y2={H} stroke={C.ink} strokeWidth={2.5} strokeLinecap="round" />
  }

  return (
    <svg width="100%" height={H} viewBox={\`0 0 \${W} \${H}\`} preserveAspectRatio="none" style={{overflow: 'visible'}}>
      <line x1={R} y1={R} x2={W - R} y2={R}
        stroke={C.brandBorder} strokeWidth={H} strokeLinecap="round" />
      {fill > 0 && (
        <line x1={R} y1={R} x2={R + fill} y2={R}
          stroke={barColor} strokeWidth={H} strokeLinecap="round" />
      )}
      {paceMarker}
    </svg>
  )
}`;

code = code.replace(originalSvg, newSvg);

// Update props
const propsMatch = `export default function CategorySpendingChart({
  entries,
  total,
  budgets = {},
  title = 'Spent by Category',
  subtitle,
  onCategoryClick,
}) {`;

const newProps = `export default function CategorySpendingChart({
  entries,
  total,
  budgets = {},
  title = 'Spent by Category',
  subtitle,
  onCategoryClick,
  month,
  year,
}) {

  const now = new Date()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  const daysInMonth = isCurrentMonth ? new Date(year, month, 0).getDate() : 30
  const pacePct = isCurrentMonth ? Math.round((now.getDate() / daysInMonth) * 100) : null
`;

code = code.replace(propsMatch, newProps);

// Apply pacePct
const barRenderMatch = `<SvgArcBar pct={barPct} color={cat?.chart || C.brand} overBudget={overBudget} />`;
const newBarRender = `<SvgArcBar pct={barPct} color={cat?.chart || C.brand} overBudget={overBudget} pacePct={hasBudget ? pacePct : null} />`;
code = code.replace(barRenderMatch, newBarRender);

// Wait, maybe something simple below the bar
const tagMatch = `</div>
            </RowTag>`;

const newTagMatch = `  {hasBudget && pacePct !== null && (barPct > pacePct) && !overBudget && (
                  <p className="text-[10px] text-warning-text mt-1 font-medium text-right tracking-tight">Tracking {barPct - pacePct}% ahead of pace</p>
                )}
              </div>
            </RowTag>`;

code = code.replace(tagMatch, newTagMatch);

fs.writeFileSync('src/components/CategorySpendingChart.jsx', code);
console.log('Category chart patched');
