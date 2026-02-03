import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action, replicateKey, predictionId, version, ...rest } = body

  if (action === 'start') {
    // Check if using official model format (org/model) vs version hash
    const isOfficialModel = version && version.includes('/')
    
    const requestBody = isOfficialModel 
      ? { model: version, ...rest }
      : { version, ...rest }

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${replicateKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  }

  if (action === 'poll') {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${replicateKey}`,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
