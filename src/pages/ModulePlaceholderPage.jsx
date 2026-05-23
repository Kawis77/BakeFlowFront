import { useTranslation } from 'react-i18next'

function ModulePlaceholderPage({ titleKey }) {
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="text-primary mb-2 font-serif text-2xl">{t(titleKey)}</h2>
      <p className="text-muted text-sm">This module will be implemented in the next step.</p>
    </div>
  )
}

export default ModulePlaceholderPage
