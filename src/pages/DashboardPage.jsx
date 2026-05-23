import { useTranslation } from 'react-i18next'

function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="text-primary mb-2 font-serif text-2xl">{t('dashboard.title')}</h2>
      <p className="text-muted text-sm">{t('dashboard.placeholder')}</p>
    </div>
  )
}

export default DashboardPage
