const fs = require('fs');

// Patch useTransactions.js
let file = 'src/hooks/useTransactions.js';
let content = fs.readFileSync(file, 'utf8');

const optStart = content.indexOf('export function applyOptimisticUpdate');
if (optStart !== -1) {
  content = content.substring(0, optStart);
  fs.writeFileSync(file, content);
}

// Patch useLiabilities.js
let lFile = 'src/hooks/useLiabilities.js';
let lContent = fs.readFileSync(lFile, 'utf8');
lContent = lContent.replace(/import \{ invalidateCache as invalidateTxnCache, applyOptimisticUpdate \} from '\.\/useTransactions'/, "import { invalidateCache as invalidateTxnCache } from './useTransactions'");
fs.writeFileSync(lFile, lContent);

console.log('done.');
