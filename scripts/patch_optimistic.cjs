const fs = require('fs');

let code = fs.readFileSync('src/hooks/useTransactions.js', 'utf8');

const targetFunction = `export function applyOptimisticUpdate(id, payload) {
  queryClient.setQueriesData({ queryKey: ['transactions'] }, (old) => {
    if (!Array.isArray(old)) return old
    if (payload === null) {
      return old.filter(t => t.id !== id)
    }
    const exists = old.some(t => t.id === id)
    if (exists) {
      return old.map(t => t.id === id ? { ...t, ...payload } : t).sort((a,b) => new Date(b.date) - new Date(a.date))
    }
    return [{ id, ...payload }, ...old].sort((a,b) => new Date(b.date) - new Date(a.date))
  })
}`;

const newFunction = `export function applyOptimisticUpdate(id, payload) {
  // 1. Attempt to resolve original transaction (for edits or deletes)
  let originalTxn = payload?._original;
  if (!originalTxn) {
    const txnsCaches = queryClient.getQueriesData({ queryKey: ['transactions'] });
    for (const [key, data] of txnsCaches) {
      if (Array.isArray(data)) {
        const found = data.find(t => t.id === id);
        if (found) { originalTxn = found; break; }
      }
    }
  }

  // 2. Patch transaction lists
  queryClient.setQueriesData({ queryKey: ['transactions'] }, (old) => {
    if (!Array.isArray(old)) return old;
    if (payload === null) {
      return old.filter(t => t.id !== id);
    }
    const exists = old.some(t => t.id === id);
    if (exists) {
      return old.map(t => t.id === id ? { ...t, ...payload } : t).sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return [{ id, ...payload }, ...old].sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  // 3. Patch global balance precisely and instantly
  let balanceDiff = 0;
  if (payload === null && originalTxn) {
    balanceDiff = originalTxn.type === 'income' ? -Number(originalTxn.amount) : Number(originalTxn.amount);
  } else if (payload && originalTxn) {
    const oldAmt = originalTxn.type === 'income' ? Number(originalTxn.amount) : -Number(originalTxn.amount);
    const newAmt = payload.type === 'income' ? Number(payload.amount) : -Number(payload.amount);
    balanceDiff = newAmt - oldAmt;
  } else if (payload) {
    balanceDiff = payload.type === 'income' ? Number(payload.amount) : -Number(payload.amount);
  }

  if (balanceDiff !== 0) {
    queryClient.setQueriesData({ queryKey: ['balance'] }, (old) => {
      if (typeof old === 'number') return old + balanceDiff;
      return old;
    });
  }

  // 4. Patch monthly summary exactly
  if (payload || originalTxn) {
    const activeDate = new Date((payload || originalTxn).date);
    const mYear = activeDate.getFullYear();
    const mMonth = activeDate.getMonth() + 1;
    
    queryClient.setQueriesData({ queryKey: ['month', mYear, mMonth] }, (old) => {
      if (!old || typeof old !== 'object') return old;
      let next = { ...old, byCategory: { ...old.byCategory }, byVehicle: { ...old.byVehicle } };

      // Revert old values
      if (originalTxn) {
        if (originalTxn.type === 'income' && !originalTxn.is_repayment) next.earned -= Number(originalTxn.amount);
        if (originalTxn.type === 'income' && originalTxn.is_repayment) next.repayments -= Number(originalTxn.amount);
        if (originalTxn.type === 'expense') { 
          next.expense -= Number(originalTxn.amount);
          if (originalTxn.category) next.byCategory[originalTxn.category] = Math.max(0, (next.byCategory[originalTxn.category] || 0) - Number(originalTxn.amount));
        }
        if (originalTxn.type === 'investment') { 
          next.investment -= Number(originalTxn.amount);
          const v = originalTxn.investment_vehicle || 'Other';
          next.byVehicle[v] = Math.max(0, (next.byVehicle[v] || 0) - Number(originalTxn.amount));
        }
      }

      // Apply new values
      if (payload) {
        if (payload.type === 'income' && !payload.is_repayment) next.earned += Number(payload.amount);
        if (payload.type === 'income' && payload.is_repayment) next.repayments += Number(payload.amount);
        if (payload.type === 'expense') {
          next.expense += Number(payload.amount);
          if (payload.category) next.byCategory[payload.category] = (next.byCategory[payload.category] || 0) + Number(payload.amount);
        }
        if (payload.type === 'investment') {
          next.investment += Number(payload.amount);
          const v = payload.investment_vehicle || 'Other';
          next.byVehicle[v] = (next.byVehicle[v] || 0) + Number(payload.amount);
        }
      }

      next.balance = next.earned + next.repayments - next.expense - next.investment;
      return next;
    });
  }
}`;

let newCode = code.replace(targetFunction, newFunction);
fs.writeFileSync('src/hooks/useTransactions.js', newCode);
console.log('Patched properly.');
