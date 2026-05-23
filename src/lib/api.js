import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

export function register(payload) {
  return api.post('/auth/register', payload)
}

export function login(payload) {
  return api.post('/auth/login', payload)
}

export default api
