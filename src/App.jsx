import { useState, useEffect } from 'react'
import PublicAvailability from './components/PublicAvailability.jsx'
import AdminPanel from './components/AdminPanel.jsx'

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
          <div>
            <p className="font-display text-xl tracking-tight text-ink">4R Studio</p>
            <p className="text-xs text-ink/50 -mt-0.5">Studio Availability</p>
          </div>
          {isAdmin && (
            <a
              href="#/"
              className="text-xs font-medium text-pine border border-pine/30 rounded-full px-3 py-1.5 hover:bg-pine hover:text-paper transition-colors"
            >
              Client View
            </a>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isAdmin ? <AdminPanel /> : <PublicAvailability />}
      </main>
    </div>
  )
}
