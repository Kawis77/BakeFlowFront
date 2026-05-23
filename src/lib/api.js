import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function register(payload) {
  return api.post('/auth/register', payload)
}

export function login(payload) {
  return api.post('/auth/login', payload)
}

export function logout(refreshToken) {
  return api.post('/auth/logout', { refreshToken })
}

export function me() {
  return api.get('/auth/me')
}

export default api
