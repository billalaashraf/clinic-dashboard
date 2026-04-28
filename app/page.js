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
  if (c.Status === 'Lapsed') return { level: 1, label: '#1 CRITICAL', sub: 'Lapsed client', color: '#e87e7e', bg: '#2e1010' }
  const diff = dayDiff(c.Next_Reminder_Date)
  if (diff === null) return { level: 5, label: '#5 LOW', sub: 'No date set', color: '#555', bg: 'transparent' }
  if (diff < -2) return { level: 1, label: '#1 CRITICAL', sub: `${Math.abs(diff)}d overdue`, color: '#e87e7e', bg: '#2e1010' }
  if (diff < 0)  return { level: 2, label: '#2 HIGH',     sub: `${Math.abs(diff)}d overdue`, color: '#e8a87e', bg: '#2e1e10' }
  if (diff === 0) return { level: 3, label: '#3 HIGH',    sub: 'Due today',   color: '#e8c87e', bg: '#2a2010' }
  if (diff <= 3)  return { level: 4, label: '#4 MED',     sub: `In ${diff}d`, color: '#7eb3e8', bg: 'transparent' }
  return { level: 5, label: '#5 MED', sub: `In ${diff}d`, color: '#888', bg: 'transparent' }
}

function getAIMove(c) {
  const diff = dayDiff(c.Next_Reminder_Date)
  if (c.Status === 'Lapsed') return { move: 'Send win-back WhatsApp now', ai: 'AI: offer loyalty discount' }
  if (diff !== null && diff < -2) return { move: 'Call first, then WhatsApp follow-up', ai: 'AI: escalate — revenue at risk' }
  if (diff !== null && diff < 0)  return { move: 'WhatsApp now, call at 6 PM', ai: 'AI: add 1-click rebook link' }
  if (diff === 0) return { move: 'Send reminder now', ai: 'AI: best contact time is 6 PM' }
  return { move: 'Schedule automated reminder', ai: 'AI: no action needed yet' }
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

function ActionHub({ client, onClose }) {
  if (!client) return (
    <div style={{width:300,minWidth:300,background:'#0f0f0f',borderLeft:'1px solid #1a1a1a',display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem'}}>
      <p style={{color:'#333',fontSize:12,textAlign:'center'}}>Click a row to open the Action Hub</p>
    </div>
  )
  const diff = dayDiff(client.Next_Reminder_Date)
  const revenue = getRevenue(client)
  const aiMove = getAIMove(client)
  const isHighValue = Number(client.Session_Number) > 1 || revenue > 400

  return (
    <div style={{width:300,minWidth:300,background:'#0f0f0f',borderLeft:'1px solid #1a1a1a',padding:'1.5rem',overflowY:'auto',display:'flex',flexDirection:'column',gap:'1.25rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:14,fontWeight:600,color:'#f0f0f0'}}>Action Hub</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#444',cursor:'pointer',fontSize:18,padding:0}}>×</button>
      </div>

      <div>
        <div style={{fontSize:13,fontWeight:600,color:'#f0f0f0',marginBottom:4}}>
          {client.Full_Name} · <span style={{color:'#555',fontWeight:400,fontSize:12}}>{client.Client_ID}</span>
          {isHighValue && <span style={{marginLeft:6,background:'#2e2a10',color:'#e8c87e',fontSize:10,padding:'1px 6px',borderRadius:3}}>High value</span>}
        </div>
        <div style={{fontSize:11,color:'#555',marginBottom:2}}>History: Last visit {client.Treatment_Date || 'unknown'}</div>
        <div style={{fontSize:11,color:'#555',marginBottom:2}}>Stage: <span style={{color:'#aaa'}}>{client.Reminder_Stage}</span> (inline edit)</div>
        <div style={{fontSize:11,color:'#555'}}>Next Reminder: <span style={{color:'#aaa'}}>
          {diff===null?'—':diff===0?'Today':diff<0?`${Math.abs(diff)} days overdue`:`In ${diff} days`}
        </span> (inline edit)</div>
      </div>

      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:8,padding:'10px 12px'}}>
        <div style={{fontSize:11,color:'#e87e7e',marginBottom:4}}>AI: {aiMove.ai}</div>
        <div style={{fontSize:11,color:'#555'}}>Revenue risk if missed today: <span style={{color:'#e8c87e'}}>${revenue.toLocaleString()}</span></div>
        {client.Status === 'Lapsed' && <div style={{fontSize:11,color:'#e87e7e',marginTop:3}}>This client is likely to churn permanently</div>}
      </div>

      <div style={{display:'flex',gap:6}}>
        {['Message','Call','Reschedule'].map(a=>(
          <button key={a} style={{flex:1,background:'#141414',border:'1px solid #222',color:'#aaa',padding:'8px 4px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:500}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#444';e.currentTarget.style.color='#f0f0f0'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#222';e.currentTarget.style.color='#aaa'}}>
            + {a}
          </button>
        ))}
      </div>

      <div>
        <div style={{fontSize:11,color:'#444',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Automation + Next Best Actions</div>
        <div style={{fontSize:11,color:'#666',marginBottom:5}}>• Trigger: Send reminder if no response in 2h</div>
        <div style={{fontSize:11,color:'#666',marginBottom:5}}>• Recommendation: Best contact time 6:00 PM</div>
        <div style={{fontSize:11,color:'#666'}}>• If lapsed &gt; 7 days → escalate to manager</div>
      </div>

      {client.Notes && (
        <div style={{background:'#141414',border:'1px solid #1a1a1a',borderRadius:8,padding:'10px 12px'}}>
          <div style={{fontSize:11,color:'#444',marginBottom:4}}>Notes</div>
          <div style={{fontSize:12,color:'#777'}}>{client.Notes}</div>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',gap:6,marginTop:'auto',paddingTop:'1rem',borderTop:'1px solid #141414'}}>
        <span style={{fontSize:11,color:'#333'}}>Power-saving mode</span>
        <div style={{width:28,height:16,background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:8,cursor:'pointer'}}/>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [filterStage, setStage] = useState('All')
  const [filterStatus, setStatus] = useState('All')
  const [selected, setSelected] = useState(null)

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

  useEffect(()=>{ fetchData(); const i=setInterval(fetchData,300000); return()=>clearInterval(i) },[])

  const totalRevAtRisk  = clients.reduce((s,c)=>{ const d=dayDiff(c.Next_Reminder_Date); return (c.Status==='Lapsed'||d<0)?s+getRevenue(c):s },0)
  const recoveredValue  = clients.filter(c=>c.Last_Reminder_Sent).reduce((s,c)=>s+getRevenue(c),0)
  const lostRevenue     = clients.filter(c=>c.Status==='Lapsed').reduce((s,c)=>s+getRevenue(c)*2,0)
  const actionQueue     = clients.filter(c=>{ if(c.Status==='Lapsed') return true; const d=dayDiff(c.Next_Reminder_Date); return d!==null&&d<=1 }).length

  const sorted = [...clients].sort((a,b)=>getPriority(a).level-getPriority(b).level)
  const filtered = sorted.filter(c=>{
    const ms = !search||[c.Full_Name,c.Treatment_Type,c.Client_ID].some(v=>v?.toLowerCase().includes(search.toLowerCase()))
    const mst = filterStage==='All'||c.Reminder_Stage===filterStage
    const mss = filterStatus==='All'||c.Status===filterStatus
    return ms&&mst&&mss
  })

  return (
    <div style={{minHeight:'100vh',background:'#0c0c0c',color:'#f0f0f0',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:13}}>
      <div style={{borderBottom:'1px solid #141414',padding:'10px 1.5rem',fontSize:11,color:'#333'}}>
        Clinic Follow-up Dashboard
      </div>

      <div style={{display:'flex',height:'calc(100vh - 37px)'}}>
        <div style={{flex:1,overflowY:'auto',padding:'1.75rem 2rem'}}>

          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem'}}>
            <div>
              <h1 style={{fontSize:22,fontWeight:700,margin:0,letterSpacing:'-0.03em'}}>Clinic Command Center</h1>
              <p style={{fontSize:12,color:'#555',margin:'4px 0 0'}}>Live follow-up execution, urgency triage, and revenue recovery in one workflow.</p>
            </div>
            <button style={{background:'#1a2e1a',border:'1px solid #2d5a2d',color:'#7ec87e',padding:'9px 16px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>
              <span>↗</span> Send WhatsApp Reminder
            </button>
          </div>

          {error && <div style={{background:'#2e1a1a',border:'1px solid #5a2d2d',borderRadius:8,padding:'10px 14px',marginBottom:'1rem',fontSize:12,color:'#e87e7e'}}>Could not load: {error}</div>}

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:'1.5rem'}}>
            {[
              {label:'Revenue At Risk',         value:`$${totalRevAtRisk.toLocaleString()}`,  sub:`${clients.filter(c=>c.Status==='Lapsed'||(dayDiff(c.Next_Reminder_Date)??1)<0).length} overdue high-value clients`, bg:'#160a0a', border:'#2e1a1a', subC:'#e87e7e'},
              {label:'Recovered This Week',      value:`$${recoveredValue.toLocaleString()}`,  sub:`+${clients.filter(c=>c.Last_Reminder_Sent).length} clients reactivated`, bg:'#0a160a', border:'#1a2e1a', subC:'#7ec87e'},
              {label:'Lost Revenue (No Follow-up)', value:`$${lostRevenue.toLocaleString()}`, sub:'7-day trailing impact', bg:'#12100a', border:'#2a2010', subC:'#e8c87e'},
              {label:'Action Queue',             value:actionQueue,                            sub:'Needs manual intervention', bg:'#0a0f16', border:'#1a2030', subC:'#7eb3e8'},
            ].map(m=>(
              <div key={m.label} style={{background:m.bg,border:`1px solid ${m.border}`,borderRadius:10,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:'#555',marginBottom:8}}>{m.label}</div>
                <div style={{fontSize:24,fontWeight:700,lineHeight:1,color:'#f0f0f0',letterSpacing:'-0.02em'}}>{loading?'—':m.value}</div>
                <div style={{fontSize:11,color:m.subC,marginTop:6}}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{background:'#0a0a0a',border:'1px solid #141414',borderRadius:10,overflow:'hidden'}}>
            <div style={{display:'flex',gap:8,padding:'10px 14px',borderBottom:'1px solid #141414',alignItems:'center',flexWrap:'wrap'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client, ID, phone..."
                style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'5px 10px',color:'#e0e0e0',fontSize:12,width:180,outline:'none'}}/>
              <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'5px 10px',fontSize:12,color:'#666',cursor:'pointer'}}>
                Urgency: <select onChange={()=>{}} style={{background:'transparent',border:'none',color:'#aaa',fontSize:12,outline:'none'}}>
                  <option style={{background:'#111'}}>All ↕</option>
                </select>
              </div>
              <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'5px 10px',fontSize:12,color:'#666'}}>
                Stage: <select value={filterStage} onChange={e=>setStage(e.target.value)} style={{background:'transparent',border:'none',color:'#aaa',fontSize:12,outline:'none'}}>
                  {['All','Aftercare','Results Check','Next Session','Rebooking','Win-back'].map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
                </select>
              </div>
              <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'5px 10px',fontSize:12,color:'#666'}}>
                Status: <select value={filterStatus} onChange={e=>setStatus(e.target.value)} style={{background:'transparent',border:'none',color:'#aaa',fontSize:12,outline:'none'}}>
                  {['All','Active','Lapsed','Completed'].map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
                </select>
              </div>
              <div style={{marginLeft:'auto',background:'#1a1a2e',border:'1px solid #2a2a5a',borderRadius:6,padding:'5px 10px',fontSize:11,color:'#7eb3e8',cursor:'pointer'}}>
                Quick sort: Risk ↓
              </div>
            </div>

            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{borderBottom:'1px solid #141414'}}>
                  {['Priority','Client Command','AI Next Move','Stage','Follow-up Date','Revenue at Risk','Quick Actions'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11,whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading?(
                  <tr><td colSpan={7} style={{padding:'3rem',textAlign:'center',color:'#333',fontSize:13}}>Loading from Google Sheets...</td></tr>
                ):filtered.length===0?(
                  <tr><td colSpan={7} style={{padding:'3rem',textAlign:'center',color:'#333',fontSize:13}}>No clients match</td></tr>
                ):filtered.map((c,i)=>{
                  const pri   = getPriority(c)
                  const ai    = getAIMove(c)
                  const rev   = getRevenue(c)
                  const stage = STAGE_STYLE[c.Reminder_Stage]||{bg:'#1a1a1a',color:'#888'}
                  const diff  = dayDiff(c.Next_Reminder_Date)
                  const isSel = selected?.Client_ID===c.Client_ID
                  const isTop = pri.level <= 2

                  return (
                    <tr key={i} onClick={()=>setSelected(isSel?null:c)}
                      style={{borderBottom:'1px solid #111',cursor:'pointer',background:isSel?'#141414':isTop?'#110a0a':'transparent'}}
                      onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='#0f0f0f'}}
                      onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=isSel?'#141414':isTop?'#110a0a':'transparent'}}>
                      <td style={{padding:'11px 14px',minWidth:80}}>
                        <div style={{fontSize:11,fontWeight:600,color:pri.color}}>{pri.label}</div>
                        <div style={{fontSize:10,color:pri.color,opacity:0.7,marginTop:1}}>{pri.sub}</div>
                      </td>
                      <td style={{padding:'11px 14px',minWidth:160}}>
                        <div style={{fontWeight:500,color:'#ddd'}}>{c.Full_Name} · <span style={{color:'#444',fontSize:11}}>{c.Client_ID}</span></div>
                        <div style={{fontSize:11,color:'#555',marginTop:2}}>{c.Treatment_Type}</div>
                      </td>
                      <td style={{padding:'11px 14px',minWidth:180}}>
                        <div style={{fontSize:11,color:'#aaa'}}>{ai.move}</div>
                        <div style={{fontSize:10,color:'#555',marginTop:2}}>{ai.ai}</div>
                      </td>
                      <td style={{padding:'11px 14px'}}>
                        <span style={{background:stage.bg,color:stage.color,padding:'3px 8px',borderRadius:4,fontSize:11,whiteSpace:'nowrap'}}>
                          {c.Reminder_Stage}
                        </span>
                      </td>
                      <td style={{padding:'11px 14px',fontSize:11}}>
                        {c.Next_Reminder_Date ? (
                          <span style={{color: diff===0?'#7ec87e':diff!==null&&diff<0?'#e87e7e':'#888'}}>
                            {diff===0?'Today':diff!==null&&diff<0?`${Math.abs(diff)}d ago`:c.Next_Reminder_Date}
                          </span>
                        ) : <span style={{color:'#444'}}>—</span>}
                      </td>
                      <td style={{padding:'11px 14px'}}>
                        <div style={{fontSize:12,fontWeight:500,color: rev>500?'#e87e7e':rev>200?'#e8c87e':'#888'}}>${rev.toLocaleString()}</div>
                        {isTop && <div style={{fontSize:10,color:'#e87e7e',marginTop:1}}>Risk spike</div>}
                      </td>
                      <td style={{padding:'11px 14px'}}>
                        <div style={{display:'flex',gap:4}}>
                          {[
                            {label:'WA',  bg:'#1a2e1a', color:'#7ec87e'},
                            {label:'Call',bg:'#1a1e2e', color:'#7eb3e8'},
                            {label:'Done',bg:'#1e1e1e', color:'#888'},
                          ].map(btn=>(
                            <button key={btn.label} onClick={e=>e.stopPropagation()}
                              style={{background:btn.bg,border:'none',color:btn.color,padding:'3px 7px',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:500}}>
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{padding:'7px 14px',borderTop:'1px solid #111',fontSize:10,color:'#282828'}}>
              Action-first queue: urgency-ranked commands, top-3 auto-highlighted, inline stage/date edits, risk intel and AI suggestions with hover quick actions.
            </div>
          </div>
        </div>

        <ActionHub client={selected} onClose={()=>setSelected(null)}/>
      </div>
    </div>
  )
}
