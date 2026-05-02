export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const payload = { Client_ID: body.Client_ID || '' }

    console.log('[delete-client] sending to n8n:', JSON.stringify(payload))

    const res = await fetch('https://bilalashraf234.app.n8n.cloud/webhook/delete-client', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    const text = await res.text()
    console.log('[delete-client] n8n status:', res.status, '| body:', text)

    if (!res.ok) {
      console.error('[delete-client] n8n error:', res.status, text)
      return Response.json(
        { success: false, error: `n8n returned ${res.status}`, detail: text },
        { status: res.status }
      )
    }

    let data = {}
    try { data = JSON.parse(text) } catch { /* n8n returned non-JSON */ }

    console.log('[delete-client] success:', data)
    return Response.json({ success: true })

  } catch (e) {
    console.error('[delete-client] exception:', e.message)
    return Response.json({ success: false, error: e.message }, { status: 500 })
  }
}
