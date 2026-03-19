export function parseTransactionSmart(input) {
  let amount = '';
  let desc = '';
  let category = 'other';
  let mode = 'upi';
  let type = 'expense';

  // Extract amount
  const amountMatch = input.match(/\d+(\.\d+)?/);
  if (amountMatch) {
    amount = amountMatch[0];
  }

  // Common keywords map to category IDs
  // E.g., looking at src/lib/categories.js IDs
  const catMap = {
    'food': 'food', 'lunch': 'food', 'dinner': 'food', 'breakfast': 'food', 'coffee': 'food', 'grocery': 'groceries', 'groceries': 'groceries',
    'uber': 'transport', 'cab': 'transport', 'taxi': 'transport', 'petrol': 'transport', 'fuel': 'transport', 'bus': 'transport', 'flight': 'transport', 'train': 'transport',
    'movie': 'entertainment', 'movies': 'entertainment', 'game': 'entertainment', 'netflix': 'entertainment', 'show': 'entertainment',
    'doctor': 'health', 'medicine': 'health', 'pill': 'health', 'pharmacy': 'health',
    'rent': 'housing', 'electricity': 'housing', 'utility': 'housing', 'wifi': 'housing',
    'clothes': 'shopping', 'shirt': 'shopping', 'shoes': 'shopping', 'amazon': 'shopping', 'flipkart': 'shopping'
  };

  const words = input.toLowerCase().split(/[ \.,]+/); // split by spaces or punctuation
  
  // Match category
  for (let w of words) {
    if (catMap[w]) {
      category = catMap[w];
      break;
    }
  }

  // Match payment mode
  const lowerInput = input.toLowerCase();
  if (lowerInput.includes('card') || lowerInput.includes('credit')) mode = 'credit_card';
  else if (lowerInput.includes('debit')) mode = 'debit_card';
  else if (lowerInput.includes('cash')) mode = 'cash';
  else if (lowerInput.includes('upi') || lowerInput.includes('gpay') || lowerInput.includes('paytm') || lowerInput.includes('phonepe')) mode = 'upi';
  else if (lowerInput.includes('net') || lowerInput.includes('bank')) mode = 'net_banking';

  // Description is everything else
  desc = input.replace(/\d+(\.\d+)?/, '').trim();
  const stopwords = ['for', 'on', 'in', 'at', 'with', 'using', 'paid', 'spent', 'rupees', 'rs', 'bucks'];
  let descWords = desc.split(' ').filter(w => !stopwords.includes(w.toLowerCase()) && !['cash', 'card', 'upi', 'gpay', 'paytm'].includes(w.toLowerCase()));
  desc = descWords.join(' ').trim();
  
  // Capitalize first letter of desc
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  return { amount, desc, category, mode, type };
}
