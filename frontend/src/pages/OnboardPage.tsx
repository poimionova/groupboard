import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, LogIn, Sparkles } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export default function OnboardPage() {
  const [tab, setTab] = useState<'create' | 'join'>('join')
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { fetchMe } = useAuthStore()
  const navigate = useNavigate()

  const create = async () => {
    if (!groupName.trim()) return
    setLoading(true)
    try {
      await api.post('/api/groups', { name: groupName })
      await fetchMe()
      toast.success('Группа создана! 🎊')
      navigate('/')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Ошибка')
    } finally { setLoading(false) }
  }

  const join = async () => {
    if (!inviteCode.trim()) return
    setLoading(true)
    try {
      await api.post('/api/groups/join', { invite_code: inviteCode.toUpperCase() })
      await fetchMe()
      toast.success('Добро пожаловать в группу! 🎉')
      navigate('/')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Код не найден')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/6 rounded-full blur-[80px]" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-500 to-purple-600 rounded-2xl shadow-2xl shadow-brand-600/40 mb-4 animate-float">
            <Users size={28} className="text-white" />
          </div>
          <h1 className="font-display font-black text-2xl text-white">Выберите группу</h1>
          <p className="text-surface-200/40 text-sm mt-1">Создайте новую или вступите по коду приглашения</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-900 border border-surface-800 rounded-xl p-1 mb-5 gap-1">
          {([['join', 'Вступить', LogIn], ['create', 'Создать', Plus]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === key
                  ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-600/30 scale-[1.02]'
                  : 'text-surface-200/50 hover:text-white hover:bg-surface-800'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-brand-500/20 to-transparent pointer-events-none" />
          <div className="relative bg-surface-900/90 backdrop-blur-sm border border-surface-800 rounded-2xl p-6 space-y-4">
            {tab === 'join' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-surface-200/60 mb-2">Код приглашения</label>
                  <input
                    className="input font-mono text-center text-xl tracking-[0.3em] uppercase py-3 focus:ring-2 focus:ring-brand-500/20"
                    placeholder="ABCD1234"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    maxLength={8}
                  />
                  <p className="text-xs text-surface-200/30 mt-2 text-center">Получите код у старосты вашей группы</p>
                </div>
                <button onClick={join} disabled={loading || !inviteCode}
                  className="btn-primary w-full justify-center py-3 font-semibold shadow-xl shadow-brand-600/30 hover:-translate-y-0.5 transition-all duration-150">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Вступаем...
                    </span>
                  ) : <><LogIn size={16} />Вступить в группу</>}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-surface-200/60 mb-2">Название группы</label>
                  <input
                    className="input py-3 focus:ring-2 focus:ring-brand-500/20"
                    placeholder="ИТ-231 или Группа Иванова"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                  />
                  <div className="flex items-center gap-1.5 mt-2">
                    <Sparkles size={11} className="text-brand-400" />
                    <p className="text-xs text-surface-200/30">Вы станете старостой и получите код приглашения</p>
                  </div>
                </div>
                <button onClick={create} disabled={loading || !groupName}
                  className="btn-primary w-full justify-center py-3 font-semibold shadow-xl shadow-brand-600/30 hover:-translate-y-0.5 transition-all duration-150">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Создаём...
                    </span>
                  ) : <><Plus size={16} />Создать группу</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
