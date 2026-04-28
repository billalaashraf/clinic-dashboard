export async function GET() {
  try {
    const res = await fetch('https://bilalashraf234.app.n8n.cloud/webhook/clinic-data')
    const data = await res.json()
    return Response.json(data)
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
