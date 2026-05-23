import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../LanguageSwitcher'

function AppHeader({ theme, onToggleTheme, onLogout, userName }) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="surface-card relative z-40 mb-3 flex w-full items-center justify-between px-4 py-3 lg:mb-4 lg:px-5 lg:py-4">
      <h1 className="text-accent font-serif text-3xl font-semibold tracking-[0.16em] lg:text-4xl">BAKE FLOW</h1>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleTheme}
          className="rounded-md border border-slate-300/70 bg-white/70 px-2 py-1 text-xs text-slate-700"
        >
          {t('dashboard.header.theme')}: {theme}
        </button>
        <LanguageSwitcher />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white/80 px-3 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-white"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="8" r="4" />
              </svg>
            </span>
            <span className="block leading-tight">{userName || t('dashboard.header.user')}</span>
          </button>

          {menuOpen ? (
            <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                {t('dashboard.header.profile')}
              </button>
              <button
                type="button"
                className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={onLogout}
              >
                {t('dashboard.header.logout')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default AppHeader
