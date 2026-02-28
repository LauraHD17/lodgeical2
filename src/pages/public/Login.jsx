import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabaseClient'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState(null)

  const from = location.state?.from?.pathname ?? '/'

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data) {
    setServerError(null)
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-[32px] text-text-primary">Lodge-ical</h1>
          <p className="font-body text-[15px] text-text-secondary mt-1">
            Sign in to your property dashboard
          </p>
        </div>

        <div className="bg-surface-raised border border-border rounded-[8px] p-8">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-5">
              <Input
                label="Email"
                id="email"
                type="email"
                placeholder="you@example.com"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Password"
                id="password"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password')}
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
                Sign in
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
