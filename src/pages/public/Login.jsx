import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabaseClient'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { House } from '@phosphor-icons/react'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signupSchema = z.object({
  propertyName: z.string().min(1, 'Property name is required').max(100, 'Property name is too long'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

const SCHEMAS = { login: loginSchema, signup: signupSchema, forgot: forgotSchema }

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [serverError, setServerError] = useState(null)
  const [forgotSent, setForgotSent] = useState(false)

  const from = location.state?.from?.pathname ?? '/'

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
    resolver: zodResolver(SCHEMAS[mode]),
  })

  function switchMode(newMode) {
    setMode(newMode)
    setServerError(null)
    setForgotSent(false)
    reset()
  }

  async function onSubmit(data) {
    setServerError(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) {
        setServerError('Invalid email or password. Please try again.')
        return
      }
      navigate(from, { replace: true })
    }

    if (mode === 'signup') {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      })
      if (signUpError) {
        setServerError(signUpError.message)
        return
      }

      const session = authData.session
      if (session) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-property`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ property_name: data.propertyName }),
            }
          )
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            setServerError(err.error || 'Failed to create property. Please try again.')
            return
          }
        } catch {
          setServerError('Failed to create property. Please try again.')
          return
        }
      }

      navigate('/onboarding', { replace: true })
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setServerError(error.message)
        return
      }
      setForgotSent(true)
    }
  }

  const subtitle = {
    login: 'Sign in to your property dashboard',
    signup: 'Create your property dashboard',
    forgot: 'Reset your password',
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-[32px] text-text-primary">Lodge-ical</h1>
          <p className="font-body text-[15px] text-text-secondary mt-1">
            {subtitle[mode]}
          </p>
        </div>

        <div className="bg-surface-raised border border-border rounded-[8px] p-8">
          {mode === 'forgot' && forgotSent ? (
            <div className="text-center">
              <p className="font-body text-[15px] text-text-primary font-semibold mb-2">Check your email</p>
              <p className="font-body text-[14px] text-text-secondary mb-6">
                We sent a password reset link to your email. The link expires in 1 hour.
              </p>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-body text-[14px] text-info hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="flex flex-col gap-5">
                {mode === 'signup' && (
                  <Input
                    label="Property name"
                    id="propertyName"
                    type="text"
                    placeholder="e.g. Sunrise Lodge"
                    error={errors.propertyName?.message}
                    {...register('propertyName')}
                  />
                )}

                <Input
                  label="Email"
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                {mode !== 'forgot' && (
                  <Input
                    label="Password"
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    error={errors.password?.message}
                    {...register('password')}
                  />
                )}

                {serverError && (
                  <p className="text-danger text-[13px] font-body">{serverError}</p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isSubmitting}
                  className="w-full mt-2"
                >
                  {mode === 'login' && 'Sign in'}
                  {mode === 'signup' && 'Create account'}
                  {mode === 'forgot' && 'Send reset link'}
                </Button>
              </div>
            </form>
          )}

          {/* Mode toggle links */}
          {!(mode === 'forgot' && forgotSent) && (
            <div className="mt-5 flex flex-col items-center gap-2">
              {mode === 'login' && (
                <>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="font-body text-[13px] text-text-muted hover:text-text-secondary"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="font-body text-[13px] text-info hover:underline"
                  >
                    Don&apos;t have an account? Create one
                  </button>
                </>
              )}
              {mode === 'signup' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-body text-[13px] text-info hover:underline"
                >
                  Already have an account? Sign in
                </button>
              )}
              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-body text-[13px] text-info hover:underline"
                >
                  Back to sign in
                </button>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="font-body text-[12px] text-text-muted">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Demo CTA */}
        <Link
          to="/demo"
          className="flex items-center justify-center gap-3 w-full min-h-[48px] px-4 bg-surface border-[1.5px] border-border rounded-none font-body hover:bg-border transition-colors duration-100"
        >
          <House size={18} weight="bold" className="text-text-secondary shrink-0" />
          <div className="text-left">
            <div className="text-[14px] font-semibold text-text-primary leading-tight">Try Lodge-ical</div>
            <div className="text-[11px] text-text-muted leading-tight">No account needed — nothing is saved</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
