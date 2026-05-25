import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function AppSidebar() {
  const { t } = useTranslation()

  const items = [
    { to: '/dashboard', label: t('nav.dashboard') },
    { to: '/orders', label: t('nav.orders') },
    { to: '/products', label: t('nav.products') },
    { to: '/recipes', label: t('nav.recipes') },
    { to: '/components', label: t('nav.components') },
    { to: '/ingredients', label: t('nav.ingredients') },
    { to: '/extra-items', label: t('nav.extraItems') },
    { to: '/reports', label: t('nav.reports') },
    { to: '/settings', label: t('nav.settings') },
  ]

  return (
    <aside className="surface-card w-full p-4 lg:sticky lg:top-4 lg:h-fit">
      <p className="text-accent mb-3 text-xs font-semibold uppercase tracking-[0.14em]">{t('app.name')}</p>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (
              `block rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-sky-100/70 text-sky-900 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100/70'
              }`
            )}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default AppSidebar
