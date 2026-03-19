const fs = require('fs');

let monthly = fs.readFileSync('src/pages/Monthly.jsx', 'utf8');
monthly = monthly.replace('month={month}\n              year={year}\n              month={month}\n              year={year}', 'month={month}\n              year={year}');
fs.writeFileSync('src/pages/Monthly.jsx', monthly);

let analytics = fs.readFileSync('src/pages/Analytics.jsx', 'utf8');
analytics = analytics.replace("import { CATEGORIES }\nimport { fmt, fmtDate }", "import { CATEGORIES } from '../lib/categories'\nimport { fmt, fmtDate }");
fs.writeFileSync('src/pages/Analytics.jsx', analytics);
