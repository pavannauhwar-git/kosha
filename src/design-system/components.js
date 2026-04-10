/**
 * Kosha Design System — Component API Specification
 *
 * Documents the API surface for every UI primitive in src/components/ui/.
 * All components use design tokens, are dark-mode aware, accessible, and mobile-first.
 */

/* ── Button ───────────────────────────────────────────────────────────── */
export const ButtonSpec = {
  variants: ['primary', 'secondary', 'ghost', 'danger', 'tonal'],
  sizes:    ['sm', 'md', 'lg'],
  props: {
    variant:   'string — primary | secondary | ghost | danger | tonal',
    size:      'string — sm | md | lg (default: md)',
    disabled:  'boolean',
    loading:   'boolean — shows spinner, disables interaction',
    icon:      'ReactNode — leading icon',
    iconRight: 'ReactNode — trailing icon',
    fullWidth: 'boolean — stretches to container width',
    children:  'ReactNode — button label',
    onClick:   'function',
    type:      'string — button | submit | reset (default: button)',
    className: 'string — additional Tailwind classes',
    as:        'string|Component — render as different element',
  },
}

/* ── Input ────────────────────────────────────────────────────────────── */
export const InputSpec = {
  props: {
    label:       'string — visible label above input',
    placeholder: 'string',
    value:       'string',
    onChange:     'function(e)',
    type:        'string — text | email | password | number',
    error:       'string — error message shown below',
    helperText:  'string — help text below input',
    disabled:    'boolean',
    icon:        'ReactNode — leading icon inside input',
    iconRight:   'ReactNode — trailing icon/action',
    autoFocus:   'boolean',
    className:   'string',
  },
}

/* ── AmountInput ──────────────────────────────────────────────────────── */
export const AmountInputSpec = {
  props: {
    value:       'string — raw amount string',
    onChange:     'function(string)',
    type:        'string — income | expense | investment — controls color',
    currency:    'string — INR, USD, etc.',
    autoFocus:   'boolean',
    error:       'string',
    placeholder: 'string (default: "0")',
    className:   'string',
  },
  behavior: 'Formatted on blur with currency symbol. Red for expense, green for income, indigo for investment. Rejects non-numeric input silently.',
}

/* ── Badge ────────────────────────────────────────────────────────────── */
export const BadgeSpec = {
  variants: ['recurring', 'repayment', 'category', 'status', 'income', 'expense', 'invest', 'neutral'],
  props: {
    variant:   'string',
    children:  'ReactNode — badge label',
    icon:      'ReactNode — optional leading icon',
    size:      'string — sm | md (default: sm)',
    className: 'string',
  },
}

/* ── Card ─────────────────────────────────────────────────────────────── */
export const CardSpec = {
  props: {
    children:  'ReactNode',
    variant:   'string — elevated | filled | outlined (default: elevated)',
    padding:   'string — sm | md | lg (default: md)',
    pressable: 'boolean — adds hover/press states',
    onClick:   'function',
    className: 'string',
  },
}

/* ── BottomSheet ──────────────────────────────────────────────────────── */
export const BottomSheetSpec = {
  props: {
    open:       'boolean',
    onClose:    'function',
    title:      'string — sheet header',
    children:   'ReactNode — sheet content',
    snapPoints: 'number[] — e.g. [0.5, 0.9] of viewport height',
    className:  'string',
  },
  behavior: 'Gesture-dismissable on mobile (drag down to close). Modal with backdrop on desktop. Trap focus when open. Escape to close.',
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */
export const SkeletonSpec = {
  props: {
    variant:   'string — text | circle | rect | card | row',
    width:     'string — Tailwind width class',
    height:    'string — Tailwind height class',
    count:     'number — repeat N times for text lines (default: 1)',
    className: 'string',
  },
}

/* ── EmptyState ───────────────────────────────────────────────────────── */
export const EmptyStateSpec = {
  props: {
    icon:        'ReactNode — illustration icon',
    title:       'string — headline',
    description: 'string — supporting text',
    action:      '{ label: string, onClick: function } — primary CTA',
    secondaryAction: '{ label: string, onClick: function } — secondary CTA',
    className:   'string',
  },
}

/* ── MonthStepper ─────────────────────────────────────────────────────── */
export const MonthStepperSpec = {
  props: {
    year:       'number',
    month:      'number — 1-12',
    onChange:    'function(year, month)',
    minYear:    'number — earliest navigable year',
    className:  'string',
  },
  behavior: 'Blocks navigation past current month. Prev/Next buttons with month-year display.',
}

/* ── CategoryPicker ───────────────────────────────────────────────────── */
export const CategoryPickerSpec = {
  props: {
    type:       'string — expense | income | investment',
    value:      'string — selected category id',
    onChange:    'function(categoryId)',
    className:  'string',
  },
  behavior: 'Grid of icons+labels, single select, scrollable within container.',
}

/* ── TransactionRow ───────────────────────────────────────────────────── */
export const TransactionRowSpec = {
  props: {
    transaction: 'object — { id, date, type, amount, description, category, is_recurring, is_repayment, ... }',
    onTap:       'function(transaction) — opens edit',
    onDelete:    'function(id)',
    onDuplicate: 'function(transaction)',
    className:   'string',
  },
  behavior: 'Shows category icon, description, date, formatted amount. Badges for recurring and repayment. Swipe-to-reveal delete on mobile.',
}

/* ── AmountDisplay ────────────────────────────────────────────────────── */
export const AmountDisplaySpec = {
  props: {
    amount:    'number',
    type:      'string — income | expense | investment | balance | neutral',
    size:      'string — sm | md | lg | hero (default: md)',
    animate:   'boolean — animated count-up on mount (default: false)',
    prefix:    'string — e.g. "+" or "-" override',
    currency:  'string (default: INR)',
    className: 'string',
  },
  behavior: 'Large formatted number with currency symbol. Color by type. Optional animated count-up using requestAnimationFrame.',
}
