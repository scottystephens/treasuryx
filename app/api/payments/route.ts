import { NextResponse } from 'next/server'
import { getPayments } from '@/lib/csv-parser'

export async function GET() {
  try {
    const payments = await getPayments()
    return NextResponse.json(payments)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

