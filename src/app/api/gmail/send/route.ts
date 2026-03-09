import { NextRequest, NextResponse } from 'next/server'

function encodeEmail(to: string, subject: string, body: string, from?: string): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body).toString('base64'),
  ]
  if (from) emailLines.unshift(`From: ${from}`)
  return Buffer.from(emailLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.access_token || null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, accessToken, refreshToken }: {
      to: string
      subject: string
      body: string
      accessToken: string
      refreshToken?: string
    } = await request.json()

    if (!to || !subject || !body || !accessToken) {
      return NextResponse.json(
        { error: '送信先・件名・本文・アクセストークンが必要です' },
        { status: 400 }
      )
    }

    let token = accessToken

    const encodedEmail = encodeEmail(to, subject, body)

    let response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail }),
    })

    // Try refreshing token if unauthorized
    if (response.status === 401 && refreshToken) {
      const newToken = await refreshAccessToken(refreshToken)
      if (newToken) {
        token = newToken
        response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: encodedEmail }),
        })
      }
    }

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `Gmail送信エラー: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ messageId: data.id, newAccessToken: token !== accessToken ? token : undefined })
  } catch (error) {
    console.error('Gmail send error:', error)
    return NextResponse.json(
      { error: 'メール送信に失敗しました: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
