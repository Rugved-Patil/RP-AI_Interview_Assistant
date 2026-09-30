import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import './RightNavbar.css'

interface NavItem {
  to: string
  label: string
  icon: string
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Home',
    icon: '🏠',
    exact: true,
  },
  {
    to: '/analytics',
    label: 'Analytics & Progress',
    icon: '📊',
  },
  {
    to: '/questions',
    label: 'Question Bank',
    icon: '📚',
  },
  {
    to: '/presets',
    label: 'Interview Presets',
    icon: '🏷️',
  },
  {
    to: '/reports',
    label: 'Saved Reports',
    icon: '📁',
  },
]

export function RightNavbar() {
  const location = useLocation()
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
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <span className="right-nav__toggle-icon">{collapsed ? '«' : '»'}</span>
          {!collapsed && <span className="right-nav__toggle-text">Collapse Menu</span>}
        </button>
      </div>

      <nav className="right-nav__menu">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={`right-nav__link ${isActive ? 'right-nav__link--active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="right-nav__link-icon" aria-hidden="true">
                {item.icon}
              </span>
              {!collapsed && <span className="right-nav__link-label">{item.label}</span>}
              {collapsed && <span className="right-nav__tooltip">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
