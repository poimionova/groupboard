import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Calendar, Trash2, Shuffle, BookOpen, X } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

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
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function nextDatesForWeekday(weekday: number, count: number): string[] {
  const jsDay = weekday === 6 ? 0 : weekday + 1
  const dates: string[] = []
  const cur = new Date(); cur.setHours(0,0,0,0)
  let skip = (jsDay - cur.getDay() + 7) % 7 || 7
  cur.setDate(cur.getDate() + skip)
  for (let i = 0; i < count; i++) {
    dates.push(toDateStr(new Date(cur)))
    cur.setDate(cur.getDate() + 7)
  }
  return dates
}

const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

export default function QueuePage() {
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ subject: '', slot_minutes: 15, dates: [''], auto_distribute: true })
  const [datesLocked, setDatesLocked] = useState(false)

  const { data: queues = [] } = useQuery({
    queryKey: ['queues'],
    queryFn: () => api.get('/api/queues').then(r => r.data),
    enabled: !!user?.group_id,
  })
  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => api.get('/api/schedule').then(r => r.data),
    enabled: !!user?.group_id,
  })
  const { data: calEvents = [] } = useQuery({
    queryKey: ['calendar-feed'],
    queryFn: async () => { const r = await fetch(CALENDAR_URL); return parseIcal(await r.text()) },
    staleTime: 5 * 60 * 1000,
  })

  const scheduleSubjects = useMemo(() => {
    const seen = new Set<string>()
    return (schedule as any[])
      .filter(s => s.subject)
      .filter(s => { const k = `${s.subject}:${s.weekday}`; if (seen.has(k)) return false; seen.add(k); return true })
  }, [schedule])

  const calSubjects = useMemo(() => {
    const today = toDateStr(new Date())
    const map = new Map<string, string[]>()
    for (const ev of calEvents) {
      const d = toDateStr(ev.start)
      if (d < today) continue
      if (!map.has(ev.summary)) map.set(ev.summary, [])
      map.get(ev.summary)!.push(d)
    }
    return Array.from(map.entries()).map(([summary, dates]) => ({ summary, dates: [...new Set(dates)] }))
  }, [calEvents])

  function applySubject(subject: string, dates: string[]) {
    setForm(f => ({ ...f, subject, dates: dates.length ? dates : [''] }))
    setDatesLocked(dates.length > 0)
  }

  function handleSubjectSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (!val) { setForm(f => ({ ...f, subject: '' })); setDatesLocked(false); return }
    const calMatch = calSubjects.find(c => c.summary === val)
    if (calMatch) { applySubject(val, calMatch.dates); return }
    if (val.includes('::')) {
      const [subj, wdStr] = val.split('::')
      applySubject(subj, nextDatesForWeekday(parseInt(wdStr), 4))
      return
    }
    setForm(f => ({ ...f, subject: val }))
    setDatesLocked(false)
  }

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/queues', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] })
      setShowForm(false)
      setDatesLocked(false)
      setForm({ subject: '', slot_minutes: 15, dates: [''], auto_distribute: true })
      toast.success('Очередь создана')
    },
    onError: (e: any) => {
      const detail = e.response?.data?.detail
      toast.error(typeof detail === 'object' ? detail.message : (detail || 'Ошибка'))
    },
  })

  const joinMut = useMutation({
    mutationFn: ({ qid, date }: any) => api.post(`/api/queues/${qid}/join?slot_date=${date}`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['queues'] })
      toast.success('+5 баллов! Вы записаны')
      if (user) setUser({ ...user, points: res.data.points })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Ошибка'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/queues/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queues'] }),
  })

  const addDate = () => setForm(f => ({ ...f, dates: [...f.dates, ''] }))
  const setDate = (i: number, v: string) => setForm(f => ({ ...f, dates: f.dates.map((d, idx) => idx === i ? v : d) }))
  const removeDate = (i: number) => setForm(f => ({ ...f, dates: f.dates.filter((_, idx) => idx !== i) }))
  const perDay = Math.max(1, Math.floor(90 / form.slot_minutes))
  const hasCalOrSchedule = scheduleSubjects.length > 0 || calSubjects.length > 0

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl text-white">Очередь выступлений</h1>
          <p className="text-surface-200/50 text-sm mt-0.5">Автоматическое распределение по датам</p>
        </div>
        {user?.role !== 'member' && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={16} />Новая очередь
          </button>
        )}
      </div>

      {showForm && (
        <div className="card mb-5 animate-slide-up">
          <h3 className="font-display font-semibold text-white mb-4">Новая очередь</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs text-surface-200/50 mb-1.5">Предмет</label>
                {hasCalOrSchedule ? (
                  <div className="space-y-2">
                    <select className="input" value="" onChange={handleSubjectSelect}>
                      <option value="">— выбрать из расписания —</option>
                      {scheduleSubjects.length > 0 && (
                        <optgroup label="Расписание группы">
                          {scheduleSubjects.map((s: any) => (
                            <option key={`${s.subject}::${s.weekday}`} value={`${s.subject}::${s.weekday}`}>
                              {s.subject} ({DAYS_RU[s.weekday]})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {calSubjects.length > 0 && (
                        <optgroup label="Календарь (ближайшие занятия)">
                          {calSubjects.map(c => (
                            <option key={c.summary} value={c.summary}>
                              {c.summary} ({c.dates.length} дат)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <input className="input" placeholder="или введите вручную"
                      value={form.subject}
                      onChange={e => { setForm(f => ({ ...f, subject: e.target.value })); setDatesLocked(false) }}
                    />
                  </div>
                ) : (
                  <input className="input" placeholder="Защита лабораторной"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs text-surface-200/50 mb-1.5">Длительность слота (мин)</label>
                <select className="input" value={form.slot_minutes} onChange={e => setForm(f => ({ ...f, slot_minutes: +e.target.value }))}>
                  {[5, 10, 15, 20, 30].map(m => <option key={m} value={m}>{m} мин (~{Math.floor(90/m)} чел/пара)</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-surface-200/50">
                  Даты выступлений
                  <span className="ml-2 text-brand-400">≈ {perDay} чел/день</span>
                </label>
                {datesLocked && (
                  <button onClick={() => setDatesLocked(false)}
                    className="text-xs text-surface-200/40 hover:text-white flex items-center gap-1 transition-colors">
                    <X size={10} /> изменить вручную
                  </button>
                )}
              </div>

              {datesLocked ? (
                <div className="space-y-1.5">
                  {form.dates.filter(Boolean).map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-surface-950/60 border border-surface-800 rounded-xl px-4 py-2.5">
                      <Calendar size={13} className="text-brand-400 shrink-0" />
                      <span className="text-sm text-white">
                        {format(new Date(d + 'T00:00:00'), 'EEEE, d MMMM yyyy', { locale: ru })}
                      </span>
                      {i === 0 && (
                        <span className="ml-auto badge bg-brand-600/15 text-brand-400 text-[10px]">
                          <BookOpen size={9} />из расписания
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {form.dates.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="date" className="input flex-1" value={d} onChange={e => setDate(i, e.target.value)} />
                      {form.dates.length > 1 && (
                        <button onClick={() => removeDate(i)} className="btn-ghost px-3 text-red-400">✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={addDate} className="btn-ghost text-xs mt-1">+ Добавить дату</button>
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-10 h-5 rounded-full transition-colors relative ${form.auto_distribute ? 'bg-brand-600' : 'bg-surface-700'}`}
                onClick={() => setForm(f => ({ ...f, auto_distribute: !f.auto_distribute }))}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.auto_distribute ? 'left-5' : 'left-0.5'}`} />
              </div>
              <div>
                <div className="text-sm text-white flex items-center gap-1.5"><Shuffle size={13} />Авто-распределение</div>
                <div className="text-xs text-surface-200/40">Система автоматически распределит всех студентов по датам</div>
              </div>
            </label>

            <div className="flex gap-3">
              <button onClick={() => createMut.mutate({ ...form, dates: form.dates.filter(Boolean) })}
                disabled={!form.dates.some(Boolean) || !form.subject}
                className="btn-primary">
                Создать очередь
              </button>
              <button onClick={() => { setShowForm(false); setDatesLocked(false) }} className="btn-ghost">Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {queues.length === 0 && (
          <div className="card text-center py-12">
            <Users size={32} className="text-surface-200/20 mx-auto mb-3" />
            <p className="text-surface-200/40">Очередей пока нет</p>
            <p className="text-xs text-surface-200/25 mt-1">Староста может создать очередь выступлений</p>
          </div>
        )}
        {queues.map((q: any) => {
          const mySlot = q.slots.find((s: any) => s.user_id === user?.id)
          const byDate: Record<string, any[]> = {}
          q.slots.forEach((s: any) => {
            if (!byDate[s.slot_date]) byDate[s.slot_date] = []
            byDate[s.slot_date].push(s)
          })
          return (
            <div key={q.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-white">{q.subject || 'Выступления'}</h3>
                    {q.auto_distributed && <span className="badge bg-brand-600/15 text-brand-400 text-[10px]"><Shuffle size={9} />авто</span>}
                  </div>
                  <div className="text-xs text-surface-200/40 mt-0.5">
                    {q.slot_minutes} мин/чел · {q.slots.length} записано
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {mySlot ? (
                    <span className="badge bg-green-500/15 text-green-400">
                      Ваша дата: {format(new Date(mySlot.slot_date), 'd MMM', { locale: ru })}
                    </span>
                  ) : (
                    <span className="badge bg-surface-800 text-surface-200/40">Не записаны</span>
                  )}
                  {user?.role !== 'member' && (
                    <button onClick={() => deleteMut.mutate(q.id)} className="text-surface-200/20 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {q.dates.map((date: string) => {
                  const daySlots = byDate[date] || []
                  const perD = Math.max(1, Math.floor(90 / q.slot_minutes))
                  const isFull = daySlots.length >= perD
                  return (
                    <div key={date} className="bg-surface-950/50 rounded-xl p-3 border border-surface-800">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar size={12} className="text-brand-400" />
                          <span className="font-medium text-white">
                            {format(new Date(date), 'EEEE, d MMMM', { locale: ru })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-surface-200/40">{daySlots.length}/{perD} чел.</span>
                          {!mySlot && !isFull && (
                            <button onClick={() => joinMut.mutate({ qid: q.id, date })} className="btn-primary text-xs py-1 px-3">
                              Записаться
                            </button>
                          )}
                          {isFull && <span className="badge bg-surface-800 text-surface-200/40">Заполнено</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {daySlots.sort((a: any, b: any) => a.position - b.position).map((slot: any) => (
                          <span key={slot.id} className={`badge ${slot.user_id === user?.id ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30' : 'bg-surface-800 text-surface-200/50'}`}>
                            {slot.position}. {slot.user?.full_name?.split(' ')[1] || slot.user?.username || '...'}
                          </span>
                        ))}
                      </div>
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
