export const CHANGELOG = [
  {
    version: '3.1.1',
    date: 'June 2026',
    items: [
      'Resolved accessibility violations and enhanced screen reader support across UI components',
      'Refined loan interest calculation to strictly apply to the declining balance',
      'Enforced a strict 1:1 partner model for shared wallets with transparent error messaging',
      'Hardened database schema aggregations, improving search resilience and preventing silent data overwrites'
    ],
  },
  {
    version: '3.1.0',
    date: 'June 2026',
    items: [
      'Introduced robust offline capabilities, allowing users to queue transactions, bills, loans, and Splitwise expenses seamlessly without network connectivity',
      'Migrated application data mutations to centralized global React Query hooks for unified error tracking and consistent state management',
      'Configured real-time conflict policies and a structured error taxonomy to protect against duplicate data entries and provide clear user feedback',
      'Reduced real-time synchronization suppression window, ensuring multi-device updates remain accurate and immediately visible',
    ],
  },
  {
    version: '3.0.2',
    date: 'June 2026',
    items: [
      'Implemented extensive optimistic UI updates across transactions and Splitwise group management, eliminating visual lag during cache mutations',
      'Enabled strict jsx-a11y static analysis and resolved accessibility violations across all UI components for a more inclusive user experience',
      'Refactored sensitive runtime data handling, improving loan cache consistency and adding automated monthly net change backfills',
      'Optimized application layout with safe-area-inset padding to seamlessly support native notch and mobile status bars',
    ],
  },
  {
    version: '3.0.1',
    date: 'May 2026',
    items: [
      'Hardened CI/CD pipelines with parallel execution, secret validation checks, and comprehensive ESLint static analysis',
      'Enhanced optimistic update stability via robust mutation guards, preventing UI race conditions during latency spikes',
      'Optimized application bundle and module graph by purging orphaned React components and unused system hooks',
      'Refined data caching architecture with strictly scoped query-key factories to prevent cross-wallet data pollution',
    ],
  },
  {
    version: '3.0.0',
    date: 'May 2026',
    items: [
      'Migrated financial math from floating-point arithmetic to BigInt paise for zero-loss precision across all features',
      'Overhauled validation and component lifecycles to eliminate race conditions, duplicate submissions, and data entry errors',
      'Implemented strict MIME-type and magic byte verification for file uploads and attachments, reinforcing data integrity and security',
      'Introduced cross-currency validation guards during Splitwise settlements to prevent mismatched currency resolutions',
    ],
  },
  {
    version: '2.4.1',
    date: 'May 2026',
    items: [
      'Unified Material Design 3 spring-physics animations across all pages — card entry, hover, and tap interactions now follow the same elastic M3 motion curve',
      'Fixed empty-state flash on dashboard: new users no longer see a momentary data blip before the onboarding empty state appears',
      'Eliminated ghost data flash on profile switch by switching from resetQueries to removeQueries for wallet-scoped cache invalidation',
      'Fixed hardcoded bg-white on linked wallets list breaking dark mode; Settings SettingRow upgraded to spring-physics motion button',
    ],
  },
  {
    version: '2.4.0',
    date: 'May 2026',
    items: [
      'Integrated loan creation with the transaction system — every new loan now atomically generates a linked disbursement transaction',
      'Introduced four distinct loan transaction types with unique icons and colored badges: Loan Disbursement, Loan Received, Repayment Received, and Repayment Made',
      'Removed auto-generated notes from all loan and bill transactions, eliminating misleading "Note" badges on system-created records',
      'Standardized linked transaction subtitles across Loans, Bills, and Splitwise to always show the category name',
    ],
  },
  {
    version: '2.3.9',
    date: 'May 2026',
    items: [
      'Hardened Shared Wallet infrastructure with strict RLS policies for secure, read-only visibility across partner Bills, Loans, and Transactions',
      'Resolved Splitwise group rejoining flows and schema constraints to support seamless user re-entry without database conflicts',
      'Refactored the core Supabase schema with atomic RPC functions for robust onboarding and authentication',
      'Corrected transaction-scoped mutations to ensure shared wallet actions are accurately attributed to the correct wallet owner',
    ],
  },
  {
    version: '2.3.8',
    date: 'May 2026',
    items: [
      'Overhauled the illustration system with premium hero assets for Error, 404, and Invitation pages',
      'Implemented Eager Chunk Preloading to eliminate visual lag and Suspense flashes during navigation',
      'Resolved Splitwise sheet visibility issues by optimizing z-index layering and bottom padding for mobile navigation',
      'Unified error page layouts with a centered hero design for a more premium and cohesive recovery experience',
    ],
  },
]