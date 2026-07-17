import { useState, useEffect } from 'react'
import PublicAvailability from './components/PublicAvailability.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import MyBookingsModal from './components/MyBookingsModal.jsx'
import { FACEBOOK_URL, INSTAGRAM_URL, MAP_URL } from './lib/packages.js'
import { IconCalendar, IconMapPin, IconFacebook, IconInstagram } from './components/icons.jsx'

function HeaderCard({ href, onClick, icon: Icon, label }) {
  const isLink = Boolean(href)
  const Tag = isLink ? 'a' : 'button'
  const linkProps = isLink ? { href, target: '_blank', rel: 'noreferrer' } : { onClick, type: 'button' }
  return (
    <Tag
      {...linkProps}
      className="flex items-center justify-center gap-1.5 w-24 bg-white border border-[#E0E0E0] rounded-lg px-2 py-1.5 shadow-sm hover:border-pine/40 hover:bg-pine/5 hover:shadow-md transition-all"
    >
      <Icon className="h-3.5 w-3.5 text-pine shrink-0" />
      <span className="text-[11px] font-medium text-[#333333]/75 whitespace-nowrap">{label}</span>
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

  return (
    <div className={`min-h-screen font-body ${isAdmin ? 'bg-paper' : 'bg-[#F9F7F2]'}`}>
      <header
        className={`border-b sticky top-0 z-20 backdrop-blur ${
          isAdmin ? 'border-mist bg-paper/95' : 'border-[#E0E0E0] bg-[#F9F7F2]/95'
        }`}
      >
        {isAdmin ? (
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <img src="/logo.png" alt="4R Studio" className="h-12 w-auto" />
            <a
              href="#/"
              className="text-xs font-medium text-pine border border-pine/30 rounded-full px-3 py-1.5 hover:bg-pine hover:text-paper transition-colors"
            >
              Client View
            </a>
          </div>
        ) : (
          <div className="font-sans max-w-5xl mx-auto px-4 py-3 grid grid-cols-3 items-center gap-1.5">
            <div className="flex flex-col items-start gap-1.5 min-w-0">
              <HeaderCard href={FACEBOOK_URL} icon={IconFacebook} label="Facebook" />
              <HeaderCard href={INSTAGRAM_URL} icon={IconInstagram} label="Instagram" />
            </div>

            <div className="flex items-center justify-center min-w-0">
              <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm px-3.5 py-2">
                <img src="/logo.png" alt="4R Studio" className="h-12 w-auto" />
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 min-w-0">
              <HeaderCard onClick={() => setMyBookingsOpen(true)} icon={IconCalendar} label="My Bookings" />
              <HeaderCard href={MAP_URL} icon={IconMapPin} label="Location" />
            </div>
          </div>
        )}
      </header>

      <main className={`max-w-5xl mx-auto px-4 ${isAdmin ? 'py-6' : 'pt-6 pb-6'}`}>
        {isAdmin ? <AdminPanel /> : <PublicAvailability />}
      </main>

      {myBookingsOpen && <MyBookingsModal onClose={() => setMyBookingsOpen(false)} />}
    </div>
  )
}
