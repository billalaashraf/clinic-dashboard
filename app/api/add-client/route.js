export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    console.log('[add-client] payload to n8n:', JSON.stringify(body))

    const res = await fetch('https://bilalashraf234.app.n8n.cloud/webhook/add-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    // Read as text first so we never throw on an empty or non-JSON body
    const text = await res.text()
    console.log('[add-client] n8n status:', res.status, '| body:', text)

    let data = {}
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    if (!res.ok) {
      console.error('[add-client] n8n error:', res.status, text)
      return Response.json(
        { error: `n8n returned ${res.status}`, detail: text },
        { status: res.status }
      )
    }

    return Response.json(data)
  } catch (e) {
    console.error('[add-client] exception:', e.message)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
