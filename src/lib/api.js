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

export function getRecipes() {
  return api.get('/recipes')
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
