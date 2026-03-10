import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabaseClient'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Lock } from '@phosphor-icons/react'

const resetSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export default function ResetPassword() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState(null)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [checking, setChecking] = useState(true)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetSchema),
  })

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setHasRecoverySession(true)
          setChecking(false)
        }
      }
    )

    // Also check if there is already an active session (recovery link may
    // have been processed before the listener was attached).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasRecoverySession(true)
      }
      setChecking(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function onSubmit(data) {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    })
    if (error) {
      setServerError(error.message)
      return
    }
    setSuccess(true)
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="font-body text-[15px] text-text-secondary">Verifying link&hellip;</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-[32px] text-text-primary">Lodge-ical</h1>
          <p className="font-body text-[15px] text-text-secondary mt-1">
            Reset your password
          </p>
        </div>

        <div className="bg-surface-raised border border-border rounded-[8px] p-8">
          {!hasRecoverySession ? (
            <div className="text-center flex flex-col items-center gap-4">
              <Lock size={32} weight="bold" className="text-text-muted" />
              <p className="font-body text-[15px] text-text-primary">
                This link is invalid or has expired.
              </p>
              <Link
                to="/login"
                className="font-body text-[14px] text-info hover:underline"
              >
                Back to login
              </Link>
            </div>
          ) : success ? (
            <div className="text-center flex flex-col items-center gap-3">
              <p className="font-body text-[15px] text-success font-semibold">
                Password updated successfully.
              </p>
              <p className="font-body text-[13px] text-text-secondary">
                Redirecting to dashboard&hellip;
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="flex flex-col gap-5">
                <Input
                  label="New Password"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  {...register('password')}
                />
                <Input
                  label="Confirm Password"
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />

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
                  Reset password
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="font-body text-[13px] text-text-secondary hover:text-text-primary transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
