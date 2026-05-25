import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ImageUploadField from '../components/forms/ImageUploadField'
import { createExtraItem, deleteExtraItem, getExtraItems, updateExtraItem, uploadExtraItemImage } from '../lib/api'

const unitOptions = ['PIECE', 'G', 'KG', 'ML', 'L']
const categoryOptions = ['BASE', 'BOX', 'OTHER']

const initialForm = {
  name: '',
  manufacturer: '',
  category: 'OTHER',
  unit: 'PIECE',
  unitCost: '',
}

function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toFixed(2)
}

function formatStatus(value, t) {
  if (value === 'ACTIVE') return t('extraItems.values.active')
  if (value === 'INACTIVE') return t('extraItems.values.inactive')
  return value || '-'
}

function formatUnit(value, t) {
  if (!value) return '-'
  const key = `units.${String(value).toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

function formatCategory(value, t) {
  if (!value) return '-'
  const key = `extraItems.categoryOptions.${String(value).toLowerCase()}`
  const translated = t(key)
  return translated === key ? value : translated
}

function ExtraItemsPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState(initialForm)
  const [createError, setCreateError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createImageFile, setCreateImageFile] = useState(null)

  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState(initialForm)
  const [editError, setEditError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editImageFile, setEditImageFile] = useState(null)

  const [deleteItem, setDeleteItem] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [previewItem, setPreviewItem] = useState(null)

  const loadItems = async () => {
    const { data } = await getExtraItems()
    setItems(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const { data } = await getExtraItems()
        if (!mounted) return
        setItems(Array.isArray(data) ? data : [])
        setError('')
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message ?? t('extraItems.errors.loadFailed'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [t])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      item.name?.toLowerCase().includes(q)
      || item.manufacturer?.toLowerCase().includes(q)
    )
  }, [items, query])

  const openEdit = (item) => {
    setEditItem(item)
    setEditError('')
    setEditForm({
      name: item.name ?? '',
      manufacturer: item.manufacturer ?? '',
      category: item.category ?? 'OTHER',
      unit: item.unit ?? 'PIECE',
      unitCost: item.unitCost ?? '',
    })
    setEditImageFile(null)
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setIsCreating(true)
    setCreateError('')
    try {
      const { data: extraItemId } = await createExtraItem({
        name: createForm.name,
        manufacturer: createForm.manufacturer || null,
        category: createForm.category,
        unit: createForm.unit,
        unitCost: Number(createForm.unitCost),
      })
      if (createImageFile && extraItemId) {
        await uploadExtraItemImage(extraItemId, createImageFile)
      }
      await loadItems()
      setShowCreateModal(false)
      setCreateForm(initialForm)
      setCreateImageFile(null)
    } catch (err) {
      setCreateError(err?.response?.data?.message ?? t('extraItems.errors.createFailed'))
    } finally {
      setIsCreating(false)
    }
  }

  const handleEdit = async (event) => {
    event.preventDefault()
    if (!editItem) return
    setIsEditing(true)
    setEditError('')
    try {
      await updateExtraItem(editItem.id, {
        name: editForm.name,
        manufacturer: editForm.manufacturer || null,
        category: editForm.category,
        unit: editForm.unit,
        unitCost: Number(editForm.unitCost),
      })
      if (editImageFile) {
        await uploadExtraItemImage(editItem.id, editImageFile)
      }
      await loadItems()
      setEditItem(null)
      setEditForm(initialForm)
      setEditImageFile(null)
    } catch (err) {
      setEditError(err?.response?.data?.message ?? t('extraItems.errors.updateFailed'))
    } finally {
      setIsEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    setIsDeleting(true)
    try {
      await deleteExtraItem(deleteItem.id)
      setItems((prev) => prev.filter((item) => item.id !== deleteItem.id))
      setDeleteItem(null)
    } catch (err) {
      setError(err?.response?.data?.message ?? t('extraItems.errors.deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-primary font-serif text-2xl">{t('extraItems.title')}</h2>
          <p className="text-muted text-sm">{t('extraItems.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('extraItems.searchPlaceholder')} className="input-field min-w-56" />
          <button type="button" className="primary-btn w-auto px-4 py-2.5 text-xs" onClick={() => setShowCreateModal(true)}>{t('extraItems.addButton')}</button>
        </div>
      </div>

      {error ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse bg-white/80">
            <thead className="bg-slate-50/90">
              <tr>
                {['name', 'manufacturer', 'category', 'unit', 'unitCost', 'status', 'actions'].map((key) => (
                  <th key={key} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t(`extraItems.columns.${key}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">{t('extraItems.loading')}</td></tr> : null}
              {!loading && filtered.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">{t('extraItems.empty')}</td></tr> : null}
              {!loading && filtered.map((item) => (
                <tr key={item.id} className="cursor-pointer hover:bg-slate-50/80" onDoubleClick={() => setPreviewItem(item)}>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-800">{item.name}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.manufacturer || '-'}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatCategory(item.category, t)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatUnit(item.unit, t)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatMoney(item.unitCost)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatStatus(item.status, t)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <button type="button" className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700 hover:bg-sky-100" onClick={() => setPreviewItem(item)}>{t('extraItems.actions.view')}</button>
                      <button type="button" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => openEdit(item)}>{t('extraItems.actions.edit')}</button>
                      <button type="button" className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100" onClick={() => setDeleteItem(item)}>{t('extraItems.actions.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal ? <ExtraItemModal title={t('extraItems.create.title')} subtitle={t('extraItems.create.subtitle')} form={createForm} setForm={setCreateForm} error={createError} onCancel={() => { setShowCreateModal(false); setCreateForm(initialForm); setCreateError(''); setCreateImageFile(null) }} onSubmit={handleCreate} submitLabel={isCreating ? t('extraItems.create.creating') : t('extraItems.create.confirmButton')} disabled={isCreating} imageFile={createImageFile} setImageFile={setCreateImageFile} existingImageUrl={null} t={t} /> : null}
      {editItem ? <ExtraItemModal title={t('extraItems.edit.title')} subtitle={t('extraItems.edit.subtitle')} form={editForm} setForm={setEditForm} error={editError} onCancel={() => { setEditItem(null); setEditForm(initialForm); setEditError(''); setEditImageFile(null) }} onSubmit={handleEdit} submitLabel={isEditing ? t('extraItems.edit.saving') : t('extraItems.edit.confirmButton')} disabled={isEditing} imageFile={editImageFile} setImageFile={setEditImageFile} existingImageUrl={editItem.imageUrl || null} t={t} /> : null}

      {deleteItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-primary mb-2 font-serif text-xl">{t('extraItems.delete.title')}</h3>
            <p className="text-muted mb-4 text-sm">{t('extraItems.delete.confirm')} <strong>{deleteItem.name}</strong>?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={() => setDeleteItem(null)}>{t('extraItems.delete.cancel')}</button>
              <button type="button" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? t('extraItems.delete.deleting') : t('extraItems.delete.confirmButton')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {previewItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-primary mb-2 font-serif text-xl">{previewItem.name}</h3>
            {previewItem.imageUrl ? <img src={previewItem.imageUrl} alt={previewItem.name} className="mb-3 h-40 w-full rounded-lg border border-slate-200 object-cover" /> : null}
            <div className="rounded border border-slate-200 bg-slate-50/60 p-3 text-sm">
              <div className="divide-y divide-slate-200/80">
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('extraItems.columns.unit')}:</strong><span>{formatUnit(previewItem.unit, t)}</span></p>
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('extraItems.columns.manufacturer')}:</strong><span>{previewItem.manufacturer || '-'}</span></p>
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('extraItems.columns.category')}:</strong><span>{formatCategory(previewItem.category, t)}</span></p>
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('extraItems.columns.unitCost')}:</strong><span>{formatMoney(previewItem.unitCost)}</span></p>
                <p className="flex items-center justify-between gap-2 pt-1.5"><strong>{t('extraItems.columns.status')}:</strong><span>{formatStatus(previewItem.status, t)}</span></p>
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

function ExtraItemModal({ title, subtitle, form, setForm, error, onCancel, onSubmit, submitLabel, disabled, imageFile, setImageFile, existingImageUrl, t }) {
  const imagePreviewUrl = useMemo(() => {
    if (!imageFile) return existingImageUrl || ''
    return URL.createObjectURL(imageFile)
  }, [imageFile, existingImageUrl])

  useEffect(() => {
    if (!imageFile || !imagePreviewUrl.startsWith('blob:')) return undefined
    return () => URL.revokeObjectURL(imagePreviewUrl)
  }, [imageFile, imagePreviewUrl])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
      <div className="modal-panel w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h3 className="text-primary mb-2 font-serif text-xl">{title}</h3>
        <p className="text-muted mb-4 text-sm">{subtitle}</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('extraItems.columns.name')}</span>
            <input className="input-field" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          </label>
          <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('extraItems.columns.manufacturer')}</span>
            <input className="input-field" value={form.manufacturer} onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('extraItems.columns.category')}</span>
            <select className="input-field" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} required>
              {categoryOptions.map((category) => <option key={category} value={category}>{formatCategory(category, t)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('extraItems.columns.unit')}</span>
            <select className="input-field" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} required>
              {unitOptions.map((unit) => <option key={unit} value={unit}>{formatUnit(unit, t)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('extraItems.columns.unitCost')}</span>
            <input type="number" step="0.01" min="0.01" className="input-field" value={form.unitCost} onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))} required />
          </label>
          <ImageUploadField
            label={t('extraItems.columns.image')}
            selectedFileName={imageFile?.name || ''}
            previewUrl={imagePreviewUrl}
            onFileSelect={setImageFile}
          />
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={onCancel}>{t('extraItems.create.cancel')}</button>
            <button type="submit" className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60" disabled={disabled}>{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ExtraItemsPage
