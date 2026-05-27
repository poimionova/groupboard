import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Zap } from 'lucide-react'

const PARTICLES = [
  { top: '15%', left: '10%', size: 3, delay: '0s', dur: '6s' },
  { top: '70%', left: '85%', size: 2, delay: '1s', dur: '8s' },
  { top: '40%', left: '90%', size: 4, delay: '2s', dur: '5s' },
  { top: '80%', left: '20%', size: 2, delay: '0.5s', dur: '7s' },
  { top: '25%', left: '75%', size: 3, delay: '3s', dur: '6s' },
  { top: '60%', left: '5%', size: 2, delay: '1.5s', dur: '9s' },
]

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(username, password)
      toast.success('Добро пожаловать! 🎉')
      navigate('/')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Неверные данные')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4 relative overflow-hidden">
      {/* Multi-layer background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-purple-600/8 rounded-full blur-[80px]" />
        <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] bg-brand-400/6 rounded-full blur-[60px]" />
      </div>

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <div key={i} className="absolute rounded-full bg-brand-400/20 animate-float pointer-events-none"
          style={{ top: p.top, left: p.left, width: p.size * 4, height: p.size * 4, animationDelay: p.delay, animationDuration: p.dur }} />
      ))}

      <div className="relative w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-flex mb-5">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-brand-600/40 animate-glow-pulse">
              <span className="font-display font-black text-white text-2xl">G</span>
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-surface-950 flex items-center justify-center">
              <Zap size={10} className="text-surface-950" />
            </div>
          </div>
          <h1 className="font-display font-black text-3xl text-white mb-1">GroupBoard</h1>
          <p className="text-surface-200/40 text-sm">Канбан для учебной группы</p>
        </div>

        {/* Form card */}
        <div className="relative">
          {/* Glow border effect */}
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-brand-500/30 to-transparent pointer-events-none" />
          <form onSubmit={handle} className="relative bg-surface-900/90 backdrop-blur-sm border border-surface-800 rounded-2xl p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-surface-200/60">Логин</label>
              <input
                className="input focus:ring-2 focus:ring-brand-500/20 transition-shadow"
                placeholder="your_username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-surface-200/60">Пароль</label>
              <input
                className="input focus:ring-2 focus:ring-brand-500/20 transition-shadow"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={isLoading}
              className="btn-primary w-full justify-center py-3 text-base font-semibold shadow-xl shadow-brand-600/30 hover:shadow-brand-600/50 hover:-translate-y-0.5 transition-all duration-150 mt-2">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Входим...
                </span>
              ) : 'Войти →'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-200/30 mt-5">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}
