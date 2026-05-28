export function dayKey(dateInput) {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateDistanceDays(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return NaN;
  
  da.setHours(12, 0, 0, 0);
  db.setHours(12, 0, 0, 0);
  
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

export function groupByDate(transactions) {
  const groups = {};
  const rows = Array.isArray(transactions) ? transactions : [];
  for (const t of rows) {
    if (!t || typeof t !== 'object') continue;
    const val = t.date || t.created_at;
    if (!val) continue;
    
    // For ISO strings that are already YYYY-MM-DD, prefer to just use the prefix directly if possible
    // Wait, let's use dayKey. However, if it's "2024-05-12T10:00:00Z", dayKey(val) will parse it to local time
    // and extract local YYYY-MM-DD. Which is usually what we want for local display.
    const key = typeof val === 'string' && val.length >= 10 && val.indexOf('T') === -1
      ? val.slice(0, 10) 
      : dayKey(val);
      
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.entries(groups).sort(([a],[b]) => b.localeCompare(a));
}
