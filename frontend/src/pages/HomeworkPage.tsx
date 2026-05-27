import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, Trash2, Clock, BookOpen, Users, Sparkles, Paperclip, X, FileText } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import { ru } from 'date-fns/locale'
import clsx from 'clsx'

const CALENDAR_URL = 'https://eilpyzysgdyrpunkhosb.supabase.co/functions/v1/calendar-export?type=group&id=f0ff99e1-8fbb-11f0-bee6-005056912e01&period=2weeks'

function getField(block: string, key: string) {
  const m = block.match(new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, 'm'))
  return m ? m[1].trim() : ''
}
function parseIcalDate(val: string) {
  const c = val.replace('Z', '')
  return new Date(+c.slice(0,4), +c.slice(4,6)-1, +c.slice(6,8), c.length>=13?+c.slice(9,11):0, c.length>=15?+c.slice(11,13):0)
}
function parseIcal(text: string) {
  return text.split('BEGIN:VEVENT').slice(1).map(block => ({
    summary: getField(block, 'SUMMARY').replace(/\\,/g, ','),
    start: parseIcalDate(getField(block, 'DTSTART')),
  })).filter(e => e.summary).sort((a, b) => a.start.getTime() - b.start.getTime())
}

function nextClassDatetime(weekday: number, timeStart: string): string {
  const jsDay = weekday === 6 ? 0 : weekday + 1
  const now = new Date()
  const [h, m] = timeStart.split(':')
  let daysUntil = (jsDay - now.getDay() + 7) % 7
  if (daysUntil === 0) {
    const classTime = new Date(now)
    classTime.setHours(+h, +m, 0, 0)
    if (classTime <= now) daysUntil = 7
  }
  const next = new Date(now)
  next.setDate(now.getDate() + daysUntil)
  next.setHours(+h, +m, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${next.getFullYear()}-${p(next.getMonth()+1)}-${p(next.getDate())}T${p(next.getHours())}:${p(next.getMinutes())}`
}

const DAYS_SHORT = ['пн','вт','ср','чт','пт','сб','вс']

export default function HomeworkPage() {
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'mine' | 'overdue'>('all')
  const [form, setForm] = useState({ title: '', subject: '', description: '', deadline: '', file_url: '' })
  const [deadlineAutoFilled, setDeadlineAutoFilled] = useState(false)
  const [customMode, setCustomMode] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: homework = [] } = useQuery({
    queryKey: ['homework'],
    queryFn: () => api.get('/api/homework').then(r => r.data),
    enabled: !!user?.group_id,
  })

  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => api.get('/api/schedule').then(r => r.data),
    enabled: !!user?.group_id,
  })

  const { data: calEvents = [], isLoading: calLoading } = useQuery({
    queryKey: ['calendar-feed'],
    queryFn: async () => { const r = await fetch(CALENDAR_URL); return parseIcal(await r.text()) },
    staleTime: 5 * 60 * 1000,
  })

  const scheduleSubjects = useMemo(() => {
    const seen = new Set<string>()
    return (schedule as any[]).filter(s => s.subject && !seen.has(s.subject) && seen.add(s.subject))
  }, [schedule])

  // subjects from iCal — prefer nearest future date, fall back to any date for name suggestion
  const calSubjects = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const futureMap = new Map<string, Date>()
    const anyMap = new Map<string, Date>()
    for (const ev of calEvents as any[]) {
      if (!ev.summary) continue
      // track nearest future occurrence
      if (ev.start >= today) {
        if (!futureMap.has(ev.summary) || ev.start < futureMap.get(ev.summary)!) futureMap.set(ev.summary, ev.start)
      }
      // track most recent occurrence (future or past) for subject name
      if (!anyMap.has(ev.summary) || ev.start > anyMap.get(ev.summary)!) anyMap.set(ev.summary, ev.start)
    }
    // merge: use future date if available, otherwise show subject without deadline hint
    return Array.from(anyMap.keys()).map(name => ({
      name,
      date: futureMap.get(name) ?? null,
    }))
  }, [calEvents])

  const hasSubjects = scheduleSubjects.length > 0 || calSubjects.length > 0

  function resetForm() {
    setForm({ title: '', subject: '', description: '', deadline: '', file_url: '' })
    setDeadlineAutoFilled(false)
    setCustomMode(false)
    setAttachedFile(null)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { toast.error('Файл слишком большой (макс. 20 МБ)'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/api/homework/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setAttachedFile({ name: res.data.original_name, url: res.data.url })
      setForm(f => ({ ...f, file_url: res.data.url }))
      toast.success('Файл прикреплён')
    } catch {
      toast.error('Не удалось загрузить файл')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/homework', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework'] })
      setShowForm(false)
      resetForm()
      toast.success('ДЗ добавлено')
    },
  })

  const completeMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/homework/${id}/complete`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['homework'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      const data = res.data
      if (data.completed) {
        toast.success('+10 баллов за выполнение! 🎉')
        if (user) setUser({ ...user, points: data.points })
      }
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/homework/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['homework'] }),
  })

  function handleSubjectChange(value: string) {
    if (value === '__custom__') {
      setCustomMode(true)
      setForm(f => ({ ...f, subject: '' }))
      setDeadlineAutoFilled(false)
      return
    }
    // schedule entry → deadline from weekday
    const schedEntry = (schedule as any[]).find(s => s.subject === value)
    if (schedEntry) {
      const dt = nextClassDatetime(schedEntry.weekday, schedEntry.time_start)
      setForm(f => ({ ...f, subject: value, deadline: dt }))
      setDeadlineAutoFilled(true)
      return
    }
    // calendar entry → deadline from nearest future event date (if any)
    const calEntry = calSubjects.find(c => c.name === value)
    if (calEntry) {
      if (calEntry.date) {
        const p = (n: number) => String(n).padStart(2, '0')
        const d = calEntry.date
        const dt = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
        setForm(f => ({ ...f, subject: value, deadline: dt }))
        setDeadlineAutoFilled(true)
      } else {
        setForm(f => ({ ...f, subject: value }))
        setDeadlineAutoFilled(false)
      }
      return
    }
    setForm(f => ({ ...f, subject: value }))
    setDeadlineAutoFilled(false)
  }

  const deadlineLabel = (d: string | null) => {
    if (!d) return null
    const date = new Date(d)
    if (isPast(date) && !isToday(date)) return { text: 'Просрочено', cls: 'text-red-400 bg-red-500/10' }
    if (isToday(date)) return { text: 'Сегодня', cls: 'text-orange-400 bg-orange-500/10' }
    if (isTomorrow(date)) return { text: 'Завтра', cls: 'text-yellow-400 bg-yellow-500/10' }
    return { text: format(date, 'd MMMM', { locale: ru }), cls: 'text-surface-200/50 bg-surface-800' }
  }

  const filtered = homework.filter((hw: any) => {
    if (filter === 'mine') return !hw.is_completed_by_me
    if (filter === 'overdue') return isPast(new Date(hw.deadline)) && !isToday(new Date(hw.deadline))
    return true
  })

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl text-white">Домашние задания</h1>
          <p className="text-surface-200/50 text-sm mt-0.5">{homework.length} заданий в группе</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }} className="btn-primary">
          <Plus size={16} />Добавить ДЗ
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([['all', 'Все'], ['mine', 'Не выполнено'], ['overdue', 'Просрочено']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={clsx('text-xs px-3 py-1.5 rounded-lg border transition-all', filter === k ? 'bg-brand-600/20 border-brand-500/50 text-brand-400' : 'border-surface-800 text-surface-200/40 hover:border-surface-700')}>
            {l}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-5 animate-slide-up">
          <h3 className="font-display font-semibold text-white mb-4">Новое домашнее задание</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-surface-200/50 mb-1.5">Название</label>
              <input className="input" placeholder="Что нужно сделать?" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-surface-200/50 mb-2">Предмет</label>
              {calLoading && scheduleSubjects.length === 0 ? (
                <div className="space-y-1.5">
                  {[1,2,3].map(i => <div key={i} className="skeleton h-11 rounded-xl" />)}
                </div>
              ) : hasSubjects && !customMode ? (
                <div className="space-y-1.5">
                  {scheduleSubjects.map((s: any) => (
                    <button key={s.id} type="button" onClick={() => handleSubjectChange(s.subject)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border transition-all text-sm ${
                        form.subject === s.subject
                          ? 'border-brand-500/50 bg-brand-600/10 text-white'
                          : 'border-surface-700 text-surface-200/70 hover:border-brand-500/30 hover:bg-brand-600/5 hover:text-white'
                      }`}>
                      <span className="font-medium">{s.subject}</span>
                      <span className="ml-2 text-xs opacity-50">{DAYS_SHORT[s.weekday]}, {s.time_start}</span>
                    </button>
                  ))}
                  {calSubjects.map(c => (
                    <button key={c.name} type="button" onClick={() => handleSubjectChange(c.name)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border transition-all text-sm ${
                        form.subject === c.name
                          ? 'border-brand-500/50 bg-brand-600/10 text-white'
                          : 'border-surface-700 text-surface-200/70 hover:border-brand-500/30 hover:bg-brand-600/5 hover:text-white'
                      }`}>
                      <span className="font-medium">{c.name}</span>
                      {c.date && (
                        <span className="ml-2 text-xs opacity-50">
                          {c.date.getDate()} {['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][c.date.getMonth()]}
                        </span>
                      )}
                    </button>
                  ))}
                  <button type="button" onClick={() => handleSubjectChange('__custom__')}
                    className="w-full text-left px-4 py-2.5 rounded-xl border border-dashed border-surface-700 text-surface-200/40 hover:border-surface-600 hover:text-surface-200/60 transition-all text-sm">
                    Другой предмет...
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input className="input" placeholder="Например: Математика"
                    value={form.subject} autoFocus={customMode}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                  {hasSubjects && (
                    <button type="button"
                      onClick={() => { setCustomMode(false); setForm(f => ({ ...f, subject: '' })); setDeadlineAutoFilled(false) }}
                      className="text-xs text-brand-400 hover:text-brand-300">
                      ← выбрать из расписания
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">Дедлайн <span className="text-surface-200/30">(необязательно)</span></label>
              <input type="datetime-local" className="input" value={form.deadline}
                onChange={e => { setForm(f => ({ ...f, deadline: e.target.value })); setDeadlineAutoFilled(false) }} />
              {deadlineAutoFilled && (
                <p className="flex items-center gap-1 text-xs text-brand-400/70 mt-1">
                  <Sparkles size={10} />
                  Ближайшая пара — можете изменить
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-surface-200/50 mb-1.5">Описание</label>
              <textarea className="input resize-none" rows={2} placeholder="Дополнительные детали..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip,.xlsx,.pptx" />
              {attachedFile ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm">
                  <FileText size={14} className="text-brand-400 shrink-0" />
                  <span className="text-surface-200/80 truncate flex-1">{attachedFile.name}</span>
                  <button type="button" onClick={() => { setAttachedFile(null); setForm(f => ({ ...f, file_url: '' })) }}
                    className="text-surface-200/30 hover:text-red-400 shrink-0 p-1">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 text-sm text-surface-200/40 hover:text-surface-200/70 transition-colors py-1">
                  <Paperclip size={14} />
                  {uploading ? 'Загружаем...' : 'Прикрепить файл'}
                </button>
              )}
            </div>

            <div className="md:col-span-2 flex gap-3 flex-wrap">
              <button onClick={() => createMut.mutate(form)} disabled={!form.title || createMut.isPending}
                className="btn-primary">
                {createMut.isPending ? 'Добавляем...' : 'Добавить'}
              </button>
              <button onClick={() => { setShowForm(false); resetForm() }} className="btn-ghost">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* HW list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card text-center py-12">
            <div className="text-5xl mb-4 animate-float">
              {filter === 'overdue' ? '😮‍💨' : filter === 'mine' ? '🏆' : '📚'}
            </div>
            <p className="text-surface-200/40 font-medium">
              {filter === 'overdue' ? 'Просроченных нет' : filter === 'mine' ? 'Всё выполнено!' : 'Заданий пока нет'}
            </p>
            <p className="text-surface-200/20 text-xs mt-1">
              {filter === 'overdue' ? 'Вы справляетесь 💪' : filter === 'mine' ? 'Редкое явление. Сохраните момент 📸' : 'Скоро что-нибудь добавят...'}
            </p>
          </div>
        )}
        {filtered.map((hw: any) => {
          const dl = deadlineLabel(hw.deadline)
          const pct = hw.total_members > 0 ? Math.round(hw.completion_count / hw.total_members * 100) : 0
          return (

            <div key={hw.id} className={clsx('card-hover transition-all', hw.is_completed_by_me && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <button onClick={() => completeMut.mutate(hw.id)}
                  className={clsx('mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all',
                    hw.is_completed_by_me ? 'bg-green-500 border-green-500 text-white' : 'border-surface-700 hover:border-brand-500')}>
                  {hw.is_completed_by_me && <Check size={13} strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx('text-sm font-medium', hw.is_completed_by_me ? 'line-through text-surface-200/40' : 'text-white')}>
                      {hw.title}
                    </span>
                    {hw.subject && <span className="badge bg-brand-600/15 text-brand-400">{hw.subject}</span>}
                    {dl && <span className={`badge ${dl.cls}`}><Clock size={9} />{dl.text}</span>}
                  </div>
                  {hw.description && <p className="text-xs text-surface-200/40 mt-1">{hw.description}</p>}
                  {hw.file_url && (
                    <a href={`http://localhost:8000${hw.file_url}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-1">
                      <Paperclip size={10} />Файл
                    </a>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-surface-200/40 shrink-0">
                      <Users size={10} />{hw.completion_count}/{hw.total_members}
                    </div>
                  </div>
                </div>
                {(user?.role === 'head' || user?.role === 'admin' || hw.created_by === user?.id) && (
                  <button onClick={() => deleteMut.mutate(hw.id)} className="text-surface-200/20 hover:text-red-400 transition-colors shrink-0 p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
