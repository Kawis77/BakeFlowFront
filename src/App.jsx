import { Navigate, Route, Routes } from 'react-router-dom'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AppLayout from './layouts/AppLayout'
import ModulePlaceholderPage from './pages/ModulePlaceholderPage'
import IngredientsPage from './pages/IngredientsPage'
import RecipesPage from './pages/RecipesPage'

function hasAccessToken() {
  return Boolean(localStorage.getItem('accessToken'))
}

function ProtectedRoute({ children }) {
  return hasAccessToken() ? children : <Navigate to="/login" replace />
}

function GuestRoute({ children }) {
  return hasAccessToken() ? <Navigate to="/dashboard" replace /> : children
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        )}
      />
      <Route
        path="/register"
        element={(
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        )}
      />
      <Route
        element={(
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        )}
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="orders" element={<ModulePlaceholderPage titleKey="nav.orders" />} />
        <Route path="products" element={<ModulePlaceholderPage titleKey="nav.products" />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="ingredients" element={<IngredientsPage />} />
        <Route path="extra-items" element={<ModulePlaceholderPage titleKey="nav.extraItems" />} />
        <Route path="reports" element={<ModulePlaceholderPage titleKey="nav.reports" />} />
        <Route path="settings" element={<ModulePlaceholderPage titleKey="nav.settings" />} />
      </Route>
      <Route
        path="/"
        element={(
          <Navigate to="/dashboard" replace />
        )}
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
