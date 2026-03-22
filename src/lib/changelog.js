export const CHANGELOG = [
  {
    version: '1.4',
    date: 'March 2026',
    items: [
      'Fixed "Not signed in" error when adding transactions or bills on first app open',
      'Dialogs now close instantly after saving — no more 1–3 second freeze',
      'Transaction list, balance, and monthly summary update immediately after any change',
      'Bills now use an atomic database operation — no risk of mismatched data on payment',
      'Running balance calculation moved server-side — faster and scales with history',
      'Monthly and yearly summaries now computed on the server — significantly faster load',
      'Fixed duplicate network requests triggered after every local change',
      'Search in Transactions no longer triggers unnecessary database count queries',
      'Dashboard sections now update independently — changing one no longer redraws all',
      'Fixed month rollover on Dashboard not detecting until up to 60 seconds after midnight',
      'Reduced unnecessary re-renders across Dashboard, Monthly, Analytics, and Transactions',
    ],
  },
  {
    version: '1.3',
    date: 'March 2026',
    items: [
      'Profile menu now clickable in desktop sidebar',
      'Unified sticky page header across all screen sizes',
      'Removed duplicate page titles on Transactions and Bills',
      'Restored name and email in sidebar profile footer',
      'Fixed content spacing on Monthly and Analytics pages',
      'Fixed layout on report bug, about, and settings pages',
    ],
  },
  {
    version: '1.2',
    date: 'March 2026',
    items: [
      'Desktop sidebar with logo and navigation',
      'Sticky page header with title on mobile',
      'Bottom nav hidden on desktop, sidebar takes over',
      'Account Settings and About pages redesigned',
    ],
  },
  {
    version: '1.1',
    date: 'March 2026',
    items: [
      'Redesigned profile menu with grouped sections',
      'New Account Settings page for name and photo',
      'Redesigned About page with full-page layout',
      'What\'s New and Privacy cards in About',
      'Logo repositioned with text-left hero layout',
    ],
  },
  {
    version: '1.0',
    date: 'March 2026',
    items: [
      'Income, expense & investment tracking',
      'Bills & dues with recurring support',
      'Monthly breakdown with category budgets',
      'Year-over-year analytics',
      'Smart Entry — natural language input',
      'PWA — installable on iOS & Android',
    ],
  },
]
