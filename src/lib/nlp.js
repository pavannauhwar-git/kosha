const INCOME_CATEGORIES = new Set([
  'salary', 'bonus', 'dividend', 'interest', 'freelance',
  'business_profit', 'share_market', 'refund',
])

export function parseTransactionSmart(input) {
  let amount = '';
  let desc = '';
  let category = 'other';
  let mode = 'upi';
  let type = 'expense';

  // Extract amount - prefer the LAST number (most natural: "bought 2 coffees 400")
  const amountMatches = [...input.matchAll(/\d+(\.\d+)?/g)];
  if (amountMatches.length > 0) {
    amount = amountMatches[amountMatches.length - 1][0];
  }

  const catMap = {
    'food': 'food', 'lunch': 'food', 'dinner': 'food', 'breakfast': 'food', 'coffee': 'food', 'grocery': 'groceries', 'groceries': 'groceries',
    'uber': 'vehicle', 'cab': 'vehicle', 'taxi': 'vehicle', 'petrol': 'fuel', 'fuel': 'fuel', 'bus': 'travel', 'flight': 'travel', 'train': 'travel',
    'movie': 'entertainment', 'movies': 'entertainment', 'game': 'entertainment', 'netflix': 'entertainment', 'show': 'entertainment',
    'doctor': 'medical', 'medicine': 'medical', 'pill': 'medical', 'pharmacy': 'medical',
    'rent': 'rent', 'electricity': 'utilities', 'utility': 'utilities', 'wifi': 'internet',
    'clothes': 'shopping', 'shirt': 'shopping', 'shoes': 'shopping', 'amazon': 'shopping', 'flipkart': 'shopping',
    'salary': 'salary', 'bonus': 'bonus', 'dividend': 'dividend', 'interest': 'interest', 'freelance': 'freelance',
    'profit': 'business_profit', 'business': 'business_profit', 'share': 'share_market', 'trading': 'share_market', 'refund': 'refund',
    'got': 'salary', 'received': 'salary', 'credited': 'salary',
  };

  const words = input.toLowerCase().split(/[\s.,]+/);

  for (let w of words) {
    if (catMap[w]) {
      category = catMap[w];
      break;
    }
  }

  if (INCOME_CATEGORIES.has(category)) {
    type = 'income';
  }

  const lowerInput = input.toLowerCase();
  if (lowerInput.includes('card') || lowerInput.includes('credit')) mode = 'credit_card';
  else if (lowerInput.includes('debit')) mode = 'debit_card';
  else if (lowerInput.includes('cash')) mode = 'cash';
  else if (lowerInput.includes('upi') || lowerInput.includes('gpay') || lowerInput.includes('paytm') || lowerInput.includes('phonepe')) mode = 'upi';
  else if (lowerInput.includes('net') || lowerInput.includes('bank')) mode = 'net_banking';

  desc = input.replace(/\d+(\.\d+)?/g, '').trim();
  const stopwords = ['for', 'on', 'in', 'at', 'with', 'using', 'paid', 'spent', 'rupees', 'rs', 'bucks', 'got', 'received', 'credited'];
  let descWords = desc.split(' ').filter(w => !stopwords.includes(w.toLowerCase()) && !['cash', 'card', 'upi', 'gpay', 'paytm'].includes(w.toLowerCase()));
  desc = descWords.join(' ').trim();

  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  return { amount, desc, category, mode, type };
}
