import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Vote, Lock, Users } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function PollsPage() {
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ question: '', options: ['', ''], is_anonymous: false, closes_at: '' })

  const { data: polls = [] } = useQuery({
    queryKey: ['polls'],
    queryFn: () => api.get('/api/polls').then(r => r.data),
    enabled: !!user?.group_id,
    refetchInterval: 30_000,
  })

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/polls', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['polls'] }); setShowForm(false); toast.success('Голосование создано') },
  })

  const voteMut = useMutation({
    mutationFn: ({ pollId, optionId }: any) => api.post(`/api/polls/${pollId}/vote`, { option_id: optionId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['polls'] })
      toast.success('+2 балла за участие!')
      if (user) setUser({ ...user, points: res.data.points })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Уже голосовали'),
  })

  const addOption = () => setForm(f => ({ ...f, options: [...f.options, ''] }))
  const setOpt = (i: number, v: string) => setForm(f => ({ ...f, options: f.options.map((o, idx) => idx === i ? v : o) }))

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl text-white">Голосования</h1>
          <p className="text-surface-200/50 text-sm mt-0.5">Узнайте мнение всей группы</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} />Создать опрос
        </button>
      </div>

      {showForm && (
        <div className="card mb-5 animate-slide-up">
          <h3 className="font-display font-semibold text-white mb-4">Новый опрос</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">Вопрос</label>
              <input className="input" placeholder="Когда удобно сдать лабораторную?" value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-surface-200/50 mb-2">Варианты ответов</label>
              <div className="space-y-2">
                {form.options.map((o, i) => (
                  <input key={i} className="input" placeholder={`Вариант ${i + 1}`} value={o} onChange={e => setOpt(i, e.target.value)} />
                ))}
              </div>
              <button onClick={addOption} className="btn-ghost text-xs mt-2">+ Добавить вариант</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" checked={form.is_anonymous} onChange={e => setForm(f => ({ ...f, is_anonymous: e.target.checked }))} />
                <span className="text-sm text-surface-200/60">Анонимное</span>
              </label>
              <div>
                <label className="block text-xs text-surface-200/50 mb-1.5">Закрывается</label>
                <input type="datetime-local" className="input" value={form.closes_at} onChange={e => setForm(f => ({ ...f, closes_at: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => createMut.mutate({ ...form, options: form.options.filter(Boolean).map(text => ({ text })), closes_at: form.closes_at || undefined })} disabled={!form.question || form.options.filter(Boolean).length < 2} className="btn-primary">
                Создать
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {polls.length === 0 && (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4 animate-float">🗳️</div>
            <p className="text-surface-200/40 font-medium">Голосований пока нет</p>
            <p className="text-surface-200/20 text-xs mt-1">Типичная группа — все молчат 💀</p>
          </div>
        )}
        {polls.map((poll: any) => {
          const isClosed = poll.closes_at && new Date(poll.closes_at) < new Date()
          const hasVoted = !!poll.my_vote
          return (
            <div key={poll.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-white">{poll.question}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-surface-200/40">
                    <span className="flex items-center gap-1"><Users size={10} />{poll.total_votes} голосов</span>
                    {poll.is_anonymous && <span className="flex items-center gap-1"><Lock size={10} />Анонимное</span>}
                    {poll.closes_at && <span>{isClosed ? 'Закрыто' : `До ${format(new Date(poll.closes_at), 'd MMM HH:mm', { locale: ru })}`}</span>}
                  </div>
                </div>
                {isClosed && <span className="badge bg-surface-800 text-surface-200/40">Завершено</span>}
              </div>

              <div className="space-y-2">
                {poll.options.map((opt: any) => {
                  const pct = poll.total_votes > 0 ? Math.round(opt.votes / poll.total_votes * 100) : 0
                  const isMyVote = poll.my_vote === opt.id
                  return (
                    <div key={opt.id}>
                      {(hasVoted || isClosed) ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className={isMyVote ? 'text-brand-400 font-medium' : 'text-surface-200/60'}>{opt.text}</span>
                            <span className="text-surface-200/40">{pct}%</span>
                          </div>
                          <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${isMyVote ? 'bg-brand-500' : 'bg-surface-600'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => voteMut.mutate({ pollId: poll.id, optionId: opt.id })}
                          disabled={isClosed}
                          className="w-full text-left px-4 py-2.5 rounded-xl border border-surface-700 hover:border-brand-500/50 hover:bg-brand-600/5 transition-all text-sm text-surface-200/70 hover:text-white">
                          {opt.text}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
