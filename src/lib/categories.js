// Each category: Phosphor icon name, unique vivid colour, tinted background
export const CATEGORIES = [
  { id:'food',          label:'Food & Dining',  icon:'ForkKnife',       color:'#FF6B35', bg:'#FFF0EB' },
  { id:'groceries',     label:'Groceries',       icon:'ShoppingCart',    color:'#00C896', bg:'#E8FBF6' },
  { id:'vehicle',       label:'Vehicle',         icon:'Car',             color:'#0EA5E9', bg:'#E0F2FE' },
  { id:'travel',        label:'Travel',          icon:'AirplaneTilt',    color:'#F59E0B', bg:'#FEF3C7' },
  { id:'electronics',   label:'Electronics',     icon:'DeviceMobile',    color:'#3B82F6', bg:'#EFF6FF' },
  { id:'medical',       label:'Medical',         icon:'FirstAid',        color:'#FF4757', bg:'#FFE8EA' },
  { id:'utilities',     label:'Utilities',       icon:'Lightning',       color:'#EAB308', bg:'#FEFCE8' },
  { id:'personal',      label:'Personal',        icon:'User',            color:'#FF6B9D', bg:'#FFE8F2' },
  { id:'entertainment', label:'Entertainment',   icon:'FilmSlate',       color:'#A855F7', bg:'#F5F3FF' },
  { id:'education',     label:'Education',       icon:'BookOpen',        color:'#14B8A6', bg:'#F0FDFA' },
  { id:'shopping',      label:'Shopping',        icon:'ShoppingBag',     color:'#EC4899', bg:'#FDF2F8' },
  { id:'dining_out',    label:'Dining Out',      icon:'CookingPot',      color:'#EA580C', bg:'#FFF7ED' },
  { id:'insurance',     label:'Insurance',       icon:'ShieldCheck',     color:'#64748B', bg:'#F8FAFC' },
  { id:'credit_card',   label:'Credit Card',     icon:'CreditCard',      color:'#6C47FF', bg:'#EDE8FF' },
  { id:'rent',          label:'Rent',            icon:'House',           color:'#92400E', bg:'#FEF3C7' },
  { id:'subscription',  label:'Subscriptions',   icon:'MonitorPlay',     color:'#8B5CF6', bg:'#F5F3FF' },
  { id:'transfer',      label:'Transfer',        icon:'ArrowsLeftRight', color:'#6B7280', bg:'#F9FAFB' },
  { id:'gift',          label:'Gift',            icon:'Gift',            color:'#D97706', bg:'#FFFBEB' },
  { id:'charity',       label:'Charity',         icon:'Heart',           color:'#DC2626', bg:'#FEF2F2' },
  { id:'taxes',         label:'Taxes',           icon:'Receipt',         color:'#B45309', bg:'#FFFBEB' },
  { id:'bills',         label:'Bills',           icon:'Receipt',         color:'#D97706', bg:'#FFFBEB' },
  { id:'other',         label:'Other',           icon:'Package',         color:'#9CA3AF', bg:'#F9FAFB' },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

export function getCategory(id) {
  return CATEGORY_MAP[id] || CATEGORY_MAP['other']
}

export const INVESTMENT_VEHICLES = [
  'ESOPs','Adobe ESPP','PPF','NPS','Zerodha','Indriya',
  'HSBC','Gold','SGB','Term Plan','CBI','Mutual Fund','Other',
]

export const PAYMENT_MODES = [
  { id:'upi',         label:'UPI'         },
  { id:'credit_card', label:'Credit Card' },
  { id:'debit_card',  label:'Debit Card'  },
  { id:'cash',        label:'Cash'        },
  { id:'net_banking', label:'Net Banking' },
  { id:'other',       label:'Other'       },
]
