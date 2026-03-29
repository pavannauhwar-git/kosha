// Each category: Phosphor icon name, unique vivid colour, tinted background (dark-theme alpha)
const OTHER_CATEGORY = { id:'other', label:'Other', icon:'Package', color:'#9CA3AF', bg:'rgba(156,163,175,0.12)' }

export const EXPENSE_CATEGORIES = [
  { id:'food',          label:'Food & Dining',    icon:'ForkKnife',       color:'#FF6B35', bg:'rgba(255,107,53,0.12)' },
  { id:'groceries',     label:'Groceries',         icon:'ShoppingCart',    color:'#00C896', bg:'rgba(0,200,150,0.12)' },
  { id:'vehicle',       label:'Vehicle',           icon:'Car',             color:'#0EA5E9', bg:'rgba(14,165,233,0.12)' },
  { id:'fuel',          label:'Fuel',              icon:'GasPump',         color:'#F97316', bg:'rgba(249,115,22,0.12)' },
  { id:'travel',        label:'Travel',            icon:'AirplaneTilt',    color:'#F59E0B', bg:'rgba(245,158,11,0.12)' },
  { id:'electronics',   label:'Electronics',       icon:'DeviceMobile',    color:'#3B82F6', bg:'rgba(59,130,246,0.12)' },
  { id:'medical',       label:'Medical',           icon:'FirstAid',        color:'#FF4757', bg:'rgba(255,71,87,0.12)' },
  { id:'utilities',     label:'Utilities',         icon:'Lightning',       color:'#EAB308', bg:'rgba(234,179,8,0.12)' },
  { id:'personal',      label:'Personal',          icon:'User',            color:'#FF6B9D', bg:'rgba(255,107,157,0.12)' },
  { id:'entertainment', label:'Entertainment',     icon:'FilmSlate',       color:'#A855F7', bg:'rgba(168,85,247,0.12)' },
  { id:'education',     label:'Education',         icon:'BookOpen',        color:'#14B8A6', bg:'rgba(20,184,166,0.12)' },
  { id:'shopping',      label:'Shopping',          icon:'ShoppingBag',     color:'#EC4899', bg:'rgba(236,72,153,0.12)' },
  { id:'dining_out',    label:'Dining Out',        icon:'CookingPot',      color:'#EA580C', bg:'rgba(234,88,12,0.12)' },
  { id:'insurance',     label:'Insurance',         icon:'ShieldCheck',     color:'#64748B', bg:'rgba(100,116,139,0.12)' },
  { id:'credit_card',   label:'Credit Card',       icon:'CreditCard',      color:'#6C47FF', bg:'rgba(108,71,255,0.12)' },
  { id:'rent',          label:'Rent',              icon:'House',           color:'#92400E', bg:'rgba(146,64,14,0.12)' },
  { id:'subscription',  label:'Subscriptions',     icon:'MonitorPlay',     color:'#8B5CF6', bg:'rgba(139,92,246,0.12)' },
  { id:'transfer',      label:'Transfer',          icon:'ArrowsLeftRight', color:'#6B7280', bg:'rgba(107,114,128,0.12)' },
  { id:'gift',          label:'Gift',              icon:'Gift',            color:'#D97706', bg:'rgba(217,119,6,0.12)' },
  { id:'charity',       label:'Charity',           icon:'Heart',           color:'#DC2626', bg:'rgba(220,38,38,0.12)' },
  { id:'taxes',         label:'Taxes',             icon:'Scales',          color:'#B45309', bg:'rgba(180,83,9,0.12)' },
  { id:'bills',         label:'Bills',             icon:'FileText',        color:'#D97706', bg:'rgba(217,119,6,0.12)' },
  { id:'salon',         label:'Salon & Grooming',  icon:'Scissors',        color:'#DB2777', bg:'rgba(219,39,119,0.12)' },
  { id:'gym',           label:'Gym & Fitness',     icon:'Barbell',         color:'#059669', bg:'rgba(5,150,105,0.12)' },
  { id:'pets',          label:'Pets',              icon:'PawPrint',        color:'#A16207', bg:'rgba(161,98,7,0.12)' },
  { id:'baby',          label:'Baby & Kids',       icon:'Baby',            color:'#E879F9', bg:'rgba(232,121,249,0.12)' },
  { id:'home',          label:'Home Maintenance',  icon:'Wrench',          color:'#78716C', bg:'rgba(120,113,108,0.12)' },
  { id:'internet',      label:'Internet & WiFi',   icon:'WifiHigh',        color:'#06B6D4', bg:'rgba(6,182,212,0.12)' },
  { id:'laundry',       label:'Laundry',           icon:'TShirt',          color:'#6366F1', bg:'rgba(99,102,241,0.12)' },
  { id:'parking',       label:'Parking & Tolls',   icon:'MapPin',          color:'#0284C7', bg:'rgba(2,132,199,0.12)' },
  { id:'emi',           label:'EMI',               icon:'CalendarCheck',   color:'#7C3AED', bg:'rgba(124,58,237,0.12)' },
  OTHER_CATEGORY,
]

export const INCOME_CATEGORIES = [
  { id:'salary',          label:'Salary',           icon:'Briefcase',      color:'#10B981', bg:'rgba(16,185,129,0.12)' },
  { id:'rent_income',     label:'Rent',             icon:'House',          color:'#92400E', bg:'rgba(146,64,14,0.12)' },
  { id:'dividend',        label:'Dividend',         icon:'Scroll',         color:'#0EA5E9', bg:'rgba(14,165,233,0.12)' },
  { id:'share_market',    label:'Share Market',     icon:'TrendUp',        color:'#3B82F6', bg:'rgba(59,130,246,0.12)' },
  { id:'business_profit', label:'Business Profit',  icon:'ChartLineUp',    color:'#14B8A6', bg:'rgba(20,184,166,0.12)' },
  { id:'interest',        label:'Interest',         icon:'Coin',           color:'#D97706', bg:'rgba(217,119,6,0.12)' },
  { id:'freelance',       label:'Freelance',        icon:'IdentificationBadge', color:'#7C3AED', bg:'rgba(124,58,237,0.12)' },
  { id:'bonus',           label:'Bonus',            icon:'Gift',           color:'#EC4899', bg:'rgba(236,72,153,0.12)' },
  { id:'refund',          label:'Refund',           icon:'ArrowsLeftRight',color:'#64748B', bg:'rgba(100,116,139,0.12)' },
  OTHER_CATEGORY,
]

export const CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES.filter((cat) => cat.id !== 'other'),
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

const EXPENSE_CATEGORY_IDS = new Set(EXPENSE_CATEGORIES.map(c => c.id))
const INCOME_CATEGORY_IDS = new Set(INCOME_CATEGORIES.map(c => c.id))

export function getCategoriesForType(type) {
  if (type === 'income') return INCOME_CATEGORIES
  if (type === 'expense') return EXPENSE_CATEGORIES
  return CATEGORIES
}

export function isCategoryAllowedForType(type, categoryId) {
  if (!categoryId) return false
  if (type === 'income') return INCOME_CATEGORY_IDS.has(categoryId)
  if (type === 'expense') return EXPENSE_CATEGORY_IDS.has(categoryId)
  return true
}

export function normalizeCategoryForType(type, categoryId) {
  if (!categoryId) return 'other'
  return isCategoryAllowedForType(type, categoryId) ? categoryId : 'other'
}

export function getCategory(id) {
  return CATEGORY_MAP[id] || CATEGORY_MAP['other']
}

export const INVESTMENT_VEHICLES = [
  { id:'mutual_fund',  label:'Mutual Fund',   icon:'ChartLineUp',  color:'#3B82F6', bg:'rgba(59,130,246,0.12)' },
  { id:'stocks',       label:'Stocks',        icon:'TrendUp',      color:'#10B981', bg:'rgba(16,185,129,0.12)' },
  { id:'fixed_deposit',label:'Fixed Deposit', icon:'Vault',        color:'#6B7280', bg:'rgba(107,114,128,0.12)' },
  { id:'ppf',          label:'PPF',           icon:'Coin',         color:'#D97706', bg:'rgba(217,119,6,0.12)' },
  { id:'nps',          label:'NPS',           icon:'Umbrella',     color:'#0EA5E9', bg:'rgba(14,165,233,0.12)' },
  { id:'gold',         label:'Gold',          icon:'Diamond',      color:'#EAB308', bg:'rgba(234,179,8,0.12)' },
  { id:'real_estate',  label:'Real Estate',   icon:'Buildings',    color:'#92400E', bg:'rgba(146,64,14,0.12)' },
  { id:'crypto',       label:'Crypto',        icon:'CurrencyBtc',  color:'#F59E0B', bg:'rgba(245,158,11,0.12)' },
  { id:'bonds',        label:'Bonds',         icon:'Scroll',       color:'#64748B', bg:'rgba(100,116,139,0.12)' },
  { id:'esops',        label:'ESOPs',         icon:'Briefcase',    color:'#7C3AED', bg:'rgba(124,58,237,0.12)' },
  { id:'espp',         label:'ESPP',          icon:'IdentificationBadge', color:'#6C47FF', bg:'rgba(108,71,255,0.12)' },
  { id:'sgb',          label:'SGB',           icon:'Certificate',  color:'#B45309', bg:'rgba(180,83,9,0.12)' },
  { id:'term_plan',    label:'Term Plan',     icon:'ShieldCheck',  color:'#DC2626', bg:'rgba(220,38,38,0.12)' },
  { id:'other',        label:'Other',         icon:'Package',      color:'#9CA3AF', bg:'rgba(156,163,175,0.12)' },
]

export const PAYMENT_MODES = [
  { id:'upi',         label:'UPI',          icon:'QrCode',       color:'#7C3AED', bg:'rgba(124,58,237,0.12)' },
  { id:'credit_card', label:'Credit Card',  icon:'CreditCard',   color:'#6C47FF', bg:'rgba(108,71,255,0.12)' },
  { id:'debit_card',  label:'Debit Card',   icon:'Bank',         color:'#0EA5E9', bg:'rgba(14,165,233,0.12)' },
  { id:'cash',        label:'Cash',         icon:'Money',        color:'#10B981', bg:'rgba(16,185,129,0.12)' },
  { id:'net_banking', label:'Net Banking',  icon:'Globe',        color:'#3B82F6', bg:'rgba(59,130,246,0.12)' },
  { id:'wallet',      label:'Wallet',       icon:'Wallet',       color:'#F59E0B', bg:'rgba(245,158,11,0.12)' },
  { id:'other',       label:'Other',        icon:'DotsThree',    color:'#9CA3AF', bg:'rgba(156,163,175,0.12)' },
]
