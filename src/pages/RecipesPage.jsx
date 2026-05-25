import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addRecipeComponent,
  addRecipeIngredient,
  addRecipeStep,
  createRecipe,
  deleteRecipeComponent,
  deleteRecipeIngredient,
  getIngredients,
  deleteRecipe,
  deleteRecipeStep,
  getRecipes,
  uploadRecipeMainImage,
  uploadRecipeStepImage,
  updateRecipe,
  updateRecipeStep,
} from '../lib/api'
import ImageUploadField from '../components/forms/ImageUploadField'

const categoryOptions = ['CAKE', 'PASTRY', 'DESSERT', 'OTHER']
const difficultyOptions = ['EASY', 'MEDIUM', 'HARD']
const shapeOptions = ['ROUND', 'SQUARE']
const yieldUnitOptions = ['PIECE', 'G', 'ML']
const ingredientUnitOptions = ['KG', 'G', 'L', 'ML', 'PIECE']
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
const apiOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, '')

const initialForm = {
  name: '',
  category: 'CAKE',
  description: '',
  baseDiameterCm: '',
  yieldQuantity: '',
  yieldUnit: 'PIECE',
  preparationTime: '',
  difficulty: 'MEDIUM',
  shape: 'ROUND',
  active: true,
}

const newStep = { stepOrder: '', name: '', instruction: '' }
const newIngredient = { ingredientId: '', quantity: '', unit: 'G', notes: '' }
const newComponent = { childRecipeId: '', quantityFactor: '1', scalingMode: 'DIAMETER_AREA' }

function mapStepFromApi(step, t) {
  const fallbackName = `${t('recipes.steps.defaultName')} ${step?.stepOrder ?? ''}`.trim()
  return {
    name: step?.name?.trim() || fallbackName,
    description: step?.instruction || '',
  }
}

function resolveUploadUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${apiOrigin}${path}`
}

function mapApiErrorToI18nKey(message) {
  if (!message) return null
  if (message.includes('Recipe ingredient unit category must match ingredient base unit category')) {
    return 'recipes.errors.unitCategoryMismatch'
  }
  if (message.includes('Yield unit must be one of: PIECE, G, ML')) {
    return 'recipes.errors.invalidYieldUnit'
  }
  if (message.includes('Recipe category LAYER_CAKE is not allowed')) {
    return 'recipes.errors.singleTierOnly'
  }
  return null
}

function mapFieldValidationError(field, rawMessage, t) {
  const fieldMap = {
    name: t('recipes.columns.name'),
    preparationTime: t('recipes.columns.preparationTime'),
    yieldQuantity: t('recipes.columns.yieldQuantity'),
    baseDiameterCm: t('recipes.columns.baseDiameter'),
  }

  const fieldLabel = fieldMap[field] || field
  if (rawMessage.includes('is required')) {
    return t('recipes.validation.required', { field: fieldLabel })
  }
  if (rawMessage.includes('must be greater than 0')) {
    return t('recipes.validation.positive', { field: fieldLabel })
  }
  return `${fieldLabel}: ${rawMessage}`
}

function formatRecipeApiError(rawMessage, t) {
  if (!rawMessage) return null

  const i18nKey = mapApiErrorToI18nKey(rawMessage)
  if (i18nKey) {
    return t(i18nKey)
  }

  const parts = rawMessage.split(',').map((p) => p.trim()).filter(Boolean)
  const mapped = parts.map((part) => {
    const idx = part.indexOf(':')
    if (idx === -1) return part
    const field = part.slice(0, idx).trim()
    const message = part.slice(idx + 1).trim()
    return mapFieldValidationError(field, message, t)
  })

  return mapped.join('\n')
}

function validateRecipeForm(form, t) {
  const errors = []
  const shapeEnabled = form.category === 'CAKE' || form.category === 'PASTRY'

  const requiredFieldChecks = [
    { key: 'name', label: t('recipes.columns.name') },
    { key: 'yieldQuantity', label: t('recipes.columns.yieldQuantity') },
    { key: 'preparationTime', label: t('recipes.columns.preparationTime') },
  ]

  for (const check of requiredFieldChecks) {
    const raw = form[check.key]
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      errors.push(t('recipes.validation.required', { field: check.label }))
    }
  }

  if (form.yieldQuantity && Number(form.yieldQuantity) <= 0) {
    errors.push(t('recipes.validation.positive', { field: t('recipes.columns.yieldQuantity') }))
  }

  if (form.preparationTime && Number(form.preparationTime) <= 0) {
    errors.push(t('recipes.validation.positive', { field: t('recipes.columns.preparationTime') }))
  }

  if (shapeEnabled && form.shape === 'ROUND') {
    const diameter = Number(form.baseDiameterCm)
    const field = t('recipes.columns.baseDiameter')
    if (!form.baseDiameterCm) {
      errors.push(t('recipes.validation.required', { field }))
    } else if (!Number.isFinite(diameter) || diameter <= 0) {
      errors.push(t('recipes.validation.positive', { field }))
    }
  }

  return errors
}

function mapRecipeRequest(form, recipeType) {
  const shapeEnabled = form.category === 'CAKE' || form.category === 'PASTRY'
  const normalizedShape = shapeEnabled ? form.shape : 'ROUND'
  return {
    name: form.name,
    category: form.category,
    description: form.description || null,
    baseDiameterCm: shapeEnabled && normalizedShape === 'ROUND' && form.baseDiameterCm ? Number(form.baseDiameterCm) : null,
    yieldQuantity: Number(form.yieldQuantity),
    yieldUnit: form.yieldUnit,
    preparationTime: Number(form.preparationTime),
    difficulty: form.difficulty,
    shape: normalizedShape,
    active: Boolean(form.active),
    recipeType,
  }
}

function formatMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  return amount.toFixed(2)
}

function formatRecipeCategory(value, t) {
  if (!value) return '-'
  const key = `recipes.categoryOptions.${String(value).toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

function formatRecipeDifficulty(value, t) {
  if (!value) return '-'
  const key = `recipes.difficultyOptions.${String(value).toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

function formatRecipeShape(value, t) {
  if (!value) return '-'
  const key = `recipes.shapeOptions.${String(value).toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

function formatYieldUnit(value, t) {
  if (!value) return '-'
  const key = `recipes.yieldUnitOptions.${String(value).toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

function formatQuantity(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return String(Math.round(n))
}

function RecipesPage({ recipeType = 'FINAL', moduleKey = 'recipes' }) {
  const { t } = useTranslation()
  const isFinalRecipeMode = recipeType === 'FINAL'
  const wizardLastStep = isFinalRecipeMode ? 5 : 4
  const [recipes, setRecipes] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createWizardStep, setCreateWizardStep] = useState(1)
  const [createForm, setCreateForm] = useState(initialForm)
  const [createMainImage, setCreateMainImage] = useState(null)
  const [ingredientCatalog, setIngredientCatalog] = useState([])
  const [componentCatalog, setComponentCatalog] = useState([])
  const [createIngredients, setCreateIngredients] = useState([])
  const [createIngredientForm, setCreateIngredientForm] = useState(newIngredient)
  const [createComponents, setCreateComponents] = useState([])
  const [createSteps, setCreateSteps] = useState([])
  const [createStepForm, setCreateStepForm] = useState(newStep)
  const [createError, setCreateError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateConfirm, setShowCreateConfirm] = useState(false)

  const [editItem, setEditItem] = useState(null)
  const [editWizardStep, setEditWizardStep] = useState(1)
  const [editForm, setEditForm] = useState(initialForm)
  const [editIngredientForm, setEditIngredientForm] = useState(newIngredient)
  const [editComponentForm, setEditComponentForm] = useState(newComponent)
  const [editStepForm, setEditStepForm] = useState(newStep)
  const [editError, setEditError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isUploadingMainImage, setIsUploadingMainImage] = useState(false)

  const [deleteItem, setDeleteItem] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewItem, setPreviewItem] = useState(null)

  const loadRecipes = async () => {
    const { data } = await getRecipes(recipeType)
    setRecipes(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    let mounted = true
    const fetchRecipes = async () => {
      try {
        const { data } = await getRecipes(recipeType)
        if (mounted) {
          setRecipes(Array.isArray(data) ? data : [])
          setError('')
        }
      } catch (err) {
        if (mounted) {
          setError(err?.response?.data?.message ?? t('recipes.errors.loadFailed'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    fetchRecipes()
    getIngredients().then(({ data }) => setIngredientCatalog(Array.isArray(data) ? data : [])).catch(() => {})
    if (isFinalRecipeMode) {
      getRecipes('COMPONENT').then(({ data }) => setComponentCatalog(Array.isArray(data) ? data : [])).catch(() => {})
    }
    return () => {
      mounted = false
    }
  }, [t, recipeType, isFinalRecipeMode])

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return recipes
    }
    return recipes.filter((item) => item.name?.toLowerCase().includes(q))
  }, [recipes, query])

  const handleFormChange = (setter) => (event) => {
    const { name, value, type, checked } = event.target
    setter((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const pushCreateStep = () => {
    const stepOrder = Number(createStepForm.stepOrder)
    const name = createStepForm.name.trim()
    const instruction = createStepForm.instruction.trim()
    if (!stepOrder || !name || !instruction) {
      return
    }
    setCreateSteps((prev) => [...prev, { stepOrder, name, instruction }].sort((a, b) => a.stepOrder - b.stepOrder))
    setCreateStepForm(newStep)
  }

  const removeCreateStep = (stepOrder) => {
    setCreateSteps((prev) => prev.filter((step) => step.stepOrder !== stepOrder))
  }

  const pushCreateIngredient = (formOverride) => {
    const source = formOverride || createIngredientForm
    const ingredientId = Number(source.ingredientId)
    const quantity = Number(source.quantity)
    if (!ingredientId || !quantity) {
      return
    }
    setCreateIngredients((prev) => [
      ...prev,
      {
        ingredientId,
        quantity,
        unit: source.unit,
        notes: source.notes || null,
      },
    ])
    setCreateIngredientForm(newIngredient)
  }

  const removeCreateIngredient = (index) => {
    setCreateIngredients((prev) => prev.filter((_, idx) => idx !== index))
  }

  const pushCreateComponent = (formOverride) => {
    const source = formOverride || newComponent
    const childRecipeId = Number(source.childRecipeId)
    const quantityFactor = Number(source.quantityFactor)
    if (!childRecipeId || !quantityFactor || quantityFactor <= 0) {
      return
    }

    setCreateComponents((prev) => {
      const existing = prev.find((c) => c.childRecipeId === childRecipeId)
      if (existing) {
        return prev.map((c) => (c.childRecipeId === childRecipeId ? { ...c, quantityFactor, scalingMode: source.scalingMode || 'DIAMETER_AREA' } : c))
      }
      return [...prev, { childRecipeId, quantityFactor, scalingMode: source.scalingMode || 'DIAMETER_AREA' }]
    })
  }

  const removeCreateComponent = (childRecipeId) => {
    setCreateComponents((prev) => prev.filter((c) => c.childRecipeId !== childRecipeId))
  }

  const handleCreateRecipe = async (event) => {
    event?.preventDefault?.()
    if (!showCreateConfirm) {
      return
    }

    const clientErrors = validateRecipeForm(createForm, t)
    if (clientErrors.length) {
      setCreateError(clientErrors.join('\n'))
      return
    }

    setIsCreating(true)
    setCreateError('')
    try {
      const createResponse = await createRecipe(mapRecipeRequest(createForm, recipeType))
      const recipeId = createResponse.data

      if (createMainImage) {
        await uploadRecipeMainImage(recipeId, createMainImage)
      }

      for (const ingredient of createIngredients) {
        await addRecipeIngredient(recipeId, ingredient)
      }

      for (const component of createComponents) {
        await addRecipeComponent(recipeId, component)
      }

      for (const step of createSteps) {
        const { data: stepId } = await addRecipeStep(recipeId, {
          stepOrder: step.stepOrder,
          name: step.name,
          instruction: step.instruction,
        })
        if (step.imageFile) {
          await uploadRecipeStepImage(recipeId, stepId, step.imageFile)
        }
      }

      await loadRecipes()
      setShowCreateModal(false)
      setCreateWizardStep(1)
      setCreateForm(initialForm)
      setCreateMainImage(null)
      setCreateIngredients([])
      setCreateIngredientForm(newIngredient)
      setCreateComponents([])
      setCreateSteps([])
      setCreateStepForm(newStep)
      setShowCreateConfirm(false)
    } catch (err) {
      const raw = err?.response?.data?.message
      setCreateError(formatRecipeApiError(raw, t) || t('recipes.errors.createFailed'))
    } finally {
      setIsCreating(false)
    }
  }

  const openEdit = (item) => {
    setEditItem(item)
    setEditError('')
    setEditForm({
      name: item.name ?? '',
      category: item.category ?? 'CAKE',
      description: item.description ?? '',
      baseDiameterCm: item.baseDiameterCm ?? '',
      yieldQuantity: item.yieldQuantity ?? '',
      yieldUnit: item.yieldUnit ?? 'PIECE',
      preparationTime: item.preparationTime ?? '',
      difficulty: item.difficulty ?? 'MEDIUM',
      shape: item.shape ?? 'ROUND',
      active: Boolean(item.active),
    })
    setEditWizardStep(1)
    setEditIngredientForm(newIngredient)
    setEditComponentForm(newComponent)
    setEditStepForm(newStep)
  }

  const handleEditMainImageUpload = async (file) => {
    if (!editItem || !file) return
    setIsUploadingMainImage(true)
    try {
      await uploadRecipeMainImage(editItem.id, file)
      const refreshed = (await getRecipes(recipeType)).data.find((r) => r.id === editItem.id)
      setEditItem(refreshed ?? null)
      await loadRecipes()
    } catch (err) {
      const raw = err?.response?.data?.message
      setEditError(raw ?? t('recipes.errors.imageUploadFailed'))
    } finally {
      setIsUploadingMainImage(false)
    }
  }

  const handleEditRecipe = async (event) => {
    event?.preventDefault?.()
    if (!editItem) return

    const clientErrors = validateRecipeForm(editForm, t)
    if (clientErrors.length) {
      setEditError(clientErrors.join('\n'))
      return
    }

    setIsEditing(true)
    setEditError('')
    try {
      await updateRecipe(editItem.id, mapRecipeRequest(editForm, recipeType))
      await loadRecipes()
      setEditItem(null)
      setEditWizardStep(1)
      setEditForm(initialForm)
      setEditIngredientForm(newIngredient)
      setEditComponentForm(newComponent)
      setEditStepForm(newStep)
    } catch (err) {
      const raw = err?.response?.data?.message
      setEditError(formatRecipeApiError(raw, t) || t('recipes.errors.updateFailed'))
    } finally {
      setIsEditing(false)
    }
  }

  const addStepInEdit = async (formOverride) => {
    if (!editItem) return
    const source = formOverride || editStepForm
    const stepOrder = Number(source.stepOrder)
    const name = source.name?.trim()
    const instruction = source.instruction?.trim()
    if (!stepOrder || !name || !instruction) return
    try {
      const { data: stepId } = await addRecipeStep(editItem.id, {
        stepOrder,
        name,
        instruction,
      })
      if (source.imageFile) {
        await uploadRecipeStepImage(editItem.id, stepId, source.imageFile)
      }
      const refreshed = (await getRecipes(recipeType)).data.find((r) => r.id === editItem.id)
      setEditItem(refreshed ?? null)
      setEditStepForm(newStep)
    } catch (err) {
      const raw = err?.response?.data?.message
      const i18nKey = mapApiErrorToI18nKey(raw)
      setEditError(i18nKey ? t(i18nKey) : (raw ?? t('recipes.errors.stepFailed')))
    }
  }

  const addIngredientInEdit = async (formOverride) => {
    if (!editItem) return
    const source = formOverride || editIngredientForm
    const ingredientId = Number(source.ingredientId)
    const quantity = Number(source.quantity)
    if (!ingredientId || !quantity) return
    try {
      await addRecipeIngredient(editItem.id, {
        ingredientId,
        quantity,
        unit: source.unit,
        notes: source.notes || null,
      })
      const refreshed = (await getRecipes(recipeType)).data.find((r) => r.id === editItem.id)
      setEditItem(refreshed ?? null)
      setEditIngredientForm(newIngredient)
    } catch (err) {
      const raw = err?.response?.data?.message
      const i18nKey = mapApiErrorToI18nKey(raw)
      setEditError(i18nKey ? t(i18nKey) : (raw ?? t('recipes.errors.stepFailed')))
    }
  }

  const removeIngredientInEdit = async (ingredientId) => {
    if (!editItem) return
    try {
      await deleteRecipeIngredient(editItem.id, ingredientId)
      const refreshed = (await getRecipes(recipeType)).data.find((r) => r.id === editItem.id)
      setEditItem(refreshed ?? null)
    } catch (err) {
      const raw = err?.response?.data?.message
      const i18nKey = mapApiErrorToI18nKey(raw)
      setEditError(i18nKey ? t(i18nKey) : (raw ?? t('recipes.errors.stepFailed')))
    }
  }

  const addComponentInEdit = async (formOverride) => {
    if (!editItem) return
    const source = formOverride || editComponentForm
    const childRecipeId = Number(source.childRecipeId)
    const quantityFactor = Number(source.quantityFactor)
    if (!childRecipeId || !quantityFactor || quantityFactor <= 0) return
    try {
      await addRecipeComponent(editItem.id, { childRecipeId, quantityFactor, scalingMode: source.scalingMode || 'DIAMETER_AREA' })
      const refreshed = (await getRecipes(recipeType)).data.find((r) => r.id === editItem.id)
      setEditItem(refreshed ?? null)
      setEditComponentForm(newComponent)
    } catch (err) {
      const raw = err?.response?.data?.message
      const i18nKey = mapApiErrorToI18nKey(raw)
      setEditError(i18nKey ? t(i18nKey) : (raw ?? t('recipes.errors.stepFailed')))
    }
  }

  const removeComponentInEdit = async (childRecipeId) => {
    if (!editItem) return
    try {
      await deleteRecipeComponent(editItem.id, childRecipeId)
      const refreshed = (await getRecipes(recipeType)).data.find((r) => r.id === editItem.id)
      setEditItem(refreshed ?? null)
    } catch (err) {
      const raw = err?.response?.data?.message
      const i18nKey = mapApiErrorToI18nKey(raw)
      setEditError(i18nKey ? t(i18nKey) : (raw ?? t('recipes.errors.stepFailed')))
    }
  }

  const updateStepInEdit = async (step) => {
    if (!editItem) return
    try {
      await updateRecipeStep(editItem.id, step.id, {
        stepOrder: step.stepOrder,
        name: step.name,
        instruction: step.instruction,
      })
      const refreshed = (await getRecipes(recipeType)).data.find((r) => r.id === editItem.id)
      setEditItem(refreshed ?? null)
    } catch (err) {
      const raw = err?.response?.data?.message
      const i18nKey = mapApiErrorToI18nKey(raw)
      setEditError(i18nKey ? t(i18nKey) : (raw ?? t('recipes.errors.stepFailed')))
    }
  }

  const deleteStepInEdit = async (stepId) => {
    if (!editItem) return
    try {
      await deleteRecipeStep(editItem.id, stepId)
      const refreshed = (await getRecipes(recipeType)).data.find((r) => r.id === editItem.id)
      setEditItem(refreshed ?? null)
    } catch (err) {
      setEditError(err?.response?.data?.message ?? t('recipes.errors.stepFailed'))
    }
  }

  const confirmDeleteRecipe = async () => {
    if (!deleteItem) return
    setIsDeleting(true)
    try {
      await deleteRecipe(deleteItem.id)
      setDeleteItem(null)
      await loadRecipes()
    } catch (err) {
      setError(err?.response?.data?.message ?? t('recipes.errors.deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-primary font-serif text-2xl">{t(`${moduleKey}.title`)}</h2>
          <p className="text-muted text-sm">{t(`${moduleKey}.subtitle`)}</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(`${moduleKey}.searchPlaceholder`)} className="input-field min-w-56" />
          <button type="button" className="primary-btn w-auto px-4 py-2.5 text-xs" onClick={() => setShowCreateModal(true)}>{t(`${moduleKey}.addButton`)}</button>
        </div>
      </div>

      {error ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse bg-white/80">
            <thead className="bg-slate-50/90">
              <tr>
                {['name', 'category', 'yield', 'difficulty', 'totalCost', 'active', 'actions'].map((key) => (
                  <th key={key} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t(`recipes.columns.${key}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">{t(`${moduleKey}.loading`)}</td></tr>
              ) : filteredRecipes.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">{t(`${moduleKey}.empty`)}</td></tr>
              ) : (
                filteredRecipes.map((item) => (
                  <tr key={item.id} className="cursor-pointer hover:bg-slate-50/80" onDoubleClick={() => setPreviewItem(item)}>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-800">{item.name}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatRecipeCategory(item.category, t)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.yieldQuantity} {formatYieldUnit(item.yieldUnit, t)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatRecipeDifficulty(item.difficulty, t)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatMoney(item.totalCost)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.active ? t('recipes.values.active') : t('recipes.values.inactive')}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <button type="button" className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700 hover:bg-sky-100" onClick={() => setPreviewItem(item)}>{t('recipes.actions.view')}</button>
                        <button type="button" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => openEdit(item)}>{t('recipes.actions.edit')}</button>
                        <button type="button" className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100" onClick={() => setDeleteItem(item)}>{t('recipes.actions.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel flex h-[84vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5">
            <h3 className="text-primary mb-1.5 font-serif text-lg">{isFinalRecipeMode ? t('recipes.create.title') : t('componentsModule.addButton')}</h3>
            <p className="text-muted mb-3 text-xs">{isFinalRecipeMode ? t('recipes.create.subtitle') : t('componentsModule.subtitle')}</p>
            <form onSubmit={handleCreateRecipe} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {createWizardStep === 1 ? (
                  <RecipeFormFields
                    form={createForm}
                    onChange={handleFormChange(setCreateForm)}
                    t={t}
                    mainImageFile={createMainImage}
                    onMainImageSelect={(file) => setCreateMainImage(file || null)}
                  />
                ) : null}
                {isFinalRecipeMode && createWizardStep === 2 ? <ComponentBuilder components={createComponents} recipes={componentCatalog} currentRecipeName={createForm.name} parentShape={createForm.shape} parentBaseDiameterCm={createForm.baseDiameterCm} onAdd={pushCreateComponent} onRemove={removeCreateComponent} t={t} /> : null}
                {((isFinalRecipeMode && createWizardStep === 3) || (!isFinalRecipeMode && createWizardStep === 2)) ? (
                  <IngredientBuilder
                    ingredients={createIngredients}
                    ingredientCatalog={ingredientCatalog}
                    onAdd={pushCreateIngredient}
                    onRemove={removeCreateIngredient}
                    t={t}
                  />
                ) : null}
                {((isFinalRecipeMode && createWizardStep === 4) || (!isFinalRecipeMode && createWizardStep === 3)) ? <StepBuilder steps={createSteps} setSteps={setCreateSteps} stepForm={createStepForm} setStepForm={setCreateStepForm} onAdd={pushCreateStep} onRemove={removeCreateStep} t={t} /> : null}
                {((isFinalRecipeMode && createWizardStep === 5) || (!isFinalRecipeMode && createWizardStep === 4)) ? <RecipeSummary form={createForm} ingredients={createIngredients} components={isFinalRecipeMode ? createComponents : []} steps={createSteps} ingredientCatalog={ingredientCatalog} recipes={componentCatalog} showComponents={isFinalRecipeMode} t={t} /> : null}
                {createError ? <p className="whitespace-pre-line rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p> : null}
              </div>
              <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button type="button" onClick={() => { setShowCreateModal(false); setCreateForm(initialForm); setCreateMainImage(null); setCreateIngredients([]); setCreateIngredientForm(newIngredient); setCreateComponents([]); setCreateSteps([]); setCreateStepForm(newStep); setCreateError('') }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{t('recipes.create.cancel')}</button>
                {createWizardStep > 1 ? (
                  <button type="button" onClick={() => setCreateWizardStep((prev) => prev - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{t('recipes.create.back')}</button>
                ) : null}
                {createWizardStep < wizardLastStep ? (
                  <button type="button" onClick={() => setCreateWizardStep((prev) => prev + 1)} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white">{t('recipes.create.next')}</button>
                ) : (
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => {
                      setShowCreateConfirm(true)
                    }}
                    className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isCreating ? t('recipes.create.creating') : t('recipes.create.confirmButton')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCreateConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4">
          <div className="modal-panel w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h4 className="text-primary mb-2 font-serif text-xl">{t('recipes.create.confirmTitle')}</h4>
            <p className="text-muted mb-4 text-sm">{t('recipes.create.confirmMessage')}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={() => setShowCreateConfirm(false)}>
                {t('recipes.create.confirmCancel')}
              </button>
              <button
                type="button"
                className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white"
                onClick={() => {
                  handleCreateRecipe({ preventDefault: () => {} })
                }}
              >
                {t('recipes.create.confirmProceed')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel flex h-[84vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5">
            <h3 className="text-primary mb-1.5 font-serif text-lg">{t('recipes.edit.title')}</h3>
            <p className="text-muted mb-3 text-xs">{t('recipes.edit.subtitle')}</p>
            <form onSubmit={(e) => e.preventDefault()} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {editWizardStep === 1 ? <RecipeFormFields form={editForm} onChange={handleFormChange(setEditForm)} t={t} mainImageUrl={editItem.mainImageUrl} onMainImageSelect={handleEditMainImageUpload} isUploadingMainImage={isUploadingMainImage} /> : null}
                {isFinalRecipeMode && editWizardStep === 2 ? (
                  <ComponentEditor
                    components={editItem.components ?? []}
                    recipes={componentCatalog.filter((r) => r.id !== editItem.id)}
                    parentShape={editForm.shape}
                    parentBaseDiameterCm={editForm.baseDiameterCm}
                    onAdd={addComponentInEdit}
                    onRemove={removeComponentInEdit}
                    t={t}
                  />
                ) : null}
                {((isFinalRecipeMode && editWizardStep === 3) || (!isFinalRecipeMode && editWizardStep === 2)) ? (
                  <IngredientEditor
                    ingredients={editItem.ingredients ?? []}
                    ingredientCatalog={ingredientCatalog}
                    onAdd={addIngredientInEdit}
                    onRemove={removeIngredientInEdit}
                    t={t}
                  />
                ) : null}
                {((isFinalRecipeMode && editWizardStep === 4) || (!isFinalRecipeMode && editWizardStep === 3)) ? (
                  <StepEditor
                    recipeId={editItem.id}
                    steps={editItem.steps ?? []}
                    stepForm={editStepForm}
                    onAdd={addStepInEdit}
                    onUpdate={updateStepInEdit}
                    onDelete={deleteStepInEdit}
                    t={t}
                  />
                ) : null}
                {((isFinalRecipeMode && editWizardStep === 5) || (!isFinalRecipeMode && editWizardStep === 4)) ? <RecipeSummary form={editForm} ingredients={editItem.ingredients ?? []} components={isFinalRecipeMode ? (editItem.components ?? []) : []} steps={editItem.steps ?? []} ingredientCatalog={ingredientCatalog} recipes={componentCatalog} showComponents={isFinalRecipeMode} t={t} /> : null}
                {editError ? <p className="whitespace-pre-line rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</p> : null}
              </div>
              <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button type="button" onClick={() => { setEditItem(null); setEditError('') }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{t('recipes.edit.cancel')}</button>
                {editWizardStep > 1 ? (
                  <button type="button" onClick={() => setEditWizardStep((prev) => prev - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{t('recipes.create.back')}</button>
                ) : null}
                {editWizardStep < wizardLastStep ? (
                  <button type="button" onClick={() => setEditWizardStep((prev) => prev + 1)} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white">{t('recipes.create.next')}</button>
                ) : (
                  <button type="button" onClick={handleEditRecipe} disabled={isEditing} className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">{isEditing ? t('recipes.edit.saving') : t('recipes.edit.confirmButton')}</button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-primary mb-2 font-serif text-xl">{t('recipes.delete.title')}</h3>
            <p className="text-muted mb-4 text-sm">{t('recipes.delete.confirm')} <strong>{deleteItem.name}</strong>?</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteItem(null)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{t('recipes.delete.cancel')}</button>
              <button type="button" onClick={confirmDeleteRecipe} disabled={isDeleting} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">{isDeleting ? t('recipes.delete.deleting') : t('recipes.delete.confirmButton')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {previewItem ? (
        <RecipePreviewModal item={previewItem} componentCatalog={componentCatalog} onClose={() => setPreviewItem(null)} t={t} />
      ) : null}
    </div>
  )
}

function RecipeFormFields({ form, onChange, t, mainImageFile, mainImageUrl, onMainImageSelect, isUploadingMainImage }) {
  const shapeEnabled = form.category === 'CAKE' || form.category === 'PASTRY'

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.name')}</span><input name="name" value={form.name} onChange={onChange} className="input-field" required /></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.category')}</span><select name="category" value={form.category} onChange={onChange} className="input-field" required>{categoryOptions.map((v) => <option key={v} value={v}>{formatRecipeCategory(v, t)}</option>)}</select></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.difficulty')}</span><select name="difficulty" value={form.difficulty} onChange={onChange} className="input-field" required>{difficultyOptions.map((v) => <option key={v} value={v}>{formatRecipeDifficulty(v, t)}</option>)}</select></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.yieldQuantity')}</span><input type="number" step="0.001" min="0.001" name="yieldQuantity" value={form.yieldQuantity} onChange={onChange} className="input-field" required /></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.yieldUnit')}</span><select name="yieldUnit" value={form.yieldUnit} onChange={onChange} className="input-field" required>{yieldUnitOptions.map((v) => <option key={v} value={v}>{formatYieldUnit(v, t)}</option>)}</select></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.shape')}</span><select name="shape" value={shapeEnabled ? form.shape : ''} onChange={onChange} className={`input-field ${!shapeEnabled ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`} required disabled={!shapeEnabled}><option value="">-</option>{shapeOptions.map((v) => <option key={v} value={v}>{formatRecipeShape(v, t)}</option>)}</select></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.preparationTime')}</span><input type="number" min="1" name="preparationTime" value={form.preparationTime} onChange={onChange} className="input-field" required /></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.baseDiameter')}</span><input type="number" step="0.01" min="0.01" name="baseDiameterCm" value={shapeEnabled && form.shape === 'ROUND' ? form.baseDiameterCm : ''} onChange={onChange} className={`input-field ${!shapeEnabled || form.shape !== 'ROUND' ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`} disabled={!shapeEnabled || form.shape !== 'ROUND'} required={shapeEnabled && form.shape === 'ROUND'} /></label>
      <label className="block sm:col-span-2"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.description')}</span><textarea name="description" value={form.description} onChange={onChange} className="input-field min-h-20" /></label>
      <label className="block sm:col-span-2">
        <ImageUploadField
          label={t('recipes.columns.mainImage')}
          selectedFileName={mainImageFile?.name}
          onFileSelect={(file) => onMainImageSelect?.(file || null)}
        />
        {isUploadingMainImage ? <span className="text-muted mt-1 block text-xs">{t('recipes.images.uploading')}</span> : null}
        {mainImageUrl ? <img src={resolveUploadUrl(mainImageUrl)} alt="recipe" className="mt-2 h-24 rounded border border-slate-200 object-cover" /> : null}
      </label>
      <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" name="active" checked={form.active} onChange={onChange} /><span className="text-secondary text-xs font-medium">{t('recipes.columns.active')}</span></label>
    </div>
  )
}

function StepBuilder({ steps, setSteps, t }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [draft, setDraft] = useState({ stepOrder: '', name: '', instruction: '', imageFile: null })

  const openAdd = () => {
    setEditingIndex(null)
    setDraft({ stepOrder: '', name: '', instruction: '', imageFile: null })
    setModalOpen(true)
  }

  const openEdit = (step, index) => {
    setEditingIndex(index)
    setDraft({
      stepOrder: step.stepOrder,
      name: step.name || '',
      instruction: step.instruction,
      imageFile: step.imageFile || null,
    })
    setModalOpen(true)
  }

  const saveStep = () => {
    const stepOrder = Number(draft.stepOrder)
    const name = draft.name?.trim()
    const instruction = draft.instruction?.trim()
    if (!stepOrder || !name || !instruction) return

    if (editingIndex === null) {
      setSteps((prev) => [...prev, { stepOrder, name, instruction, imageFile: draft.imageFile || null }].sort((a, b) => a.stepOrder - b.stepOrder))
    } else {
      setSteps((prev) => {
        const updated = [...prev]
        updated[editingIndex] = { ...updated[editingIndex], stepOrder, name, instruction, imageFile: draft.imageFile || null }
        return updated.sort((a, b) => a.stepOrder - b.stepOrder)
      })
    }
    setModalOpen(false)
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-secondary text-sm font-semibold">{t('recipes.steps.title')}</p>
        <button type="button" className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white" onClick={openAdd}>{t('recipes.steps.add')}</button>
      </div>

      {steps.length === 0 ? <p className="text-muted text-xs">{t('recipes.steps.empty')}</p> : (
        <ul className="space-y-1">
          {steps.map((step, idx) => (
            <li key={`${step.stepOrder}-${idx}`} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
              <span className="truncate text-slate-700">{step.stepOrder}. {step.name}{step.imageFile ? ` • ${step.imageFile.name}` : ''}</span>
              <div className="ml-3 flex items-center gap-3">
                <button type="button" className="text-sky-700" onClick={() => openEdit(step, idx)}>{t('recipes.actions.edit')}</button>
                <button type="button" className="text-red-600" onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}>{t('recipes.steps.remove')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <StepModal
          title={editingIndex === null ? t('recipes.steps.add') : t('recipes.actions.edit')}
          draft={draft}
          setDraft={setDraft}
          onCancel={() => setModalOpen(false)}
          onSave={saveStep}
          t={t}
        />
      ) : null}
    </div>
  )
}

function StepEditor({ recipeId, steps, stepForm, onAdd, onUpdate, onDelete, t }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStep, setEditingStep] = useState(null)
  const [draft, setDraft] = useState({ stepOrder: '', name: '', instruction: '', imageFile: null })

  const openAdd = () => {
    setEditingStep(null)
    setDraft({ stepOrder: stepForm.stepOrder, name: stepForm.name, instruction: stepForm.instruction, imageFile: null })
    setModalOpen(true)
  }

  const openEdit = (step) => {
    const parsed = mapStepFromApi(step, t)
    setEditingStep(step)
    setDraft({ stepOrder: step.stepOrder, name: parsed.name, instruction: parsed.description, imageFile: null })
    setModalOpen(true)
  }

  const saveStep = async () => {
    const stepOrder = Number(draft.stepOrder)
    const name = draft.name?.trim()
    const instruction = draft.instruction?.trim()
    if (!stepOrder || !name || !instruction) return

    if (editingStep) {
      await onUpdate({ ...editingStep, stepOrder, name, instruction })
      if (draft.imageFile) {
        await uploadRecipeStepImage(recipeId, editingStep.id, draft.imageFile)
      }
    } else {
      await onAdd({ stepOrder: String(stepOrder), name, instruction, imageFile: draft.imageFile || null })
    }

    setModalOpen(false)
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-secondary mb-2 text-sm font-semibold">{t('recipes.steps.title')}</p>
      <div className="mb-3 flex justify-end">
        <button type="button" className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white" onClick={openAdd}>{t('recipes.steps.add')}</button>
      </div>
      {steps.length === 0 ? <p className="text-muted text-xs">{t('recipes.steps.empty')}</p> : (
        <ul className="space-y-1">
          {steps.map((step) => {
            const parsed = mapStepFromApi(step, t)
            return (
              <li key={step.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
                <span className="truncate text-slate-700">{step.stepOrder}. {parsed.name}</span>
                <div className="ml-3 flex items-center gap-3">
                  <button type="button" className="text-sky-700" onClick={() => openEdit(step)}>{t('recipes.actions.edit')}</button>
                  <button type="button" className="text-red-600" onClick={() => onDelete(step.id)}>{t('recipes.steps.remove')}</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {modalOpen ? (
        <StepModal
          title={editingStep ? t('recipes.actions.edit') : t('recipes.steps.add')}
          draft={draft}
          setDraft={setDraft}
          onCancel={() => setModalOpen(false)}
          onSave={saveStep}
          t={t}
          previewUrl={editingStep?.imageUrl ? resolveUploadUrl(editingStep.imageUrl) : undefined}
        />
      ) : null}
    </div>
  )
}

function StepModal({ title, draft, setDraft, onCancel, onSave, t, previewUrl }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4">
      <div className="modal-panel w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h4 className="text-primary mb-3 font-serif text-xl">{title}</h4>
        <div className="space-y-3">
          <label className="block">
            <span className="text-secondary mb-1 block text-xs font-semibold uppercase tracking-wide">{t('recipes.steps.name')}</span>
            <input className="input-field" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-secondary mb-1 block text-xs font-semibold uppercase tracking-wide">{t('recipes.steps.order')}</span>
            <input type="number" min="1" className="input-field max-w-32" value={draft.stepOrder} onChange={(e) => setDraft((p) => ({ ...p, stepOrder: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-secondary mb-1 block text-xs font-semibold uppercase tracking-wide">{t('recipes.steps.description')}</span>
            <textarea className="input-field min-h-40" value={draft.instruction} onChange={(e) => setDraft((p) => ({ ...p, instruction: e.target.value }))} />
          </label>
          <ImageUploadField
            label={t('recipes.steps.image')}
            selectedFileName={draft.imageFile?.name}
            previewUrl={previewUrl}
            onFileSelect={(file) => setDraft((p) => ({ ...p, imageFile: file || null }))}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={onCancel}>{t('recipes.edit.cancel')}</button>
          <button type="button" className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white" onClick={onSave}>{t('recipes.steps.save')}</button>
        </div>
      </div>
    </div>
  )
}

export default RecipesPage

function IngredientBuilder({ ingredients, ingredientCatalog, onAdd, onRemove, t }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(newIngredient)

  const filteredCatalog = ingredientCatalog.filter((item) => item.name?.toLowerCase().includes(query.trim().toLowerCase()))

  const openAdd = () => {
    setDraft(newIngredient)
    setQuery('')
    setModalOpen(true)
  }

  const saveIngredient = () => {
    onAdd(draft)
    setModalOpen(false)
  }

  const resolveCreateIngredientName = (item) => ingredientCatalog.find((ing) => ing.id === item.ingredientId)?.name || item.ingredientId

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-secondary text-sm font-semibold">{t('recipes.ingredients.title')}</p>
        <button type="button" className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white" onClick={openAdd}>{t('recipes.ingredients.addButton')}</button>
      </div>
      {ingredients.length === 0 ? <p className="text-muted text-xs">{t('recipes.ingredients.empty')}</p> : (
        <ul className="space-y-1">
          {ingredients.map((item, idx) => (
            <li key={`${item.ingredientId}-${idx}`} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
              <span>{resolveCreateIngredientName(item)} • {item.quantity} {item.unit}{item.notes ? ` • ${item.notes}` : ''}</span>
              <button type="button" className="text-red-600" onClick={() => onRemove(idx)}>{t('recipes.ingredients.remove')}</button>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <IngredientPickerModal
          title={t('recipes.ingredients.add')}
          draft={draft}
          setDraft={setDraft}
          query={query}
          setQuery={setQuery}
          ingredientCatalog={ingredientCatalog}
          filteredCatalog={filteredCatalog}
          onCancel={() => setModalOpen(false)}
          onSave={saveIngredient}
          t={t}
        />
      ) : null}
    </div>
  )
}

function RecipeSummary({ form, ingredients, components, steps, ingredientCatalog, recipes, showComponents, t }) {
  const unitMultipliers = {
    PIECE: 1,
    G: 1,
    KG: 1000,
    ML: 1,
    L: 1000,
  }

  const formatCost = (value) => {
    const amount = Number(value || 0)
    if (!Number.isFinite(amount)) return '-'
    return amount.toFixed(2)
  }

  const ingredientRows = ingredients.map((item, idx) => {
    const catalogMatch = ingredientCatalog.find((ing) => ing.id === item.ingredientId)
    const name = item.ingredientName || catalogMatch?.name || `${t('recipes.ingredients.select')} #${item.ingredientId ?? idx + 1}`
    const quantity = Number(item.quantity || 0)
    const unit = item.unit || catalogMatch?.baseUnit || 'G'
    const unitPrice = Number(catalogMatch?.unitPrice || item.unitPrice || 0)
    const multiplier = unitMultipliers[unit] || 1
    const estimatedCost = Number(item.cost ?? (quantity * multiplier * unitPrice))

    return {
      key: `${item.ingredientId ?? name}-${idx}`,
      name,
      quantity,
      unit,
      notes: item.notes,
      cost: Number.isFinite(estimatedCost) ? estimatedCost : 0,
    }
  })

  const totalCost = ingredientRows.reduce((sum, row) => sum + row.cost, 0)
  const componentRows = (components || []).map((item, idx) => {
    const recipeId = item.childRecipeId || item.recipeId
    const recipeRef = recipes.find((r) => r.id === recipeId)
    const recipeName = item.childRecipeName || recipeRef?.name || `${t('recipes.title')} #${recipeId ?? idx + 1}`
    const quantityFactor = Number(item.quantityFactor || 0)
    const baseRecipeCost = Number(item.baseRecipeCost || recipeRef?.totalCost || 0)
    const scalingMode = item.scalingMode || 'DIAMETER_AREA'
    const childDiameter = Number(recipeRef?.baseDiameterCm || 0)
    const parentDiameter = Number(form.baseDiameterCm || 0)
    const areaMultiplier = childDiameter > 0 && parentDiameter > 0 ? (parentDiameter / childDiameter) ** 2 : 1
    const effectiveFactor = Number(item.effectiveFactor ?? (scalingMode === 'DIAMETER_AREA' ? quantityFactor * areaMultiplier : quantityFactor))
    const componentCost = Number(item.totalCost ?? (baseRecipeCost * effectiveFactor))

    return {
      key: `${recipeId ?? recipeName}-${idx}`,
      recipeId,
      recipeName,
      quantityFactor,
      scalingMode,
      effectiveFactor,
      componentCost: Number.isFinite(componentCost) ? componentCost : 0,
    }
  })

  const totalComponentCost = componentRows.reduce((sum, row) => sum + row.componentCost, 0)
  const grandTotalCost = totalCost + totalComponentCost

  return (
    <div className="rounded-md border border-slate-200 p-3 text-xs">
      <p className="text-secondary mb-2 font-semibold">{t('recipes.summary.title')}</p>

      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <p><strong>{t('recipes.columns.name')}:</strong> {form.name || '-'}</p>
        <p><strong>{t('recipes.columns.category')}:</strong> {formatRecipeCategory(form.category, t)}</p>
        <p><strong>{t('recipes.columns.difficulty')}:</strong> {formatRecipeDifficulty(form.difficulty, t)}</p>
        <p><strong>{t('recipes.columns.shape')}:</strong> {(form.category === 'CAKE' || form.category === 'PASTRY') ? formatRecipeShape(form.shape, t) : '-'}</p>
        <p><strong>{t('recipes.columns.yield')}:</strong> {form.yieldQuantity || '-'} {formatYieldUnit(form.yieldUnit, t)}</p>
        <p><strong>{t('recipes.columns.preparationTime')}:</strong> {form.preparationTime || '-'} min</p>
        <p><strong>{t('recipes.columns.baseDiameter')}:</strong> {(form.category === 'CAKE' || form.category === 'PASTRY') && form.shape === 'ROUND' ? (form.baseDiameterCm || '-') : '-'}</p>
        <p className="sm:col-span-2"><strong>{t('recipes.columns.description')}:</strong> {form.description || '-'}</p>
      </div>

      <div className="mt-3 rounded border border-slate-200 bg-slate-50/60 p-2">
        <p className="font-semibold text-slate-700">{t('recipes.ingredients.title')} ({ingredientRows.length})</p>
        {ingredientRows.length === 0 ? <p className="text-muted mt-1">{t('recipes.ingredients.empty')}</p> : (
          <ul className="mt-1 space-y-1">
            {ingredientRows.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 rounded bg-white px-2 py-1">
                <span className="truncate text-slate-700">{row.name} • {row.quantity} {row.unit}{row.notes ? ` • ${row.notes}` : ''}</span>
                <span className="whitespace-nowrap font-medium text-slate-800">{formatCost(row.cost)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showComponents ? (
        <div className="mt-2 rounded border border-slate-200 bg-slate-50/60 p-2">
          <p className="font-semibold text-slate-700">{t('recipes.components.title')} ({componentRows.length})</p>
          {componentRows.length === 0 ? <p className="text-muted mt-1">{t('recipes.components.empty')}</p> : (
            <ul className="mt-1 space-y-1">
              {componentRows.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3 rounded bg-white px-2 py-1">
                  <span className="truncate text-slate-700">{row.recipeName} • x{row.effectiveFactor.toFixed(3)}{row.scalingMode === 'DIAMETER_AREA' ? ` (${t('recipes.components.autoScale')})` : ''}</span>
                  <span className="whitespace-nowrap font-medium text-slate-800">{formatCost(row.componentCost)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mt-2 rounded border border-slate-200 bg-slate-50/60 p-2">
        <p className="font-semibold text-slate-700">{t('recipes.steps.title')} ({steps.length})</p>
        {steps.length === 0 ? <p className="text-muted mt-1">{t('recipes.steps.empty')}</p> : (
          <ul className="mt-1 space-y-1">
            {steps.map((step, idx) => (
              <li key={`${step.id ?? step.stepOrder}-${idx}`} className="rounded bg-white px-2 py-1 text-slate-700">
                {step.stepOrder}. {step.name || mapStepFromApi(step, t).name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <div className="rounded bg-sky-50 px-3 py-2 text-xs text-sky-900">
          {showComponents ? <p><strong>{t('recipes.summary.componentsSubtotal')}:</strong> {formatCost(totalComponentCost)}</p> : null}
          <p><strong>{t('recipes.summary.ingredientsSubtotal')}:</strong> {formatCost(totalCost)}</p>
          <p className="mt-1 text-sm font-semibold"><strong>{t('recipes.columns.totalCost')}:</strong> {formatCost(grandTotalCost)}</p>
        </div>
      </div>
    </div>
  )
}

function ComponentBuilder({ components, recipes, currentRecipeName, parentShape, parentBaseDiameterCm, onAdd, onRemove, t }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(newComponent)

  const filteredRecipes = recipes.filter((r) => r.name?.toLowerCase().includes(query.trim().toLowerCase()) && r.name !== currentRecipeName)

  const saveComponent = () => {
    onAdd(draft)
    setModalOpen(false)
  }

  const resolveName = (item) => recipes.find((r) => r.id === item.childRecipeId)?.name || item.childRecipeName || item.childRecipeId

  const resolveEffectiveFactor = (item) => {
    const fromApi = Number(item.effectiveFactor)
    if (Number.isFinite(fromApi) && fromApi > 0) return fromApi

    const base = Number(item.quantityFactor || 0)
    if (!Number.isFinite(base) || base <= 0) return 0
    if (item.scalingMode !== 'DIAMETER_AREA') return base

    const child = recipes.find((r) => r.id === item.childRecipeId)
    const parentDiameter = Number(parentBaseDiameterCm || 0)
    const childDiameter = Number(child?.baseDiameterCm || 0)
    const parentIsRound = (parentShape || 'ROUND') === 'ROUND'
    const childIsRound = (child?.shape || 'ROUND') === 'ROUND'

    if (!parentIsRound || !childIsRound || parentDiameter <= 0 || childDiameter <= 0) {
      return base
    }

    const areaMultiplier = (parentDiameter / childDiameter) ** 2
    return base * areaMultiplier
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-secondary text-sm font-semibold">{t('recipes.components.title')}</p>
        <button type="button" className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white" onClick={() => { setDraft(newComponent); setQuery(''); setModalOpen(true) }}>{t('recipes.components.addButton')}</button>
      </div>
      {components.length === 0 ? <p className="text-muted text-xs">{t('recipes.components.empty')}</p> : (
        <ul className="space-y-1">
          {components.map((item) => (
            <li key={item.childRecipeId} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
              <span>{resolveName(item)} • x{resolveEffectiveFactor(item).toFixed(2)}{item.scalingMode === 'DIAMETER_AREA' ? ` • ${t('recipes.components.autoScale')}` : ''}</span>
              <button type="button" className="text-red-600" onClick={() => onRemove(item.childRecipeId)}>{t('recipes.ingredients.remove')}</button>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <ComponentPickerModal
          title={t('recipes.components.addButton')}
          draft={draft}
          setDraft={setDraft}
          query={query}
          setQuery={setQuery}
          filteredRecipes={filteredRecipes}
          onCancel={() => setModalOpen(false)}
          onSave={saveComponent}
          t={t}
        />
      ) : null}
    </div>
  )
}

function ComponentEditor({ components, recipes, parentShape, parentBaseDiameterCm, onAdd, onRemove, t }) {
  const normalized = (components || []).map((c) => ({
    childRecipeId: c.childRecipeId,
    childRecipeName: c.childRecipeName,
    quantityFactor: c.quantityFactor,
    scalingMode: c.scalingMode || 'DIAMETER_AREA',
  }))
  return <ComponentBuilder components={normalized} recipes={recipes} parentShape={parentShape} parentBaseDiameterCm={parentBaseDiameterCm} onAdd={onAdd} onRemove={onRemove} t={t} />
}

function ComponentPickerModal({ title, draft, setDraft, query, setQuery, filteredRecipes, onCancel, onSave, t }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4">
      <div className="modal-panel w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h4 className="text-primary mb-3 font-serif text-lg">{title}</h4>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('recipes.components.searchPlaceholder')} className="input-field mb-3" />
        <div className="mb-3 max-h-52 overflow-y-auto rounded-md border border-slate-200">
          {filteredRecipes.length === 0 ? <p className="text-muted px-3 py-2 text-xs">{t('recipes.components.emptySearch')}</p> : (
            <ul className="divide-y divide-slate-100">
              {filteredRecipes.map((item) => (
                <li key={item.id} className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setDraft((p) => ({ ...p, childRecipeId: String(item.id) }))}>
                  <span>{item.name}</span>
                  <span className="text-xs text-slate-500">{formatMoney(item.totalCost)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className="input-field" value={draft.childRecipeId} readOnly placeholder={t('recipes.components.selected')} />
          <input className="input-field" type="number" step="0.001" min="0.001" value={draft.quantityFactor} onChange={(e) => setDraft((p) => ({ ...p, quantityFactor: e.target.value }))} placeholder={t('recipes.components.factor')} />
        </div>
        <select className="input-field mt-2" value={draft.scalingMode} onChange={(e) => setDraft((p) => ({ ...p, scalingMode: e.target.value }))}>
          <option value="DIAMETER_AREA">{t('recipes.components.modeDiameter')}</option>
          <option value="MANUAL">{t('recipes.components.modeManual')}</option>
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={onCancel}>{t('recipes.edit.cancel')}</button>
          <button type="button" className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white" onClick={onSave}>{t('recipes.components.addButton')}</button>
        </div>
      </div>
    </div>
  )
}

function RecipePreviewModal({ item, componentCatalog = [], onClose, t, scaleFactor = 1 }) {
  const normalizedScaleFactor = Number.isFinite(Number(scaleFactor)) ? Number(scaleFactor) : 1
  const totalCost = Number(item.totalCost || 0) * normalizedScaleFactor
  const [zoomImageUrl, setZoomImageUrl] = useState('')
  const [componentPreviewItem, setComponentPreviewItem] = useState(null)

  const resolveComponentRecipe = (component) => {
    const fromCatalog = componentCatalog.find((r) => r.id === component.childRecipeId)
    return fromCatalog || null
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4">
        <div className="flex h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-primary truncate font-serif text-lg">{item.name}</h3>
            <p className="text-muted mt-1 text-xs">{item.description || '-'}</p>
          </div>
        </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
              <div>
                {item.mainImageUrl ? (
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => setZoomImageUrl(resolveUploadUrl(item.mainImageUrl))}
                  >
                    <img src={resolveUploadUrl(item.mainImageUrl)} alt="recipe" className="h-56 w-full rounded border border-slate-200 bg-white object-contain" />
                  </button>
                ) : (
                  <div className="flex h-56 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs text-slate-500">{t('recipes.columns.mainImage')}: -</div>
                )}
              </div>

              <div className="rounded border border-slate-200 bg-slate-50/60 p-2 text-xs">
                <div className="divide-y divide-slate-200/80">
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('recipes.columns.category')}:</strong><span>{formatRecipeCategory(item.category, t)}</span></p>
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('recipes.columns.difficulty')}:</strong><span>{formatRecipeDifficulty(item.difficulty, t)}</span></p>
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('recipes.columns.shape')}:</strong><span>{(item.category === 'CAKE' || item.category === 'PASTRY') ? formatRecipeShape(item.shape, t) : '-'}</span></p>
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('recipes.columns.yield')}:</strong><span>{item.yieldQuantity || '-'} {formatYieldUnit(item.yieldUnit, t)}</span></p>
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('recipes.columns.preparationTime')}:</strong><span>{item.preparationTime || '-'} min</span></p>
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('recipes.columns.baseDiameter')}:</strong><span>{(item.category === 'CAKE' || item.category === 'PASTRY') && item.shape === 'ROUND' ? (item.baseDiameterCm || '-') : '-'}</span></p>
                  <p className="flex items-center justify-between gap-2 pt-1.5 text-sm"><strong>{t('recipes.columns.totalCost')}:</strong><span className="font-semibold">{Number.isFinite(totalCost) ? totalCost.toFixed(2) : '-'}</span></p>
                </div>
              </div>
            </div>

          <div className="rounded border border-slate-200 p-2">
            <p className="text-secondary text-sm font-semibold">{t('recipes.ingredients.title')} ({item.ingredients?.length || 0})</p>
            {item.ingredients?.length ? (
              <ul className="mt-2 space-y-1">
                {item.ingredients.map((ing, idx) => (
                  <li key={`${ing.ingredientId}-${idx}`} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
                    <span className="truncate text-slate-700">{ing.ingredientName || ing.ingredientId} • {formatQuantity(Number(ing.quantity || 0) * normalizedScaleFactor)} {ing.unit}{ing.notes ? ` • ${ing.notes}` : ''}</span>
                    <span className="whitespace-nowrap font-medium text-slate-800">{(Number(ing.cost || 0) * normalizedScaleFactor).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted mt-1 text-xs">{t('recipes.ingredients.empty')}</p>}
          </div>

          {item.recipeType !== 'COMPONENT' ? (
            <div className="rounded border border-slate-200 p-2">
              <p className="text-secondary text-sm font-semibold">{t('recipes.components.title')} ({item.components?.length || 0})</p>
              {item.components?.length ? (
                <ul className="mt-2 space-y-1">
                  {item.components.map((component, idx) => (
                    <li key={`${component.childRecipeId}-${idx}`} className="rounded bg-slate-50 px-2 py-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="truncate text-left text-sky-700 hover:underline"
                          onClick={() => {
                            const resolved = resolveComponentRecipe(component)
                            if (resolved) {
                              setComponentPreviewItem({
                                item: resolved,
                                scaleFactor: Number(component.effectiveFactor ?? component.quantityFactor ?? 1) * normalizedScaleFactor,
                              })
                            }
                          }}
                        >
                          {component.childRecipeName} • x{component.effectiveFactor ?? component.quantityFactor}
                        </button>
                        <span className="whitespace-nowrap font-medium text-slate-800">{Number(component.totalCost || 0).toFixed(2)}</span>
                      </div>
                      {(() => {
                        const resolved = resolveComponentRecipe(component)
                        const ingredients = resolved?.ingredients || []
                        const factor = Number(component.effectiveFactor ?? component.quantityFactor ?? 1)
                        if (!ingredients.length) return null
                        return (
                          <p className="mt-1 truncate text-[11px] text-slate-500">
                            {ingredients
                              .map((ing) => {
                                const scaledQty = Number(ing.quantity || 0) * (Number.isFinite(factor) ? factor : 1)
                                return `${ing.ingredientName || ing.ingredientId} ${formatQuantity(scaledQty)} ${formatYieldUnit(ing.unit, t)}`
                              })
                              .join(' • ')}
                          </p>
                        )
                      })()}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted mt-1 text-xs">{t('recipes.components.empty')}</p>}
            </div>
          ) : null}

          <div className="rounded border border-slate-200 p-2">
            <p className="text-secondary text-sm font-semibold">{t('recipes.steps.title')} ({item.steps?.length || 0})</p>
            {item.steps?.length ? (
              <ul className="mt-2 space-y-2">
                {item.steps.map((step, idx) => {
                  const parsed = mapStepFromApi(step, t)
                  return (
                    <li key={`${step.id ?? step.stepOrder}-${idx}`} className="rounded bg-slate-50 px-2 py-2 text-xs">
                      <p className="font-semibold text-slate-700">{step.stepOrder}. {parsed.name}</p>
                      <p className="mt-0.5 text-slate-700">{parsed.description || '-'}</p>
                      {step.imageUrl ? (
                        <button
                          type="button"
                          className="mt-1.5 block w-full"
                          onClick={() => setZoomImageUrl(resolveUploadUrl(step.imageUrl))}
                        >
                          <img src={resolveUploadUrl(step.imageUrl)} alt="step" className="h-40 w-full rounded border border-slate-200 bg-white object-contain" />
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : <p className="text-muted mt-1 text-xs">{t('recipes.steps.empty')}</p>}
          </div>
        </div>

          <div className="mt-3 flex justify-end border-t border-slate-200 pt-3">
            <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={onClose}>{t('recipes.preview.close')}</button>
          </div>
        </div>
      </div>
      {zoomImageUrl ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setZoomImageUrl('')}>
          <img src={zoomImageUrl} alt="zoom" className="max-h-[92vh] max-w-[92vw] rounded border border-slate-500 bg-white object-contain" />
        </div>
      ) : null}

      {componentPreviewItem ? (
        <RecipePreviewModal
          item={componentPreviewItem.item}
          componentCatalog={componentCatalog}
          onClose={() => setComponentPreviewItem(null)}
          scaleFactor={componentPreviewItem.scaleFactor}
          t={t}
        />
      ) : null}
    </>
  )
}

function IngredientEditor({ ingredients, ingredientCatalog, onAdd, onRemove, t }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(newIngredient)

  const filteredCatalog = ingredientCatalog.filter((item) => item.name?.toLowerCase().includes(query.trim().toLowerCase()))

  const openAdd = () => {
    setDraft(newIngredient)
    setQuery('')
    setModalOpen(true)
  }

  const saveIngredient = async () => {
    await onAdd(draft)
    setModalOpen(false)
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-secondary text-sm font-semibold">{t('recipes.ingredients.title')}</p>
        <button type="button" className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white" onClick={openAdd}>{t('recipes.ingredients.addButton')}</button>
      </div>

      {ingredients.length === 0 ? <p className="text-muted text-xs">{t('recipes.ingredients.empty')}</p> : (
        <ul className="space-y-1">
          {ingredients.map((item) => (
            <li key={item.ingredientId} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
              <span>{item.ingredientName} • {item.quantity} {item.unit}{item.notes ? ` • ${item.notes}` : ''}</span>
              <button type="button" className="text-red-600" onClick={() => onRemove(item.ingredientId)}>{t('recipes.ingredients.remove')}</button>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <IngredientPickerModal
          title={t('recipes.ingredients.add')}
          draft={draft}
          setDraft={setDraft}
          query={query}
          setQuery={setQuery}
          ingredientCatalog={ingredientCatalog}
          filteredCatalog={filteredCatalog}
          onCancel={() => setModalOpen(false)}
          onSave={saveIngredient}
          t={t}
        />
      ) : null}
    </div>
  )
}

function IngredientPickerModal({ title, draft, setDraft, query, setQuery, ingredientCatalog, filteredCatalog, onCancel, onSave, t }) {
  const selectedId = String(draft.ingredientId || '')
  const selectedIngredientName = ingredientCatalog.find((item) => String(item.id) === selectedId)?.name || ''

  const handlePickIngredient = (item) => {
    const baseUnit = item?.baseUnit
    const resolvedUnit = ingredientUnitOptions.includes(baseUnit) ? baseUnit : draft.unit
    setDraft((p) => ({ ...p, ingredientId: String(item.id), unit: resolvedUnit }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4">
      <div className="modal-panel w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h4 className="text-primary mb-3 font-serif text-lg">{title}</h4>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('recipes.ingredients.searchPlaceholder')}
          className="input-field mb-3"
        />
        <p className="text-muted mb-2 text-xs">{t('recipes.ingredients.resultsCount', { count: filteredCatalog.length })}</p>
        <div className="mb-3 max-h-44 overflow-y-auto rounded-md border border-slate-200">
          {filteredCatalog.length === 0 ? <p className="text-muted px-3 py-2 text-xs">{t('recipes.ingredients.emptySearch')}</p> : (
            <ul className="divide-y divide-slate-100">
              {filteredCatalog.map((item) => (
                <li
                  key={item.id}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition ${selectedId === String(item.id) ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                  onClick={() => handlePickIngredient(item)}
                >
                  <span className="flex-1 text-left text-slate-700">{item.name}</span>
                  {selectedId === String(item.id) ? (
                    <span className="text-xs font-semibold text-sky-700">{t('recipes.ingredients.selected')}</span>
                  ) : (
                    <span className="text-xs font-semibold text-sky-700">{t('recipes.ingredients.select')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_1fr]">
          <input className="input-field" value={selectedIngredientName} readOnly placeholder={t('recipes.ingredients.selected')} />
          <select className="input-field" value={draft.unit} onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value }))}>
            {ingredientUnitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <input className="input-field" type="number" step="0.001" min="0.001" value={draft.quantity} onChange={(e) => setDraft((p) => ({ ...p, quantity: e.target.value }))} placeholder={t('recipes.ingredients.quantity')} />
        </div>
        <input className="input-field mt-2" value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder={t('recipes.ingredients.notes')} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={onCancel}>{t('recipes.edit.cancel')}</button>
          <button type="button" className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white" onClick={onSave}>{t('recipes.ingredients.add')}</button>
        </div>
      </div>
    </div>
  )
}
