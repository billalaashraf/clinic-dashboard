export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://bilalashraf234.app.n8n.cloud/webhook/clinic-data', {
      cache: 'no-store'
    })

    const text = await res.text()
    console.log('[clients] n8n status:', res.status, '| raw length:', text.length)

    let data
    try { data = JSON.parse(text) } catch {
      console.error('[clients] failed to parse n8n response:', text.slice(0, 200))
      return Response.json({ error: 'Invalid JSON from n8n' }, { status: 500 })
    }

    if (!Array.isArray(data)) {
      console.error('[clients] n8n did not return an array:', JSON.stringify(data).slice(0, 200))
      return Response.json({ error: 'Expected array from n8n' }, { status: 500 })
    }

    console.log('[clients] row count:', data.length)
    data.forEach((row, i) => {
      console.log(`[clients] row[${i}] keys:`, Object.keys(row).join(', '))
      console.log(`[clients] row[${i}] Client_ID="${row.Client_ID}" Full_Name="${row.Full_Name}"`)
    })

    const missing = data.filter(r => !r.Client_ID)
    if (missing.length) {
      console.warn('[clients] rows with missing Client_ID:', missing.length,
        missing.map(r => r.Full_Name || '(no name)'))
    }

    return Response.json(data)
  } catch (e) {
    console.error('[clients] exception:', e.message)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
