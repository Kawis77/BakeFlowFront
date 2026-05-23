import { useTranslation } from 'react-i18next'

function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language" className="text-xs font-medium uppercase tracking-wide text-stone-600">
        {t('language.label')}
      </label>
      <select
        id="language"
        value={i18n.language}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 outline-none focus:border-rose-400"
      >
        <option value="en">{t('language.en')}</option>
        <option value="pl">{t('language.pl')}</option>
        <option value="es">{t('language.es')}</option>
        <option value="uk">{t('language.uk')}</option>
      </select>
    </div>
  )
}

export default LanguageSwitcher
