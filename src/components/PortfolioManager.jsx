import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { compressImage, getPortfolioImageUrl } from '../lib/portfolio.js'
import { IconUpload, IconTrash, IconAlert, IconInbox, IconChevronLeft, IconPlus, IconImage } from './icons.jsx'

function inputClass() {
  return 'w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-xs outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine/15'
}

// Compresses+uploads one file to the portfolio bucket, returns its storage path.
async function uploadOne(file) {
  const { blob, mimeType, extension } = await compressImage(file)
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  const { error } = await supabase.storage.from('portfolio').upload(path, blob, { contentType: mimeType })
  if (error) throw error
  return path
}

export default function PortfolioManager({ onError }) {
  const [albums, setAlbums] = useState([])
  const [albumsLoading, setAlbumsLoading] = useState(true)
  const [selectedAlbum, setSelectedAlbum] = useState(null)

  const [newAlbumName, setNewAlbumName] = useState('')
  const [newAlbumCoverFile, setNewAlbumCoverFile] = useState(null)
  const [newAlbumCoverPreview, setNewAlbumCoverPreview] = useState(null)
  const [creatingAlbum, setCreatingAlbum] = useState(false)
  const [createAlbumError, setCreateAlbumError] = useState('')
  const coverInputRef = useRef(null)

  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)

  const fileInputRef = useRef(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [deletingId, setDeletingId] = useState(null)
  const [deletingAlbumId, setDeletingAlbumId] = useState(null)

  async function loadAlbums() {
    setAlbumsLoading(true)
    const { data, error } = await supabase
      .from('portfolio_albums')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) {
      onError?.('Could not load portfolio albums', error)
    } else {
      setAlbums(data || [])
    }
    setAlbumsLoading(false)
  }

  useEffect(() => {
    loadAlbums()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (newAlbumCoverPreview) URL.revokeObjectURL(newAlbumCoverPreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, newAlbumCoverPreview])

  async function loadItems(albumId) {
    setItemsLoading(true)
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('album_id', albumId)
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error) {
      onError?.('Could not load album photos', error)
    } else {
      setItems(data || [])
    }
    setItemsLoading(false)
  }

  function openAlbum(album) {
    setSelectedAlbum(album)
    clearPendingPhoto()
    loadItems(album.id)
  }

  function pickCoverFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    setNewAlbumCoverFile(file)
    setNewAlbumCoverPreview(URL.createObjectURL(file))
  }

  async function handleCreateAlbum() {
    setCreateAlbumError('')
    if (!newAlbumName.trim()) {
      setCreateAlbumError('অ্যালবামের নাম দিন')
      return
    }
    setCreatingAlbum(true)
    try {
      let coverPath = null
      if (newAlbumCoverFile) coverPath = await uploadOne(newAlbumCoverFile)

      const { error } = await supabase
        .from('portfolio_albums')
        .insert({ name: newAlbumName.trim(), cover_storage_path: coverPath })
      if (error) throw error

      setNewAlbumName('')
      setNewAlbumCoverFile(null)
      setNewAlbumCoverPreview(null)
      if (coverInputRef.current) coverInputRef.current.value = ''
      loadAlbums()
    } catch (err) {
      setCreateAlbumError('অ্যালবাম তৈরি করা যায়নি: ' + (err.message || 'unknown error'))
    } finally {
      setCreatingAlbum(false)
    }
  }

  async function handleDeleteAlbum(album, e) {
    e?.stopPropagation()
    if (!confirm(`"${album.name}" অ্যালবামটা এবং এর সব ছবি স্থায়ীভাবে মুছে ফেলবেন?`)) return
    setDeletingAlbumId(album.id)

    const { data: albumItems, error: itemsErr } = await supabase
      .from('portfolio_items')
      .select('storage_path')
      .eq('album_id', album.id)
    if (itemsErr) {
      onError?.('Could not load album photos before delete', itemsErr)
      setDeletingAlbumId(null)
      return
    }

    const paths = (albumItems || []).map((i) => i.storage_path)
    if (album.cover_storage_path) paths.push(album.cover_storage_path)
    if (paths.length > 0) {
      const { error: removeErr } = await supabase.storage.from('portfolio').remove(paths)
      if (removeErr) {
        onError?.('Could not delete album image files', removeErr)
        setDeletingAlbumId(null)
        return
      }
    }

    const { error: itemsDelErr } = await supabase.from('portfolio_items').delete().eq('album_id', album.id)
    if (itemsDelErr) {
      onError?.('Could not delete album photos', itemsDelErr)
      setDeletingAlbumId(null)
      return
    }

    const { error: albumDelErr } = await supabase.from('portfolio_albums').delete().eq('id', album.id)
    if (albumDelErr) {
      onError?.('Could not delete album', albumDelErr)
      setDeletingAlbumId(null)
      return
    }

    setDeletingAlbumId(null)
    if (selectedAlbum?.id === album.id) setSelectedAlbum(null)
    loadAlbums()
  }

  function pickPhotoFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('শুধু ছবি ফাইল সিলেক্ট করুন')
      return
    }
    setUploadError('')
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function clearPendingPhoto() {
    setPendingFile(null)
    setPreviewUrl(null)
    setTitle('')
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUploadPhoto() {
    if (!pendingFile || !selectedAlbum) return
    setUploadError('')
    setUploading(true)
    try {
      const path = await uploadOne(pendingFile)

      const { error: insertErr } = await supabase
        .from('portfolio_items')
        .insert({ title: title.trim() || null, album_id: selectedAlbum.id, storage_path: path })
      if (insertErr) {
        await supabase.storage.from('portfolio').remove([path])
        throw insertErr
      }

      // First photo in an album automatically becomes its cover.
      if (!selectedAlbum.cover_storage_path) {
        await supabase.from('portfolio_albums').update({ cover_storage_path: path }).eq('id', selectedAlbum.id)
        setSelectedAlbum((a) => ({ ...a, cover_storage_path: path }))
      }

      clearPendingPhoto()
      loadItems(selectedAlbum.id)
      loadAlbums()
    } catch (err) {
      setUploadError('আপলোড করা যায়নি: ' + (err.message || 'unknown error'))
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteItem(item) {
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
    if (selectedAlbum && item.storage_path === selectedAlbum.cover_storage_path) {
      await supabase.from('portfolio_albums').update({ cover_storage_path: null }).eq('id', selectedAlbum.id)
      setSelectedAlbum((a) => ({ ...a, cover_storage_path: null }))
    }
    setDeletingId(null)
    loadItems(selectedAlbum.id)
    loadAlbums()
  }

  // ---------------------------------------------------------------
  // Album detail view
  // ---------------------------------------------------------------
  if (selectedAlbum) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedAlbum(null)}
          className="flex items-center gap-1 text-xs font-semibold text-[#333333]/70 hover:text-[#333333]"
        >
          <IconChevronLeft className="h-3.5 w-3.5" /> অ্যালবাম তালিকা
        </button>
        <p className="text-sm font-bold text-[#333333]">{selectedAlbum.name}</p>

        <div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              pickPhotoFile(e.dataTransfer.files?.[0])
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#E0E0E0] rounded-xl p-4 text-center cursor-pointer hover:border-pine/40 hover:bg-pine/5 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickPhotoFile(e.target.files?.[0])}
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
              {uploadError && (
                <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3 py-2">
                  <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {uploadError}
                </p>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={clearPendingPhoto}
                  className="flex-1 border border-[#E0E0E0] rounded-lg py-1.5 text-xs font-medium text-[#333333]/60"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleUploadPhoto}
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
            {itemsLoading ? 'লোড হচ্ছে…' : `ছবি (${items.length})`}
          </p>
          {!itemsLoading && items.length === 0 ? (
            <p className="flex flex-col items-center gap-1.5 text-xs text-[#333333]/45 py-6 text-center">
              <IconInbox className="h-5 w-5" /> এখনো কোনো ছবি নেই
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {items.map((item) => (
                <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border border-[#E0E0E0]/70 bg-mist/20">
                  <img src={getPortfolioImageUrl(item.storage_path)} alt={item.title || ''} className="h-full w-full object-cover" />
                  <button
                    onClick={() => handleDeleteItem(item)}
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

  // ---------------------------------------------------------------
  // Album list view
  // ---------------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="border border-[#E0E0E0]/70 rounded-xl p-2.5 space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-[#333333]/55 font-semibold">নতুন অ্যালবাম</p>
        <input
          type="text"
          placeholder="অ্যালবামের নাম (যেমন: Wedding)"
          value={newAlbumName}
          onChange={(e) => setNewAlbumName(e.target.value)}
          maxLength={100}
          className={inputClass()}
        />
        <div className="flex items-center gap-2">
          <div
            onClick={() => coverInputRef.current?.click()}
            className="shrink-0 h-14 w-14 rounded-lg border-2 border-dashed border-[#E0E0E0] flex items-center justify-center cursor-pointer hover:border-pine/40 overflow-hidden"
          >
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickCoverFile(e.target.files?.[0])}
            />
            {newAlbumCoverPreview ? (
              <img src={newAlbumCoverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <IconImage className="h-4 w-4 text-[#333333]/40" />
            )}
          </div>
          <p className="text-[11px] text-[#333333]/55 flex-1">কভার ফটো (ঐচ্ছিক)</p>
          <button
            type="button"
            disabled={creatingAlbum}
            onClick={handleCreateAlbum}
            className="flex items-center gap-1 bg-pine text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <IconPlus className="h-3 w-3" /> {creatingAlbum ? 'তৈরি হচ্ছে…' : 'তৈরি করুন'}
          </button>
        </div>
        {createAlbumError && (
          <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3 py-2">
            <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {createAlbumError}
          </p>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-[#333333]/55 font-semibold mb-1.5">
          {albumsLoading ? 'লোড হচ্ছে…' : `অ্যালবাম (${albums.length})`}
        </p>
        {!albumsLoading && albums.length === 0 ? (
          <p className="flex flex-col items-center gap-1.5 text-xs text-[#333333]/45 py-6 text-center">
            <IconInbox className="h-5 w-5" /> এখনো কোনো অ্যালবাম নেই
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {albums.map((album) => (
              <button
                key={album.id}
                onClick={() => openAlbum(album)}
                className="relative aspect-square rounded-lg overflow-hidden border border-[#E0E0E0]/70 bg-mist/20 text-left"
              >
                {album.cover_storage_path ? (
                  <img src={getPortfolioImageUrl(album.cover_storage_path)} alt={album.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <IconImage className="h-5 w-5 text-[#333333]/25" />
                  </div>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[9px] font-medium px-1.5 py-1 truncate">
                  {album.name}
                </span>
                <button
                  onClick={(e) => handleDeleteAlbum(album, e)}
                  disabled={deletingAlbumId === album.id}
                  aria-label="অ্যালবাম ডিলিট করুন"
                  className="absolute top-1 right-1 flex items-center justify-center h-6 w-6 rounded-full bg-black/55 text-white hover:bg-clay disabled:opacity-50"
                >
                  <IconTrash className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
