'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
    if (error) { setError('E-posta veya şifre hatalı.'); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Yenpa ERP</h1>
          <p className="text-sm text-gray-500 mt-1">Üretim Yönetim Sistemi</p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="kullanici@yenpaambalaj.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="btn btn-primary w-full justify-center py-2.5">
              {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">Demo hesaplar:</p>
            <div className="mt-2 space-y-1">
              {[
                ['admin@yenpaambalaj.com','Admin'],
                ['depo@yenpaambalaj.com','Depo'],
                ['uretim@yenpaambalaj.com','Üretim'],
              ].map(([mail, rol]) => (
                <button key={mail} type="button" onClick={() => { setEmail(mail); setPassword('yenpa2026') }}
                  className="w-full text-left text-xs text-gray-500 hover:text-blue-600 px-2 py-1 hover:bg-blue-50 rounded transition-colors">
                  {rol} — {mail}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">Şifre: yenpa2026</p>
          </div>
        </div>
      </div>
    </div>
  )
}
