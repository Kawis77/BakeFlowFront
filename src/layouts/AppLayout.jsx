import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { logout, me } from '../lib/api'
import AppHeader from '../components/navigation/AppHeader'
import AppSidebar from '../components/navigation/AppSidebar'

function AppLayout() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem('bakeflow-theme') ?? 'warm')
  const [user, setUser] = useState(null)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'ocean') {
      root.setAttribute('data-theme', 'ocean')
    } else {
      root.removeAttribute('data-theme')
    }
    localStorage.setItem('bakeflow-theme', theme)
  }, [theme])

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const { data } = await me()
        setUser(data)
      } catch {
        // Keep layout usable even if profile request fails temporarily.
      }
    }
    fetchMe()
  }, [])

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')

    try {
      if (refreshToken) {
        await logout(refreshToken)
      }
    } catch {
      // Ignore API logout errors and continue local sign-out.
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      navigate('/login', { replace: true })
    }
  }

  return (
    <main className="page-bg flex min-h-screen flex-col px-3 py-3 lg:px-4">
      <AppHeader
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'warm' ? 'ocean' : 'warm'))}
        onLogout={handleLogout}
        userName={user?.username}
      />

      <div className="grid w-full flex-1 grid-cols-1 gap-3 lg:grid-cols-[260px_1fr] lg:gap-4">
        <AppSidebar />
        <section className="surface-card h-full p-8">
          <Outlet />
        </section>
      </div>
    </main>
  )
}

export default AppLayout
