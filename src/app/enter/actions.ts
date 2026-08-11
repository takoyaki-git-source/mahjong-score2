'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const SITE_AUTH_COOKIE = 'site_auth'

export async function unlock(formData: FormData) {
  const password = formData.get('password')
  const next = formData.get('next')
  const nextPath = typeof next === 'string' && next.startsWith('/') ? next : '/'

  if (typeof password !== 'string' || password !== process.env.SITE_PASSWORD) {
    redirect(`/enter?error=1&next=${encodeURIComponent(nextPath)}`)
  }

  const cookieStore = await cookies()
  cookieStore.set(SITE_AUTH_COOKIE, password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 180,
    path: '/',
  })

  redirect(nextPath)
}
