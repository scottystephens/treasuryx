import { NextResponse } from 'next/server'
import { getEntities } from '@/lib/csv-parser'

export async function GET() {
  try {
    const entities = await getEntities()
    return NextResponse.json(entities)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    )
  }
}

