/**
 * Theme & Color Palette Manager for RP-AI Interview Assistant
 * Supports 8 distinctive artisanal editorial themes:
 * 1. linen-olive (Default Warm Linen Canvas & Deep Olive)
 * 2. slate-sage (Cool Editorial & Sage Forest)
 * 3. terracotta-dune (Desert Terracotta & Warm Sand Dune)
 * 4. nocturne-olive (Dark Studio Canvas & Olive Glow)
 * 5. espresso-oat (Rich Coffee Roast & Warm Oatmeal)
 * 6. indigo-parchment (Oxford Indigo & Tailored Denim)
 * 7. burgundy-tweed (Heritage Bordeaux & Rose Tweed)
 * 8. nordic-moss (Nordic Pine Forest Dark Mode)
 */

export type ThemeId =
  | 'linen-olive'
  | 'slate-sage'
  | 'terracotta-dune'
  | 'nocturne-olive'
  | 'espresso-oat'
  | 'indigo-parchment'
  | 'burgundy-tweed'
  | 'nordic-moss'

export interface ThemeOption {
  id: ThemeId
  name: string
  description: string
  isDark?: boolean
  previewColors: {
    bg: string
    card: string
    primary: string
    accent: string
    text: string
  }
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'linen-olive',
    name: 'Linen & Olive',
    description: 'Warm tactile linen canvas, deep olive primary, and terracotta accents.',
    isDark: false,
    previewColors: {
      bg: '#E8DDC8',
      card: '#F5F0E5',
      primary: '#596044',
      accent: '#A4775C',
      text: '#303329',
    },
  },
  {
    id: 'slate-sage',
    name: 'Slate & Sage',
    description: 'Cool misty parchment, pale sage white card, and amber contrast.',
    isDark: false,
    previewColors: {
      bg: '#DFE5E0',
      card: '#F0F5F1',
      primary: '#486350',
      accent: '#C07D3E',
      text: '#222E25',
    },
  },
  {
    id: 'terracotta-dune',
    name: 'Terracotta & Dune',
    description: 'Warm desert sand, terracotta earth tones, and warm alabaster cards.',
    isDark: false,
    previewColors: {
      bg: '#EFE4D6',
      card: '#FAF5EE',
      primary: '#8C4A32',
      accent: '#BA5D3F',
      text: '#382B24',
    },
  },
  {
    id: 'nocturne-olive',
    name: 'Nocturne Olive',
    description: 'Dark slate-olive studio surface with bright sage accents and warm ivory type.',
    isDark: true,
    previewColors: {
      bg: '#1A1D17',
      card: '#242820',
      primary: '#8EA473',
      accent: '#D4956B',
      text: '#EAE3D2',
    },
  },
  {
    id: 'espresso-oat',
    name: 'Espresso & Oat',
    description: 'Dark roast espresso, cashmere cream cards, and warm bronze clay.',
    isDark: false,
    previewColors: {
      bg: '#E5DDD1',
      card: '#F6F1EA',
      primary: '#4A3528',
      accent: '#9C6644',
      text: '#2C1E16',
    },
  },
  {
    id: 'indigo-parchment',
    name: 'Indigo & Parchment',
    description: 'Tailored Oxford cloth paper, deep midnight navy, and burnished amber.',
    isDark: false,
    previewColors: {
      bg: '#E2E6EC',
      card: '#F2F5F9',
      primary: '#2B4468',
      accent: '#B86B35',
      text: '#1C293D',
    },
  },
  {
    id: 'burgundy-tweed',
    name: 'Burgundy & Tweed',
    description: 'Heritage Bordeaux wine, rosewater tweed card surfaces, and mulberry ochre.',
    isDark: false,
    previewColors: {
      bg: '#E9DFDF',
      card: '#F7F2F2',
      primary: '#6E2E39',
      accent: '#A85A48',
      text: '#33181C',
    },
  },
  {
    id: 'nordic-moss',
    name: 'Nordic Moss & Pine',
    description: 'Deep Scandinavian emerald pine dark studio with glowing amber spruce.',
    isDark: true,
    previewColors: {
      bg: '#161F1A',
      card: '#1F2C24',
      primary: '#76A786',
      accent: '#D99B52',
      text: '#E4EDE7',
    },
  },
]

const THEME_STORAGE_KEY = 'rp_ai_theme'

export function getActiveTheme(): ThemeId {
  if (typeof window === 'undefined') return 'linen-olive'
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId
    if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
      return saved
    }
  } catch {
    // Fall back to default
  }
  return 'linen-olive'
}

export function applyTheme(themeId: ThemeId): void {
  if (typeof document === 'undefined') return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId)
    document.documentElement.setAttribute('data-theme', themeId)
    document.body.setAttribute('data-theme', themeId)
  } catch (err) {
    console.error('Failed to apply theme:', err)
  }
}

export function initTheme(): void {
  const current = getActiveTheme()
  applyTheme(current)
}
