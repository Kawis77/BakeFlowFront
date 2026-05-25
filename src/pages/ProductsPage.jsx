import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ImageUploadField from '../components/forms/ImageUploadField'
import { createProduct, deleteProduct, getProducts, getRecipes, updateProduct, uploadProductImage } from '../lib/api'

const initialForm = {
  name: '',
  description: '',
  sellingPrice: '',
  targetDiameterCm: '',
  recipeId: '',
  tiers: [{ diameterCm: '' }],
}

function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toFixed(2)
}

function formatStatus(value, t) {
  if (value === 'ACTIVE') return t('products.values.active')
  if (value === 'INACTIVE') return t('products.values.inactive')
  return value || '-'
}

function normalizeTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) return [{ diameterCm: '' }]
  return tiers.map((tier) => ({ diameterCm: tier?.diameterCm ?? '' }))
}

function ProductsPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [recipeOptions, setRecipeOptions] = useState([])
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

  const loadProducts = async () => {
    const { data } = await getProducts()
    setItems(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const [{ data: products }, { data: recipes }] = await Promise.all([
          getProducts(),
          getRecipes('FINAL'),
        ])
        if (!mounted) return
        setItems(Array.isArray(products) ? products : [])
        setRecipeOptions(Array.isArray(recipes) ? recipes : [])
        setError('')
      } catch (err) {
        if (!mounted) return
        setError(err?.response?.data?.message ?? t('products.errors.loadFailed'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [t])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => item.name?.toLowerCase().includes(q))
  }, [items, query])

  const openEdit = (item) => {
    setEditItem(item)
    setEditError('')
    setEditForm({
      name: item.name ?? '',
      description: item.description ?? '',
      sellingPrice: item.sellingPrice ?? '',
      targetDiameterCm: item.targetDiameterCm ?? '',
      recipeId: item.recipeId ?? '',
      tiers: normalizeTiers(item.tiers),
    })
    setEditImageFile(null)
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setIsCreating(true)
    setCreateError('')
    try {
      const { data: productId } = await createProduct({
        name: createForm.name,
        description: createForm.description || null,
        sellingPrice: Number(createForm.sellingPrice),
        targetDiameterCm: createForm.tiers?.[0]?.diameterCm ? Number(createForm.tiers[0].diameterCm) : (createForm.targetDiameterCm ? Number(createForm.targetDiameterCm) : null),
        recipeId: Number(createForm.recipeId),
        tiers: (createForm.tiers || [])
          .map((tier) => ({ diameterCm: Number(tier.diameterCm) }))
          .filter((tier) => Number.isFinite(tier.diameterCm) && tier.diameterCm > 0),
        extraItems: [],
      })
      if (createImageFile && productId) {
        await uploadProductImage(productId, createImageFile)
      }
      await loadProducts()
      setShowCreateModal(false)
      setCreateForm(initialForm)
      setCreateImageFile(null)
    } catch (err) {
      setCreateError(err?.response?.data?.message ?? t('products.errors.createFailed'))
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
      await updateProduct(editItem.id, {
        name: editForm.name,
        description: editForm.description || null,
        sellingPrice: Number(editForm.sellingPrice),
        targetDiameterCm: editForm.tiers?.[0]?.diameterCm ? Number(editForm.tiers[0].diameterCm) : (editForm.targetDiameterCm ? Number(editForm.targetDiameterCm) : null),
        recipeId: Number(editForm.recipeId),
        tiers: (editForm.tiers || [])
          .map((tier) => ({ diameterCm: Number(tier.diameterCm) }))
          .filter((tier) => Number.isFinite(tier.diameterCm) && tier.diameterCm > 0),
        extraItems: [],
      })
      if (editImageFile) {
        await uploadProductImage(editItem.id, editImageFile)
      }
      await loadProducts()
      setEditItem(null)
      setEditForm(initialForm)
      setEditImageFile(null)
    } catch (err) {
      setEditError(err?.response?.data?.message ?? t('products.errors.updateFailed'))
    } finally {
      setIsEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    setIsDeleting(true)
    try {
      await deleteProduct(deleteItem.id)
      setItems((prev) => prev.filter((item) => item.id !== deleteItem.id))
      setDeleteItem(null)
    } catch (err) {
      setError(err?.response?.data?.message ?? t('products.errors.deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-primary font-serif text-2xl">{t('products.title')}</h2>
          <p className="text-muted text-sm">{t('products.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('products.searchPlaceholder')} className="input-field min-w-56" />
          <button type="button" className="primary-btn w-auto px-4 py-2.5 text-xs" onClick={() => setShowCreateModal(true)}>{t('products.addButton')}</button>
        </div>
      </div>

      {error ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse bg-white/80">
            <thead className="bg-slate-50/90">
              <tr>
                {['name', 'recipe', 'targetDiameter', 'sellingPrice', 'productionCost', 'profit', 'margin', 'status', 'actions'].map((key) => (
                  <th key={key} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t(`products.columns.${key}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">{t('products.loading')}</td></tr> : null}
              {!loading && filtered.length === 0 ? <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">{t('products.empty')}</td></tr> : null}
              {!loading && filtered.map((item) => (
                <tr key={item.id} className="cursor-pointer hover:bg-slate-50/80" onDoubleClick={() => setPreviewItem(item)}>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-800">{item.name}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.recipeName}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.targetDiameterCm ?? '-'}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatMoney(item.sellingPrice)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatMoney(item.productionCost)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatMoney(item.profit)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{item.marginPercentage != null ? `${Number(item.marginPercentage).toFixed(2)}%` : '-'}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{formatStatus(item.status, t)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <button type="button" className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700 hover:bg-sky-100" onClick={() => setPreviewItem(item)}>{t('products.actions.view')}</button>
                      <button type="button" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => openEdit(item)}>{t('products.actions.edit')}</button>
                      <button type="button" className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100" onClick={() => setDeleteItem(item)}>{t('products.actions.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal ? (
        <ProductModal
          title={t('products.create.title')}
          subtitle={t('products.create.subtitle')}
          form={createForm}
          setForm={setCreateForm}
          recipeOptions={recipeOptions}
          error={createError}
          onCancel={() => { setShowCreateModal(false); setCreateForm(initialForm); setCreateError(''); setCreateImageFile(null) }}
          onSubmit={handleCreate}
          submitLabel={isCreating ? t('products.create.creating') : t('products.create.confirmButton')}
          disabled={isCreating}
          imageFile={createImageFile}
          setImageFile={setCreateImageFile}
          existingImageUrl={null}
          t={t}
        />
      ) : null}

      {editItem ? (
        <ProductModal
          title={t('products.edit.title')}
          subtitle={t('products.edit.subtitle')}
          form={editForm}
          setForm={setEditForm}
          recipeOptions={recipeOptions}
          error={editError}
          onCancel={() => { setEditItem(null); setEditForm(initialForm); setEditError(''); setEditImageFile(null) }}
          onSubmit={handleEdit}
          submitLabel={isEditing ? t('products.edit.saving') : t('products.edit.confirmButton')}
          disabled={isEditing}
          imageFile={editImageFile}
          setImageFile={setEditImageFile}
          existingImageUrl={editItem.imageUrl || null}
          t={t}
        />
      ) : null}

      {deleteItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-primary mb-2 font-serif text-xl">{t('products.delete.title')}</h3>
            <p className="text-muted mb-4 text-sm">{t('products.delete.confirm')} <strong>{deleteItem.name}</strong>?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={() => setDeleteItem(null)}>{t('products.delete.cancel')}</button>
              <button type="button" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? t('products.delete.deleting') : t('products.delete.confirmButton')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {previewItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="modal-panel w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-primary mb-2 font-serif text-xl">{previewItem.name}</h3>
            {previewItem.imageUrl ? <img src={previewItem.imageUrl} alt={previewItem.name} className="mb-3 h-40 w-full rounded-lg border border-slate-200 object-cover" /> : null}
            <p className="text-muted mb-3 text-sm">{previewItem.description || '-'}</p>
            <div className="rounded border border-slate-200 bg-slate-50/60 p-3 text-sm">
              <div className="divide-y divide-slate-200/80">
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('products.columns.recipe')}:</strong><span>{previewItem.recipeName || '-'}</span></p>
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('products.columns.targetDiameter')}:</strong><span>{previewItem.targetDiameterCm ?? '-'}</span></p>
                <div className="py-1">
                  <p className="mb-1 flex items-center justify-between gap-2"><strong>{t('products.tiers.title')}:</strong><span>{Array.isArray(previewItem.tiers) && previewItem.tiers.length > 0 ? previewItem.tiers.length : 1}</span></p>
                  <div className="space-y-1">
                    {(Array.isArray(previewItem.tiers) && previewItem.tiers.length > 0
                      ? previewItem.tiers
                      : [{ diameterCm: previewItem.targetDiameterCm }]).map((tier, index) => (
                        <p key={`${tier?.id ?? 'tier'}-${index}`} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                          <span>{t('products.tiers.tierLabel', { number: index + 1 })}</span>
                          <span>{tier?.diameterCm ?? '-'} cm</span>
                        </p>
                      ))}
                  </div>
                </div>
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('products.columns.sellingPrice')}:</strong><span>{formatMoney(previewItem.sellingPrice)}</span></p>
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('products.columns.productionCost')}:</strong><span>{formatMoney(previewItem.productionCost)}</span></p>
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('products.columns.profit')}:</strong><span>{formatMoney(previewItem.profit)}</span></p>
                <p className="flex items-center justify-between gap-2 py-1"><strong>{t('products.columns.margin')}:</strong><span>{previewItem.marginPercentage != null ? `${Number(previewItem.marginPercentage).toFixed(2)}%` : '-'}</span></p>
                <p className="flex items-center justify-between gap-2 pt-1.5"><strong>{t('products.columns.status')}:</strong><span>{formatStatus(previewItem.status, t)}</span></p>
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

function ProductModal({ title, subtitle, form, setForm, recipeOptions, error, onCancel, onSubmit, submitLabel, disabled, imageFile, setImageFile, existingImageUrl, t }) {
  const selectedRecipe = recipeOptions.find((recipe) => String(recipe.id) === String(form.recipeId))
  const canScaleByDiameter = selectedRecipe?.shape === 'ROUND' && (selectedRecipe?.category === 'CAKE' || selectedRecipe?.category === 'PASTRY') && Number(selectedRecipe?.baseDiameterCm) > 0
  const canUseTiers = selectedRecipe?.shape === 'ROUND' && selectedRecipe?.category === 'CAKE' && Number(selectedRecipe?.baseDiameterCm) > 0
  const baseRecipeCost = Number(selectedRecipe?.totalCost || 0)
  const modalTiers = canUseTiers
    ? (Array.isArray(form.tiers) && form.tiers.length > 0 ? form.tiers : [{ diameterCm: form.targetDiameterCm || '' }])
    : [{ diameterCm: form.targetDiameterCm || '' }]
  const tierPreviews = modalTiers.map((tier, index) => {
    const diameter = Number(tier?.diameterCm)
    const factor = canScaleByDiameter && diameter > 0
      ? (diameter / Number(selectedRecipe.baseDiameterCm)) ** 2
      : 1
    const tierCost = Number.isFinite(baseRecipeCost * factor) ? (baseRecipeCost * factor) : 0
    return { index, diameter, factor, tierCost }
  })
  const scaledProductionPreview = tierPreviews.reduce((sum, item) => sum + item.tierCost, 0)
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
      <div className="modal-panel flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h3 className="text-primary mb-2 font-serif text-xl">{title}</h3>
        <p className="text-muted mb-4 text-sm">{subtitle}</p>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 overflow-y-auto pr-1">
            <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('products.columns.name')}</span>
            <input className="input-field" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            </label>
            <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('products.columns.recipe')}</span>
            <select className="input-field" value={form.recipeId} onChange={(e) => setForm((p) => ({ ...p, recipeId: e.target.value }))} required>
              <option value="">{t('products.selectRecipe')}</option>
              {recipeOptions.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
            </select>
            </label>
            {canUseTiers ? (
              <div className="rounded border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-secondary text-sm font-medium">{t('products.tiers.title')}</span>
                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => setForm((p) => ({ ...p, tiers: [...(p.tiers || []), { diameterCm: '' }] }))}
                  >
                    {t('products.tiers.add')}
                  </button>
                </div>
                <div className="space-y-2">
                  {modalTiers.map((tier, index) => (
                    <div key={`tier-${index}`} className="flex items-end gap-2">
                      <label className="block flex-1">
                        <span className="text-secondary mb-1 block text-xs font-medium">{t('products.tiers.tierLabel', { number: index + 1 })}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="input-field"
                          value={tier.diameterCm}
                          onChange={(e) => setForm((p) => ({
                            ...p,
                            tiers: (p.tiers || []).map((it, idx) => idx === index ? { ...it, diameterCm: e.target.value } : it),
                            targetDiameterCm: index === 0 ? e.target.value : (p.targetDiameterCm || ''),
                          }))}
                        />
                      </label>
                      <button
                        type="button"
                        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-60"
                        onClick={() => setForm((p) => {
                          const nextTiers = (p.tiers || []).filter((_, idx) => idx !== index)
                          return {
                            ...p,
                            tiers: nextTiers.length > 0 ? nextTiers : [{ diameterCm: '' }],
                            targetDiameterCm: nextTiers[0]?.diameterCm || '',
                          }
                        })}
                        disabled={modalTiers.length <= 1}
                      >
                        {t('products.tiers.remove')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {!canUseTiers ? (
              <label className="block">
                <span className="text-secondary mb-1 block text-sm font-medium">{t('products.columns.targetDiameter')}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={`input-field ${!canScaleByDiameter ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                  value={canScaleByDiameter ? form.targetDiameterCm : ''}
                  onChange={(e) => setForm((p) => ({ ...p, targetDiameterCm: e.target.value }))}
                  disabled={!canScaleByDiameter}
                  placeholder={canScaleByDiameter ? '' : '-'}
                />
              </label>
            ) : null}
            <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('products.columns.sellingPrice')}</span>
            <input type="number" step="0.01" min="0.01" className="input-field" value={form.sellingPrice} onChange={(e) => setForm((p) => ({ ...p, sellingPrice: e.target.value }))} required />
            </label>
            <p className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <strong>{t('products.columns.productionCost')}:</strong> {formatMoney(scaledProductionPreview)}
            </p>
            {canScaleByDiameter ? (
              <div className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <div className="space-y-1">
                  {tierPreviews.map((tier) => (
                    <p key={`tier-preview-${tier.index}`} className="flex items-center justify-between gap-2">
                      <span>{t('products.tiers.tierLabel', { number: tier.index + 1 })}</span>
                      <span>x{tier.factor.toFixed(2)} • {formatMoney(tier.tierCost)}</span>
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="block">
            <span className="text-secondary mb-1 block text-sm font-medium">{t('products.columns.description')}</span>
            <textarea className="input-field min-h-20" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </label>
            <ImageUploadField
              label={t('products.columns.image')}
              selectedFileName={imageFile?.name || ''}
              previewUrl={imagePreviewUrl}
              onFileSelect={setImageFile}
            />
            {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          </div>
          <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700" onClick={onCancel}>{t('products.create.cancel')}</button>
            <button type="submit" className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60" disabled={disabled}>{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProductsPage
