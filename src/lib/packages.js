export const WHATSAPP_NUMBER = '8801335254627' // no '+', wa.me format
export const ADVANCE_PERCENT = 25

export const PACKAGES = [
  { id: 'photoshoot', label: 'Studio Rent for Photoshoot', rateLabel: '৳700/ঘণ্টা', hourlyRate: 700 },
  { id: 'photo_video', label: 'Studio Rent for Photo & Videoshoot', rateLabel: '৳1000/ঘণ্টা', hourlyRate: 1000 },
  { id: 'custom', label: 'অন্যান্য শ্যুট (পডকাস্ট/ফ্যাশন/প্রোডাক্ট ইত্যাদি)', hourlyRate: null },
]

export function buildWhatsAppLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
