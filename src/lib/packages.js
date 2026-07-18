export const WHATSAPP_NUMBER = '8801335254627' // no '+', wa.me format
export const ADVANCE_PERCENT = 25

export const FACEBOOK_URL = 'https://www.facebook.com/4rstudioBD/'
export const INSTAGRAM_URL = 'https://instagram.com/4rstudiobd'
export const MAP_URL = 'https://maps.app.goo.gl/kBQP3Gh91ah2TkPp7'

// Fallback shown until the live `packages` table loads from Supabase
// (PublicAvailability.jsx) — keeps the id set here in sync with the
// rows seeded by docs/schema.sql's admin-management migration, since
// PACKAGE_ICONS in PublicAvailability.jsx keys off these same ids.
export const DEFAULT_PACKAGES = [
  { id: 'photoshoot', label: 'Studio Rent for Photoshoot', rateLabel: '700 TK (Per Hour)', hourlyRate: 700, inclusions: null },
  { id: 'photo_video', label: 'Studio Rent for Photo & Videoshoot', rateLabel: '1000 TK (Per Hour)', hourlyRate: 1000, inclusions: null },
  { id: 'custom', label: 'Others', hourlyRate: null, inclusions: null },
]

export const PAYMENT_METHODS = ['Hand Cash', 'Bkash', 'Nagad', 'Bank']
export const PAYMENT_COLLECTORS = ['Rezwan', 'Radone', 'Rasel', 'Kabbo']

export const PAYMENT_INFO = {
  mobileBankingNumber: '+8801799361321',
  mobileBankingType: 'Personal',
  bank: {
    accountName: 'TRU MULTIMEDIA LIMITED',
    accountNumber: '2078905160001',
    bankName: 'BRAC Bank PLC',
    branchName: 'Banasree',
  },
}

export function buildWhatsAppLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
