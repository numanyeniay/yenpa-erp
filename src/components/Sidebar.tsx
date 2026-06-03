'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',        icon: '▦' },
  { href: '/depo',       label: 'Hammadde deposu',  icon: '📦' },
  { href: '/satin-alma', label: 'Satın alma',        icon: '🛒' },
  { href: '/is-emirleri',label: 'İş emirleri',       icon: '📋' },
  { href: '/uretim',     label: 'Üretim takibi',     icon: '⚙️' },
  { href: '/tablet',     label: 'Tablet paneli',     icon: '📱' },
  { href: '/musteriler', label: 'Müşteri & sevkiyat',icon: '🚚' },
  { href: '/fiyatlama',  label: 'Fiyatlama',         icon: '💰' },
]

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <aside className="w-56 min-h-screen bg-[#1a1a2e] flex flex-col">
      <div className="p-5 border-b border-white/10">
        <div className="text-white font-semibold text-base">Yenpa ERP</div>
        <div className="text-white/40 text-xs mt-0.5">Ambalaj Üretim Sistemi</div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(n => (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
              ${path.startsWith(n.href) && n.href !== '/dashboard' || path === n.href
                ? 'bg-white/15 text-white font-medium'
                : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
            <span className="text-base leading-none">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors">
          <span>↩</span> Çıkış yap
        </button>
      </div>
    </aside>
  )
}
