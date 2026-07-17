import { useState, useEffect } from 'react'
import PublicAvailability from './components/PublicAvailability.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import MyBookingsModal from './components/MyBookingsModal.jsx'
import { FACEBOOK_URL, INSTAGRAM_URL, MAP_URL } from './lib/packages.js'
import { IconMapPin } from './components/icons.jsx'

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img src="/logo.png" alt="4R Studio" className="h-9 w-auto" />
      <div className="leading-tight">
        <p className="font-display text-lg font-semibold text-ink leading-none">4R</p>
        <p className="text-[10px] uppercase tracking-wide text-ink/50 font-medium leading-none mt-0.5">Studio</p>
      </div>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash)
  const [myBookingsOpen, setMyBookingsOpen] = useState(false)

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const isAdmin = route === '#/admin'

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-mist bg-paper/95 backdrop-blur sticky top-0 z-20">
        {isAdmin ? (
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Logo />
            <a
              href="#/"
              className="text-xs font-medium text-pine border border-pine/30 rounded-full px-3 py-1.5 hover:bg-pine hover:text-paper transition-colors"
            >
              Client View
            </a>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="flex items-center justify-center h-8 w-8 rounded-full text-ink/40 hover:text-pine hover:bg-pine/5 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M22 12.06C22 6.48 17.52 2 11.94 2S1.88 6.48 1.88 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.42V9.85c0-2.39 1.42-3.71 3.6-3.71 1.04 0 2.13.19 2.13.19v2.34h-1.2c-1.18 0-1.55.73-1.55 1.48v1.78h2.64l-.42 2.91h-2.22V22c4.78-.76 8.44-4.92 8.44-9.94z" />
                </svg>
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex items-center justify-center h-8 w-8 rounded-full text-ink/40 hover:text-pine hover:bg-pine/5 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
            </div>

            <div className="flex items-center justify-center min-w-0">
              <Logo />
            </div>

            <div className="flex items-center justify-end gap-2 min-w-0">
              <button
                onClick={() => setMyBookingsOpen(true)}
                className="whitespace-nowrap text-xs font-medium text-pine border border-pine/30 bg-pine/5 rounded-full px-2.5 py-1.5 hover:bg-pine hover:text-paper transition-colors"
              >
                My Bookings
              </button>
              <a
                href={MAP_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Studio Location"
                className="flex items-center justify-center h-8 w-8 rounded-full text-pine border border-pine/30 bg-pine/5 hover:bg-pine hover:text-paper transition-colors"
              >
                <IconMapPin className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isAdmin ? <AdminPanel /> : <PublicAvailability />}
      </main>

      {myBookingsOpen && <MyBookingsModal onClose={() => setMyBookingsOpen(false)} />}
    </div>
  )
}
