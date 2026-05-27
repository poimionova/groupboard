import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, KanbanSquare, BookOpen, Calendar,
  Users, Vote, LogOut, Zap, Menu, X
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import clsx from 'clsx'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд', emoji: '📊' },
  { to: '/board', icon: KanbanSquare, label: 'Канбан-доска', emoji: '📌' },
  { to: '/homework', icon: BookOpen, label: 'Домашние задания', emoji: '📚' },
  { to: '/schedule', icon: Calendar, label: 'Расписание', emoji: '📅' },
  { to: '/queue', icon: Users, label: 'Очередь выступлений', emoji: '🎤' },
  { to: '/polls', icon: Vote, label: 'Голосования', emoji: '🗳️' },
]

const roleLabel: Record<string, string> = {
  admin: 'Администратор',
  head: 'Староста',
  member: 'Студент',
}

const roleColor: Record<string, string> = {
  admin: 'text-red-400',
  head: 'text-yellow-400',
  member: 'text-surface-200/50',
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-surface-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 bg-gradient-to-br from-brand-500 to-purple-600 rounded-lg flex items-center justify-center text-sm font-black text-white shadow-lg shadow-brand-600/30">
            G
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border border-surface-950" />
          </div>
          <div>
            <div className="font-display font-bold text-white text-sm leading-tight">GroupBoard</div>
            <div className="text-[10px] text-surface-200/40">учебная группа</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-surface-200/30 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label, emoji }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) => clsx(
              'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer',
              isActive
                ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20 shadow-sm shadow-brand-500/5'
                : 'text-surface-200/60 hover:text-white hover:bg-surface-800/70 border border-transparent'
            )}
          >
            {({ isActive }) => (
              <>
                <span className={clsx('text-base leading-none shrink-0 transition-transform duration-150', !isActive && 'group-hover:scale-110')}>{emoji}</span>
                <span className="font-body text-sm truncate">{label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-soft" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-surface-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-800/50 transition-colors group">
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-brand-600/30 to-purple-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-xs shrink-0">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {user?.full_name || user?.username}
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <Zap size={8} className="text-yellow-400" />
              <span className="text-yellow-400/80 font-mono font-bold">{user?.points || 0}</span>
              <span className="text-surface-200/30">·</span>
              <span className={clsx('font-medium', roleColor[user?.role ?? 'member'])}>
                {user?.role ? roleLabel[user.role] : ''}
              </span>
            </div>
          </div>
          <button onClick={handleLogout}
            className="text-surface-200/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-surface-950 border-r border-surface-800">
        <SidebarContent />
      </aside>

      {/* ── Mobile drawer backdrop ── */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setOpen(false)} />
      )}

      {/* ── Mobile drawer ── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-surface-950 border-r border-surface-800 transition-transform duration-200 md:hidden',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent />
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-surface-950/95 backdrop-blur-sm border-b border-surface-800 shrink-0">
          <button onClick={() => setOpen(true)} className="text-surface-200/50 hover:text-white transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 bg-gradient-to-br from-brand-500 to-purple-600 rounded-md flex items-center justify-center text-xs font-black text-white">G</div>
            <span className="font-display font-bold text-white text-sm">GroupBoard</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <Zap size={9} className="text-yellow-400" />
            <span className="text-yellow-400/80 font-mono font-bold">{user?.points || 0}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
