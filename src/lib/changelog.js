export const CHANGELOG = [
  {
    version: '1.3.3',
    date: 'May 2026',
    items: [
      'Overhauled the Obligations hub with a descriptive onboarding experience and refined navigation card layout',
      'Enhanced dark mode elevation with improved surface contrast and subtle card borders for better visual separation',
      'Standardized the profile avatar system across the app with refined borders and shadows for a premium, cohesive look',
      'Integrated useUserCategories across Transaction filters, Budgeting, and Category Pickers for instant reactivity',
      'Improved Dashboard stability and resolved specificity conflicts between custom card styles and Tailwind utilities',
    ],
  },
  {
    version: '1.3.2',
    date: 'April 2026',
    items: [
      'Generalized financial linking architecture to atomically connect transactions with Bills and Loans',
      'Implemented UI safeguards to block manual editing/deleting of system-linked records, ensuring ledger integrity',
      'Upgraded Bills navigation to auto-switch tabs when focusing on settled entries from the transaction list',
      'Added contextual "Go to Source" navigation in the unified Linked Transaction Info Sheet for Splitwise, Bills, and Loans',
      'Resolved focus-highlight visual flicker by hardening CSS animation background states across card surfaces',
    ],
  },
  {
    version: '1.3.1',
    date: 'April 2026',
    items: [
      'Overhauled the illustration system with perfectly matched stick-figure assets for empty states and hero headers',
      'Standardized page header layouts across Settings, About, Guide, Login, and Report Bug for premium visual consistency',
      'Rebalanced the Settings profile card and list rows for a denser, more compact typography and layout',
      'Separated active and archived trip counts in Splitwise admin and member dashboards',
      'Unified list-level "Add" actions to a secondary visual weight across Dashboard, Loans, and Bills',
    ],
  },
  {
    version: '1.3.0',
    date: 'April 2026',
    items: [
      'Implemented end-to-end Linked Wallets sharing, enabling multi-user visibility for transactions, bills, and loans via unified identity management',
      'Upgraded core server-side functions (Balance, Month/Year Summaries) to automatically aggregate financial data across all linked partner accounts',
      'Integrated linked-user discovery into the global authentication lifecycle, ensuring instant data synchronization and cache awareness upon login',
      'Rebuilt the Settings UX with distinct sections for Active Sync partners, Invite Token management, and a dedicated Social App Sharing area',
      'Hardened automated join-flow test suites with improved record-cleanup logic and explicit verification for multi-user data-access paths',
    ],
  },
]