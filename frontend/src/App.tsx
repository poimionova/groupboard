import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import Layout from './components/ui/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import OnboardPage from './pages/OnboardPage'
import DashboardPage from './pages/DashboardPage'
import BoardPage from './pages/BoardPage'
import HomeworkPage from './pages/HomeworkPage'
import SchedulePage from './pages/SchedulePage'
import QueuePage from './pages/QueuePage'
import PollsPage from './pages/PollsPage'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (token && user && !user.group_id) return <Navigate to="/onboard" replace />
  return <>{children}</>
}

function RequireNoAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (token) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { token, fetchMe } = useAuthStore()

  useEffect(() => {
    if (token) fetchMe()
  }, [token])

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#27272a', color: '#fafafa', border: '1px solid #3f3f46' },
            success: { iconTheme: { primary: '#6366f1', secondary: '#fafafa' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<RequireNoAuth><LoginPage /></RequireNoAuth>} />
          <Route path="/register" element={<RequireNoAuth><RegisterPage /></RequireNoAuth>} />
          <Route path="/onboard" element={token ? <OnboardPage /> : <Navigate to="/login" />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/homework" element={<HomeworkPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/polls" element={<PollsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
