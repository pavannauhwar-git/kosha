import {
  ForkKnife, ShoppingCart, Car, AirplaneTilt, DeviceMobile,
  FirstAid, Lightning, User, FilmSlate, BookOpen, ShoppingBag,
  CookingPot, ShieldCheck, CreditCard, House, MonitorPlay,
  ArrowsLeftRight, Gift, Heart, Receipt, Package,
  GasPump, Scissors, Barbell, PawPrint, Baby, Wrench, WifiHigh,
  TShirt, CalendarCheck, Scales, FileText, MapPin,
  QrCode, Bank, Money, Globe, Wallet, DotsThree,
  ChartLineUp, TrendUp, Vault, Coin, Umbrella, Diamond,
  Buildings, CurrencyBtc, Scroll, Briefcase, IdentificationBadge,
  Certificate, Tag,
} from '@phosphor-icons/react'
import { memo } from 'react'
import { getCategory } from '../../lib/categories'

export const ICON_MAP = {
  ForkKnife, ShoppingCart, Car, AirplaneTilt, DeviceMobile,
  FirstAid, Lightning, User, FilmSlate, BookOpen, ShoppingBag,
  CookingPot, ShieldCheck, CreditCard, House, MonitorPlay,
  ArrowsLeftRight, Gift, Heart, Receipt, Package,
  GasPump, Scissors, Barbell, PawPrint, Baby, Wrench, WifiHigh,
  TShirt, CalendarCheck, Scales, FileText, MapPin,
  QrCode, Bank, Money, Globe, Wallet, DotsThree,
  ChartLineUp, TrendUp, Vault, Coin, Umbrella, Diamond,
  Buildings, CurrencyBtc, Scroll, Briefcase, IdentificationBadge,
  Certificate, Tag,
}

function CategoryIcon({ categoryId, id, size = 20, className = '' }) {
  const cat  = getCategory(categoryId || id)
  const Icon = ICON_MAP[cat.icon] || Package

  return (
    <div
      className={`flex items-center justify-center rounded-chip flex-shrink-0 ${className}`}
      style={{
        width:  size + 12,
        height: size + 12,
        backgroundColor: cat.bg,
        background: `color-mix(in srgb, ${cat.color} 18%, var(--ds-surface))`,
      }}
    >
      {/* Duotone effect: primary icon layer + lighter shadow */}
      <Icon
        size={size}
        weight="duotone"
        color={cat.color}
      />
    </div>
  )
}

export default memo(CategoryIcon)
