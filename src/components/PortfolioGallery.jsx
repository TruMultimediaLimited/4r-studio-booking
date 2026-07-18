import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { PORTFOLIO_CATEGORIES, CATEGORY_LABELS_BN, getPortfolioImageUrl } from '../lib/portfolio.js'
import { IconAlert, IconInbox, IconX, IconChevronLeft, IconChevronRight } from './icons.jsx'

export default function PortfolioGallery() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .order('sort_order')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Failed to load portfolio items:', error)
        setError(true)
      } else {
        setItems(data || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const filteredItems = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory)

  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e) {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i > 0 ? i - 1 : i))
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i < filteredItems.length - 1 ? i + 1 : i))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, filteredItems.length])

  const activeItem = lightboxIndex !== null ? filteredItems[lightboxIndex] : null

  return (
    <div className="font-sans">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xl font-bold text-[#333333]">আমাদের কাজ</p>
        <a
          href="#/"
          className="text-xs font-medium text-pine border border-pine/30 rounded-full px-3 py-1.5 hover:bg-pine hover:text-white transition-colors whitespace-nowrap"
        >
          বুকিং পেজে ফিরুন
        </a>
      </div>

      {error && (
        <div className="flex items-start gap-2 mb-4 text-sm text-clay bg-clay/10 border border-clay/20 rounded-lg px-3.5 py-3">
          <IconAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <p>গ্যালারি লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setActiveCategory('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeCategory === 'all' ? 'bg-pine text-white' : 'bg-white border border-[#E0E0E0] text-[#333333]/70 hover:border-pine/40'
          }`}
        >
          সব
        </button>
        {PORTFOLIO_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeCategory === cat ? 'bg-pine text-white' : 'bg-white border border-[#E0E0E0] text-[#333333]/70 hover:border-pine/40'
            }`}
          >
            {CATEGORY_LABELS_BN[cat] || cat}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#333333]/55 py-12 text-center">লোড হচ্ছে…</p>
      ) : filteredItems.length === 0 ? (
        <p className="flex flex-col items-center gap-2 text-sm text-[#333333]/55 py-16 text-center">
          <IconInbox className="h-6 w-6" /> এখনো কোনো কাজ যোগ করা হয়নি।
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {filteredItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setLightboxIndex(index)}
              className="group relative aspect-square rounded-xl overflow-hidden border border-[#E0E0E0]/70 bg-mist/20 shadow-sm hover:shadow-md transition-shadow"
            >
              <img
                src={getPortfolioImageUrl(item.storage_path)}
                alt={item.title || CATEGORY_LABELS_BN[item.category] || item.category}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {item.title && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[11px] font-medium px-2 py-1.5 text-left truncate">
                  {item.title}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {activeItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8"
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
          {lightboxIndex < filteredItems.length - 1 && (
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
              alt={activeItem.title || activeItem.category}
              className="w-full max-h-[75vh] object-contain rounded-lg"
            />
            {(activeItem.title || activeItem.category) && (
              <div className="flex items-center gap-2 mt-3 text-white/90">
                {activeItem.title && <p className="text-sm font-semibold">{activeItem.title}</p>}
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-white/15 rounded-full px-2 py-0.5">
                  {CATEGORY_LABELS_BN[activeItem.category] || activeItem.category}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
