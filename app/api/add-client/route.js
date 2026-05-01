export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()

    // Confirm payload keys before sending
    const payload = {
      Full_Name:             body.Full_Name            || '',
      WhatsApp_Number:       body.WhatsApp_Number       || '',
      Email:                 body.Email                 || '',
      Treatment_Type:        body.Treatment_Type        || '',
      Treatment_Date:        body.Treatment_Date        || '',
      Session_Number:        body.Session_Number        || '1',
      Total_Sessions_Planned:body.Total_Sessions_Planned|| '',
      Reminder_Stage:        body.Reminder_Stage        || 'Aftercare',
      Notes:                 body.Notes                 || '',
    }

    console.log('[add-client] sending to n8n:', JSON.stringify(payload))

    const res = await fetch('https://bilalashraf234.app.n8n.cloud/webhook/add-client', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    const text = await res.text()
    console.log('[add-client] n8n status:', res.status, '| body:', text)

    if (!res.ok) {
      console.error('[add-client] n8n error:', res.status, text)
      return Response.json(
        { success: false, error: `n8n returned ${res.status}`, detail: text },
        { status: res.status }
      )
    }

    // Parse row_number from n8n response if present
    let data = {}
    try { data = JSON.parse(text) } catch { /* n8n returned non-JSON — that's fine */ }

    console.log('[add-client] success, row_number:', data.row_number ?? 'not returned')
    return Response.json({ success: true, row_number: data.row_number ?? null })

  } catch (e) {
    console.error('[add-client] exception:', e.message)
    return Response.json({ success: false, error: e.message }, { status: 500 })
  }
}
