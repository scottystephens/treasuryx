import { NextResponse } from 'next/server'
import { getForecasts } from '@/lib/csv-parser'

export async function GET() {
  try {
    const forecasts = await getForecasts()
    return NextResponse.json(forecasts)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch forecasts' },
      { status: 500 }
    )
  }
}

