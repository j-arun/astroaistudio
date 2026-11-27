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
      'bg-gradient-to-br from-rose-50/95 via-white/95 to-pink-100/75 dark:from-rose-500/[0.15] dark:via-pink-500/[0.06] dark:to-fuchsia-950/[0.18] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-rose-100/90 via-white/95 to-fuchsia-100/70 dark:from-rose-500/[0.19] dark:via-fuchsia-950/[0.16] dark:to-slate-950/[0.45] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(244, 114, 182, 0.16), transparent 55%)',
    borderClass: 'border-rose-300/70 dark:border-rose-300/25',
    activeBorderClass:
      'border-rose-400/80 dark:border-rose-300/60 shadow-[0_10px_28px_-8px_rgba(244,114,182,0.28)] dark:shadow-[0_0_28px_-6px_rgba(244,114,182,0.35)]',
    accentText: 'text-rose-700 dark:text-rose-200',
    mutedAccentText: 'text-rose-600/90 dark:text-rose-300/80',
    badgeClass:
      'bg-rose-100 text-rose-800 border border-rose-300/70 dark:bg-rose-400/15 dark:text-rose-200 dark:border-rose-300/30',
    buttonClass:
      'bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-300/90 dark:hover:bg-rose-200 dark:text-[#1A0E14]',
    focusBorderClass: 'focus:border-rose-500 dark:focus:border-rose-300/70',
    selectorActiveClass:
      'bg-rose-100 text-rose-900 border-rose-400 dark:bg-rose-400/20 dark:text-rose-100 dark:border-rose-300/60',
  },
  Career: {
    id: 'Career',
    label: 'Career',
    tagline: 'Vocation & Trajectory',
    icon: Briefcase,
    surfaceGradient:
      'bg-gradient-to-br from-amber-50/95 via-white/95 to-slate-100/80 dark:from-amber-400/[0.12] dark:via-slate-700/[0.14] dark:to-indigo-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-amber-100/85 via-white/95 to-slate-100/80 dark:from-amber-400/[0.16] dark:via-slate-900/[0.28] dark:to-indigo-950/[0.35] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(212, 168, 83, 0.16), transparent 55%)',
    borderClass: 'border-amber-300/75 dark:border-amber-300/25',
    activeBorderClass:
      'border-amber-500/80 dark:border-amber-300/65 shadow-[0_10px_28px_-8px_rgba(212,168,83,0.26)] dark:shadow-[0_0_28px_-6px_rgba(212,168,83,0.32)]',
    accentText: 'text-amber-800 dark:text-amber-200',
    mutedAccentText: 'text-amber-700/90 dark:text-amber-300/80',
    badgeClass:
      'bg-amber-100 text-amber-900 border border-amber-300/80 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-300/30',
    buttonClass: 'bg-[#D4A853] hover:bg-[#E2BA6A] text-[#111318]',
    focusBorderClass: 'focus:border-amber-600 dark:focus:border-amber-300/70',
    selectorActiveClass:
      'bg-amber-100 text-amber-900 border-amber-500 dark:bg-amber-400/20 dark:text-amber-100 dark:border-amber-300/60',
  },
  Financial: {
    id: 'Financial',
    label: 'Financial',
    tagline: 'Wealth & Capital',
    icon: Coins,
    surfaceGradient:
      'bg-gradient-to-br from-emerald-50/95 via-white/95 to-teal-100/70 dark:from-emerald-500/[0.14] dark:via-teal-900/[0.10] dark:to-emerald-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-emerald-100/85 via-white/95 to-teal-100/75 dark:from-emerald-500/[0.18] dark:via-emerald-950/[0.26] dark:to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(52, 211, 153, 0.15), transparent 55%)',
    borderClass: 'border-emerald-300/70 dark:border-emerald-300/25',
    activeBorderClass:
      'border-emerald-500/75 dark:border-emerald-300/60 shadow-[0_10px_28px_-8px_rgba(16,185,129,0.24)] dark:shadow-[0_0_28px_-6px_rgba(52,211,153,0.3)]',
    accentText: 'text-emerald-800 dark:text-emerald-200',
    mutedAccentText: 'text-emerald-700/90 dark:text-emerald-300/80',
    badgeClass:
      'bg-emerald-100 text-emerald-900 border border-emerald-300/75 dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-300/30',
    buttonClass:
      'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-300/90 dark:hover:bg-emerald-200 dark:text-[#0B1713]',
    focusBorderClass: 'focus:border-emerald-600 dark:focus:border-emerald-300/70',
    selectorActiveClass:
      'bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-400/20 dark:text-emerald-100 dark:border-emerald-300/60',
  },
  Finance: {
    id: 'Financial',
    label: 'Financial',
    tagline: 'Wealth & Capital',
    icon: Coins,
    surfaceGradient:
      'bg-gradient-to-br from-emerald-50/95 via-white/95 to-teal-100/70 dark:from-emerald-500/[0.14] dark:via-teal-900/[0.10] dark:to-emerald-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-emerald-100/85 via-white/95 to-teal-100/75 dark:from-emerald-500/[0.18] dark:via-emerald-950/[0.26] dark:to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(52, 211, 153, 0.15), transparent 55%)',
    borderClass: 'border-emerald-300/70 dark:border-emerald-300/25',
    activeBorderClass:
      'border-emerald-500/75 dark:border-emerald-300/60 shadow-[0_10px_28px_-8px_rgba(16,185,129,0.24)] dark:shadow-[0_0_28px_-6px_rgba(52,211,153,0.3)]',
    accentText: 'text-emerald-800 dark:text-emerald-200',
    mutedAccentText: 'text-emerald-700/90 dark:text-emerald-300/80',
    badgeClass:
      'bg-emerald-100 text-emerald-900 border border-emerald-300/75 dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-300/30',
    buttonClass:
      'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-300/90 dark:hover:bg-emerald-200 dark:text-[#0B1713]',
    focusBorderClass: 'focus:border-emerald-600 dark:focus:border-emerald-300/70',
    selectorActiveClass:
      'bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-400/20 dark:text-emerald-100 dark:border-emerald-300/60',
  },
  Education: {
    id: 'Education',
    label: 'Education',
    tagline: 'Study & Mastery',
    icon: GraduationCap,
    surfaceGradient:
      'bg-gradient-to-br from-sky-50/95 via-white/95 to-indigo-100/70 dark:from-sky-400/[0.14] dark:via-indigo-500/[0.08] dark:to-blue-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-sky-100/85 via-white/95 to-indigo-100/75 dark:from-sky-400/[0.18] dark:via-indigo-950/[0.24] dark:to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(56, 189, 248, 0.15), transparent 55%)',
    borderClass: 'border-sky-300/70 dark:border-sky-300/25',
    activeBorderClass:
      'border-sky-500/75 dark:border-sky-300/60 shadow-[0_10px_28px_-8px_rgba(14,165,233,0.24)] dark:shadow-[0_0_28px_-6px_rgba(56,189,248,0.32)]',
    accentText: 'text-sky-800 dark:text-sky-200',
    mutedAccentText: 'text-sky-700/90 dark:text-sky-300/80',
    badgeClass:
      'bg-sky-100 text-sky-900 border border-sky-300/75 dark:bg-sky-400/15 dark:text-sky-200 dark:border-sky-300/30',
    buttonClass:
      'bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-300/90 dark:hover:bg-sky-200 dark:text-[#0B1520]',
    focusBorderClass: 'focus:border-sky-600 dark:focus:border-sky-300/70',
    selectorActiveClass:
      'bg-sky-100 text-sky-900 border-sky-500 dark:bg-sky-400/20 dark:text-sky-100 dark:border-sky-300/60',
  },
  Health: {
    id: 'Health',
    label: 'Health',
    tagline: 'Vitality & Balance',
    icon: HeartPulse,
    surfaceGradient:
      'bg-gradient-to-br from-teal-50/95 via-white/95 to-cyan-100/70 dark:from-teal-400/[0.14] dark:via-cyan-500/[0.07] dark:to-teal-950/[0.22] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-teal-100/85 via-white/95 to-cyan-100/75 dark:from-teal-400/[0.18] dark:via-teal-950/[0.26] dark:to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(45, 212, 191, 0.15), transparent 55%)',
    borderClass: 'border-teal-300/70 dark:border-teal-300/25',
    activeBorderClass:
      'border-teal-500/75 dark:border-teal-300/60 shadow-[0_10px_28px_-8px_rgba(20,184,166,0.24)] dark:shadow-[0_0_28px_-6px_rgba(45,212,191,0.3)]',
    accentText: 'text-teal-800 dark:text-teal-200',
    mutedAccentText: 'text-teal-700/90 dark:text-teal-300/80',
    badgeClass:
      'bg-teal-100 text-teal-900 border border-teal-300/75 dark:bg-teal-400/15 dark:text-teal-200 dark:border-teal-300/30',
    buttonClass:
      'bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-300/90 dark:hover:bg-teal-200 dark:text-[#091817]',
    focusBorderClass: 'focus:border-teal-600 dark:focus:border-teal-300/70',
    selectorActiveClass:
      'bg-teal-100 text-teal-900 border-teal-500 dark:bg-teal-400/20 dark:text-teal-100 dark:border-teal-300/60',
  },
  Family: {
    id: 'Family',
    label: 'Family',
    tagline: 'Home & Kinship',
    icon: Home,
    surfaceGradient:
      'bg-gradient-to-br from-orange-50/95 via-white/95 to-amber-100/70 dark:from-orange-400/[0.14] dark:via-amber-500/[0.07] dark:to-stone-900/[0.24] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-orange-100/85 via-white/95 to-amber-100/75 dark:from-orange-400/[0.18] dark:via-stone-900/[0.28] dark:to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(251, 146, 60, 0.15), transparent 55%)',
    borderClass: 'border-orange-300/70 dark:border-orange-300/25',
    activeBorderClass:
      'border-orange-500/75 dark:border-orange-300/60 shadow-[0_10px_28px_-8px_rgba(249,115,22,0.24)] dark:shadow-[0_0_28px_-6px_rgba(251,146,60,0.3)]',
    accentText: 'text-orange-800 dark:text-orange-200',
    mutedAccentText: 'text-orange-700/90 dark:text-orange-300/80',
    badgeClass:
      'bg-orange-100 text-orange-900 border border-orange-300/75 dark:bg-orange-400/15 dark:text-orange-200 dark:border-orange-300/30',
    buttonClass:
      'bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-300/90 dark:hover:bg-orange-200 dark:text-[#1C110B]',
    focusBorderClass: 'focus:border-orange-600 dark:focus:border-orange-300/70',
    selectorActiveClass:
      'bg-orange-100 text-orange-900 border-orange-500 dark:bg-orange-400/20 dark:text-orange-100 dark:border-orange-300/60',
  },
  Travel: {
    id: 'Travel',
    label: 'Travel',
    tagline: 'Horizons & Journeys',
    icon: Compass,
    surfaceGradient:
      'bg-gradient-to-br from-violet-50/95 via-white/95 to-purple-100/70 dark:from-violet-400/[0.14] dark:via-purple-500/[0.07] dark:to-slate-950/[0.24] backdrop-blur-xl',
    backSurfaceGradient:
      'bg-gradient-to-br from-violet-100/85 via-white/95 to-purple-100/75 dark:from-violet-400/[0.18] dark:via-purple-950/[0.26] dark:to-slate-950/[0.42] backdrop-blur-xl',
    ambientGlow:
      'radial-gradient(circle at 85% 15%, rgba(167, 139, 250, 0.15), transparent 55%)',
    borderClass: 'border-violet-300/70 dark:border-violet-300/25',
    activeBorderClass:
      'border-violet-500/75 dark:border-violet-300/60 shadow-[0_10px_28px_-8px_rgba(139,92,246,0.24)] dark:shadow-[0_0_28px_-6px_rgba(167,139,250,0.3)]',
    accentText: 'text-violet-800 dark:text-violet-200',
    mutedAccentText: 'text-violet-700/90 dark:text-violet-300/80',
    badgeClass:
      'bg-violet-100 text-violet-900 border border-violet-300/75 dark:bg-violet-400/15 dark:text-violet-200 dark:border-violet-300/30',
    buttonClass:
      'bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-300/90 dark:hover:bg-violet-200 dark:text-[#140F20]',
    focusBorderClass: 'focus:border-violet-600 dark:focus:border-violet-300/70',
    selectorActiveClass:
      'bg-violet-100 text-violet-900 border-violet-500 dark:bg-violet-400/20 dark:text-violet-100 dark:border-violet-300/60',
  },
};

export function getCardTheme(domain: CardDomain | string): CardTheme {
  if (domain in CARD_THEMES) {
    return CARD_THEMES[domain as CardDomain];
  }
  return CARD_THEMES.Career;
}
