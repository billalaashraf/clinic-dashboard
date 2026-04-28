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
  if (diff < 0)  return { level: 2, label: 'HIGH', sub: `${Math.abs(diff)}d overdue`, color: '#e8a87e', bg: '#2e1e10' }
  if (diff === 0) return { level: 3, label: 'HIGH', sub: 'Due today', color: '#e8c87e', bg: '#2a2010' }
  if (diff <= 3)  return { level: 4, label: 'MED', sub: `In ${diff}d`, color: '#7eb3e8', bg: 'transparent' }
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
  return v * (c.Status === 'Lapsed' ? 3 : diff !== null && diff < 0 ? 2 : 1)
}

const STAGE_STYLE = {
  'Aftercare':     { bg: '#1a2e1a', color: '#7ec87e' },
  'Results Check': { bg: '#1a1e2e', color: '#7eb3e8' },
  'Next Session':  { bg: '#2e2a1a', color: '#e8c87e' },
  'Rebooking':     { bg: '#251a2e', color: '#c87ee8' },
  'Win-back':      { bg: '#2e1a1a', color: '#e87e7e' },
}

export default function Dashboard() {
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [filterStage, setStage]   = useState('All')
  const [filterStatus, setStatus] = useState('All')
  const [selected, setSelected]   = useState(null)
  const [width, setWidth]         = useState(1200)

  useEffect(() => {
    setWidth(window.innerWidth)
    const fn = () => setWidth(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  async function fetchData() {
    try {
      setLoading(true); setError(null)
      const res = await fetch(WEBHOOK_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setClients(Array.isArray(data) ? data.map(d=>d.json||d) : [])
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 300000); return () => clearInterval(i) }, [])

  const isMobile = width < 768
  const isTablet = width < 1024

  const sorted = [...clients].sort((a,b) => getPriority(a).level - getPriority(b).level)
  const filtered = sorted.filter(c => {
    const ms = !search || [c.Full_Name, c.Treatment_Type, c.Client_ID].some(v => v?.toLowerCase().includes(search.toLowerCase()))
    const mst = filterStage === 'All' || c.Reminder_Stage === filterStage
    const mss = filterStatus === 'All' || c.Status === filterStatus
    return ms && mst && mss
  })

  const totalRev    = clients.reduce((s,c) => { const d = dayDiff(c.Next_Reminder_Date); return (c.Status==='Lapsed'||(d!==null&&d<0)) ? s+getRevenue(c) : s }, 0)
  const actionQueue = clients.filter(c => { if(c.Status==='Lapsed') return true; const d = dayDiff(c.Next_Reminder_Date); return d!==null&&d<=0 }).length
  const lapsed      = clients.filter(c => c.Status==='Lapsed').length
  const recovered   = clients.filter(c => c.Last_Reminder_Sent).reduce((s,c) => s+getRevenue(c), 0)
  const diffSel     = selected ? dayDiff(selected.Next_Reminder_Date) : null
  const revSel      = selected ? getRevenue(selected) : 0

  const ActionHubContent = selected ? (
    <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontWeight:600,color:'#f0f0f0',fontSize:14}}>Action Hub</span>
        <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'#444',cursor:'pointer',fontSize:20,padding:0}}>×</button>
      </div>
      <div>
        <div style={{fontSize:14,fontWeight:600,color:'#f0f0f0',marginBottom:4}}>{selected.Full_Name} · <span style={{color:'#444',fontWeight:400,fontSize:12}}>{selected.Client_ID}</span></div>
        <div style={{fontSize:12,color:'#555',marginBottom:2}}>Treatment: <span style={{color:'#aaa'}}>{selected.Treatment_Type}</span></div>
        <div style={{fontSize:12,color:'#555',marginBottom:2}}>Stage: <span style={{color:'#aaa'}}>{selected.Reminder_Stage}</span></div>
        <div style={{fontSize:12,color:'#555'}}>Next: <span style={{color:diffSel!==null&&diffSel<0?'#e87e7e':'#aaa'}}>
          {diffSel===null?'—':diffSel===0?'Today':diffSel<0?`${Math.abs(diffSel)}d overdue`:`In ${diffSel}d`}
        </span></div>
      </div>
      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:8,padding:'10px 12px'}}>
        <div style={{fontSize:11,color:'#e87e7e',marginBottom:3}}>AI: {getAIMove(selected)}</div>
        <div style={{fontSize:11,color:'#555'}}>Revenue at risk: <span style={{color:'#e8c87e'}}>${revSel.toLocaleString()}</span></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
        {['Message','Call','Reschedule'].map(a=>(
          <button key={a} style={{background:'#141414',border:'1px solid #222',color:'#aaa',padding:'8px 4px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:500}}>+ {a}</button>
        ))}
      </div>
      <div>
        <div style={{fontSize:11,color:'#444',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Automation Triggers</div>
        <div style={{fontSize:11,color:'#666',marginBottom:5}}>• If overdue &gt; 3 days → escalate</div>
        <div style={{fontSize:11,color:'#666',marginBottom:5}}>• If lapsed + high value → notify manager</div>
        <div style={{fontSize:11,color:'#666'}}>• On rebooking → send confirmation</div>
      </div>
      {selected.Notes && (
        <div style={{background:'#141414',border:'1px solid #1a1a1a',borderRadius:8,padding:'10px 12px'}}>
          <div style={{fontSize:11,color:'#444',marginBottom:4}}>Notes</div>
          <div style={{fontSize:12,color:'#777'}}>{selected.Notes}</div>
        </div>
      )}
    </div>
  ) : (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}>
      <p style={{color:'#333',fontSize:12,textAlign:'center'}}>Click a row to open the Action Hub</p>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#0c0c0c',color:'#f0f0f0',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:13}}>

      <div style={{borderBottom:'1px solid #141414',padding:'10px 1.5rem',fontSize:11,color:'#333'}}>
        Clinic Follow-up Dashboard
      </div>

      <div style={{display:'flex',height:'calc(100vh - 37px)'}}>

        {/* Main content */}
        <div style={{flex:1,overflowY:'auto',padding: isMobile ? '0.75rem' : '1.75rem 2rem',minWidth:0}}>

          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem',gap:12,flexWrap:'wrap'}}>
            <div>
              <h1 style={{fontSize: isMobile ? 16 : 20,fontWeight:700,margin:0,letterSpacing:'-0.03em'}}>Clinic Command Center</h1>
              <p style={{fontSize:12,color:'#555',margin:'4px 0 0'}}>Live follow-up execution, urgency triage, and revenue recovery.</p>
            </div>
            <button style={{background:'#1a2e1a',border:'1px solid #2d5a2d',color:'#7ec87e',padding:'9px 16px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:500,whiteSpace:'nowrap'}}>
              ↗ Send Reminder
            </button>
          </div>

          {error && <div style={{background:'#2e1a1a',border:'1px solid #5a2d2d',borderRadius:8,padding:'10px',marginBottom:'1rem',fontSize:12,color:'#e87e7e'}}>Could not load: {error}</div>}

          {/* Metrics */}
          <div style={{display:'grid',gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',gap:10,marginBottom:'1.5rem'}}>
            {[
              {label:'Revenue At Risk',     value:`$${totalRev.toLocaleString()}`,  sub:`${clients.filter(c=>c.Status==='Lapsed'||(dayDiff(c.Next_Reminder_Date)??1)<0).length} overdue`, bg:'#160a0a',border:'#2e1a1a',subC:'#e87e7e'},
              {label:'Recovered',           value:`$${recovered.toLocaleString()}`, sub:`${clients.filter(c=>c.Last_Reminder_Sent).length} reactivated`, bg:'#0a160a',border:'#1a2e1a',subC:'#7ec87e'},
              {label:'Action Queue',        value:actionQueue,                       sub:'Need attention', bg:'#0a0f16',border:'#1a2030',subC:'#7eb3e8'},
              {label:'Lapsed',              value:lapsed,                            sub:'Win-back needed', bg:'#120808',border:'#2a1010',subC:'#e87e7e'},
            ].map(m=>(
              <div key={m.label} style={{background:m.bg,border:`1px solid ${m.border}`,borderRadius:10,padding:'12px 14px'}}>
                <div style={{fontSize:10,color:'#444',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>{m.label}</div>
                <div style={{fontSize: isMobile ? 20 : 24,fontWeight:700,lineHeight:1,color:'#f0f0f0'}}>{loading?'—':m.value}</div>
                <div style={{fontSize:10,color:m.subC,marginTop:5}}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{display:'flex',gap:8,marginBottom:'1rem',flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client..."
              style={{flex:1,minWidth:120,background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 10px',color:'#e0e0e0',fontSize:12,outline:'none'}}/>
            <select value={filterStage} onChange={e=>setStage(e.target.value)}
              style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 10px',color:'#aaa',fontSize:12,outline:'none'}}>
              {['All','Aftercare','Results Check','Next Session','Rebooking','Win-back'].map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
            </select>
            <select value={filterStatus} onChange={e=>setStatus(e.target.value)}
              style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 10px',color:'#aaa',fontSize:12,outline:'none'}}>
              {['All','Active','Lapsed','Completed'].map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
            </select>
          </div>

          {/* Table */}
          <div style={{background:'#0a0a0a',border:'1px solid #141414',borderRadius:10,overflow:'hidden'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth: isMobile ? 400 : 'auto'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #141414'}}>
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11,whiteSpace:'nowrap'}}>Priority</th>
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11,whiteSpace:'nowrap'}}>Client</th>
                    {!isMobile && <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11,whiteSpace:'nowrap'}}>AI Next Move</th>}
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11,whiteSpace:'nowrap'}}>Stage</th>
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11,whiteSpace:'nowrap'}}>Follow-up</th>
                    {!isMobile && <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11,whiteSpace:'nowrap'}}>Revenue</th>}
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11,whiteSpace:'nowrap'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{padding:'3rem',textAlign:'center',color:'#333',fontSize:13}}>Loading from Google Sheets...</td></tr>
                  ) : filtered.length===0 ? (
                    <tr><td colSpan={7} style={{padding:'3rem',textAlign:'center',color:'#333',fontSize:13}}>No clients match</td></tr>
                  ) : filtered.map((c,i) => {
                    const pri   = getPriority(c)
                    const rev   = getRevenue(c)
                    const stage = STAGE_STYLE[c.Reminder_Stage]||{bg:'#1a1a1a',color:'#888'}
                    const diff  = dayDiff(c.Next_Reminder_Date)
                    const isSel = selected?.Client_ID===c.Client_ID
                    return (
                      <tr key={i} onClick={()=>setSelected(isSel?null:c)}
                        style={{borderBottom:'1px solid #111',cursor:'pointer',background:isSel?'#141414':pri.level<=2?'#110a0a':'transparent'}}
                        onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='#0f0f0f'}}
                        onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=isSel?'#141414':pri.level<=2?'#110a0a':'transparent'}}>
                        <td style={{padding:'10px 14px'}}>
                          <div style={{fontSize:10,fontWeight:600,color:pri.color}}>{pri.label}</div>
                          <div style={{fontSize:10,color:pri.color,opacity:0.7}}>{pri.sub}</div>
                        </td>
                        <td style={{padding:'10px 14px'}}>
                          <div style={{fontWeight:500,color:'#ddd',fontSize: isMobile?11:12}}>{c.Full_Name}</div>
                          <div style={{fontSize:10,color:'#444',marginTop:1}}>{c.Client_ID}</div>
                        </td>
                        {!isMobile && <td style={{padding:'10px 14px',color:'#666',fontSize:11}}>{getAIMove(c)}</td>}
                        <td style={{padding:'10px 14px'}}>
                          <span style={{background:stage.bg,color:stage.color,padding:'2px 7px',borderRadius:4,fontSize:10,whiteSpace:'nowrap'}}>{c.Reminder_Stage}</span>
                        </td>
                        <td style={{padding:'10px 14px',fontSize:11,color:diff!==null&&diff<0?'#e87e7e':diff===0?'#7ec87e':'#888',whiteSpace:'nowrap'}}>
                          {diff===null?'—':diff===0?'Today':diff<0?`${Math.abs(diff)}d ago`:`In ${diff}d`}
                        </td>
                        {!isMobile && <td style={{padding:'10px 14px',fontSize:12,color:rev>400?'#e8c87e':'#888',fontWeight:500}}>${rev.toLocaleString()}</td>}
                        <td style={{padding:'10px 14px'}}>
                          <div style={{display:'flex',gap:4}}>
                            {[{l:'WA',bg:'#1a2e1a',c:'#7ec87e'},{l:'Call',bg:'#1a1e2e',c:'#7eb3e8'},{l:'✓',bg:'#1e1e1e',c:'#888'}].map(btn=>(
                              <button key={btn.l} onClick={e=>e.stopPropagation()}
                                style={{background:btn.bg,border:'none',color:btn.c,padding:'3px 6px',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:500}}>
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
            <div style={{padding:'7px 14px',borderTop:'1px solid #111',fontSize:10,color:'#282828'}}>
              Click row to open Action Hub · Urgency-ranked · Revenue risk highlighted
            </div>
          </div>

          {/* Mobile Action Hub — shows inline below table */}
          {selected && isMobile && (
            <div style={{marginTop:'1rem',background:'#0f0f0f',border:'1px solid #1a1a1a',borderRadius:12,padding:'1.25rem'}}>
              {ActionHubContent}
            </div>
          )}

        </div>

        {/* Desktop side panel — only on wide screens */}
        {!isTablet && (
          <div style={{width:300,minWidth:300,background:'#0f0f0f',borderLeft:'1px solid #1a1a1a',padding:'1.5rem',overflowY:'auto'}}>
            {ActionHubContent}
          </div>
        )}

        {/* Tablet: floating overlay when row is selected */}
        {isTablet && !isMobile && selected && (
          <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#0f0f0f',borderTop:'1px solid #1a1a1a',padding:'1.5rem',zIndex:100,maxHeight:'50vh',overflowY:'auto',boxShadow:'0 -4px 24px rgba(0,0,0,0.6)'}}>
            {ActionHubContent}
          </div>
        )}

      </div>
    </div>
  )
}
