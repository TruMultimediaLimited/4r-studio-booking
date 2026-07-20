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
  const [pendingFiles, setPendingFiles] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
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
      previewUrls.forEach((u) => URL.revokeObjectURL(u))
      if (newAlbumCoverPreview) URL.revokeObjectURL(newAlbumCoverPreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrls, newAlbumCoverPreview])

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
      setCreateAlbumError('Please enter an album name')
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
      setCreateAlbumError('Could not create album: ' + (err.message || 'unknown error'))
    } finally {
      setCreatingAlbum(false)
    }
  }

  async function handleDeleteAlbum(album, e) {
    e?.stopPropagation()
    if (!confirm(`Permanently delete the "${album.name}" album and all its photos?`)) return
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

  function pickPhotoFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) {
      setUploadError('Please select only image files')
      return
    }
    setUploadError('')
    setPendingFiles(files)
    setPreviewUrls(files.map((f) => URL.createObjectURL(f)))
    setTitle('')
  }

  function clearPendingPhoto() {
    setPendingFiles([])
    setPreviewUrls([])
    setTitle('')
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Uploads every pending file one at a time (no queue library — the
  // batch is small enough that a simple sequential loop is plenty).
  // Files that fail stay in the pending list (with their previews) so
  // clicking "Upload" again only retries the failures, never re-sends
  // files that already succeeded.
  async function handleUploadPhotos() {
    if (pendingFiles.length === 0 || !selectedAlbum) return
    setUploadError('')
    setUploading(true)
    const singleTitle = pendingFiles.length === 1 ? title.trim() || null : null
    let coverPath = selectedAlbum.cover_storage_path
    const failedFiles = []
    const failedUrls = []

    for (let i = 0; i < pendingFiles.length; i++) {
      setUploadProgress({ done: i, total: pendingFiles.length })
      try {
        const path = await uploadOne(pendingFiles[i])
        const { error: insertErr } = await supabase
          .from('portfolio_items')
          .insert({ title: singleTitle, album_id: selectedAlbum.id, storage_path: path })
        if (insertErr) {
          await supabase.storage.from('portfolio').remove([path])
          throw insertErr
        }
        if (!coverPath) {
          coverPath = path
          await supabase.from('portfolio_albums').update({ cover_storage_path: path }).eq('id', selectedAlbum.id)
          setSelectedAlbum((a) => ({ ...a, cover_storage_path: path }))
        }
      } catch (err) {
        console.error('Upload failed for one file:', err)
        failedFiles.push(pendingFiles[i])
        failedUrls.push(previewUrls[i])
      }
    }

    setUploadProgress(null)
    setUploading(false)

    const succeededCount = pendingFiles.length - failedFiles.length
    previewUrls.forEach((u) => {
      if (!failedUrls.includes(u)) URL.revokeObjectURL(u)
    })
    setPendingFiles(failedFiles)
    setPreviewUrls(failedUrls)

    if (failedFiles.length > 0) {
      setUploadError(`${succeededCount} uploaded, ${failedFiles.length} failed — click "Upload" again to retry.`)
    } else {
      setTitle('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    loadItems(selectedAlbum.id)
    loadAlbums()
  }

  async function handleDeleteItem(item) {
    if (!confirm('Permanently delete this photo?')) return
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
          <IconChevronLeft className="h-3.5 w-3.5" /> Album List
        </button>
        <p className="text-sm font-bold text-[#333333]">{selectedAlbum.name}</p>

        <div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              pickPhotoFiles(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#E0E0E0] rounded-xl p-4 text-center cursor-pointer hover:border-pine/40 hover:bg-pine/5 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => pickPhotoFiles(e.target.files)}
            />
            {previewUrls.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-1.5">
                {previewUrls.map((url, i) => (
                  <img key={i} src={url} alt="" className="h-14 w-14 object-cover rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                <IconUpload className="h-5 w-5 mx-auto text-[#333333]/45 mb-1" />
                <p className="text-xs text-[#333333]/60">Select one or more photos, or drag and drop here</p>
              </>
            )}
          </div>

          {pendingFiles.length > 0 && (
            <div className="mt-2.5 space-y-2">
              {pendingFiles.length === 1 && (
                <input
                  type="text"
                  placeholder="Title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className={inputClass()}
                />
              )}
              {uploadError && (
                <p className="flex items-start gap-2 text-xs text-clay bg-clay/10 border border-clay/20 rounded-xl px-3 py-2">
                  <IconAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {uploadError}
                </p>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={clearPendingPhoto}
                  className="flex-1 border border-[#E0E0E0] rounded-lg py-1.5 text-xs font-medium text-[#333333]/60 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleUploadPhotos}
                  className="flex-1 bg-pine text-white rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {uploading
                    ? `Uploading (${uploadProgress?.done ?? 0}/${uploadProgress?.total ?? pendingFiles.length})…`
                    : pendingFiles.length > 1
                    ? `Upload ${pendingFiles.length} photos`
                    : 'Upload'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#333333]/55 font-semibold mb-1.5">
            {itemsLoading ? 'Loading…' : `Photos (${items.length})`}
          </p>
          {!itemsLoading && items.length === 0 ? (
            <p className="flex flex-col items-center gap-1.5 text-xs text-[#333333]/45 py-6 text-center">
              <IconInbox className="h-5 w-5" /> No photos yet
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {items.map((item) => (
                <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border border-[#E0E0E0]/70 bg-mist/20">
                  <img src={getPortfolioImageUrl(item.storage_path)} alt={item.title || ''} className="h-full w-full object-cover" />
                  <button
                    onClick={() => handleDeleteItem(item)}
                    disabled={deletingId === item.id}
                    aria-label="Delete"
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
        <p className="text-[10px] uppercase tracking-wide text-[#333333]/55 font-semibold">New Album</p>
        <input
          type="text"
          placeholder="Album name (e.g. Wedding)"
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
          <p className="text-[11px] text-[#333333]/55 flex-1">Cover photo (optional)</p>
          <button
            type="button"
            disabled={creatingAlbum}
            onClick={handleCreateAlbum}
            className="flex items-center gap-1 bg-pine text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <IconPlus className="h-3 w-3" /> {creatingAlbum ? 'Creating…' : 'Create'}
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
          {albumsLoading ? 'Loading…' : `Albums (${albums.length})`}
        </p>
        {!albumsLoading && albums.length === 0 ? (
          <p className="flex flex-col items-center gap-1.5 text-xs text-[#333333]/45 py-6 text-center">
            <IconInbox className="h-5 w-5" /> No albums yet
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
                  aria-label="Delete album"
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
