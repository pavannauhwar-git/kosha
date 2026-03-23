const fs = require('fs');
let code = fs.readFileSync('src/pages/Monthly.jsx', 'utf8');

const target = `<CategorySpendingChart
              entries={catEntries}
              total={categoryTotal}
              budgets={budgets}`;

const replacement = `<CategorySpendingChart
              entries={catEntries}
              total={categoryTotal}
              budgets={budgets}
              month={month}
              year={year}`;

if(code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/pages/Monthly.jsx', code);
  console.log('Monthly patched.');
} else {
  console.log('Target not found in Monthly.jsx');
}
