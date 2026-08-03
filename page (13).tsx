'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('E-posta veya sifre hatali.'); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image src="/logo.png" alt="Yenpa Ambalaj" width={240} height={80} className="object-contain" />
          </div>
          <p className="text-slate-400 text-sm mt-2">Uretim Yonetim Sistemi</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-gray-700">E-posta</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="kullanici@yenpaambalaj.com" required />
            </div>
            <div>
              <label className="text-gray-700">Sifre</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 border border-red-200">{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5 text-base">
              {loading ? 'Giris yapiliyor...' : 'Giris yap'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-2">Demo hesaplar</p>
            <div className="space-y-1">
              {[
                ['admin@yenpaambalaj.com','Admin'],
                ['satis@yenpaambalaj.com','Satis'],
                ['planlama@yenpaambalaj.com','Planlama'],
                ['depo@yenpaambalaj.com','Depo'],
                ['uretim@yenpaambalaj.com','Uretim'],
              ].map(([mail, rol]) => (
                <button key={mail} type="button"
                  onClick={() => { setEmail(mail); setPassword('yenpa2026') }}
                  className="w-full text-left text-xs text-gray-400 hover:text-blue-600 px-2 py-1 hover:bg-blue-50 rounded transition-colors flex items-center justify-between">
                  <span>{rol}</span>
                  <span className="font-mono">{mail}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-300 text-center mt-2">Sifre: yenpa2026</p>
          </div>
        </div>
      </div>
    </div>
  )
}
