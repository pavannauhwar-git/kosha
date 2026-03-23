const fs = require('fs');
let code = fs.readFileSync('src/components/AddTransactionSheet.jsx', 'utf8');

if (!code.includes('import { parseTransactionSmart }')) {
  code = code.replace("import { CATEGORIES } from '../lib/categories'", "import { CATEGORIES } from '../lib/categories'\nimport { parseTransactionSmart } from '../lib/nlp'\nimport { Sparkle } from '@phosphor-icons/react'");
}

if (!code.includes('const [smartMode, setSmartMode]')) {
  code = code.replace("const [error, setError] = useState('')", "const [error, setError] = useState('')\n  const [smartMode, setSmartMode] = useState(false)\n  const [smartText, setSmartText] = useState('')");
}

let handleSmartTextChange = `
  const handleSmartTextChange = (val) => {
    setSmartText(val)
    const { amount: a, desc: d, category: c, mode: m, type: t } = parseTransactionSmart(val)
    if (a) setAmount(a)
    if (d) setDesc(d)
    if (c) setCategory(c)
    if (m) setMode(m)
    // could set t but maybe not override type if they already picked it
  }
`;

if (!code.includes('handleSmartTextChange')) {
  code = code.replace("const initSource = editTxn?.id", handleSmartTextChange + "\n  const initSource = editTxn?.id");
}

// Add Smart Mode Toggle in Header
const headerSearch = `<div className="flex items-center justify-between mb-5">
                <h2 className="text-[20px] font-bold text-ink">
                  {editTxn ? 'Edit Transaction' : 'Add Transaction'}
                </h2>
                <button onClick={onClose} className="close-btn">
                  <X size={16} className="text-ink-3" />
                </button>
              </div>`;

const newHeader = `<div className="flex items-center justify-between mb-5">
                <h2 className="text-[20px] font-bold text-ink">
                  {editTxn ? 'Edit Transaction' : 'Add Transaction'}
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSmartMode(!smartMode)} className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors \${smartMode ? 'bg-brand text-white shadow-sm' : 'bg-surface text-ink-3'}\`}>
                    <Sparkle size={14} weight={smartMode ? 'fill' : 'regular'} />
                    Smart Entry
                  </button>
                  <button onClick={onClose} className="close-btn">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>
              </div>`;

code = code.replace(headerSearch, newHeader);

// Smart Input UI
const typeSelectorSearch = `{/* Type selector */}`;

const smartInputUI = `
              {/* Smart Input Mode */}
              <AnimatePresence>
                {smartMode && (
                  <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: 16 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="overflow-hidden">
                    <textarea 
                      placeholder="e.g. Paid 400 for lunch using UPI..."
                      value={smartText}
                      onChange={e => handleSmartTextChange(e.target.value)}
                      className="w-full bg-brand/5 border border-brand/20 text-brand font-medium rounded-2xl p-4 min-h-[100px] outline-none focus:ring-2 ring-brand/50 resize-none shadow-inner"
                    />
                    <p className="text-[11px] text-ink-4 mt-2 px-2 flex items-center gap-1"><Sparkle size={12} /> Auto-fills amount, description, category, and mode.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Type selector */}`;

if (!code.includes('Smart Input Mode')) {
  code = code.replace(typeSelectorSearch, smartInputUI);
}

fs.writeFileSync('src/components/AddTransactionSheet.jsx', code);
console.log('NLP added to sheet.');
