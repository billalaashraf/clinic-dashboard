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
    console.log('[delete-client] n8n status:', res.status, '| raw body:', text)

    let n8nData = {}
    try { n8nData = JSON.parse(text) } catch { /* n8n returned non-JSON */ }
    console.log('[delete-client] n8n parsed:', n8nData)

    if (!res.ok) {
      console.error('[delete-client] n8n HTTP error:', res.status)
      return Response.json(
        { success: false, deleted: false, error: `n8n returned ${res.status}`, detail: text },
        { status: res.status }
      )
    }

    // n8n must return { deleted: true } — HTTP 200 alone is not enough
    if (!n8nData.deleted) {
      console.warn('[delete-client] n8n responded 200 but deleted !== true:', n8nData)
      return Response.json({
        success: false,
        deleted: false,
        error: n8nData.error || 'Row not found or not deleted in sheet',
        n8n: n8nData,
      })
    }

    console.log('[delete-client] sheet row confirmed deleted')
    return Response.json({ success: true, deleted: true })

  } catch (e) {
    console.error('[delete-client] exception:', e.message)
    return Response.json({ success: false, deleted: false, error: e.message }, { status: 500 })
  }
}
