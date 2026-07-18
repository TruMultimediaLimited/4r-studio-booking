import { supabase } from '../supabaseClient.js'

export const PORTFOLIO_CATEGORIES = ['Photoshoot', 'Event', 'Portrait', 'Product']

// English values are stored in the DB (and used in the admin dropdown);
// Bengali labels are what visitors see on the public gallery.
export const CATEGORY_LABELS_BN = {
  Photoshoot: 'ফটোশুট',
  Event: 'ইভেন্ট',
  Portrait: 'পোর্ট্রেট',
  Product: 'প্রোডাক্ট',
}

const MAX_DIMENSION = 2000
const WEBP_QUALITY = 0.85
const JPEG_QUALITY = 0.85

// WebP encodes noticeably smaller than JPEG at the same visual quality.
// Some older browsers accept the 'image/webp' request but silently emit
// PNG instead (huge files), so this actually probes canvas support
// rather than trusting the request.
let webpSupportCache = null
function supportsWebP() {
  if (webpSupportCache !== null) return webpSupportCache
  const probe = document.createElement('canvas')
  probe.width = 1
  probe.height = 1
  webpSupportCache = probe.toDataURL('image/webp').startsWith('data:image/webp')
  return webpSupportCache
}

// Resizes+compresses an image file in the browser before upload, so a
// multi-MB phone photo doesn't eat into the free storage quota while
// staying visually sharp. Pure Canvas API — no extra dependency.
// Resolves to { blob, mimeType, extension } — format depends on browser
// WebP support, so callers must use the returned extension/mimeType
// rather than assuming JPEG.
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      const useWebP = supportsWebP()
      const mimeType = useWebP ? 'image/webp' : 'image/jpeg'
      const extension = useWebP ? 'webp' : 'jpg'
      const quality = useWebP ? WEBP_QUALITY : JPEG_QUALITY

      canvas.toBlob(
        (blob) => (blob ? resolve({ blob, mimeType, extension }) : reject(new Error('Image compression failed'))),
        mimeType,
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read image file'))
    }
    img.src = objectUrl
  })
}

export function getPortfolioImageUrl(storagePath) {
  return supabase.storage.from('portfolio').getPublicUrl(storagePath).data.publicUrl
}
