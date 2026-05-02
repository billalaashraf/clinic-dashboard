export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    console.log('[update-client] payload:', JSON.stringify(body))

    const res = await fetch('https://bilalashraf234.app.n8n.cloud/webhook/update-client', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    const text = await res.text()
    console.log('[update-client] n8n status:', res.status, '| body:', text)

    if (!res.ok) {
      console.error('[update-client] n8n error:', res.status, text)
      return Response.json(
        { success: false, error: `n8n returned ${res.status}`, detail: text },
        { status: res.status }
      )
    }

    let data = {}
    try { data = JSON.parse(text) } catch { /* non-JSON */ }

    console.log('[update-client] success')
    return Response.json({ success: true, ...data })

  } catch (e) {
    console.error('[update-client] exception:', e.message)
    return Response.json({ success: false, error: e.message }, { status: 500 })
  }
}
