import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createIngredient, deleteIngredient, getIngredients, updateIngredient, uploadIngredientImage } from '../lib/api'
import ImageUploadField from '../components/forms/ImageUploadField'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
const apiOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, '')

function resolveUploadUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${apiOrigin}${path}`
}

const unitOptions = ['KG', 'G', 'L', 'ML', 'PIECE']
const initialCreateForm = {
  name: '',
  manufacturer: '',
  packageUnit: 'KG',
  packageQuantity: '',
  packagePrice: '',
}

function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toFixed(2)
}

function IngredientsPage() {
  const { t } = useTranslation()
  const [ingredients, setIngredients] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [createError, setCreateError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editForm, setEditForm] = useState(initialCreateForm)
  const [editError, setEditError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [previewItem, setPreviewItem] = useState(null)
  const [createImageFile, setCreateImageFile] = useState(null)
  const [editImageFile, setEditImageFile] = useState(null)

  useEffect(() => {
    let mounted = true

    const fetchIngredients = async () => {
      try {
        const { data } = await getIngredients()
        if (mounted) {
          setIngredients(Array.isArray(data) ? data : [])
          setError('')
        }
      } catch (err) {
        if (mounted) {
          setError(err?.response?.data?.message ?? t('ingredients.errors.loadFailed'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchIngredients()

    return () => {
      mounted = false
    }
  }, [t])

  const filteredIngredients = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return ingredients
    }
    return ingredients.filter((item) => item.name?.toLowerCase().includes(q))
  }, [ingredients, query])

  const handleDelete = async () => {
    if (!deleteItem) {
      return
    }
    setIsDeleting(true)
    try {
      await deleteIngredient(deleteItem.id)
      setIngredients((prev) => prev.filter((item) => item.id !== deleteItem.id))
      setDeleteItem(null)
    } catch (err) {
      setError(err?.response?.data?.message ?? t('ingredients.errors.deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateChange = (event) => {
    const { name, value } = event.target
    setCreateForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateIngredient = async (event) => {
    event.preventDefault()
    setIsCreating(true)
    setCreateError('')

    try {
      const { data: ingredientId } = await createIngredient({
        name: createForm.name,
        manufacturer: createForm.manufacturer || null,
        packageUnit: createForm.packageUnit,
        packageQuantity: Number(createForm.packageQuantity),
        packagePrice: Number(createForm.packagePrice),
      })
      if (createImageFile) {
        await uploadIngredientImage(ingredientId, createImageFile)
      }

      const { data } = await getIngredients()
      setIngredients(Array.isArray(data) ? data : [])
      setShowCreateModal(false)
      setCreateForm(initialCreateForm)
      setCreateImageFile(null)
    } catch (err) {
      setCreateError(err?.response?.data?.message ?? t('ingredients.errors.createFailed'))
    } finally {
      setIsCreating(false)
    }
  }

  const openEditModal = (item) => {
    setEditItem(item)
    setEditError('')
    setEditForm({
      name: item.name ?? '',
      manufacturer: item.manufacturer ?? '',
      packageUnit: item.packageUnit ?? 'KG',
      packageQuantity: item.packageQuantity ?? '',
      packagePrice: item.packagePrice ?? '',
    })
  }

  const handleEditIngredient = async (event) => {
    event.preventDefault()
    if (!editItem) {
      return
    }

    setIsEditing(true)
    setEditError('')

    try {
      await updateIngredient(editItem.id, {
        name: editForm.name,
        manufacturer: editForm.manufacturer || null,
        packageUnit: editForm.packageUnit,
        packageQuantity: Number(editForm.packageQuantity),
        packagePrice: Number(editForm.packagePrice),
      })

      if (editImageFile) {
        await uploadIngredientImage(editItem.id, editImageFile)
      }
      const { data: refreshed } = await getIngredients()
      setIngredients(Array.isArray(refreshed) ? refreshed : [])
      setEditItem(null)
      setEditForm(initialCreateForm)
      setEditImageFile(null)
    } catch (err) {
      setEditError(err?.response?.data?.message ?? t('ingredients.errors.updateFailed'))
    } finally {
      setIsEditing(false)
    }
  }

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-primary font-serif text-2xl">{t('ingredients.title')}</h2>
          <p className="text-muted text-sm">{t('ingredients.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('ingredients.searchPlaceholder')}
            className="input-field min-w-56"
          />
          <button
            type="button"
            className="primary-btn w-auto px-4 py-2.5 text-xs"
            onClick={() => setShowCreateModal(true)}
          >
            {t('ingredients.addButton')}
          </button>
        </div>
      </div>

      {error ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse bg-white/80">
            <thead className="bg-slate-50/90">
              <tr>
                {['name', 'manufacturer', 'packageUnit', 'packageQuantity', 'packagePrice', 'baseUnit', 'unitPrice', 'actions'].map((key) => (
                  <th key={key} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {t(`ingredients.columns.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">{t('ingredients.loading')}</td>
                </tr>
              ) : filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">{t('ingredients.empty')}</td>
                </tr>
              ) : (
                filteredIngredients.map((item) => (
                  <tr key={item.id} className="cursor-pointer hover:bg-slate-50/80" onDoubleClick={() => setPreviewItem(item)}>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-800">{item.name}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.manufacturer || '-'}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.packageUnit}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.packageQuantity}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatMoney(item.packagePrice)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.baseUnit}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatMoney(item.unitPrice)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700 hover:bg-sky-100"
                          onClick={() => setPreviewItem(item)}
                        >
                          {t('ingredients.actions.view')}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => openEditModal(item)}
                        >
                          {t('ingredients.actions.edit')}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                          onClick={() => setDeleteItem(item)}
                        >
                          {t('ingredients.actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-primary mb-2 font-serif text-xl">{t('ingredients.edit.title')}</h3>
            <p className="text-muted mb-4 text-sm">{t('ingredients.edit.subtitle')}</p>

            <form onSubmit={handleEditIngredient} className="space-y-3">
              <label className="block">
                <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.name')}</span>
                <input name="name" value={editForm.name} onChange={handleEditChange} className="input-field" required />
              </label>

              <label className="block">
                <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.manufacturer')}</span>
                <input name="manufacturer" value={editForm.manufacturer} onChange={handleEditChange} className="input-field" />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.packageUnit')}</span>
                  <select name="packageUnit" value={editForm.packageUnit} onChange={handleEditChange} className="input-field" required>
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.packageQuantity')}</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    name="packageQuantity"
                    value={editForm.packageQuantity}
                    onChange={handleEditChange}
                    className="input-field"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.packagePrice')}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="packagePrice"
                  value={editForm.packagePrice}
                  onChange={handleEditChange}
                  className="input-field"
                  required
                />
              </label>

              <ImageUploadField
                label={t('ingredients.columns.image')}
                selectedFileName={editImageFile?.name}
                previewUrl={editItem?.imageUrl ? resolveUploadUrl(editItem.imageUrl) : undefined}
                onFileSelect={(file) => setEditImageFile(file || null)}
              />

              {editError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</p> : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditItem(null)
                    setEditError('')
                    setEditForm(initialCreateForm)
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
                >
                  {t('ingredients.edit.cancel')}
                </button>
                <button type="submit" disabled={isEditing} className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                  {isEditing ? t('ingredients.edit.saving') : t('ingredients.edit.confirmButton')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-primary mb-2 font-serif text-xl">{t('ingredients.delete.title')}</h3>
            <p className="text-muted mb-4 text-sm">
              {t('ingredients.delete.confirm')} <strong>{deleteItem.name}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                {t('ingredients.delete.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isDeleting ? t('ingredients.delete.deleting') : t('ingredients.delete.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-primary mb-2 font-serif text-xl">{t('ingredients.create.title')}</h3>
            <p className="text-muted mb-4 text-sm">{t('ingredients.create.subtitle')}</p>

            <form onSubmit={handleCreateIngredient} className="space-y-3">
              <label className="block">
                <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.name')}</span>
                <input name="name" value={createForm.name} onChange={handleCreateChange} className="input-field" required />
              </label>

              <label className="block">
                <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.manufacturer')}</span>
                <input name="manufacturer" value={createForm.manufacturer} onChange={handleCreateChange} className="input-field" />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.packageUnit')}</span>
                  <select name="packageUnit" value={createForm.packageUnit} onChange={handleCreateChange} className="input-field" required>
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.packageQuantity')}</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    name="packageQuantity"
                    value={createForm.packageQuantity}
                    onChange={handleCreateChange}
                    className="input-field"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-secondary mb-1 block text-sm font-medium">{t('ingredients.columns.packagePrice')}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="packagePrice"
                  value={createForm.packagePrice}
                  onChange={handleCreateChange}
                  className="input-field"
                  required
                />
              </label>

              <ImageUploadField
                label={t('ingredients.columns.image')}
                selectedFileName={createImageFile?.name}
                onFileSelect={(file) => setCreateImageFile(file || null)}
              />

              {createError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p> : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError('')
                    setCreateForm(initialCreateForm)
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
                >
                  {t('ingredients.create.cancel')}
                </button>
                <button type="submit" disabled={isCreating} className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                  {isCreating ? t('ingredients.create.creating') : t('ingredients.create.confirmButton')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {previewItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-primary mb-2 font-serif text-xl">{previewItem.name}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.1fr_1fr]">
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                {previewItem.imageUrl ? (
                  <img src={resolveUploadUrl(previewItem.imageUrl)} alt="ingredient" className="h-56 w-full rounded border border-slate-200 bg-white object-contain" />
                ) : (
                  <div className="flex h-56 items-center justify-center rounded border border-slate-200 bg-white text-xs text-slate-500">{t('ingredients.columns.image')}: -</div>
                )}
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/60 p-3 text-sm">
                <div className="divide-y divide-slate-200/80">
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('ingredients.columns.manufacturer')}:</strong><span>{previewItem.manufacturer || '-'}</span></p>
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('ingredients.columns.packageUnit')}:</strong><span>{previewItem.packageUnit}</span></p>
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('ingredients.columns.packageQuantity')}:</strong><span>{previewItem.packageQuantity}</span></p>
                  <p className="flex items-center justify-between gap-2 py-1"><strong>{t('ingredients.columns.baseUnit')}:</strong><span>{previewItem.baseUnit}</span></p>
                  <p className="flex items-center justify-between gap-2 pt-1.5"><strong>{t('ingredients.columns.unitPrice')}:</strong><span className="font-semibold">{formatMoney(previewItem.unitPrice)}</span></p>
                  <p className="flex items-center justify-between gap-2 pt-1.5"><strong>{t('ingredients.columns.packagePrice')}:</strong><span className="font-semibold">{formatMoney(previewItem.packagePrice)}</span></p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={() => setPreviewItem(null)}>{t('recipes.preview.close')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default IngredientsPage
