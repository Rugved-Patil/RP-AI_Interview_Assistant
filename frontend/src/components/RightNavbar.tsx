import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  AnalyticsIcon,
  QuestionBankIcon,
  CodeIcon,
  PresetsIcon,
  SavedReportsIcon,
  SettingsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './Icons'
import { useTranslation } from '../i18n/LanguageContext'
import './RightNavbar.css'

export function RightNavbar() {
  const location = useLocation()
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('rp_ai_nav_collapsed')
      return saved !== null ? saved === 'true' : true // Default to clean collapsed state
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('rp_ai_nav_collapsed', String(collapsed))
    } catch {
      // Ignore localStorage errors
    }
  }, [collapsed])

  const handleNavClick = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  const navItems = [
    {
      id: 'home',
      to: '/',
      label: t('nav.home', undefined, 'Home'),
      shortLabel: t('nav.home', undefined, 'Home'),
      icon: HomeIcon,
      exact: true,
    },
    {
      id: 'sandbox',
      to: '/sandbox',
      label: t('nav.sandbox', undefined, 'Coding Sandbox'),
      shortLabel: t('nav.sandbox_short', undefined, 'Sandbox'),
      icon: CodeIcon,
    },
    {
      id: 'analytics',
      to: '/analytics',
      label: t('nav.analytics', undefined, 'Analytics & Progress'),
      shortLabel: t('nav.analytics_short', undefined, 'Analytics'),
      icon: AnalyticsIcon,
    },
    {
      id: 'questions',
      to: '/questions',
      label: t('nav.questions', undefined, 'Question Bank'),
      shortLabel: t('nav.questions_short', undefined, 'Questions'),
      icon: QuestionBankIcon,
    },
    {
      id: 'presets',
      to: '/presets',
      label: t('nav.presets', undefined, 'Interview Presets'),
      shortLabel: t('nav.presets_short', undefined, 'Presets'),
      icon: PresetsIcon,
    },
    {
      id: 'reports',
      to: '/reports',
      label: t('nav.reports', undefined, 'Saved Reports'),
      shortLabel: t('nav.reports_short', undefined, 'Reports'),
      icon: SavedReportsIcon,
    },
    {
      id: 'settings',
      to: '/settings',
      label: t('nav.settings', undefined, 'Settings'),
      shortLabel: t('nav.settings', undefined, 'Settings'),
      icon: SettingsIcon,
    },
  ]

  return (
    <aside
      className={`right-nav ${collapsed ? 'right-nav--collapsed' : 'right-nav--expanded'}`}
      aria-label="Sidebar Navigation"
    >
      <div className="right-nav__header">
        <button
          type="button"
          className="right-nav__toggle-btn"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? t('nav.expand', undefined, 'Expand sidebar') : t('nav.collapse', undefined, 'Collapse sidebar')}
          aria-expanded={!collapsed}
        >
          <span className={`right-nav__toggle-icon ${collapsed ? 'right-nav__toggle-icon--collapsed' : 'right-nav__toggle-icon--expanded'}`} aria-hidden="true">
            {collapsed ? <ChevronLeftIcon width={16} height={16} /> : <ChevronRightIcon width={16} height={16} />}
          </span>
          {!collapsed && <span className="right-nav__toggle-text">{t('nav.collapse', undefined, 'Collapse Menu')}</span>}
        </button>
      </div>

      <nav className="right-nav__menu">
        {navItems.map((item) => {
          const IconComponent = item.icon
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={`right-nav__link right-nav__link--${item.id} ${isActive ? 'right-nav__link--active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className={`right-nav__link-icon right-nav__link-icon--${item.id}`} aria-hidden="true">
                <IconComponent width={18} height={18} />
              </span>
              <span className="right-nav__link-label-mobile">{item.shortLabel || item.label}</span>
              {!collapsed && <span className="right-nav__link-label right-nav__link-label--desktop">{item.label}</span>}
              {collapsed && <span className="right-nav__tooltip">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
