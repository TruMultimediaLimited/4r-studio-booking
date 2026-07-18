import { useState, useEffect, lazy, Suspense } from 'react'
import PublicAvailability from './components/PublicAvailability.jsx'
import MyBookingsModal from './components/MyBookingsModal.jsx'

// The admin panel is staff-only; keep it out of the public visitors' bundle.
const AdminPanel = lazy(() => import('./components/AdminPanel.jsx'))
// The gallery isn't needed on the primary booking flow's first load.
const PortfolioGallery = lazy(() => import('./components/PortfolioGallery.jsx'))
import { FACEBOOK_URL, INSTAGRAM_URL, MAP_URL } from './lib/packages.js'
import { IconCalendar, IconMapPin, IconFacebook, IconInstagram } from './components/icons.jsx'

function HeaderCard({ href, onClick, icon: Icon, label, translucent }) {
  const isLink = Boolean(href)
  const Tag = isLink ? 'a' : 'button'
  const linkProps = isLink ? { href, target: '_blank', rel: 'noreferrer' } : { onClick, type: 'button' }
  return (
    <Tag
      {...linkProps}
      className={`flex items-center justify-center gap-1 w-24 ${
        translucent ? 'bg-white/80' : 'bg-white'
      } border border-[#E0E0E0] rounded-lg px-1.5 py-1.5 shadow-sm hover:border-pine/40 hover:bg-pine/5 hover:shadow-md transition-all`}
    >
      <Icon className="h-3 w-3 text-pine shrink-0" />
      <span className="text-[11px] font-medium text-[#333333]/75 text-center leading-tight">{label}</span>
    </Tag>
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
  const isPortfolio = route === '#/portfolio'

  return (
    <div className={`min-h-screen font-body ${isPortfolio ? 'bg-[#18181B]' : 'bg-[#F9F7F2]'}`}>
      <h1 className="sr-only">4R Studio — Photography &amp; Videography Studio Rental in Aftabnagar, Dhaka</h1>
      <header
        className={`sticky top-0 z-20 backdrop-blur border-b ${
          isPortfolio ? 'bg-[#18181B]/95 border-white/10' : 'bg-[#F9F7F2]/95 border-[#E0E0E0]'
        }`}
      >
        {isAdmin ? (
          <div className="font-sans max-w-5xl mx-auto px-4 py-3 grid grid-cols-3 items-center gap-1.5">
            <div />
            <div className="flex items-center justify-center min-w-0">
              <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm px-3 py-1.5">
                <img src="/logo.png" alt="4R Studio" className="h-9 w-auto" />
              </div>
            </div>
            <div className="flex justify-end min-w-0">
              <a
                href="#/"
                className="text-xs font-medium text-pine border border-pine/30 rounded-full px-3 py-1.5 hover:bg-pine hover:text-white transition-colors whitespace-nowrap"
              >
                Client View
              </a>
            </div>
          </div>
        ) : (
          <div className="font-sans max-w-5xl mx-auto px-3 py-2 grid grid-cols-3 items-center gap-1">
            <div className="flex flex-col items-start gap-1 min-w-0">
              <HeaderCard href={FACEBOOK_URL} icon={IconFacebook} label="Facebook" translucent={isPortfolio} />
              <HeaderCard href={INSTAGRAM_URL} icon={IconInstagram} label="Instagram" translucent={isPortfolio} />
            </div>

            <div className="flex items-center justify-center min-w-0">
              <div className={`${isPortfolio ? 'bg-white/80' : 'bg-white'} border border-[#E0E0E0] rounded-lg shadow-sm px-3 py-1.5`}>
                <img src="/logo.png" alt="4R Studio" className="h-9 w-auto" />
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 min-w-0">
              <HeaderCard onClick={() => setMyBookingsOpen(true)} icon={IconCalendar} label="আমার বুকিং" translucent={isPortfolio} />
              <HeaderCard href={MAP_URL} icon={IconMapPin} label="লোকেশন" translucent={isPortfolio} />
            </div>
          </div>
        )}
      </header>

      <main className={`max-w-5xl mx-auto px-4 ${isAdmin ? 'py-6' : 'pt-1.5 pb-6'}`}>
        {isAdmin ? (
          <Suspense fallback={<p className="font-sans text-sm text-[#333333]/55 py-12 text-center">Loading…</p>}>
            <AdminPanel />
          </Suspense>
        ) : isPortfolio ? (
          <Suspense fallback={<p className="font-sans text-sm text-white/60 py-12 text-center">লোড হচ্ছে…</p>}>
            <PortfolioGallery />
          </Suspense>
        ) : (
          <PublicAvailability />
        )}
      </main>

      {myBookingsOpen && <MyBookingsModal onClose={() => setMyBookingsOpen(false)} />}
    </div>
  )
}
