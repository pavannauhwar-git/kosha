// Each category: Phosphor icon name, unique vivid colour, tinted background
const OTHER_CATEGORY = { id:'other', label:'Other', icon:'DotsThree', color:'#9CA3AF', bg:'#F9FAFB' }
const REPAYMENT_CATEGORY = {
  id: 'loans',
  label: 'Loan Repayment',
  icon: 'ArrowUDownLeft',
  color: '#F57F17',
  bg: '#FFF8E1',
}

export const EXPENSE_CATEGORIES = [
  { id:'food',          label:'Food & Dining',    icon:'ForkKnife',       color:'#FF6B35', bg:'#FFF0EB' },
  { id:'groceries',     label:'Groceries',         icon:'ShoppingCart',    color:'#00C896', bg:'#E8FBF6' },
  { id:'vehicle',       label:'Vehicle',           icon:'Car',             color:'#0EA5E9', bg:'#E0F2FE' },
  { id:'fuel',          label:'Fuel',              icon:'GasPump',         color:'#F97316', bg:'#FFF7ED' },
  { id:'travel',        label:'Travel',            icon:'AirplaneTilt',    color:'#F59E0B', bg:'#FEF3C7' },
  { id:'electronics',   label:'Electronics',       icon:'DeviceMobile',    color:'#3B82F6', bg:'#EFF6FF' },
  { id:'medical',       label:'Medical',           icon:'FirstAid',        color:'#FF4757', bg:'#FFE8EA' },
  { id:'utilities',     label:'Utilities',         icon:'Lightning',       color:'#EAB308', bg:'#FEFCE8' },
  { id:'personal',      label:'Personal',          icon:'User',            color:'#FF6B9D', bg:'#FFE8F2' },
  { id:'cigarette',     label:'Cigarettes & Tobacco', icon:'Cigarette',    color:'#8B5A2B', bg:'#FFF7ED' },
  { id:'entertainment', label:'Entertainment',     icon:'Popcorn',         color:'#A855F7', bg:'#F5F3FF' },
  { id:'education',     label:'Education',         icon:'BookOpen',        color:'#14B8A6', bg:'#F0FDFA' },
  { id:'shopping',      label:'Shopping',          icon:'Handbag',         color:'#EC4899', bg:'#FDF2F8' },
  { id:'dining_out',    label:'Dining Out',        icon:'BowlFood',        color:'#EA580C', bg:'#FFF7ED' },
  { id:'insurance',     label:'Insurance',         icon:'ShieldCheck',     color:'#64748B', bg:'#F8FAFC' },
  { id:'credit_card',   label:'Credit Card',       icon:'CreditCard',      color:'#6C47FF', bg:'#EDE8FF' },
  { id:'rent',          label:'Rent',              icon:'House',           color:'#92400E', bg:'#FEF3C7' },
  { id:'subscription',  label:'Subscriptions',     icon:'MonitorPlay',     color:'#8B5CF6', bg:'#F5F3FF' },
  { id:'transfer',      label:'Transfer',          icon:'ArrowsLeftRight', color:'#6B7280', bg:'#F9FAFB' },
  { id:'gift',          label:'Gift',              icon:'Gift',            color:'#D97706', bg:'#FFFBEB' },
  { id:'charity',       label:'Charity',           icon:'Heart',           color:'#DC2626', bg:'#FEF2F2' },
  { id:'taxes',         label:'Taxes',             icon:'Scales',          color:'#B45309', bg:'#FFFBEB' },
  { id:'bills',         label:'Bills',             icon:'FileText',        color:'#D97706', bg:'#FFFBEB' },
  { id:'salon',         label:'Salon & Grooming',  icon:'Scissors',        color:'#DB2777', bg:'#FDF2F8' },
  { id:'gym',           label:'Gym & Fitness',     icon:'Barbell',         color:'#059669', bg:'#ECFDF5' },
  { id:'pets',          label:'Pets',              icon:'PawPrint',        color:'#A16207', bg:'#FEFCE8' },
  { id:'baby',          label:'Baby & Kids',       icon:'Baby',            color:'#E879F9', bg:'#FDF4FF' },
  { id:'home',          label:'Home Maintenance',  icon:'Hammer',          color:'#78716C', bg:'#F5F5F4' },
  { id:'internet',      label:'Internet & WiFi',   icon:'WifiHigh',        color:'#06B6D4', bg:'#ECFEFF' },
  { id:'laundry',       label:'Laundry',           icon:'Broom',           color:'#6366F1', bg:'#EEF2FF' },
  { id:'parking',       label:'Parking & Tolls',   icon:'MapPin',          color:'#0284C7', bg:'#E0F2FE' },
  { id:'emi',           label:'EMI',               icon:'CalendarCheck',   color:'#7C3AED', bg:'#F5F3FF' },
  { id:'clothing',      label:'Clothing',          icon:'ShirtFolded',     color:'#BE185D', bg:'#FDF2F8' },
  { id:'household',     label:'Household Supplies',icon:'Package',         color:'#16A34A', bg:'#F0FDF4' },
  { id:'mobile_recharge', label:'Mobile Recharge', icon:'Phone',           color:'#4F46E5', bg:'#EEF2FF' },
  { id:'public_transport', label:'Public Transport', icon:'Bus',           color:'#0284C7', bg:'#E0F2FE' },
  { id:'office_expense', label:'Office Expense',   icon:'Briefcase',       color:'#0369A1', bg:'#E0F2FE' },
  { id:'fees_penalties', label:'Fees & Penalties', icon:'Receipt',         color:'#B45309', bg:'#FFFBEB' },
  { id:'legal',         label:'Legal',             icon:'Gavel',           color:'#475569', bg:'#F8FAFC' },
  { id:'events',        label:'Events & Occasions',icon:'Ticket',          color:'#C026D3', bg:'#FDF4FF' },
  { id:'party_expense', label:'Party & Celebration', icon:'Confetti',      color:'#C026D3', bg:'#FDF4FF' },
  OTHER_CATEGORY,
]

export const INCOME_CATEGORIES = [
  { id:'salary',          label:'Salary',           icon:'MoneyWavy',      color:'#10B981', bg:'#ECFDF5' },
  { id:'rent_income',     label:'Rent',             icon:'Globe',          color:'#92400E', bg:'#FEF3C7' },
  { id:'dividend',        label:'Dividend',         icon:'HandCoins',      color:'#0EA5E9', bg:'#E0F2FE' },
  { id:'share_market',    label:'Share Market',     icon:'TrendUp',        color:'#3B82F6', bg:'#EFF6FF' },
  { id:'business_profit', label:'Business Profit',  icon:'CashRegister',   color:'#14B8A6', bg:'#F0FDFA' },
  { id:'interest',        label:'Interest',         icon:'Coins',          color:'#D97706', bg:'#FFFBEB' },
  { id:'freelance',       label:'Freelance',        icon:'IdentificationBadge', color:'#7C3AED', bg:'#F5F3FF' },
  { id:'bonus',           label:'Bonus',            icon:'Sparkle',        color:'#EC4899', bg:'#FDF2F8' },
  { id:'refund',          label:'Refund',           icon:'ArrowsCounterClockwise',color:'#64748B', bg:'#F8FAFC' },
  { id:'side_hustle',     label:'Side Hustle',      icon:'ChartLineUp',    color:'#0D9488', bg:'#F0FDFA' },
  { id:'cashback',        label:'Cashback',         icon:'Wallet',         color:'#0284C7', bg:'#E0F2FE' },
  OTHER_CATEGORY,
]

export const CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES.filter((cat) => cat.id !== 'other'),
  REPAYMENT_CATEGORY,
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

const EXPENSE_CATEGORY_IDS = new Set(EXPENSE_CATEGORIES.map(c => c.id))
const INCOME_CATEGORY_IDS = new Set(INCOME_CATEGORIES.map(c => c.id))

// ── Custom category registry (populated by useUserCategories hook) ────────
let _customCategories = []

export function registerCustomCategories(cats) {
  _customCategories = cats
}

export function getCategoriesForType(type) {
  const customs = _customCategories.filter(c => c.type === type)
  if (type === 'investment') {
    return customs.length === 0 ? [OTHER_CATEGORY] : [...customs, OTHER_CATEGORY]
  }

  if (customs.length === 0) {
    if (type === 'income') return INCOME_CATEGORIES
    if (type === 'expense') return EXPENSE_CATEGORIES
    return CATEGORIES
  }

  // Insert custom categories before the "Other" catch-all
  if (type === 'income') return [...INCOME_CATEGORIES.slice(0, -1), ...customs, OTHER_CATEGORY]
  if (type === 'expense') return [...EXPENSE_CATEGORIES.slice(0, -1), ...customs, OTHER_CATEGORY]
  return [...CATEGORIES, ...customs]
}

export function isCategoryAllowedForType(type, categoryId) {
  if (!categoryId) return false
  if (type === 'income') return INCOME_CATEGORY_IDS.has(categoryId) || _customCategories.some(c => c.id === categoryId && c.type === 'income')
  if (type === 'expense') return EXPENSE_CATEGORY_IDS.has(categoryId) || _customCategories.some(c => c.id === categoryId && c.type === 'expense')
  if (type === 'investment') return categoryId === 'other' || _customCategories.some(c => c.id === categoryId && c.type === 'investment')
  return true
}

export function normalizeCategoryForType(type, categoryId) {
  if (!categoryId) return 'other'
  return isCategoryAllowedForType(type, categoryId) ? categoryId : 'other'
}

export function getCategory(id) {
  return CATEGORY_MAP[id] || _customCategories.find(c => c.id === id) || CATEGORY_MAP['other']
}

export const INVESTMENT_VEHICLES = [
  { id:'mutual_fund',  label:'Mutual Fund',   icon:'Plant',        color:'#3B82F6', bg:'#EFF6FF' },
  { id:'stocks',       label:'Stocks',        icon:'TrendUp',      color:'#10B981', bg:'#ECFDF5' },
  { id:'fixed_deposit',label:'Fixed Deposit', icon:'Vault',        color:'#6B7280', bg:'#F9FAFB' },
  { id:'ppf',          label:'PPF',           icon:'Coin',         color:'#D97706', bg:'#FFFBEB' },
  { id:'nps',          label:'NPS',           icon:'Umbrella',     color:'#0EA5E9', bg:'#E0F2FE' },
  { id:'gold',         label:'Gold',          icon:'Diamond',      color:'#EAB308', bg:'#FEFCE8' },
  { id:'real_estate',  label:'Real Estate',   icon:'Buildings',    color:'#92400E', bg:'#FEF3C7' },
  { id:'crypto',       label:'Crypto',        icon:'CurrencyBtc',  color:'#F59E0B', bg:'#FEF3C7' },
  { id:'bonds',        label:'Bonds',         icon:'Scroll',       color:'#64748B', bg:'#F8FAFC' },
  { id:'esops',        label:'ESOPs',         icon:'Briefcase',    color:'#7C3AED', bg:'#F5F3FF' },
  { id:'sgb',          label:'SGB',           icon:'Certificate',  color:'#B45309', bg:'#FFFBEB' },
  { id:'term_plan',    label:'Term Plan',     icon:'ShieldCheck',  color:'#DC2626', bg:'#FEF2F2' },
  { id:'other',        label:'Other',         icon:'Tag',          color:'#9CA3AF', bg:'#F9FAFB' },
]

export const PAYMENT_MODES = [
  { id:'upi',         label:'UPI',          icon:'QrCode',       color:'#7C3AED', bg:'#F5F3FF' },
  { id:'credit_card', label:'Credit Card',  icon:'CreditCard',   color:'#6C47FF', bg:'#EDE8FF' },
  { id:'debit_card',  label:'Debit Card',   icon:'Bank',         color:'#0EA5E9', bg:'#E0F2FE' },
  { id:'cash',        label:'Cash',         icon:'Money',        color:'#10B981', bg:'#ECFDF5' },
  { id:'net_banking', label:'Net Banking',  icon:'Globe',        color:'#3B82F6', bg:'#EFF6FF' },
  { id:'wallet',      label:'Wallet',       icon:'Wallet',       color:'#F59E0B', bg:'#FEF3C7' },
  { id:'other',       label:'Other',        icon:'DotsThree',    color:'#9CA3AF', bg:'#F9FAFB' },
]
