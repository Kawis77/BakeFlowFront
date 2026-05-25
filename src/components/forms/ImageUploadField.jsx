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

export default ImageUploadField
