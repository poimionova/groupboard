import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical, AlertCircle, Clock, User } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import clsx from 'clsx'

const COLUMNS = [
  { id: 'todo', label: 'К выполнению', color: 'text-slate-400', dot: 'bg-slate-400' },
  { id: 'in_progress', label: 'В процессе', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  { id: 'done', label: 'Готово', color: 'text-green-400', dot: 'bg-green-400' },
]

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-700 text-slate-300',
  medium: 'bg-yellow-500/15 text-yellow-400',
  high: 'bg-red-500/15 text-red-400',
}
const PRIORITY_LABEL: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }

const TEMPLATES = [
  'Договориться о зачёте', 'Отправить список группы', 'Собрать деньги на подарок',
  'Подать заявление', 'Договориться о переносе пары', 'Сдать документы',
]

export default function BoardPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [activeCol, setActiveCol] = useState('todo')
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', template: '', deadline: '' })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get('/api/tasks').then(r => r.data),
    enabled: !!user?.group_id,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/api/groups/my/members').then(r => r.data),
    enabled: !!user?.group_id,
  })

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/tasks', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setShowForm(false)
      setForm({ title: '', description: '', priority: 'medium', template: '', deadline: '' })
      toast.success('Задача создана')
    },
    onError: () => toast.error('Ошибка'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => api.patch(`/api/tasks/${id}`, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const handleDrop = (colId: string) => {
    if (dragging) { updateMut.mutate({ id: dragging, status: colId }); setDragging(null) }
  }

  const tasksByCol = (colId: string) => tasks.filter((t: any) => t.status === colId)

  const TaskCard = ({ task }: { task: any }) => (
    <div
      draggable
      onDragStart={() => setDragging(task.id)}
      className="kanban-card group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm text-white font-medium leading-snug">{task.title}</div>
        <div className="flex items-center gap-1 shrink-0">
          <GripVertical size={12} className="text-surface-200/20 group-hover:text-surface-200/40 cursor-grab hidden md:block" />
          <button onClick={() => deleteMut.mutate(task.id)} className="text-surface-200/20 hover:text-red-400 transition-colors p-1 -m-1">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {task.description && <p className="text-xs text-surface-200/40 mb-2 line-clamp-2">{task.description}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`badge ${PRIORITY_BADGE[task.priority]}`}>
          {task.priority === 'high' && <AlertCircle size={9} />}
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.deadline && (
          <span className="badge bg-surface-800 text-surface-200/40">
            <Clock size={9} />{format(new Date(task.deadline), 'd MMM', { locale: ru })}
          </span>
        )}
        {task.assignee && (
          <span className="badge bg-surface-800 text-surface-200/40">
            <User size={9} />{task.assignee.full_name?.split(' ')[1] || task.assignee.username}
          </span>
        )}
      </div>
      {/* Mobile: move to column buttons */}
      <div className="md:hidden flex gap-1 mt-2 pt-2 border-t border-surface-800">
        {COLUMNS.filter(c => c.id !== task.status).map(c => (
          <button key={c.id} onClick={() => updateMut.mutate({ id: task.id, status: c.id })}
            className={`text-[10px] px-2 py-0.5 rounded-md border border-surface-700 ${c.color} hover:bg-surface-800`}>
            → {c.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 h-full flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl text-white">Канбан-доска</h1>
          <p className="text-surface-200/50 text-sm mt-0.5">Задачи группы и старосты</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} /><span className="hidden sm:inline">Новая задача</span><span className="sm:hidden">Задача</span>
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-5 animate-slide-up">
          <h3 className="font-display font-semibold text-white mb-4">Новая задача</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-surface-200/50 mb-1.5">Шаблон (необязательно)</label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, title: t, template: t }))}
                    className={clsx('text-xs px-3 py-1.5 rounded-lg border transition-all', form.template === t ? 'bg-brand-600/20 border-brand-500/50 text-brand-400' : 'border-surface-700 text-surface-200/50 hover:border-surface-600')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-surface-200/50 mb-1.5">Название</label>
              <input className="input" placeholder="Описание задачи" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">Приоритет</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-200/50 mb-1.5">Дедлайн</label>
              <input type="datetime-local" className="input" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button onClick={() => createMut.mutate({ ...form, deadline: form.deadline || undefined })} disabled={!form.title} className="btn-primary">
                Создать задачу
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile: column tabs ── */}
      <div className="md:hidden flex gap-1 mb-4 bg-surface-900 rounded-xl p-1">
        {COLUMNS.map(col => (
          <button key={col.id} onClick={() => setActiveCol(col.id)}
            className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
              activeCol === col.id ? 'bg-surface-800 text-white' : 'text-surface-200/40')}>
            <div className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
            <span className="truncate">{col.label}</span>
            <span className="text-[10px] opacity-60">({tasksByCol(col.id).length})</span>
          </button>
        ))}
      </div>

      {/* ── Mobile: single active column ── */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-2">
        {tasksByCol(activeCol).map((task: any) => <TaskCard key={task.id} task={task} />)}
        {tasksByCol(activeCol).length === 0 && (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-surface-800 rounded-xl py-12 gap-2">
            <span className="text-3xl">{activeCol === 'done' ? '🎉' : activeCol === 'in_progress' ? '⚡' : '📋'}</span>
            <p className="text-xs text-surface-200/20">{activeCol === 'done' ? 'Ничего не сделано (пока)' : 'Задач нет'}</p>
          </div>
        )}
      </div>

      {/* ── Desktop: 3-column board ── */}
      <div className="hidden md:flex gap-4 overflow-x-auto flex-1 pb-2">
        {COLUMNS.map(col => (
          <div key={col.id} className="kanban-col"
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col.id)}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className={`font-display font-semibold text-sm ${col.color}`}>{col.label}</span>
              </div>
              <span className="badge bg-surface-800 text-surface-200/50">{tasksByCol(col.id).length}</span>
            </div>
            {tasksByCol(col.id).map((task: any) => <TaskCard key={task.id} task={task} />)}
            {tasksByCol(col.id).length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-surface-800 rounded-xl min-h-[80px] gap-1.5">
                <span className="text-xl opacity-40">{col.id === 'done' ? '🎉' : col.id === 'in_progress' ? '⚡' : '📋'}</span>
                <p className="text-xs text-surface-200/20">{col.id === 'done' ? 'Пока пусто' : 'Перетащите сюда'}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
