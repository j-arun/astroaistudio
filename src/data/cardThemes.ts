import {
  Briefcase,
  Coins,
  Compass,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  type LucideIcon,
} from 'lucide-react';
import { CardDomain } from '../types/astro';

export interface CardTheme {
  id: CardDomain;
  label: string;
  tagline: string;
  icon: LucideIcon;
  // Translucent glassmorphic surface
  surfaceGradient: string;
  backSurfaceGradient: string;
  ambientGlow: string;
  borderClass: string;
  activeBorderClass: string;
  accentText: string;
  mutedAccentText: string;
  badgeClass: string;
  buttonClass: string;
  focusBorderClass: string;
  selectorActiveClass: string;
}

export const CARD_THEMES: Record<CardDomain, CardTheme> = {
  Love: {
    id: 'Love',
    label: 'Love',
    tagline: 'Romance & Connection',
    icon: Heart,
    surfaceGradient:
      'bg-gradient-to-br from-rose-500/[0.15] via-pink-500/[0.06] to-fuchsia-950/[0.18] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-rose-500/[0.19] via-fuchsia-950/[0.16] to-slate-950/[0.45] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(244, 114, 182, 0.18), transparent 55%)',
    borderClass: 'border-rose-300/25',
    activeBorderClass: 'border-rose-300/60 shadow-[0_0_28px_-6px_rgba(244,114,182,0.35)]',
    accentText: 'text-rose-200',
    mutedAccentText: 'text-rose-300/80',
    badgeClass: 'bg-rose-400/15 text-rose-200 border border-rose-300/30',
    buttonClass: 'bg-rose-300/90 hover:bg-rose-200 text-[#1A0E14]',
    focusBorderClass: 'focus:border-rose-300/70',
    selectorActiveClass: 'bg-rose-400/20 text-rose-100 border-rose-300/60',
  },
  Career: {
    id: 'Career',
    label: 'Career',
    tagline: 'Vocation & Trajectory',
    icon: Briefcase,
    surfaceGradient:
      'bg-gradient-to-br from-amber-400/[0.12] via-slate-700/[0.14] to-indigo-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-amber-400/[0.16] via-slate-900/[0.28] to-indigo-950/[0.35] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(212, 168, 83, 0.18), transparent 55%)',
    borderClass: 'border-amber-300/25',
    activeBorderClass: 'border-amber-300/65 shadow-[0_0_28px_-6px_rgba(212,168,83,0.32)]',
    accentText: 'text-amber-200',
    mutedAccentText: 'text-amber-300/80',
    badgeClass: 'bg-amber-400/15 text-amber-200 border border-amber-300/30',
    buttonClass: 'bg-[#D4A853] hover:bg-[#E2BA6A] text-[#111318]',
    focusBorderClass: 'focus:border-amber-300/70',
    selectorActiveClass: 'bg-amber-400/20 text-amber-100 border-amber-300/60',
  },
  Financial: {
    id: 'Financial',
    label: 'Financial',
    tagline: 'Wealth & Capital',
    icon: Coins,
    surfaceGradient:
      'bg-gradient-to-br from-emerald-500/[0.14] via-teal-900/[0.10] to-emerald-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-emerald-500/[0.18] via-emerald-950/[0.26] to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(52, 211, 153, 0.16), transparent 55%)',
    borderClass: 'border-emerald-300/25',
    activeBorderClass: 'border-emerald-300/60 shadow-[0_0_28px_-6px_rgba(52,211,153,0.3)]',
    accentText: 'text-emerald-200',
    mutedAccentText: 'text-emerald-300/80',
    badgeClass: 'bg-emerald-400/15 text-emerald-200 border border-emerald-300/30',
    buttonClass: 'bg-emerald-300/90 hover:bg-emerald-200 text-[#0B1713]',
    focusBorderClass: 'focus:border-emerald-300/70',
    selectorActiveClass: 'bg-emerald-400/20 text-emerald-100 border-emerald-300/60',
  },
  Finance: {
    id: 'Financial',
    label: 'Financial',
    tagline: 'Wealth & Capital',
    icon: Coins,
    surfaceGradient:
      'bg-gradient-to-br from-emerald-500/[0.14] via-teal-900/[0.10] to-emerald-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-emerald-500/[0.18] via-emerald-950/[0.26] to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(52, 211, 153, 0.16), transparent 55%)',
    borderClass: 'border-emerald-300/25',
    activeBorderClass: 'border-emerald-300/60 shadow-[0_0_28px_-6px_rgba(52,211,153,0.3)]',
    accentText: 'text-emerald-200',
    mutedAccentText: 'text-emerald-300/80',
    badgeClass: 'bg-emerald-400/15 text-emerald-200 border border-emerald-300/30',
    buttonClass: 'bg-emerald-300/90 hover:bg-emerald-200 text-[#0B1713]',
    focusBorderClass: 'focus:border-emerald-300/70',
    selectorActiveClass: 'bg-emerald-400/20 text-emerald-100 border-emerald-300/60',
  },
  Education: {
    id: 'Education',
    label: 'Education',
    tagline: 'Study & Mastery',
    icon: GraduationCap,
    surfaceGradient:
      'bg-gradient-to-br from-sky-400/[0.14] via-indigo-500/[0.08] to-blue-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-sky-400/[0.18] via-indigo-950/[0.24] to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(56, 189, 248, 0.17), transparent 55%)',
    borderClass: 'border-sky-300/25',
    activeBorderClass: 'border-sky-300/60 shadow-[0_0_28px_-6px_rgba(56,189,248,0.32)]',
    accentText: 'text-sky-200',
    mutedAccentText: 'text-sky-300/80',
    badgeClass: 'bg-sky-400/15 text-sky-200 border border-sky-300/30',
    buttonClass: 'bg-sky-300/90 hover:bg-sky-200 text-[#0B1520]',
    focusBorderClass: 'focus:border-sky-300/70',
    selectorActiveClass: 'bg-sky-400/20 text-sky-100 border-sky-300/60',
  },
  Health: {
    id: 'Health',
    label: 'Health',
    tagline: 'Vitality & Balance',
    icon: HeartPulse,
    surfaceGradient:
      'bg-gradient-to-br from-teal-400/[0.14] via-cyan-500/[0.07] to-teal-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-teal-400/[0.18] via-teal-950/[0.26] to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(45, 212, 191, 0.17), transparent 55%)',
    borderClass: 'border-teal-300/25',
    activeBorderClass: 'border-teal-300/60 shadow-[0_0_28px_-6px_rgba(45,212,191,0.3)]',
    accentText: 'text-teal-200',
    mutedAccentText: 'text-teal-300/80',
    badgeClass: 'bg-teal-400/15 text-teal-200 border border-teal-300/30',
    buttonClass: 'bg-teal-300/90 hover:bg-teal-200 text-[#091817]',
    focusBorderClass: 'focus:border-teal-300/70',
    selectorActiveClass: 'bg-teal-400/20 text-teal-100 border-teal-300/60',
  },
  Family: {
    id: 'Family',
    label: 'Family',
    tagline: 'Home & Kinship',
    icon: Home,
    surfaceGradient:
      'bg-gradient-to-br from-orange-400/[0.14] via-amber-500/[0.07] to-stone-900/[0.24] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-orange-400/[0.18] via-stone-900/[0.28] to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(251, 146, 60, 0.17), transparent 55%)',
    borderClass: 'border-orange-300/25',
    activeBorderClass: 'border-orange-300/60 shadow-[0_0_28px_-6px_rgba(251,146,60,0.3)]',
    accentText: 'text-orange-200',
    mutedAccentText: 'text-orange-300/80',
    badgeClass: 'bg-orange-400/15 text-orange-200 border border-orange-300/30',
    buttonClass: 'bg-orange-300/90 hover:bg-orange-200 text-[#1C110B]',
    focusBorderClass: 'focus:border-orange-300/70',
    selectorActiveClass: 'bg-orange-400/20 text-orange-100 border-orange-300/60',
  },
  Travel: {
    id: 'Travel',
    label: 'Travel',
    tagline: 'Horizons & Journeys',
    icon: Compass,
    surfaceGradient:
      'bg-gradient-to-br from-violet-400/[0.14] via-purple-500/[0.07] to-slate-950/[0.24] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-violet-400/[0.18] via-purple-950/[0.26] to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(167, 139, 250, 0.17), transparent 55%)',
    borderClass: 'border-violet-300/25',
    activeBorderClass: 'border-violet-300/60 shadow-[0_0_28px_-6px_rgba(167,139,250,0.3)]',
    accentText: 'text-violet-200',
    mutedAccentText: 'text-violet-300/80',
    badgeClass: 'bg-violet-400/15 text-violet-200 border border-violet-300/30',
    buttonClass: 'bg-violet-300/90 hover:bg-violet-200 text-[#140F20]',
    focusBorderClass: 'focus:border-violet-300/70',
    selectorActiveClass: 'bg-violet-400/20 text-violet-100 border-violet-300/60',
  },
};

export function getCardTheme(domain: CardDomain | string): CardTheme {
  if (domain in CARD_THEMES) {
    return CARD_THEMES[domain as CardDomain];
  }
  return CARD_THEMES.Career;
}
