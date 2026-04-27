'use client'
import { useState, useEffect } from 'react'

const WEBHOOK_URL = 'https://bilalashraf234.app.n8n.cloud/webhook/clinic-data'

const STAGE_COLORS = {
  'Aftercare':      { bg: '#1a2e1a', text: '#6fcf6f', border: '#2d5a2d' },
  'Results Check':  { bg: '#1a1a2e', text: '#6f9fcf', border: '#2d2d5a' },
  'Next Session':   { bg: '#2e2a1a', text: '#cfb86f', border: '#5a4d2d' },
  'Rebooking':      { bg: '#2a1a2e', text: '#b86fcf', border: '#4d2d5a' },
  'Win-back':       { bg: '#2e1a1a', text: '#cf6f6f', border: '#5a2d2d' },
}

const STATUS_COLORS = {
  'Active':    { bg: '#1a2e1a', text: '#6fcf6f' },
  'Lapsed':    { bg: '#2e2a1a', text: '#cfb86f' },
  'Completed': { bg: '#1a1a2e', text: '#6f9fcf' },
}

function parseDate(str) {
  if (!str) return null
  const p = str.split('/')
  if (p.length !== 3) return null
  return new Date(`${p[2]}-${p[1]}-${p[0]}`)
}

function dayDiff(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

function ReminderBadge({ dateStr, status }) {
  if (status === 'Lapsed') return <span style={{ background: '#2e2a1a', color: '#cfb86f', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>Lapsed</span>
  const diff = dayDiff(dateStr)
  if (diff === null) return <span style={{ background: '#1a1a1a', color: '#666', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>No date</span>
  if (diff < 0)  return <span style={{ background: '#2e1a1a', color: '#cf6f6f', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>Overdue {Math.abs(diff)}d</span>
  if (diff === 0) return <span style={{ background: '#1a2e1a', color: '#6fcf6f', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>Due today</span>
  if (diff <= 7)  return <span style={{ background: '#1a1a2e', color: '#6f9fcf', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>In {diff}d</span>
  return <span style={{ background: '#1a1a1a', color: '#888', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>In {diff}d</span>
}

export default function Dashboard() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('All')

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(WEBHOOK_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const rows = Array.isArray(data) ? data.map(d => d.json || d) : []
      setClients(rows)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueToday   = clients.filter(c => { if (c.Status === 'Lapsed') return true; const d = dayDiff(c.Next_Reminder_Date); return d !== null && d <= 0 })
  const upcoming   = clients.filter(c => { const d = dayDiff(c.Next_Reminder_Date); return d !== null && d > 0 && d <= 7 })
  const lapsed     = clients.filter(c => c.Status === 'Lapsed')

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.Full_Name?.toLowerCase().includes(search.toLowerCase()) || c.Treatment_Type?.toLowerCase().includes(search.toLowerCase())
    const matchStage  = filterStage === 'All' || c.Reminder_Stage === filterStage
    return matchSearch && matchStage
  })

  const stages = ['All', 'Aftercare', 'Results Check', 'Next Session', 'Rebooking', 'Win-back']

  return (
    <div style={{ minHeight: '100vh', padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>Clinic reminder dashboard</h1>
          <p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>
            {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && <span style={{ fontSize: 12, color: '#555' }}>Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={fetchData} disabled={loading} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#2e1a1a', border: '1px solid #5a2d2d', borderRadius: 10, padding: '12px 16px', marginBottom: '1.5rem', fontSize: 13, color: '#cf6f6f' }}>
          Could not load data: {error} — make sure your n8n workflow is published and running.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '2rem' }}>
        {[
          { label: 'Total clients',   value: clients.length,  sub: 'in sheet',         color: '#aaa' },
          { label: 'Due today',       value: dueToday.length, sub: 'need reminders',   color: '#cfb86f' },
          { label: 'Upcoming 7 days', value: upcoming.length, sub: 'coming up',        color: '#6f9fcf' },
          { label: 'Lapsed',          value: lapsed.length,   sub: 'win-back needed',  color: '#cf6f6f' },
        ].map(m => (
          <div key={m.label} style={{ background: '#161616', border: '1px solid #222', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1, color: '#f0f0f0' }}>{loading ? '—' : m.value}</div>
            <div style={{ fontSize: 11, color: m.color, marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search client or treatment..."
          style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 14px', color: '#f0f0f0', fontSize: 13, width: 240, outline: 'none' }}
        />
        {stages.map(s => (
          <button key={s} onClick={() => setFilterStage(s)} style={{
            background: filterStage === s ? '#2a2a2a' : 'transparent',
            border: '1px solid ' + (filterStage === s ? '#444' : '#222'),
            color: filterStage === s ? '#f0f0f0' : '#666',
            padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12
          }}>{s}</button>
        ))}
      </div>

      <div style={{ background: '#161616', border: '1px solid #222', borderRadius: 12, overflow: 'hidden', marginBottom: '2rem' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #222', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          All clients — {filtered.length} shown
        </div>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#555', fontSize: 14 }}>Loading from Google Sheets...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#555', fontSize: 14 }}>No clients match your filter</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                {['Client', 'Treatment', 'Stage', 'Next reminder', 'Status', 'Last sent'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 18px', color: '#555', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const stage  = STAGE_COLORS[c.Reminder_Stage]  || { bg: '#1a1a1a', text: '#888', border: '#333' }
                const status = STATUS_COLORS[c.Status] || { bg: '#1a1a1a', text: '#888' }
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ fontWeight: 500, color: '#f0f0f0' }}>{c.Full_Name}</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{c.Client_ID}</div>
                    </td>
                    <td style={{ padding: '12px 18px', color: '#aaa' }}>{c.Treatment_Type}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ background: stage.bg, color: stage.text, border: `1px solid ${stage.border}`, padding: '3px 10px', borderRadius: 20, fontSize: 11 }}>
                        {c.Reminder_Stage}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <ReminderBadge dateStr={c.Next_Reminder_Date} status={c.Status} />
                      <div style={{ fontSize: 11, color: '#444', marginTop: 3 }}>{c.Next_Reminder_Date || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ background: status.bg, color: status.text, padding: '3px 10px', borderRadius: 20, fontSize: 11 }}>{c.Status}</span>
                    </td>
                    <td style={{ padding: '12px 18px', color: '#555', fontSize: 12 }}>{c.Last_Reminder_Sent || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Due today</div>
          {dueToday.length === 0
            ? <p style={{ color: '#444', fontSize: 13 }}>No reminders due today</p>
            : dueToday.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < dueToday.length - 1 ? '1px solid #1f1f1f' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f0' }}>{c.Full_Name}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{c.Reminder_Stage} · {c.Treatment_Type}</div>
                </div>
                <ReminderBadge dateStr={c.Next_Reminder_Date} status={c.Status} />
              </div>
            ))
          }
        </div>

        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Upcoming 7 days</div>
          {upcoming.length === 0
            ? <p style={{ color: '#444', fontSize: 13 }}>No reminders in next 7 days</p>
            : upcoming.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < upcoming.length - 1 ? '1px solid #1f1f1f' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f0' }}>{c.Full_Name}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{c.Reminder_Stage} · {c.Treatment_Type}</div>
                </div>
                <span style={{ fontSize: 12, color: '#6f9fcf' }}>in {dayDiff(c.Next_Reminder_Date)}d</span>
              </div>
            ))
          }
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: 11, color: '#333' }}>
        Auto-refreshes every 5 minutes · Data from Google Sheets via n8n
      </div>
    </div>
  )
}
