const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

// Add Search component import
if (!code.includes('Search')) {
  code = code.replace("import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'", "import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus, Search } from 'lucide-react'");
}

// Add state for Hero Tab
if (!code.includes('const [heroMode, setHeroMode]')) {
  code = code.replace("const [duplicateTxn, setDuplicateTxn] = useState(null)", "const [duplicateTxn, setDuplicateTxn] = useState(null)\n  const [heroMode, setHeroMode] = useState('balance') // 'balance' | 'safe'");
}

// Search Pill in return section
const heroStart = code.indexOf("{/* ── Hero card ─────────────────────────────────────────────────── */}");

const searchPillCode = `
        {/* ── Search Pill ───────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={18} className="text-ink-4" />
          </div>
          <input 
            type="text" 
            placeholder="Search transactions..."
            onClick={() => navigate('/transactions')}
            className="w-full bg-surface-2 text-ink rounded-full py-3.5 pl-12 pr-4 shadow-sm border border-kosha-border focus:outline-none focus:ring-2 focus:ring-brand/50 transition-shadow"
          />
        </motion.div>

`;

if (!code.includes('Search Pill')) {
  code = code.substring(0, heroStart) + searchPillCode + code.substring(heroStart);
}

// Hero toggle logic
const heroAmountStart = code.indexOf('<p className="text-caption font-medium mb-1" style={{ color: C.heroLabel }}>\n            Total balance\n          </p>');
const heroAmountEndStr = '<p className="text-hero font-bold text-white leading-none tracking-tight tabular-nums">\n            {runningBalance !== null ? fmt(runningBalance) : \'—\'}\n          </p>';
const heroAmountEnd = code.indexOf(heroAmountEndStr) + heroAmountEndStr.length;

const newHeroAmount = `
          <div onClick={() => setHeroMode(m => m === 'balance' ? 'safe' : 'balance')} className="cursor-pointer active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-caption font-medium" style={{ color: C.heroLabel }}>
                {heroMode === 'balance' ? 'Total balance' : 'Safe to spend'}
              </p>
              <div className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-white/70 uppercase tracking-wider">Tap</div>
            </div>
            <p className="text-hero font-bold text-white leading-none tracking-tight tabular-nums">
              {heroMode === 'balance' 
                ? (runningBalance !== null ? fmt(runningBalance) : '—') 
                : (runningBalance !== null ? fmt(Math.max(0, runningBalance - bills.reduce((acc, b) => acc + b.amount, 0))) : '—')}
            </p>
          </div>
`;

if (!code.includes('setHeroMode(m =>') && heroAmountStart !== -1) {
  code = code.substring(0, heroAmountStart) + newHeroAmount.trim() + code.substring(heroAmountEnd);
}

// Insights Carousel
const quickActionStart = code.indexOf("{/* ── Quick-action strip");

const insightsCode = `
        {/* ── Insights Carousel ─────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="overflow-hidden -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory flex-nowrap" style={{ maskImage: 'linear-gradient(to right, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)' }}>
            <div className="snap-start shrink-0 w-64 p-4 rounded-3xl" style={{ background: C.brand + '15', border: \`1px solid \${C.brand}30\` }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: C.brand }}>
                <TrendingUp size={16} weight="bold" />
                <span className="text-xs font-bold uppercase tracking-wider">Pacing</span>
              </div>
              <p className="text-sm font-medium text-ink">You are saving <b style={{ color: C.brand }}>{rate}%</b> of your income this month. Great pace!</p>
            </div>
            {topCatInfo && (
              <div className="snap-start shrink-0 w-64 p-4 rounded-3xl" style={{ background: C.expense + '15', border: \`1px solid \${C.expense}30\` }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: C.expense }}>
                  <TrendingDown size={16} weight="bold" />
                  <span className="text-xs font-bold uppercase tracking-wider">Top Spend</span>
                </div>
                <p className="text-sm font-medium text-ink">Your largest expense is <b style={{ color: C.expense }}>{topCatInfo.label}</b> at {topCatPct}% of total spend.</p>
              </div>
            )}
            {dueSoon.length > 0 && (
              <div className="snap-start shrink-0 w-64 p-4 rounded-3xl" style={{ background: C.bills + '15', border: \`1px solid \${C.bills}30\` }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: C.bills }}>
                  <Bell size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Upcoming</span>
                </div>
                <p className="text-sm font-medium text-ink">You have <b>{dueSoon.length} bills</b> due within 7 days.</p>
              </div>
            )}
          </div>
        </motion.div>

        `;

if (!code.includes('Insights Carousel')) {
  code = code.substring(0, quickActionStart) + insightsCode + code.substring(quickActionStart);
}

fs.writeFileSync('src/pages/Dashboard.jsx', code);
console.log('Dashboard patched.');
