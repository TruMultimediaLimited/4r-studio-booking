import { useState, useEffect } from 'react'
import PublicAvailability from './components/PublicAvailability.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import { FACEBOOK_URL, INSTAGRAM_URL } from './lib/packages.js'

export default function App() {
  const [route, setRoute] = useState(window.location.hash)

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const isAdmin = route === '#/admin'

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-mist bg-paper/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="4R Studio" className="h-8 w-auto" />
            <p className="text-sm font-medium text-ink/80">Studio Availability</p>
          </div>
          {isAdmin ? (
            <a
              href="#/"
              className="text-xs font-medium text-pine border border-pine/30 rounded-full px-3 py-1.5 hover:bg-pine hover:text-paper transition-colors"
            >
              Client View
            </a>
          ) : (
            <div className="flex items-center gap-2.5">
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="flex items-center justify-center h-10 w-10 rounded-full bg-[#1877F2] text-white hover:opacity-90 transition-opacity shadow-sm"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M22 12.06C22 6.48 17.52 2 11.94 2S1.88 6.48 1.88 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.42V9.85c0-2.39 1.42-3.71 3.6-3.71 1.04 0 2.13.19 2.13.19v2.34h-1.2c-1.18 0-1.55.73-1.55 1.48v1.78h2.64l-.42 2.91h-2.22V22c4.78-.76 8.44-4.92 8.44-9.94z" />
                </svg>
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex items-center justify-center h-10 w-10 rounded-full text-white hover:opacity-90 transition-opacity shadow-sm bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isAdmin ? <AdminPanel /> : <PublicAvailability />}
      </main>
    </div>
  )
}
