export const WHATSAPP_NUMBER = '8801335254627' // no '+', wa.me format
export const ADVANCE_PERCENT = 25

export const FACEBOOK_URL = 'https://www.facebook.com/4rstudioBD/'
export const INSTAGRAM_URL = 'https://instagram.com/4rstudiobd'

export const PACKAGES = [
  { id: 'photoshoot', label: 'Studio Rent for Photoshoot', rateLabel: '700 TK (Per Hour)', hourlyRate: 700 },
  { id: 'photo_video', label: 'Studio Rent for Photo & Videoshoot', rateLabel: '1000 TK (Per Hour)', hourlyRate: 1000 },
  { id: 'custom', label: 'Others', hourlyRate: null },
]

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
