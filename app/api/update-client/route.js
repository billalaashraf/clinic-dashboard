export async function POST(request) {
  try {
    const body = await request.json()
    const res = await fetch('https://bilalashraf234.app.n8n.cloud/webhook/update-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    return Response.json(data)
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
