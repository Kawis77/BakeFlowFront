import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { login } from '../lib/api'
import LanguageSwitcher from '../components/LanguageSwitcher'

const initialForm = {
  email: '',
  password: '',
}

function LoginPage() {
  const { t } = useTranslation()
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('bakeflow-theme') ?? 'warm')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'ocean') {
      root.setAttribute('data-theme', 'ocean')
    } else {
      root.removeAttribute('data-theme')
    }
    localStorage.setItem('bakeflow-theme', theme)
  }, [theme])

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { data } = await login(form)
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      setSuccess(t('auth.login.success'))
      setForm(initialForm)
    } catch (err) {
      const message = err?.response?.data?.message ?? t('auth.login.genericError')
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-bg min-h-screen px-4 py-12">
      <div className="surface-card mx-auto w-full max-w-md p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-accent text-sm font-semibold uppercase tracking-[0.16em]">{t('auth.login.badge')}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'warm' ? 'ocean' : 'warm'))}
              className="rounded-md border border-slate-300/70 bg-white/70 px-2 py-1 text-xs text-slate-700"
            >
              Theme: {theme}
            </button>
            <LanguageSwitcher />
          </div>
        </div>

        <h1 className="text-primary mb-2 font-serif text-3xl">{t('auth.login.title')}</h1>
        <p className="text-muted mb-8 text-sm">{t('auth.login.subtitle')}</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('auth.login.email')}</span>
            <input
              type="email"
              className="input-field"
              name="email"
              value={form.email}
              onChange={onChange}
              required
            />
          </label>

          <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('auth.login.password')}</span>
            <input
              type="password"
              className="input-field"
              name="password"
              value={form.password}
              onChange={onChange}
              required
            />
          </label>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

          <button type="submit" disabled={isSubmitting} className="primary-btn mt-2">
            {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        <p className="text-muted mt-6 text-sm">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="text-accent font-medium hover:underline">
            {t('auth.login.createAccount')}
          </Link>
        </p>
      </div>
    </main>
  )
}

export default LoginPage
