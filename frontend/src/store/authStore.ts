import { create } from 'zustand'
import api from '../lib/api'

interface User {
  id: string
  username: string
  email: string
  full_name?: string
  role: string
  group_id?: string
  avatar_url?: string
  points: number
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: { username: string; email: string; password: string; full_name?: string }) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  setUser: (u: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true })
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    const { data } = await api.post('/api/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    localStorage.setItem('token', data.access_token)
    set({ token: data.access_token, isLoading: false })
    const me = await api.get('/api/auth/me')
    set({ user: me.data })
  },

  register: async (payload) => {
    set({ isLoading: true })
    await api.post('/api/auth/register', payload)
    set({ isLoading: false })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/api/auth/me')
      set({ user: data })
    } catch {
      set({ user: null, token: null })
      localStorage.removeItem('token')
    }
  },

  setUser: (u) => set({ user: u }),
}))
