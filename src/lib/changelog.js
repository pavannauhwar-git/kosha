export const CHANGELOG = [
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