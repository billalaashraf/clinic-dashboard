'use client'
import { useState, useEffect } from 'react'

const WEBHOOK_URL = 'https://bilalashraf234.app.n8n.cloud/webhook/clinic-data'

function parseDate(str) {
  if (!str) return null
  const p = str.split('/')
  if (p.length !== 3) return null
  const d = new Date(`${p[2]}-${p[1]}-${p[0]}`)
  d.setHours(0,0,0,0)
  return d
}

function dayDiff(str) {
  const d = parseDate(str)
  if (!d) return null
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.round((d - t) / 86400000)
}

function getPriority(c) {
  if (c.Status === 'Lapsed') return { level: 1, label: 'CRITICAL', sub: 'Lapsed', color: '#e87e7e', bg: '#2e1010' }
  const diff = dayDiff(c.Next_Reminder_Date)
  if (diff === null) return { level: 5, label: 'LOW', sub: 'No date', color: '#555', bg: 'transparent' }
  if (diff < -2) return { level: 1, label: 'CRITICAL', sub: `${Math.abs(diff)}d overdue`, color: '#e87e7e', bg: '#2e1010' }
  if (diff < 0)  return { level: 2, label: 'HIGH',     sub: `${Math.abs(diff)}d overdue`, color: '#e8a87e', bg: '#2e1e10' }
  if (diff === 0) return { level: 3, label: 'HIGH',    sub: 'Due today',   color: '#e8c87e', bg: '#2a2010' }
  if (diff <= 3)  return { level: 4, label: 'MED',     sub: `In ${diff}d`, color: '#7eb3e8', bg: 'transparent' }
  return { level: 5, label: 'MED', sub: `In ${diff}d`, color: '#888', bg: 'transparent' }
}

function getAIMove(c) {
  const diff = dayDiff(c.Next_Reminder_Date)
  if (c.Status === 'Lapsed') return 'Send win-back message now'
  if (diff !== null && diff < -2) return 'Call first, then follow up'
  if (diff !== null && diff < 0)  return 'Send WhatsApp reminder now'
  if (diff === 0) return 'Send reminder today'
  return 'Scheduled — no action yet'
}

function getRevenue(c) {
  const base = { 'Botox': 150, 'Dermal Filler - Lips': 300, 'HydraFacial': 120, 'Laser Hair Removal': 200, 'Chemical Peel': 180, 'CoolSculpting': 800, 'Microneedling': 250, 'HIFU': 600 }
  const v = base[c.Treatment_Type] || 200
  const diff = dayDiff(c.Next_Reminder_Date)
  const multiplier = c.Status === 'Lapsed' ? 3 : diff !== null && diff < 0 ? 2 : 1
  return v * multiplier
}

const STAGE_STYLE = {
  'Aftercare':     { bg: '#1a2e1a', color: '#7ec87e' },
  'Results Check': { bg: '#1a1e2e', color: '#7eb3e8' },
  'Next Session':  { bg: '#2e2a1a', color: '#e8c87e' },
  'Rebooking':     { bg: '#251a2e', color: '#c87ee8' },
  'Win-back':      { bg: '#2e1a1a', color: '#e87e7e' },
}

function ClientCard({ c, onClick, selected }) {
  const pri = getPriority(c)
  const rev = getRevenue(c)
  const diff = dayDiff(c.Next_Reminder_Date)
  const stage = STAGE_STYLE[c.Reminder_Stage] || { bg: '#1a1a1a', color: '#888' }
  const isSel = selected?.Client_ID === c.Client_ID

  return (
    <div onClick={onClick} style={{
      background: isSel ? '#161616' : pri.level <= 2 ? '#110a0a' : '#0f0f0f',
      border: `1px solid ${isSel ? '#333' : pri.level <= 2 ? '#2e1a1a' : '#1a1a1a'}`,
      borderRadius: 10, padding: '14px', marginBottom: 8, cursor: 'pointer',
      transition: 'all 0.15s'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, color: '#f0f0f0', fontSize: 14 }}>{c.Full_Name}</div>
          <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{c.Client_ID} · {c.Treatment_Type}</div>
        </div>
        <span style={{ background: pri.bg, color: pri.color, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
          {pri.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ background: stage.bg, color: stage.color, fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{c.Reminder_Stage}</span>
        <span style={{ fontSize: 11, color: diff !== null && diff < 0 ? '#e87e7e' : diff === 0 ? '#7ec87e' : '#666' }}>
          {diff === null ? '—' : diff === 0 ? 'Today' : diff < 0 ? `${Math.abs(diff)}d overdue` : `In ${diff}d`}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: rev > 400 ? '#e8c87e' : '#555' }}>${rev.toLocaleString()}</span>
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>{getAIMove(c)}</div>
    </div>
  )
}

function ActionPanel({ client, onClose }) {
  if (!client) return null
  const diff = dayDiff(client.Next_Reminder_Date)
  const rev = getRevenue(client)

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#0f0f0f', border: '1px solid #1a1a1a',
      borderRadius: '16px 16px 0 0', padding: '1.5rem',
      zIndex: 100, maxHeight: '70vh', overflowY: 'auto',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>Action Hub</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 22 }}>×</button>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>{client.Full_Name}</div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{client.Client_ID} · {client.Treatment_Type}</div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
          Stage: <span style={{ color: '#aaa' }}>{client.Reminder_Stage}</span>
        </div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
          Next reminder: <span style={{ color: diff !== null && diff < 0 ? '#e87e7e' : '#aaa' }}>
            {diff === null ? '—' : diff === 0 ? 'Today' : diff < 0 ? `${Math.abs(diff)} days overdue` : `In ${diff} days`}
          </span>
        </div>
      </div>
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8, padding: '10px 12px', marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, color: '#e87e7e', marginBottom: 3 }}>AI: {getAIMove(client)}</div>
        <div style={{ fontSize: 11, color: '#555' }}>Revenue at risk: <span style={{ color: '#e8c87e' }}>${rev.toLocaleString()}</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: '1rem' }}>
        {['Message', 'Call', 'Reschedule'].map(a => (
          <button key={a} style={{
            background: '#141414', border: '1px solid #222', color: '#aaa',
            padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500
          }}>+ {a}</button>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Automation Triggers</div>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>• If overdue &gt; 3 days → escalate to call queue</div>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>• If lapsed + high value → notify manager</div>
        <div style={{ fontSize: 11, color: '#555' }}>• On rebooking → send confirmation email</div>
      </div>
      {client.Notes && (
        <div style={{ marginTop: '1rem', background: '#141414', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}>Notes</div>
          <div style={{ fontSize: 12, color: '#777' }}>{client.Notes}</div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [filterStage, setStage]   = useState('All')
  const [selected, setSelected]   = useState(null)
  const [isMobile, setIsMobile]   = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function fetchData() {
    try {
      setLoading(true); setError(null)
      const res = await fetch(WEBHOOK_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setClients(Array.isArray(data) ? data.map(d => d.json || d) : [])
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 300000); return () => clearInterval(i) }, [])

  const sorted = [...clients].sort((a, b) => getPriority(a).level - getPriority(b).level)
  const filtered = sorted.filter(c => {
    const ms = !search || [c.Full_Name, c.Treatment_Type, c.Client_ID].some(v => v?.toLowerCase().includes(search.toLowerCase()))
    const mst = filterStage === 'All' || c.Reminder_Stage === filterStage
    return ms && mst
  })

  const totalRev    = clients.reduce((s, c) => { const d = dayDiff(c.Next_Reminder_Date); return (c.Status === 'Lapsed' || (d !== null && d < 0)) ? s + getRevenue(c) : s }, 0)
  const actionQueue = clients.filter(c => { if (c.Status === 'Lapsed') return true; const d = dayDiff(c.Next_Reminder_Date); return d !== null && d <= 0 }).length
  const lapsed      = clients.filter(c => c.Status === 'Lapsed').length

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0c', color: '#f0f0f0', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', fontSize: 13, paddingBottom: selected ? 300 : 0 }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #141414', padding: '12px 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Clinic Command Center</div>
          <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Live follow-up & revenue recovery</div>
        </div>
        <button style={{ background: '#1a2e1a', border: '1px solid #2d5a2d', color: '#7ec87e', padding: '8px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
          ↗ Send Reminder
        </button>
      </div>

      <div style={{ padding: '1rem' }}>

        {/* Metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: '1rem' }}>
          {[
            { label: 'Revenue At Risk',  value: `$${totalRev.toLocaleString()}`,  sub: `${clients.filter(c => c.Status === 'Lapsed' || (dayDiff(c.Next_Reminder_Date) ?? 1) < 0).length} overdue`, bg: '#160a0a', border: '#2e1a1a', subC: '#e87e7e' },
            { label: 'Action Queue',     value: actionQueue,                       sub: 'Need attention',  bg: '#0a0f16', border: '#1a2030', subC: '#7eb3e8' },
            { label: 'Total Clients',    value: clients.length,                    sub: 'In system',       bg: '#0f0f0f', border: '#1a1a1a', subC: '#888' },
            { label: 'Lapsed',           value: lapsed,                            sub: 'Win-back needed', bg: '#120808', border: '#2a1010', subC: '#e87e7e' },
          ].map(m => (
            <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', lineHeight: 1 }}>{loading ? '—' : m.value}</div>
              <div style={{ fontSize: 10, color: m.subC, marginTop: 5 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client..."
            style={{ flex: 1, minWidth: 140, background: '#111', border: '1px solid #1e1e1e', borderRadius: 6, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none' }} />
          <select value={filterStage} onChange={e => setStage(e.target.value)}
            style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 6, padding: '8px 10px', color: '#aaa', fontSize: 12, outline: 'none' }}>
            {['All', 'Aftercare', 'Results Check', 'Next Session', 'Rebooking', 'Win-back'].map(s => (
              <option key={s} style={{ background: '#111' }}>{s}</option>
            ))}
          </select>
        </div>

        {error && <div style={{ background: '#2e1a1a', border: '1px solid #5a2d2d', borderRadius: 8, padding: '10px', marginBottom: '1rem', fontSize: 12, color: '#e87e7e' }}>Could not load: {error}</div>}

        {/* Client list */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#333' }}>Loading from Google Sheets...</div>
        ) : isMobile ? (
          // Mobile: card list
          <div>
            {filtered.map((c, i) => (
              <ClientCard key={i} c={c} selected={selected} onClick={() => setSelected(selected?.Client_ID === c.Client_ID ? null : c)} />
            ))}
          </div>
        ) : (
          // Desktop: table
          <div style={{ background: '#0a0a0a', border: '1px solid #141414', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #141414' }}>
                  {['Priority', 'Client', 'AI Next Move', 'Stage', 'Follow-up', 'Revenue', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', color: '#383838', fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const pri   = getPriority(c)
                  const rev   = getRevenue(c)
                  const stage = STAGE_STYLE[c.Reminder_Stage] || { bg: '#1a1a1a', color: '#888' }
                  const diff  = dayDiff(c.Next_Reminder_Date)
                  const isSel = selected?.Client_ID === c.Client_ID
                  return (
                    <tr key={i} onClick={() => setSelected(isSel ? null : c)}
                      style={{ borderBottom: '1px solid #111', cursor: 'pointer', background: isSel ? '#141414' : pri.level <= 2 ? '#110a0a' : 'transparent' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#0f0f0f' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isSel ? '#141414' : pri.level <= 2 ? '#110a0a' : 'transparent' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: pri.color }}>{pri.label}</div>
                        <div style={{ fontSize: 10, color: pri.color, opacity: 0.7 }}>{pri.sub}</div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 500, color: '#ddd' }}>{c.Full_Name}</div>
                        <div style={{ fontSize: 11, color: '#444' }}>{c.Client_ID} · {c.Treatment_Type}</div>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#666', fontSize: 11 }}>{getAIMove(c)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ background: stage.bg, color: stage.color, padding: '3px 8px', borderRadius: 4, fontSize: 11 }}>{c.Reminder_Stage}</span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 11, color: diff !== null && diff < 0 ? '#e87e7e' : diff === 0 ? '#7ec87e' : '#888' }}>
                        {diff === null ? '—' : diff === 0 ? 'Today' : diff < 0 ? `${Math.abs(diff)}d ago` : `In ${diff}d`}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: rev > 400 ? '#e8c87e' : '#888', fontWeight: 500 }}>${rev.toLocaleString()}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[{ l: 'WA', bg: '#1a2e1a', c: '#7ec87e' }, { l: 'Call', bg: '#1a1e2e', c: '#7eb3e8' }, { l: 'Done', bg: '#1e1e1e', c: '#888' }].map(btn => (
                            <button key={btn.l} onClick={e => e.stopPropagation()}
                              style={{ background: btn.bg, border: 'none', color: btn.c, padding: '3px 7px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 500 }}>
                              {btn.l}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile bottom action panel */}
      {selected && isMobile && <ActionPanel client={selected} onClose={() => setSelected(null)} />}

      {/* Desktop side panel */}
      {selected && !isMobile && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: 300, height: '100vh', background: '#0f0f0f', borderLeft: '1px solid #1a1a1a', padding: '1.5rem', overflowY: 'auto', zIndex: 50 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 600, color: '#f0f0f0' }}>Action Hub</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>{selected.Full_Name}</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{selected.Client_ID} · {selected.Treatment_Type}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>Stage: <span style={{ color: '#aaa' }}>{selected.Reminder_Stage}</span></div>
          </div>
          <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8, padding: '10px 12px', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, color: '#e87e7e', marginBottom: 3 }}>AI: {getAIMove(selected)}</div>
            <div style={{ fontSize: 11, color: '#555' }}>Revenue at risk: <span style={{ color: '#e8c87e' }}>${getRevenue(selected).toLocaleString()}</span></div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
            {['Message', 'Call', 'Reschedule'].map(a => (
              <button key={a} style={{ flex: 1, background: '#141414', border: '1px solid #222', color: '#aaa', padding: '8px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>+ {a}</button>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Automation Triggers</div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>• If overdue &gt; 3 days → escalate to call queue</div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>• If lapsed + high value → notify manager</div>
            <div style={{ fontSize: 11, color: '#555' }}>• On rebooking → send confirmation email</div>
          </div>
          {selected.Notes && (
            <div style={{ marginTop: '1rem', background: '#141414', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 12, color: '#777' }}>{selected.Notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
