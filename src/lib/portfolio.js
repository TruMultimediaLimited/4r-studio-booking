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

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

// Resizes+compresses an image file in the browser before upload, so a
// multi-MB phone photo doesn't eat into the free storage quota. Pure
// Canvas API — no extra dependency.
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

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed'))),
        'image/jpeg',
        JPEG_QUALITY
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
