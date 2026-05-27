import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Users, BookOpen, CheckSquare, Clock, Trophy, Copy, Zap } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

const MEMES = [
  { emoji: '🚀', text: 'Дедлайн завтра в 23:59', sub: 'начну в 23:00, норм успею' },
  { emoji: '💀', text: 'Пары с 9 утра', sub: 'кто вообще это придумал' },
  { emoji: '😅', text: '«Сделаю домашку за вечер»', sub: '— каждый студент с 2007 года' },
  { emoji: '🙏', text: 'Не сдал зачёт?', sub: 'пересдача — это просто второй шанс. И третий.' },
  { emoji: '😤', text: '«Это войдёт в экзамен?»', sub: '— самый важный вопрос семестра' },
  { emoji: '🫠', text: 'Открыл задание', sub: 'закрыл задание' },
  { emoji: '📖', text: 'Читаю лекцию перед экзаменом', sub: 'в 3 часа ночи' },
  { emoji: '🎯', text: 'Цель на сессию', sub: 'закрыть всё на тройки и выжить' },
  { emoji: '⏰', text: 'Поставил будильник на 8:00', sub: 'проснулся в 12:00' },
  { emoji: '💻', text: 'Лабораторная на завтра', sub: 'открываю StackOverflow' },
]

function getMemeOfDay() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return MEMES[dayOfYear % MEMES.length]
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const meme = getMemeOfDay()

  const { data: stats } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/stats/dashboard').then(r => r.data),
    enabled: !!user?.group_id,
    refetchInterval: 60_000,
  })

  const { data: group } = useQuery({
    queryKey: ['my-group'],
    queryFn: () => api.get('/api/groups/my').then(r => r.data),
    enabled: !!user?.group_id,
  })

  const copyCode = () => {
    navigator.clipboard.writeText(group?.invite_code || '')
    toast.success('Код скопирован!')
  }

  const statCards = [
    { icon: Users, label: 'Участников', value: stats?.total_members ?? '—', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'hover:border-blue-500/30' },
    { icon: BookOpen, label: 'Выполнение ДЗ', value: stats ? `${stats.hw_completion_rate}%` : '—', color: 'text-green-400', bg: 'bg-green-400/10', border: 'hover:border-green-500/30' },
    { icon: CheckSquare, label: 'Задач сделано', value: stats?.tasks_by_status?.done ?? '—', color: 'text-brand-400', bg: 'bg-brand-400/10', border: 'hover:border-brand-500/30' },
    { icon: TrendingUp, label: 'В процессе', value: stats?.tasks_by_status?.in_progress ?? '—', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'hover:border-yellow-500/30' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl text-white">
            Привет, {user?.full_name || user?.username} 👋
          </h1>
          <p className="text-surface-200/50 text-sm mt-0.5">
            {group?.name || 'Загрузка...'}
          </p>
        </div>
        {group && (
          <button onClick={copyCode}
            className="btn-ghost text-xs border border-surface-800 shrink-0 hover:border-brand-500/40 hover:bg-brand-600/5 transition-all">
            <Copy size={12} />
            <span className="hidden sm:inline text-surface-200/50">Код: </span>
            <span className="font-mono font-bold text-brand-400 tracking-widest">{group.invite_code}</span>
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statCards.map(({ icon: Icon, label, value, color, bg, border }, i) => (
          <div key={label}
            className={`card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${border} animate-fade-in-up`}
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${bg} mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <div className="font-display font-bold text-2xl text-white">{value}</div>
            <div className="text-xs text-surface-200/50 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming deadlines */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-orange-400" />
            <h2 className="font-display font-semibold text-white text-sm">Ближайшие дедлайны</h2>
          </div>
          {!stats?.upcoming_deadlines?.length ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-surface-200/40 text-sm">Дедлайнов нет</p>
              <p className="text-surface-200/25 text-xs mt-1">Это либо победа, либо ты забыл посмотреть</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.upcoming_deadlines.map((hw: any) => {
                const d = parseISO(hw.deadline)
                const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000)
                return (
                  <div key={hw.id} className="flex items-center justify-between group">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white font-medium truncate">{hw.title}</div>
                      {hw.subject && <div className="text-xs text-surface-200/40">{hw.subject}</div>}
                    </div>
                    <div className={`badge shrink-0 ml-3 ${daysLeft <= 1 ? 'bg-red-500/15 text-red-400' : daysLeft <= 3 ? 'bg-orange-500/15 text-orange-400' : 'bg-surface-800 text-surface-200/60'}`}>
                      {daysLeft <= 0 ? 'Сегодня 😱' : daysLeft === 1 ? 'Завтра 😬' : `${daysLeft} дн.`}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top students */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-yellow-400" />
            <h2 className="font-display font-semibold text-white text-sm">Топ активности</h2>
          </div>
          {!stats?.top_students?.length ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">🏆</div>
              <p className="text-surface-200/40 text-sm">Пока нет данных</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.top_students.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center gap-3 group">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-transform group-hover:scale-110 ${
                    i === 0 ? 'bg-yellow-400/20 text-yellow-400 shadow-sm shadow-yellow-400/20' :
                    i === 1 ? 'bg-surface-300/10 text-surface-200/60' :
                    i === 2 ? 'bg-orange-400/20 text-orange-400' : 'bg-surface-800 text-surface-200/40'
                  }`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{s.full_name || s.username}</div>
                  </div>
                  <div className="text-sm font-mono font-bold text-brand-400 shrink-0">{s.points}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Points + meme row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* My points */}
        <div className="md:col-span-3 relative overflow-hidden rounded-2xl border border-brand-500/20 p-5"
          style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(99,102,241,0.05) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-600/10 rounded-full blur-2xl" />
          </div>
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={13} className="text-brand-400" />
                <span className="text-xs text-brand-400/70 font-medium">Мои баллы активности</span>
              </div>
              <div className="font-display font-black text-4xl md:text-5xl text-white">{user?.points || 0}</div>
              <div className="text-xs text-surface-200/30 mt-2 leading-relaxed">
                +10 за ДЗ · +15 за задачу · +5 за очередь · +2 за голос
              </div>
            </div>
            <div className="text-5xl opacity-20 shrink-0 animate-float">⭐</div>
          </div>
        </div>

        {/* Meme of the day */}
        <div className="md:col-span-2 card border-surface-700/50 flex flex-col justify-between">
          <div className="text-[10px] font-mono text-surface-200/20 uppercase tracking-widest mb-2">мем дня</div>
          <div>
            <div className="text-4xl mb-3 animate-float" style={{ animationDelay: '0.5s' }}>{meme.emoji}</div>
            <p className="text-sm font-semibold text-white leading-snug">{meme.text}</p>
            <p className="text-xs text-surface-200/40 mt-1 italic">{meme.sub}</p>
          </div>
          <div className="mt-3 text-[10px] text-surface-200/15">обновляется каждый день</div>
        </div>
      </div>
    </div>
  )
}
