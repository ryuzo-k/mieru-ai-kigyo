import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') || 'company_default'
  const origin = request.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?google_error=認証コードが取得できませんでした`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/settings?google_error=Google認証情報が設定されていません`)
  }

  const redirectUri = `${origin}/api/auth/google/callback`

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('Token exchange failed:', err)
      return NextResponse.redirect(`${origin}/settings?google_error=トークン取得に失敗しました`)
    }

    const tokens = await tokenRes.json()

    // Fetch user email
    let email = ''
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (userRes.ok) {
        const userInfo = await userRes.json()
        email = userInfo.email || ''
      }
    } catch {
      // email is optional
    }

    // Save tokens to Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const expiry = new Date(
      Date.now() + ((tokens.expires_in as number) || 3600) * 1000
    ).toISOString()

    await supabase.from('api_keys').upsert({
      id: state,
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token || null,
      google_token_expiry: expiry,
      google_email: email,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.redirect(
      `${origin}/settings?google_connected=true&email=${encodeURIComponent(email)}`
    )
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(`${origin}/settings?google_error=予期しないエラーが発生しました`)
  }
}
