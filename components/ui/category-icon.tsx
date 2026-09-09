'use client'

import {
  ArrowLeftRight,
  Award,
  Baby,
  BadgePercent,
  Banknote,
  Bike,
  BookOpen,
  Brain,
  Briefcase,
  Building,
  Building2,
  Car,
  CarTaxiFront,
  ChartPie,
  Clapperboard,
  Coffee,
  Cog,
  Coins,
  Cookie,
  CreditCard,
  Croissant,
  Droplet,
  Dumbbell,
  Ellipsis,
  FileText,
  Flame,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  Glasses,
  GraduationCap,
  Hammer,
  HandCoins,
  HeartPulse,
  Hotel,
  House,
  Landmark,
  Languages,
  Laptop,
  Milestone,
  MonitorPlay,
  Music,
  Package,
  Palette,
  PawPrint,
  Percent,
  PiggyBank,
  Pill,
  Plane,
  Popcorn,
  Receipt,
  Repeat,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sofa,
  SprayCan,
  SquareParking,
  Stamp,
  Stethoscope,
  Ticket,
  TrainFront,
  TrendingUp,
  Undo2,
  Users,
  UtensilsCrossed,
  Volleyball,
  Wallet,
  WashingMachine,
  Wifi,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Mapa explícito (no dinámico) para que el bundler pueda hacer tree-shaking. */
const ICONS: Record<string, LucideIcon> = { ArrowLeftRight, Award, Baby, BadgePercent, Banknote, Bike, BookOpen, Brain, Briefcase, Building, Building2, Car, CarTaxiFront, ChartPie, Clapperboard, Coffee, Cog, Coins, Cookie, CreditCard, Croissant, Droplet, Dumbbell, Ellipsis, FileText, Flame, Footprints, Fuel, Gamepad2, Gift, Glasses, GraduationCap, Hammer, HandCoins, HeartPulse, Hotel, House, Landmark, Languages, Laptop, Milestone, MonitorPlay, Music, Package, Palette, PawPrint, Percent, PiggyBank, Pill, Plane, Popcorn, Receipt, Repeat, Scissors, ShieldCheck, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sofa, SprayCan, SquareParking, Stamp, Stethoscope, Ticket, TrainFront, TrendingUp, Undo2, Users, UtensilsCrossed, Volleyball, Wallet, WashingMachine, Wifi, Wine, Wrench, Zap }

export function CategoryIcon({
  icon, color, size = 'md', className,
}: {
  icon: string
  color: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const Icon = ICONS[icon] ?? Ellipsis
  const box = {
    xs: 'h-6 w-6 rounded-[7px]',
    sm: 'h-8 w-8 rounded-[10px]',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-12 w-12 rounded-2xl',
  }[size]
  const glyph = { xs: 13, sm: 15, md: 18, lg: 22 }[size]

  return (
    <div
      className={cn('flex shrink-0 items-center justify-center', box, className)}
      // Icono a color pleno sobre un fondo del mismo tono al 18%: legible
      // sobre negro sin gritar, como los iconos de Apple Wallet.
      style={{ backgroundColor: `${color}2E`, color }}
    >
      <Icon size={glyph} strokeWidth={2.1} />
    </div>
  )
}
