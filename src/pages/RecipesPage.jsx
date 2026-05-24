import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addRecipeIngredient,
  addRecipeStep,
  createRecipe,
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

const categoryOptions = ['CAKE', 'DESSERT', 'OTHER']
const difficultyOptions = ['EASY', 'MEDIUM', 'HARD']
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
  active: true,
}

const newStep = { stepOrder: '', name: '', instruction: '' }
const newIngredient = { ingredientId: '', quantity: '', unit: 'G', notes: '' }

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

function mapRecipeRequest(form) {
  return {
    name: form.name,
    category: form.category,
    description: form.description || null,
    baseDiameterCm: form.baseDiameterCm ? Number(form.baseDiameterCm) : null,
    yieldQuantity: Number(form.yieldQuantity),
    yieldUnit: form.yieldUnit,
    preparationTime: Number(form.preparationTime),
    difficulty: form.difficulty,
    active: Boolean(form.active),
  }
}

function RecipesPage() {
  const { t } = useTranslation()
  const [recipes, setRecipes] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createWizardStep, setCreateWizardStep] = useState(1)
  const [createForm, setCreateForm] = useState(initialForm)
  const [createMainImage, setCreateMainImage] = useState(null)
  const [ingredientCatalog, setIngredientCatalog] = useState([])
  const [createIngredients, setCreateIngredients] = useState([])
  const [createIngredientForm, setCreateIngredientForm] = useState(newIngredient)
  const [createSteps, setCreateSteps] = useState([])
  const [createStepForm, setCreateStepForm] = useState(newStep)
  const [createError, setCreateError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateConfirm, setShowCreateConfirm] = useState(false)

  const [editItem, setEditItem] = useState(null)
  const [editWizardStep, setEditWizardStep] = useState(1)
  const [editForm, setEditForm] = useState(initialForm)
  const [editIngredientForm, setEditIngredientForm] = useState(newIngredient)
  const [editStepForm, setEditStepForm] = useState(newStep)
  const [editError, setEditError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isUploadingMainImage, setIsUploadingMainImage] = useState(false)

  const [deleteItem, setDeleteItem] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadRecipes = async () => {
    const { data } = await getRecipes()
    setRecipes(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    let mounted = true
    const fetchRecipes = async () => {
      try {
        const { data } = await getRecipes()
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
    return () => {
      mounted = false
    }
  }, [t])

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

  const handleCreateRecipe = async (event) => {
    event.preventDefault()
    setIsCreating(true)
    setCreateError('')
    try {
      const createResponse = await createRecipe(mapRecipeRequest(createForm))
      const recipeId = createResponse.data

      if (createMainImage) {
        await uploadRecipeMainImage(recipeId, createMainImage)
      }

      for (const ingredient of createIngredients) {
        await addRecipeIngredient(recipeId, ingredient)
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
      setCreateSteps([])
      setCreateStepForm(newStep)
    } catch (err) {
      const raw = err?.response?.data?.message
      const i18nKey = mapApiErrorToI18nKey(raw)
      setCreateError(i18nKey ? t(i18nKey) : (raw ?? t('recipes.errors.createFailed')))
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
      active: Boolean(item.active),
    })
    setEditWizardStep(1)
    setEditIngredientForm(newIngredient)
    setEditStepForm(newStep)
  }

  const handleEditMainImageUpload = async (file) => {
    if (!editItem || !file) return
    setIsUploadingMainImage(true)
    try {
      await uploadRecipeMainImage(editItem.id, file)
      const refreshed = (await getRecipes()).data.find((r) => r.id === editItem.id)
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
    event.preventDefault()
    if (!editItem) return
    setIsEditing(true)
    setEditError('')
    try {
      await updateRecipe(editItem.id, mapRecipeRequest(editForm))
      await loadRecipes()
      const refreshed = (await getRecipes()).data.find((r) => r.id === editItem.id)
      setEditItem(refreshed ?? null)
    } catch (err) {
      const raw = err?.response?.data?.message
      const i18nKey = mapApiErrorToI18nKey(raw)
      setEditError(i18nKey ? t(i18nKey) : (raw ?? t('recipes.errors.updateFailed')))
    } finally {
      setIsEditing(false)
    }
  }

  const addStepInEdit = async () => {
    if (!editItem) return
    const stepOrder = Number(editStepForm.stepOrder)
    const name = editStepForm.name.trim()
    const instruction = editStepForm.instruction.trim()
    if (!stepOrder || !name || !instruction) return
    try {
      await addRecipeStep(editItem.id, {
        stepOrder,
        name,
        instruction,
      })
      const refreshed = (await getRecipes()).data.find((r) => r.id === editItem.id)
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
      const refreshed = (await getRecipes()).data.find((r) => r.id === editItem.id)
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
      const refreshed = (await getRecipes()).data.find((r) => r.id === editItem.id)
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
      const refreshed = (await getRecipes()).data.find((r) => r.id === editItem.id)
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
      const refreshed = (await getRecipes()).data.find((r) => r.id === editItem.id)
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
          <h2 className="text-primary font-serif text-2xl">{t('recipes.title')}</h2>
          <p className="text-muted text-sm">{t('recipes.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('recipes.searchPlaceholder')} className="input-field min-w-56" />
          <button type="button" className="primary-btn w-auto px-4 py-2.5 text-xs" onClick={() => setShowCreateModal(true)}>{t('recipes.addButton')}</button>
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
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">{t('recipes.loading')}</td></tr>
              ) : filteredRecipes.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">{t('recipes.empty')}</td></tr>
              ) : (
                filteredRecipes.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-800">{item.name}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.category}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.yieldQuantity} {item.yieldUnit}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.difficulty}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.totalCost ?? '-'}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.active ? t('recipes.values.active') : t('recipes.values.inactive')}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
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
            <h3 className="text-primary mb-1.5 font-serif text-lg">{t('recipes.create.title')}</h3>
            <p className="text-muted mb-3 text-xs">{t('recipes.create.subtitle')}</p>
            <form onSubmit={handleCreateRecipe} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {createWizardStep === 1 ? (
                  <RecipeFormFields
                    form={createForm}
                    onChange={handleFormChange(setCreateForm)}
                    t={t}
                    onMainImageSelect={(file) => setCreateMainImage(file || null)}
                  />
                ) : null}
                {createWizardStep === 2 ? (
                  <IngredientBuilder
                    ingredients={createIngredients}
                    ingredientCatalog={ingredientCatalog}
                    onAdd={pushCreateIngredient}
                    onRemove={removeCreateIngredient}
                    t={t}
                  />
                ) : null}
                {createWizardStep === 3 ? <StepBuilder steps={createSteps} setSteps={setCreateSteps} stepForm={createStepForm} setStepForm={setCreateStepForm} onAdd={pushCreateStep} onRemove={removeCreateStep} t={t} /> : null}
                {createWizardStep === 4 ? <RecipeSummary form={createForm} ingredients={createIngredients} steps={createSteps} ingredientCatalog={ingredientCatalog} t={t} /> : null}
                {createError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p> : null}
              </div>
              <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button type="button" onClick={() => { setShowCreateModal(false); setCreateForm(initialForm); setCreateMainImage(null); setCreateIngredients([]); setCreateIngredientForm(newIngredient); setCreateSteps([]); setCreateStepForm(newStep); setCreateError('') }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{t('recipes.create.cancel')}</button>
                {createWizardStep > 1 ? (
                  <button type="button" onClick={() => setCreateWizardStep((prev) => prev - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{t('recipes.create.back')}</button>
                ) : null}
                {createWizardStep < 4 ? (
                  <button type="button" onClick={() => setCreateWizardStep((prev) => prev + 1)} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white">{t('recipes.create.next')}</button>
                ) : (
                  <button type="button" disabled={isCreating} onClick={() => setShowCreateConfirm(true)} className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">{isCreating ? t('recipes.create.creating') : t('recipes.create.confirmButton')}</button>
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
                onClick={(e) => {
                  setShowCreateConfirm(false)
                  handleCreateRecipe(e)
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
            <form onSubmit={handleEditRecipe} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {editWizardStep === 1 ? <RecipeFormFields form={editForm} onChange={handleFormChange(setEditForm)} t={t} mainImageUrl={editItem.mainImageUrl} onMainImageSelect={handleEditMainImageUpload} isUploadingMainImage={isUploadingMainImage} /> : null}
                {editWizardStep === 2 ? (
                  <IngredientEditor
                    ingredients={editItem.ingredients ?? []}
                    ingredientCatalog={ingredientCatalog}
                    onAdd={addIngredientInEdit}
                    onRemove={removeIngredientInEdit}
                    t={t}
                  />
                ) : null}
                {editWizardStep === 3 ? (
                  <StepEditor
                    recipeId={editItem.id}
                    steps={editItem.steps ?? []}
                    stepForm={editStepForm}
                    setStepForm={setEditStepForm}
                    onAdd={addStepInEdit}
                    onUpdate={updateStepInEdit}
                    onDelete={deleteStepInEdit}
                    t={t}
                  />
                ) : null}
                {editWizardStep === 4 ? <RecipeSummary form={editForm} ingredients={editItem.ingredients ?? []} steps={editItem.steps ?? []} ingredientCatalog={ingredientCatalog} t={t} /> : null}
                {editError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</p> : null}
              </div>
              <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button type="button" onClick={() => { setEditItem(null); setEditError('') }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{t('recipes.edit.cancel')}</button>
                {editWizardStep > 1 ? (
                  <button type="button" onClick={() => setEditWizardStep((prev) => prev - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">{t('recipes.create.back')}</button>
                ) : null}
                {editWizardStep < 4 ? (
                  <button type="button" onClick={() => setEditWizardStep((prev) => prev + 1)} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white">{t('recipes.create.next')}</button>
                ) : (
                  <button type="submit" disabled={isEditing} className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">{isEditing ? t('recipes.edit.saving') : t('recipes.edit.confirmButton')}</button>
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
    </div>
  )
}

function RecipeFormFields({ form, onChange, t, mainImageUrl, onMainImageSelect, isUploadingMainImage }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.name')}</span><input name="name" value={form.name} onChange={onChange} className="input-field" required /></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.category')}</span><select name="category" value={form.category} onChange={onChange} className="input-field" required>{categoryOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.difficulty')}</span><select name="difficulty" value={form.difficulty} onChange={onChange} className="input-field" required>{difficultyOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.yieldQuantity')}</span><input type="number" step="0.001" min="0.001" name="yieldQuantity" value={form.yieldQuantity} onChange={onChange} className="input-field" required /></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.yieldUnit')}</span><select name="yieldUnit" value={form.yieldUnit} onChange={onChange} className="input-field" required>{yieldUnitOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.preparationTime')}</span><input type="number" min="1" name="preparationTime" value={form.preparationTime} onChange={onChange} className="input-field" required /></label>
      <label className="block"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.baseDiameter')}</span><input type="number" step="0.01" min="0.01" name="baseDiameterCm" value={form.baseDiameterCm} onChange={onChange} className="input-field" /></label>
      <label className="block sm:col-span-2"><span className="text-secondary mb-1 block text-xs font-medium">{t('recipes.columns.description')}</span><textarea name="description" value={form.description} onChange={onChange} className="input-field min-h-20" /></label>
      <label className="block sm:col-span-2">
        <ImageUploadField
          label={t('recipes.columns.mainImage')}
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

function StepEditor({ recipeId, steps, stepForm, setStepForm, onAdd, onUpdate, onDelete, t }) {
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
      setStepForm({ stepOrder: String(stepOrder), name, instruction, imageFile: draft.imageFile || null })
      await onAdd()
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

function ImageUploadField({ label, selectedFileName, previewUrl, onFileSelect }) {
  return (
    <div>
      <span className="text-secondary mb-1 block text-xs font-semibold uppercase tracking-wide">{label}</span>
      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 transition hover:border-sky-400 hover:bg-sky-50/40">
        <span className="text-xs text-slate-600">{selectedFileName || 'Choose image file (JPG/PNG/WebP)'}</span>
        <span className="rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-white">Browse</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFileSelect?.(e.target.files?.[0] || null)}
        />
      </label>
      {previewUrl ? <img src={previewUrl} alt="preview" className="mt-2 h-24 rounded border border-slate-200 object-cover" /> : null}
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

function RecipeSummary({ form, ingredients, steps, ingredientCatalog, t }) {
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

  return (
    <div className="rounded-md border border-slate-200 p-3 text-xs">
      <p className="text-secondary mb-2 font-semibold">{t('recipes.summary.title')}</p>

      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <p><strong>{t('recipes.columns.name')}:</strong> {form.name || '-'}</p>
        <p><strong>{t('recipes.columns.category')}:</strong> {form.category || '-'}</p>
        <p><strong>{t('recipes.columns.difficulty')}:</strong> {form.difficulty || '-'}</p>
        <p><strong>{t('recipes.columns.yield')}:</strong> {form.yieldQuantity || '-'} {form.yieldUnit || ''}</p>
        <p><strong>{t('recipes.columns.preparationTime')}:</strong> {form.preparationTime || '-'} min</p>
        <p><strong>{t('recipes.columns.baseDiameter')}:</strong> {form.baseDiameterCm || '-'}</p>
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
        <p className="rounded bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800">
          {t('recipes.columns.totalCost')}: {formatCost(totalCost)}
        </p>
      </div>
    </div>
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
