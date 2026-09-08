'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type KullaniciRol = 'admin' | 'satis' | 'planlama' | 'depo' | 'uretim' | 'muhasebe'

export interface CurrentUser {
  id: string
  ad_soyad: string
  email: string
  rol: KullaniciRol
}

interface AuthState {
  user: CurrentUser | null
  loading: boolean
  hasSession: boolean
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, hasSession: false })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, hasSession: false })

  useEffect(() => {
    let mounted = true

    async function yukle(authUserId: string | null) {
      if (!authUserId) {
        if (mounted) setState({ user: null, loading: false, hasSession: false })
        return
      }
      const { data } = await supabase
        .from('kullanici_tanim')
        .select('id, ad_soyad, email, rol')
        .eq('auth_id', authUserId)
        .maybeSingle()
      if (mounted) setState({ user: (data as CurrentUser) || null, loading: false, hasSession: true })
    }

    supabase.auth.getSession().then(({ data }) => yukle(data.session?.user?.id || null))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      yukle(session?.user?.id || null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
