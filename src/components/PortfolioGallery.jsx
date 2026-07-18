import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { getPortfolioImageUrl } from '../lib/portfolio.js'
import { IconAlert, IconInbox, IconX, IconChevronLeft, IconChevronRight, IconImage } from './icons.jsx'

export default function PortfolioGallery() {
  const [albums, setAlbums] = useState([])
  const [albumCounts, setAlbumCounts] = useState({})
  const [albumsLoading, setAlbumsLoading] = useState(true)
  const [albumsError, setAlbumsError] = useState(false)

  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState(false)

  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    async function loadAlbums() {
      setAlbumsLoading(true)
      const [albumsRes, itemsRes] = await Promise.all([
        supabase.from('portfolio_albums').select('*').order('sort_order').order('created_at', { ascending: false }),
        supabase.from('portfolio_items').select('album_id'),
      ])
      if (albumsRes.error) {
        console.error('Failed to load portfolio albums:', albumsRes.error)
        setAlbumsError(true)
      } else {
        setAlbums(albumsRes.data || [])
        const counts = {}
        for (const row of itemsRes.data || []) {
          if (row.album_id) counts[row.album_id] = (counts[row.album_id] || 0) + 1
        }
        setAlbumCounts(counts)
      }
      setAlbumsLoading(false)
    }
    loadAlbums()
  }, [])

  useEffect(() => {
    if (!selectedAlbum) return
    async function loadItems() {
      setItemsLoading(true)
      setItemsError(false)
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('album_id', selectedAlbum.id)
        .order('sort_order')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Failed to load album photos:', error)
        setItemsError(true)
      } else {
        setItems(data || [])
      }
      setItemsLoading(false)
    }
    loadItems()
  }, [selectedAlbum])

  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e) {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i > 0 ? i - 1 : i))
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i < items.length - 1 ? i + 1 : i))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, items.length])

  const activeItem = lightboxIndex !== null ? items[lightboxIndex] : null

  const backLink = useMemo(
    () => (
      <a
        href="#/"
        className="text-xs font-medium text-sage border border-sage/40 rounded-full px-3 py-1.5 hover:bg-sage/15 transition-colors whitespace-nowrap"
      >
        বুকিং পেজে ফিরুন
      </a>
    ),
    []
  )

  if (selectedAlbum) {
    return (
      <div className="font-sans">
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            onClick={() => setSelectedAlbum(null)}
            className="flex items-center gap-1 text-sm font-semibold text-white/90 hover:text-white"
          >
            <IconChevronLeft className="h-4 w-4" /> সব অ্যালবাম
          </button>
          {backLink}
        </div>
        <p className="text-xl font-bold text-white mb-4">{selectedAlbum.name}</p>

        {itemsError && (
          <div className="flex items-start gap-2 mb-4 text-sm text-clay bg-clay/10 border border-clay/20 rounded-lg px-3.5 py-3">
            <IconAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <p>ছবি লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>
          </div>
        )}

        {itemsLoading ? (
          <p className="text-sm text-white/60 py-12 text-center">লোড হচ্ছে…</p>
        ) : items.length === 0 ? (
          <p className="flex flex-col items-center gap-2 text-sm text-white/50 py-16 text-center">
            <IconInbox className="h-6 w-6" /> এই অ্যালবামে এখনো কোনো ছবি নেই।
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setLightboxIndex(index)}
                className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 shadow-lg hover:shadow-xl transition-shadow"
              >
                <img
                  src={getPortfolioImageUrl(item.storage_path)}
                  alt={item.title || selectedAlbum.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                {item.title && (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[11px] font-medium px-2 py-1.5 text-left truncate">
                    {item.title}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {activeItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-8"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              onClick={() => setLightboxIndex(null)}
              aria-label="বন্ধ করুন"
              className="absolute top-4 right-4 text-white/80 hover:text-white"
            >
              <IconX className="h-6 w-6" />
            </button>

            {lightboxIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIndex(lightboxIndex - 1)
                }}
                aria-label="আগের ছবি"
                className="absolute left-2 sm:left-4 text-white/80 hover:text-white p-2"
              >
                <IconChevronLeft className="h-7 w-7" />
              </button>
            )}
            {lightboxIndex < items.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIndex(lightboxIndex + 1)
                }}
                aria-label="পরের ছবি"
                className="absolute right-2 sm:right-4 text-white/80 hover:text-white p-2"
              >
                <IconChevronRight className="h-7 w-7" />
              </button>
            )}

            <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              <img
                src={getPortfolioImageUrl(activeItem.storage_path)}
                alt={activeItem.title || selectedAlbum.name}
                className="w-full max-h-[75vh] object-contain rounded-lg"
              />
              {activeItem.title && <p className="text-sm font-semibold text-white/90 mt-3">{activeItem.title}</p>}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="font-sans">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-sage border border-sage/40 rounded-full px-3 py-1.5 whitespace-nowrap">আমাদের কাজ</p>
        {backLink}
      </div>

      {albumsError && (
        <div className="flex items-start gap-2 mb-4 text-sm text-clay bg-clay/10 border border-clay/20 rounded-lg px-3.5 py-3">
          <IconAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <p>গ্যালারি লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>
        </div>
      )}

      {albumsLoading ? (
        <p className="text-sm text-white/60 py-12 text-center">লোড হচ্ছে…</p>
      ) : albums.length === 0 ? (
        <p className="flex flex-col items-center gap-2 text-sm text-white/50 py-16 text-center">
          <IconInbox className="h-6 w-6" /> এখনো কোনো অ্যালবাম যোগ করা হয়নি।
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => setSelectedAlbum(album)}
              className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-white/10 bg-white/5 shadow-lg hover:shadow-xl transition-shadow"
            >
              {album.cover_storage_path ? (
                <img
                  src={getPortfolioImageUrl(album.cover_storage_path)}
                  alt={album.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <IconImage className="h-8 w-8 text-white/25" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2.5 text-left">
                <p className="text-sm font-bold text-white truncate">{album.name}</p>
                <p className="text-[11px] text-white/70">{albumCounts[album.id] || 0}টা ছবি</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
