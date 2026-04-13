export const CHANGELOG = [
  {
    version: '1.2.4',
    date: 'April 2026',
    items: [
      'Added in-app change password controls in Settings with confirm-password validation and clear success/error feedback',
      'Added swipe-to-manage custom categories in Add Transaction pickers with direct Edit and Delete actions',
      'Added a one-time swipe hint in category and investment pickers to improve discoverability of manage actions',
      'Improved custom category responsiveness by synchronizing local category registry updates immediately after create/edit/archive flows',
      'Polished swipe action sizing so Edit/Delete and Repeat/Delete remain flush with the swiped row without trailing visual gaps',
    ],
  },
  {
    version: '1.2.3',
    date: 'April 2026',
    items: [
      'Added a user-friendly in-app PWA update prompt with Update and Not now actions, plus periodic service-worker refresh checks',
      'Fixed custom category creation for investment type by aligning user_categories type constraints and improving schema mismatch error messaging',
      'Prevented accidental right-edge deletes by requiring a real swipe-open state before Repeat/Delete actions are tappable in Transactions and Dashboard recent rows',
      'Improved Transactions signal reliability by computing insight cards from full matching-scope aggregates when timeline rows are only partially loaded',
      'Enhanced Transactions filtering quality with deterministic URL filter sync (including payment mode) and broader search across description, notes, and category labels',
    ],
  },
  {
    version: '1.2.2',
    date: 'April 2026',
    items: [
      'Redesigned bottom navigation into a fixed Pixel-style bar with improved tap rhythm and calmer surface motion',
      'Refined page headers to match nav design language, including full-bleed top surface and balanced title spacing',
      'Replaced native date inputs with a shared Pixel-style calendar picker across Transactions, Bills, and Loans',
      'Added direct period-jump controls for Monthly and Analytics, including quick recent-month and recent-year chips',
      'Resolved Radix dialog accessibility warnings by adding required dialog descriptions in shared sheet surfaces',
    ],
  },
  {
    version: '1.2.1',
    date: 'April 2026',
    items: [
      'Finalized app icon mark by moving the accent dot closer to the slash while preserving the latest size and vertical alignment',
      'Regenerated production icon assets at 180/192/512 to keep launcher and install surfaces consistent',
      'Added favicon.ico generation to the icon pipeline so browser tab favicon stays in sync with the app icon',
      'Added dark mode support across core app surfaces for comfortable low-light usage',
      'Improved app-wide button consistency by consolidating actions onto shared button variants and sizes',
    ],
  },
  {
    version: '1.2.0',
    date: 'April 2026',
    items: [
      'Added full Loans tracking with given/taken tabs, settlement progress, and record-payment sheet',
      'Redesigned Reconciliation page into a 3-tab layout (Queue, Matching, Overview) with compact summary strip',
      'Refreshed Guide page with Loans feature card, updated start checklist, and playbook cadence',
      'Fixed AuthGuard infinite re-render and added null-guard on token refresh handler',
      'Standardized sheet submit buttons to solid bg-brand and added form field name attributes for accessibility',
    ],
  },
  {
    version: '1.1.11',
    date: 'March 2026',
    items: [
      'Temporarily removed budget module from active app surfaces for a full redesign and improved data contract',
      'Simplified YoY analytics card by removing anomaly and confidence-band controls',
      'Refocused Dashboard daily variance into a single absolute heatmap with per-day hover spend details',
      'Redesigned Dashboard weekly digest with comparison charts and clearer top-category distribution visuals',
      'Standardized spent-by-category visualization to treemap-first with explicit numeric values',
    ],
  },
  {
    version: '1.1.10',
    date: 'March 2026',
    items: [
      'Shipped shared-wallet invite management in Settings with one-tap link creation/copy and live join status',
      'Added deep analytics narratives: weekly change digest in Analytics and month-close summary in Monthly',
      'Added confidence drift detection to flag when 7-day matching quality drops >15% below baseline',
      'Added self-healing alias auto-demotion for merchant aliases appearing in 2+ rejected matches within 30 days',
      'Added alias quality dashboard showing top-performing merchants and auto-demoted merchants with health status',
    ],
  },
  {
    version: '1.1.9',
    date: 'March 2026',
    items: [
      'Improved parsing error guidance with collapsible formatting tips for failed statement lines',
      'Reduced dashboard latest transaction section to a compact snapshot (top 3) to cut cognitive load',
      'Added contextual dismissible guide hints on Transactions and Bills for in-flow feature education',
      'Added local reminder infrastructure with settings controls and notification permission flow',
      'Improved statement matching confidence with merchant-noise cleanup and stronger tie-break scoring',
    ],
  },
  {
    version: '1.1.8',
    date: 'March 2026',
    items: [
      'Added recent matching decisions panel to inspect the latest linked statement-to-transaction outcomes',
      'Added reconciliation confidence trend cards in Analytics based on linked vs mismatch-reported outcomes',
      'Persisted reconciliation reviewed/linked state to Supabase with secure per-user access policies',
      'Added Monthly entry card surfacing pending reconciliation count with deep-link into the review workspace',
      'Added optional dev-only query timing traces via localStorage flag kosha:trace-queries=1',
    ],
  },
  {
    version: '1.1.7',
    date: 'March 2026',
    items: [
      'Added immutable financial audit-event logging for transaction and bill mutations',
      'Added Dashboard Recent Activity feed powered by financial_events for a transparent mutation timeline',
      'Added one-command release candidate verification script with final PASS/FAIL summary output',
      'Added in-app Guide page with start checklist, feature map, playbooks, and FAQ/privacy guidance',
      'Documented CI policy and recommended branch-protection required checks for deployment discipline',
    ],
  },
]