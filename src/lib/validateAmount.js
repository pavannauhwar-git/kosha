import { fromRupees } from './paise.js';

export function validateAmount(input, options = {}) {
  const { min = -Infinity, max = Infinity, allowZero = true } = options;

  if (input === null || input === undefined) {
    return { ok: false, error: 'Amount is required' };
  }

  const str = String(input).trim();
  
  if (str === '') {
    return { ok: false, error: 'Amount is required' };
  }

  if (str.toLowerCase().includes('e') || str.startsWith('+')) {
    return { ok: false, error: 'Invalid amount format' };
  }

  const parts = str.split('.');
  if (parts.length > 2) {
    return { ok: false, error: 'Invalid amount format' };
  }
  if (parts.length === 2 && parts[1].length > 2) {
    return { ok: false, error: 'Maximum 2 decimal places allowed' };
  }

  const num = Number(str);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { ok: false, error: 'Invalid number' };
  }

  if (!allowZero && num === 0) {
    return { ok: false, error: 'Amount cannot be zero' };
  }

  if (num < min) {
    return { ok: false, error: `Amount cannot be less than ${min}` };
  }

  if (num > max) {
    return { ok: false, error: `Amount cannot be greater than ${max}` };
  }

  return { ok: true, paise: fromRupees(num) };
}
