import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SITE_AUTH_COOKIE = 'site_auth'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // サイト全体の合言葉ゲート。SITE_PASSWORD未設定なら無効(ローカル開発などでは気にせず使える)。
  const sitePassword = process.env.SITE_PASSWORD
  if (sitePassword && pathname !== '/enter') {
    const authed = request.cookies.get(SITE_AUTH_COOKIE)?.value === sitePassword
    if (!authed) {
      const url = request.nextUrl.clone()
      url.pathname = '/enter'
      url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`
      return NextResponse.redirect(url)
    }
  }

  // 公開ページ(/admin以外)はログイン確認が不要なので、Supabaseへの往復(このためだけの
  // 追加レイテンシ)を省いて素通しする。/admin/loginも当然素通し(そこでログインするので)。
  if (!pathname.startsWith('/admin') || pathname.startsWith('/admin/login')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  // The site is public read-only by design (players/results/analytics are meant
  // to be shared with friends). Only /admin (半荘入力・編集) requires the owner
  // to be logged in.
  if (!user && request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!
  return supabaseResponse
}
