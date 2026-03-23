const fs = require('fs');
let code = fs.readFileSync('src/pages/Analytics.jsx', 'utf8');

// Add CATEGORIES if not present
if (!code.includes('import { CATEGORIES }')) {
  code = code.replace("import { fmt, fmtDate }", "import { CATEGORIES }\nimport { fmt, fmtDate }");
}

let kpiSection = `          {/* ── 1. Annual KPIs ──────────────────────────────────────── */}`;

let takeawaySection = `
          {/* ── Yearly Insights Takeaways ────────────────────────────── */}
          {chartData.length > 0 && (
            <div className="card p-5 bg-brand-container border border-brand/10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkle size={18} className="text-brand" weight="fill" />
                <h3 className="text-[15px] font-bold text-ink">Yearly Insights</h3>
              </div>
              <p className="text-[14px] text-ink-2 leading-relaxed">
                {(() => {
                  let parts = [];
                  const saved = (data?.totalIncome || 0) - ((data?.totalExpense || 0) + (data?.totalInvestment || 0));
                  const inc = data?.totalIncome || 0;
                  const rate = inc > 0 ? Math.round(((inc - (data?.totalExpense || 0)) / inc) * 100) : 0;
                  
                  if (rate > 20) parts.push(\`You've had a strong year, saving \${rate}% of your earnings.\`);
                  else if (rate > 0) parts.push(\`You saved \${rate}% of your income.\`);
                  else parts.push(\`You spent more than you earned this year.\`);

                  if (data?.monthly) {
                     let maxExp = 0; let maxIdx = -1;
                     data.monthly.forEach((m, i) => { if (m.expense > maxExp) { maxExp = m.expense; maxIdx = i; } });
                     if (maxIdx >= 0 && maxExp > 0) parts.push(\`\${MONTH_SHORT[maxIdx]} was your highest spending month.\`);
                  }

                  if (catEntries && catEntries.length > 0) {
                     const c = CATEGORIES.find(c => c.id === catEntries[0][0]);
                     const pct = Math.round((catEntries[0][1] / Math.max(data?.totalExpense || 1, 1)) * 100);
                     parts.push(\`Your biggest expense was \${c ? c.label : catEntries[0][0]}, making up \${pct}% of all spending.\`);
                  }
                  return parts.join(' ');
                })()}
              </p>
            </div>
          )}
          
`;

if (!code.includes('Yearly Insights Takeaways') && code.includes(kpiSection)) {
  code = code.replace(kpiSection, takeawaySection + kpiSection);
  
  if (!code.includes('Sparkle')) {
    code = code.replace("import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'", "import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Sparkle } from 'lucide-react'");
  }
  
  fs.writeFileSync('src/pages/Analytics.jsx', code);
  console.log('Analytics patched with takeaways.');
} else {
  console.log('Analytics already patched or target not found.');
}
