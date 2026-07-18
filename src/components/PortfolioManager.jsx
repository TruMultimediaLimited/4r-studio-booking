import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { PORTFOLIO_CATEGORIES, CATEGORY_LABELS_BN, compressImage, getPortfolioImageUrl } from '../lib/portfolio.js'
import { IconUpload, IconTrash, IconAlert, IconInbox } from './icons.jsx'

function inputClass() {
  return 'w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-xs outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15'
}

export default function PortfolioManager({ onError }) {
  const fileInputRef = useRef(null)

  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(true)

  const [pendingFile, setPendingFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(PORTFOLIO_CATEGORIES[0])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [deletingId, setDeletingId] = useState(null)

  async function loadItems() {
    setItemsLoading(true)
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) {
      onError?.('Could not load portfolio items', error)
    } else {
      setItems(data || [])
    }
    setItemsLoading(false)
  }

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function pickFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('শুধু ছবি ফাইল সিলেক্ট করুন')
      return
    }
    setUploadError('')
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function clearPending() {
    setPendingFile(null)
    setPreviewUrl(null)
    setTitle('')
    setCategory(PORTFOLIO_CATEGORIES[0])
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUpload() {
    if (!pendingFile) return
    setUploadError('')
    setUploading(true)
    try {
      const { blob, mimeType, extension } = await compressImage(pendingFile)
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

      const { error: uploadErr } = await supabase.storage
        .from('portfolio')
        .upload(path, blob, { contentType: mimeType })
      if (uploadErr) throw uploadErr

      const { error: insertErr } = await supabase
        .from('portfolio_items')
        .insert({ title: title.trim() || null, category, storage_path: path })
      if (insertErr) {
        await supabase.storage.from('portfolio').remove([path])
        throw insertErr
      }

      clearPending()
      loadItems()
    } catch (err) {
      setUploadError('আপলোড করা যায়নি: ' + (err.message || 'unknown error'))
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(item) {
    if (!confirm('এই ছবিটা স্থায়ীভাবে মুছে ফেলবেন?')) return
    setDeletingId(item.id)
    const { error: storageErr } = await supabase.storage.from('portfolio').remove([item.storage_path])
    if (storageErr) {
      onError?.('Could not delete image file', storageErr)
      setDeletingId(null)
      return
    }
    const { error: dbErr } = await supabase.from('portfolio_items').delete().eq('id', item.id)
    if (dbErr) {
      onError?.('Could not delete portfolio item', dbErr)
      setDeletingId(null)
      return
    }
    setDeletingId(null)
    loadItems()
  }

  return (
    <div className="space-y-4">
      <div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pickFile(e.dataTransfer.files?.[0])
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#E0E0E0] rounded-xl p-4 text-center cursor-pointer hover:border-pine/40 hover:bg-pine/5 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {previewUrl ? (
            <img src={previewUrl} alt="" className="mx-auto h-28 w-28 object-cover rounded-lg" />
          ) : (
            <>
              <IconUpload className="h-5 w-5 mx-auto text-[#333333]/45 mb-1" />
              <p className="text-xs text-[#333333]/60">ছবি সিলেক্ট করুন বা এখানে টেনে আনুন</p>
            </>
          )}
        </div>

        {pendingFile && (
          <div className="mt-2.5 space-y-2">
            <input
              type="text"
              placeholder="টাইটেল (ঐচ্ছিক)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className={inputClass()}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass()}>
              {PORTFOLIO_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS_BN[cat] || cat}</option>
              ))}
            </select>
            {uploadError && (
              <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3 py-2">
                <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {uploadError}
              </p>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={clearPending}
                className="flex-1 border border-[#E0E0E0] rounded-lg py-1.5 text-xs font-medium text-[#333333]/60"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={handleUpload}
                className="flex-1 bg-pine text-white rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {uploading ? 'আপলোড হচ্ছে…' : 'আপলোড করুন'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-[#333333]/55 font-semibold mb-1.5">
          {itemsLoading ? 'লোড হচ্ছে…' : `আপলোড করা ছবি (${items.length})`}
        </p>
        {!itemsLoading && items.length === 0 ? (
          <p className="flex flex-col items-center gap-1.5 text-xs text-[#333333]/45 py-6 text-center">
            <IconInbox className="h-5 w-5" /> এখনো কোনো ছবি নেই
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {items.map((item) => (
              <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border border-[#E0E0E0]/70 bg-mist/20">
                <img src={getPortfolioImageUrl(item.storage_path)} alt={item.title || item.category} className="h-full w-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[9px] font-medium px-1.5 py-1 truncate">
                  {CATEGORY_LABELS_BN[item.category] || item.category}
                </span>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                  aria-label="ডিলিট করুন"
                  className="absolute top-1 right-1 flex items-center justify-center h-6 w-6 rounded-full bg-black/55 text-white hover:bg-clay disabled:opacity-50"
                >
                  <IconTrash className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
