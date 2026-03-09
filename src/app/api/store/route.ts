import { NextRequest, NextResponse } from 'next/server'

// This is a pass-through for client-side localStorage operations
// In production, this would be backed by a real database
export async function GET() {
  return NextResponse.json({ message: 'Use client-side localStorage' })
}

export async function POST(request: NextRequest) {
  const data = await request.json()
  return NextResponse.json({ success: true, data })
}
