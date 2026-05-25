import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const authApi = axios.create({
  baseURL,
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

let refreshPromise = null

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise

  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) {
    throw new Error('No refresh token')
  }

  refreshPromise = authApi
    .post('/auth/refresh', { refreshToken })
    .then(({ data }) => {
      if (!data?.accessToken || !data?.refreshToken) {
        throw new Error('Invalid refresh response')
      }
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      return data.accessToken
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isUnauthorized = error?.response?.status === 401
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh')

    if (!isUnauthorized || !originalRequest || originalRequest._retry || isRefreshCall) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const newAccessToken = await refreshAccessToken()
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login'
      }
      return Promise.reject(refreshError)
    }
  }
)

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

export function getIngredients() {
  return api.get('/ingredients')
}

export function deleteIngredient(id) {
  return api.delete(`/ingredients/${id}`)
}

export function createIngredient(payload) {
  return api.post('/ingredients', payload)
}

export function updateIngredient(id, payload) {
  return api.put(`/ingredients/${id}`, payload)
}

export function uploadIngredientImage(id, file) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/ingredients/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function getRecipes(type) {
  return api.get('/recipes', {
    params: type ? { type } : undefined,
  })
}

export function createRecipe(payload) {
  return api.post('/recipes', payload)
}

export function updateRecipe(id, payload) {
  return api.put(`/recipes/${id}`, payload)
}

export function deleteRecipe(id) {
  return api.delete(`/recipes/${id}`)
}

export function addRecipeStep(recipeId, payload) {
  return api.post(`/recipes/${recipeId}/steps`, payload)
}

export function updateRecipeStep(recipeId, stepId, payload) {
  return api.put(`/recipes/${recipeId}/steps/${stepId}`, payload)
}

export function deleteRecipeStep(recipeId, stepId) {
  return api.delete(`/recipes/${recipeId}/steps/${stepId}`)
}

export function addRecipeIngredient(recipeId, payload) {
  return api.post(`/recipes/${recipeId}/ingredients`, payload)
}

export function deleteRecipeIngredient(recipeId, ingredientId) {
  return api.delete(`/recipes/${recipeId}/ingredients/${ingredientId}`)
}

export function addRecipeComponent(recipeId, payload) {
  return api.post(`/recipes/${recipeId}/components`, payload)
}

export function deleteRecipeComponent(recipeId, childRecipeId) {
  return api.delete(`/recipes/${recipeId}/components/${childRecipeId}`)
}

export function uploadRecipeMainImage(recipeId, file) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/recipes/${recipeId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function uploadRecipeStepImage(recipeId, stepId, file) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/recipes/${recipeId}/steps/${stepId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export default api
