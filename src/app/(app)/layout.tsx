'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import { AuthProvider, useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading, hasSession } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !hasSession) router.push('/')
  }, [loading, hasSession, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Yukleniyor...</div>
  }
  if (!hasSession) return null
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="text-gray-900 font-medium mb-1">Hesabiniz sisteme tanimli degil</div>
          <p className="text-gray-500 text-sm mb-4">Giris yaptiniz ama kullanici_tanim tablosunda eslesen bir kayit bulunamadi. Yoneticinize basvurun.</p>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="btn">Cikis yap</button>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-gray-50">
          <Guard>{children}</Guard>
        </main>
      </div>
    </AuthProvider>
  )
}
