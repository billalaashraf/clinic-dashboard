export const dynamic = 'force-dynamic'

function parseDate(str) {
  if (!str) return null
  const p = str.split('/')
  if (p.length !== 3) return null
  const d = new Date(`${p[2]}-${p[1]}-${p[0]}`)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET() {
  try {
    const res = await fetch('https://bilalashraf234.app.n8n.cloud/webhook/clinic-data', {
      cache: 'no-store',
    })
    const clients = await res.json()

    if (!Array.isArray(clients)) {
      return Response.json({ error: 'Unexpected data format from clinic-data' }, { status: 502 })
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const THRESHOLD_DAYS = 30

    const toLapse = clients.filter(c => {
      if (c.Status !== 'Active') return false
      const d = parseDate(c.Next_Reminder_Date)
      if (!d) return false
      return (now - d) / 86400000 >= THRESHOLD_DAYS
    })

    const results = await Promise.allSettled(
      toLapse.map(c =>
        fetch('https://bilalashraf234.app.n8n.cloud/webhook/update-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row_number: c.row_number, Status: 'Lapsed' }),
        })
      )
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed    = results.filter(r => r.status === 'rejected').length

    return Response.json({
      checked:  clients.length,
      lapsed:   toLapse.length,
      updated:  succeeded,
      failed,
      clients:  toLapse.map(c => ({ row_number: c.row_number, name: c.Full_Name, reminder_date: c.Next_Reminder_Date })),
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
