import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Clock, Calendar, MapPin, User } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

const CALENDAR_URL = 'https://eilpyzysgdyrpunkhosb.supabase.co/functions/v1/calendar-export?type=group&id=f0ff99e1-8fbb-11f0-bee6-005056912e01&period=2weeks'

interface CalEvent {
  uid: string
  summary: string
  start: Date
  end: Date
  location: string
  instructor: string
}

function getField(block: string, key: string): string {
  const match = block.match(new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, 'm'))
  return match ? match[1].trim() : ''
}

function parseIcalDate(val: string): Date {
  const clean = val.replace('Z', '')
  const y = +clean.slice(0, 4), mo = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8)
  const h = clean.length >= 13 ? +clean.slice(9, 11) : 0
  const mi = clean.length >= 15 ? +clean.slice(11, 13) : 0
  return new Date(y, mo, d, h, mi)
}

function parseIcal(text: string): CalEvent[] {
  return text.split('BEGIN:VEVENT').slice(1).map(block => {
    const desc = getField(block, 'DESCRIPTION').replace(/\\n/g, '\n')
    return {
      uid: getField(block, 'UID'),
      summary: getField(block, 'SUMMARY').replace(/\\,/g, ','),
      start: parseIcalDate(getField(block, 'DTSTART')),
      end: parseIcalDate(getField(block, 'DTEND')),
      location: getField(block, 'LOCATION').replace(/\\,/g, ','),
      instructor: desc.split('\n')[0].trim(),
    }
  }).filter(e => e.uid).sort((a, b) => a.start.getTime() - b.start.getTime())
}

const RU_DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function formatDate(d: Date) {
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${RU_DAYS[d.getDay()]}`
}

function fmt2(n: number) { return String(n).padStart(2, '0') }
function formatTime(d: Date) { return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}` }
function dateKey(d: Date) { return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}` }

export default function SchedulePage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ weekday: 0, time_start: '09:00', time_end: '10:30', subject: '', room: '', teacher: '' })

  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => api.get('/api/schedule').then(r => r.data),
    enabled: !!user?.group_id,
  })

  const { data: calEvents = [], isLoading: calLoading } = useQuery({
    queryKey: ['calendar-feed'],
    queryFn: async () => {
      const r = await fetch(CALENDAR_URL)
      const text = await r.text()
      return parseIcal(text)
    },
    staleTime: 5 * 60 * 1000,
  })

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/schedule', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); setShowForm(false); toast.success('Добавлено') },
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/schedule/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  })

  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1

  const calByDate = calEvents.reduce<Record<string, CalEvent[]>>((acc, ev) => {
    const k = dateKey(ev.start)
    if (!acc[k]) acc[k] = []
    acc[k].push(ev)
    return acc
  }, {})
  const todayKey = dateKey(new Date())

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl text-white">Расписание</h1>
          <p className="text-surface-200/50 text-sm mt-0.5">Сегодня: {DAYS[todayIdx]}</p>
        </div>
        {user?.role !== 'member' && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={16} />Добавить пару
          </button>
        )}
      </div>

      {showForm && (
        <div className="card mb-5 animate-slide-up">
          <h3 className="font-display font-semibold text-white mb-4">Новая пара</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">День</label>
              <select className="input" value={form.weekday} onChange={e => setForm(f => ({ ...f, weekday: +e.target.value }))}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">Начало</label>
              <input type="time" className="input" value={form.time_start} onChange={e => setForm(f => ({ ...f, time_start: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">Конец</label>
              <input type="time" className="input" value={form.time_end} onChange={e => setForm(f => ({ ...f, time_end: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">Предмет</label>
              <input className="input" placeholder="Математика" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">Аудитория</label>
              <input className="input" placeholder="А-101" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">Преподаватель</label>
              <input className="input" placeholder="Иванов И.И." value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} />
            </div>
            <div className="col-span-2 md:col-span-3 flex gap-3">
              <button onClick={() => createMut.mutate(form)} className="btn-primary">Добавить</button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar feed */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-brand-400" />
          <h2 className="font-display font-semibold text-white">Ближайшие занятия</h2>
          <span className="badge bg-brand-600/15 text-brand-400 text-[10px]">2 недели</span>
        </div>

        {calLoading ? (
          <div className="card text-center py-8">
            <p className="text-surface-200/40 text-sm">Загрузка расписания…</p>
          </div>
        ) : Object.keys(calByDate).length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-surface-200/40 text-sm">Нет занятий на ближайшие 2 недели</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(calByDate).map(([key, events]) => (
              <div key={key}>
                <div className={`flex items-center gap-2 mb-2 ${key === todayKey ? 'text-brand-400' : 'text-surface-200/50'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${key === todayKey ? 'bg-brand-400' : 'bg-surface-700'}`} />
                  <span className="font-display font-semibold text-sm">{formatDate(events[0].start)}</span>
                  {key === todayKey && <span className="badge bg-brand-600/15 text-brand-400 text-[10px]">Сегодня</span>}
                </div>
                <div className="space-y-2">
                  {events.map(ev => (
                    <div key={ev.uid} className="card-hover flex items-start gap-3">
                      <div className="flex items-center gap-1 text-surface-200/50 shrink-0 pt-0.5 min-w-0 w-20 md:w-24">
                        <Clock size={11} />
                        <span className="font-mono text-xs truncate">{formatTime(ev.start)}–{formatTime(ev.end)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-white">{ev.summary}</span>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {ev.location && (
                            <span className="flex items-center gap-1 text-xs text-surface-200/40">
                              <MapPin size={10} />{ev.location}
                            </span>
                          )}
                          {ev.instructor && (
                            <span className="flex items-center gap-1 text-xs text-surface-200/40">
                              <User size={10} />{ev.instructor}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Local schedule */}
      {schedule.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-surface-200/50" />
            <h2 className="font-display font-semibold text-white">Расписание группы</h2>
          </div>
          <div className="space-y-5">
            {DAYS.map((day, idx) => {
              const dayItems = schedule.filter((s: any) => s.weekday === idx).sort((a: any, b: any) => a.time_start.localeCompare(b.time_start))
              if (!dayItems.length) return null
              return (
                <div key={idx}>
                  <div className={`flex items-center gap-2 mb-2 ${idx === todayIdx ? 'text-brand-400' : 'text-surface-200/50'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${idx === todayIdx ? 'bg-brand-400' : 'bg-surface-700'}`} />
                    <span className="font-display font-semibold text-sm">{day}</span>
                    {idx === todayIdx && <span className="badge bg-brand-600/15 text-brand-400 text-[10px]">Сегодня</span>}
                  </div>
                  <div className="space-y-2">
                    {dayItems.map((item: any) => (
                      <div key={item.id} className="card-hover flex items-center gap-3">
                        <div className="flex items-center gap-1 text-surface-200/50 shrink-0 w-20 md:w-24">
                          <Clock size={11} />
                          <span className="font-mono text-xs">{item.time_start}–{item.time_end}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-white">{item.subject || '—'}</span>
                          {item.room && <span className="text-xs text-surface-200/40 ml-2">ауд. {item.room}</span>}
                          {item.teacher && <div className="text-xs text-surface-200/40">{item.teacher}</div>}
                        </div>
                        {user?.role !== 'member' && (
                          <button onClick={() => deleteMut.mutate(item.id)} className="text-surface-200/20 hover:text-red-400 transition-colors p-1">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {schedule.length === 0 && calEvents.length === 0 && !calLoading && (
        <div className="card text-center py-12">
          <p className="text-surface-200/40">Расписание пока не добавлено</p>
          <p className="text-xs text-surface-200/25 mt-1">Староста может добавить пары</p>
        </div>
      )}
    </div>
  )
}
