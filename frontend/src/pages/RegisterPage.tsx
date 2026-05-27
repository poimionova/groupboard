import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

interface FormState {
  username: string
  email: string
  password: string
  full_name: string
}

interface FieldErrors {
  username?: string
  email?: string
  password?: string
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}
  if (!form.username) {
    errors.username = 'Обязательное поле'
  } else if (!/^[a-zA-Z0-9_-]{3,50}$/.test(form.username)) {
    errors.username = 'Только латиница, цифры, _ и − (3–50 символов). Кириллица не поддерживается.'
  }
  if (!form.email) {
    errors.email = 'Обязательное поле'
  }
  if (!form.password) {
    errors.password = 'Обязательное поле'
  } else if (form.password.length < 6) {
    errors.password = 'Минимум 6 символов'
  }
  return errors
}

function translateError(detail: any): string {
  if (!detail) return 'Ошибка регистрации'
  if (typeof detail === 'string') {
    if (detail.includes('already taken') || detail.includes('already exists')) return 'Логин или email уже занят'
    if (detail.includes('логин') || detail.includes('Логин')) return detail
    if (detail.includes('email') || detail.includes('Email')) return detail
    return detail
  }
  if (Array.isArray(detail)) {
    return detail.map((d: any) => d.msg || d.message || String(d)).join(', ')
  }
  return 'Ошибка регистрации'
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>({ username: '', email: '', password: '', full_name: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const { register, login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    if (fieldErrors[k as keyof FieldErrors]) {
      setFieldErrors(fe => ({ ...fe, [k]: undefined }))
    }
  }

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validate(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    try {
      await register(form)
      await login(form.username, form.password)
      toast.success('Аккаунт создан!')
      navigate('/onboard')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      const msg = translateError(detail)
      // Try to highlight specific field
      if (msg.toLowerCase().includes('логин')) {
        setFieldErrors({ username: msg })
      } else if (msg.toLowerCase().includes('email')) {
        setFieldErrors({ email: msg })
      } else {
        toast.error(msg)
      }
    }
  }

  const fields = [
    { key: 'full_name' as const, label: 'Полное имя', placeholder: 'Иванов Иван', type: 'text', hint: 'Необязательно' },
    { key: 'username' as const, label: 'Логин', placeholder: 'ivanov_i', type: 'text', hint: 'Только латиница, цифры, _ и −' },
    { key: 'email' as const, label: 'Email', placeholder: 'ivan@uni.ru', type: 'email', hint: undefined },
    { key: 'password' as const, label: 'Пароль', placeholder: '••••••••', type: 'password', hint: 'Минимум 6 символов' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-600/8 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-2xl shadow-xl shadow-brand-600/30 mb-4">
            <span className="font-display font-bold text-white text-lg">G</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-white">Регистрация</h1>
          <p className="text-surface-200/50 text-sm mt-1">Создайте аккаунт GroupBoard</p>
        </div>

        <form onSubmit={handle} className="card space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-surface-200/60 mb-1.5">{f.label}</label>
              <input
                className={`input ${fieldErrors[f.key as keyof FieldErrors] ? 'border-red-500 focus:border-red-500' : ''}`}
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={set(f.key)}
                autoComplete={f.key === 'password' ? 'new-password' : undefined}
              />
              {fieldErrors[f.key as keyof FieldErrors] ? (
                <p className="text-red-400 text-xs mt-1">{fieldErrors[f.key as keyof FieldErrors]}</p>
              ) : f.hint ? (
                <p className="text-surface-200/30 text-xs mt-1">{f.hint}</p>
              ) : null}
            </div>
          ))}
          <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-2.5">
            {isLoading ? 'Создаём...' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="text-center text-sm text-surface-200/40 mt-4">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Войти</Link>
        </p>
      </div>
    </div>
  )
}
