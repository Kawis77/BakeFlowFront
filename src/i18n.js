import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/common.json'
import pl from './locales/pl/common.json'
import es from './locales/es/common.json'
import uk from './locales/uk/common.json'

const supportedLanguages = ['en', 'pl', 'es', 'uk']

const storedLanguage = localStorage.getItem('bakeflow-lang')
const browserLanguage = navigator.language?.slice(0, 2)
const initialLanguage = supportedLanguages.includes(storedLanguage)
  ? storedLanguage
  : supportedLanguages.includes(browserLanguage)
    ? browserLanguage
    : 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
    es: { translation: es },
    uk: { translation: uk },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

i18n.on('languageChanged', (language) => {
  localStorage.setItem('bakeflow-lang', language)
})

export default i18n
