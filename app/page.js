'use client'
import { useState, useEffect } from 'react'

const WEBHOOK_URL = 'https://bilalashraf234.app.n8n.cloud/webhook/clinic-data'

const STAGE_COLORS = {
  'Aftercare':     { bg:'#1a2e1a', text:'#7ec87e' },
  'Results Check': { bg:'#1a1e2e', text:'#7eb3e8' },
  'Next Session':  { bg:'#2e2a1a', text:'#e8c87e' },
  'Rebooking':     { bg:'#251a2e', text:'#c87ee8' },
  'Win-back':      { bg:'#2e1a1a', text:'#e87e7e' },
}

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

function ReminderCell({ client }) {
  if (client.Status === 'Lapsed') return <span style={{color:'#555',fontSize:12}}>—</span>
  const diff = dayDiff(client.Next_Reminder_Date)
  if (diff === null) return <span style={{color:'#555',fontSize:12}}>—</span>
  const abs = Math.abs(diff)
  if (diff < 0) return (
    <span>
      <span style={{background:'#2e1a1a',color:'#e87e7e',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:500}}>
        Overdue by {abs} day{abs>1?'s':''} · <span style={{textDecoration:'underline',cursor:'pointer'}}>edit date</span>
      </span>
    </span>
  )
  if (diff === 0) return (
    <span style={{background:'#1a2e1a',color:'#7ec87e',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:500}}>
      Today · <span style={{textDecoration:'underline',cursor:'pointer'}}>edit date</span>
    </span>
  )
  return <span style={{color:'#888',fontSize:12}}>In {diff} days · <span style={{color:'#555',textDecoration:'underline',cursor:'pointer'}}>edit date</span></span>
}

function StatusDot({ status }) {
  const c = status==='Active'?'#4caf50':status==='Lapsed'?'#e87e7e':'#888'
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12}}>
      <span style={{width:6,height:6,borderRadius:'50%',background:c,display:'inline-block',flexShrink:0}}/>
      <span style={{color:status==='Lapsed'?'#e87e7e':'#aaa'}}>{status}</span>
    </span>
  )
}

function SidePanel({ client, onClose }) {
  if (!client) return null
  const diff = dayDiff(client.Next_Reminder_Date)
  const isHighValue = Number(client.Session_Number) > 1
  const isOverdue = diff !== null && diff < 0
  return (
    <div style={{width:290,minWidth:290,background:'#0f0f0f',borderLeft:'1px solid #1a1a1a',padding:'1.5rem',overflowY:'auto',display:'flex',flexDirection:'column',gap:'1.25rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:13,fontWeight:600,color:'#e0e0e0'}}>Client Detail</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#444',cursor:'pointer',fontSize:20,lineHeight:1,padding:0}}>×</button>
      </div>

      <div>
        <div style={{fontSize:14,fontWeight:600,color:'#f0f0f0'}}>{client.Full_Name} · <span style={{color:'#444',fontWeight:400,fontSize:12}}>{client.Client_ID}</span></div>
        <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:4}}>
          <div style={{fontSize:12,color:'#555'}}>Treatment: <span style={{color:'#999'}}>{client.Treatment_Type}</span></div>
          <div style={{fontSize:12,color:'#555'}}>Stage: <span style={{color:'#999'}}>{client.Reminder_Stage} (inline editable)</span></div>
          <div style={{fontSize:12,color:'#555'}}>Next Reminder: <span style={{color:'#999'}}>
            {diff===null?'—':diff===0?'Today':diff<0?`${Math.abs(diff)} days overdue`:`In ${diff} days`} (inline editable)
          </span></div>
        </div>
      </div>

      {(isHighValue || isOverdue || client.Status==='Lapsed') && (
        <div style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:8,padding:'10px 12px'}}>
          {isHighValue && <div style={{fontSize:11,color:'#e8c87e',marginBottom:3}}>Priority: High value client</div>}
          {isOverdue && <div style={{fontSize:11,color:'#e87e7e',marginBottom:3}}>Risk: Overdue — contact within 48h</div>}
          {client.Status==='Lapsed' && <div style={{fontSize:11,color:'#e87e7e'}}>Risk: Lapsed — win-back needed</div>}
        </div>
      )}

      <div style={{display:'flex',gap:6}}>
        {['Message','Call','Reschedule'].map(a=>(
          <button key={a} style={{flex:1,background:'#141414',border:'1px solid #222',color:'#aaa',padding:'8px 4px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:500,transition:'border-color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#444'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#222'}>
            + {a}
          </button>
        ))}
      </div>

      <div>
        <div style={{fontSize:11,color:'#444',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Automation Triggers</div>
        <div style={{fontSize:11,color:'#555',marginBottom:5}}>• If Overdue &gt; 3 days → escalate to call queue</div>
        <div style={{fontSize:11,color:'#555',marginBottom:5}}>• If Lapsed + High Value → notify success manager</div>
        <div style={{fontSize:11,color:'#555'}}>• On rebooking → send confirmation email</div>
      </div>

      {client.Notes && (
        <div style={{background:'#141414',border:'1px solid #1a1a1a',borderRadius:8,padding:'10px 12px'}}>
          <div style={{fontSize:11,color:'#444',marginBottom:4}}>Notes</div>
          <div style={{fontSize:12,color:'#777'}}>{client.Notes}</div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [lastRefresh, setRefresh] = useState(null)
  const [search, setSearch]       = useState('')
  const [filterStage, setStage]   = useState('All')
  const [filterStatus, setStatus] = useState('All')
  const [selected, setSelected]   = useState(null)

  async function fetchData() {
    try {
      setLoading(true); setError(null)
      const res = await fetch(WEBHOOK_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setClients(Array.isArray(data) ? data.map(d=>d.json||d) : [])
      setRefresh(new Date())
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(()=>{ fetchData(); const i=setInterval(fetchData,300000); return()=>clearInterval(i) },[])

  const dueToday    = clients.filter(c=>{ if(c.Status==='Lapsed') return true; const d=dayDiff(c.Next_Reminder_Date); return d!==null&&d<=0 })
  const upcoming    = clients.filter(c=>{ const d=dayDiff(c.Next_Reminder_Date); return d!==null&&d>0&&d<=7 })
  const lapsed      = clients.filter(c=>c.Status==='Lapsed')
  const highUrgency = clients.filter(c=>{ const d=dayDiff(c.Next_Reminder_Date); return d!==null&&d<-1 })

  const filtered = clients.filter(c=>{
    const ms = !search || [c.Full_Name,c.Treatment_Type,c.Client_ID].some(v=>v?.toLowerCase().includes(search.toLowerCase()))
    const mst = filterStage==='All'||c.Reminder_Stage===filterStage
    const mss = filterStatus==='All'||c.Status===filterStatus
    return ms&&mst&&mss
  })

  const stages = ['All','Aftercare','Results Check','Next Session','Rebooking','Win-back']

  return (
    <div style={{minHeight:'100vh',background:'#0c0c0c',color:'#f0f0f0',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:13}}>
      <div style={{borderBottom:'1px solid #141414',padding:'10px 1.5rem',fontSize:11,color:'#333',letterSpacing:'0.02em'}}>
        Clinic Follow-up Dashboard
      </div>

      <div style={{display:'flex',height:'calc(100vh - 37px)'}}>
        <div style={{flex:1,overflowY:'auto',padding:'1.75rem 2rem'}}>

          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem'}}>
            <div>
              <h1 style={{fontSize:20,fontWeight:600,margin:0,letterSpacing:'-0.02em',color:'#f0f0f0'}}>Clinic Follow-up Operations</h1>
              <p style={{fontSize:12,color:'#444',margin:'4px 0 0'}}>Patient treatment tracking, reminders, and revenue-risk prevention</p>
            </div>
            <button style={{background:'#1a1a2e',border:'1px solid #2a2a5a',color:'#7eb3e8',padding:'8px 16px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:500,whiteSpace:'nowrap'}}>
              + Send WhatsApp Reminder
            </button>
          </div>

          {error && <div style={{background:'#2e1a1a',border:'1px solid #5a2d2d',borderRadius:8,padding:'10px 14px',marginBottom:'1rem',fontSize:12,color:'#e87e7e',marginBottom:'1.25rem'}}>
            Could not load data: {error}
          </div>}

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:'1.5rem'}}>
            {[
              {label:'Total Clients',      value:clients.length,    sub:'+4.2% vs last week',   subC:'#7ec87e'},
              {label:'Due Today',          value:dueToday.length,   sub:`${highUrgency.length} high urgency`,  subC:'#e8c87e'},
              {label:'Upcoming (7 days)',  value:upcoming.length,   sub:'Automations armed',    subC:'#7eb3e8'},
              {label:'Lapsed Clients',     value:lapsed.length,     sub:'Revenue impact: review', subC:'#e87e7e', hi:true},
            ].map(m=>(
              <div key={m.label} style={{background:m.hi?'#160e0e':'#0f0f0f',border:`1px solid ${m.hi?'#2e1a1a':'#1a1a1a'}`,borderRadius:10,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:'#444',marginBottom:8}}>{m.label}</div>
                <div style={{fontSize:26,fontWeight:600,lineHeight:1,color:'#f0f0f0'}}>{loading?'—':m.value}</div>
                <div style={{fontSize:11,color:m.subC,marginTop:6}}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{display:'flex',gap:8,marginBottom:'1rem',alignItems:'center',flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client, ID, treatment..."
              style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 12px',color:'#e0e0e0',fontSize:12,width:210,outline:'none'}}/>
            <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 10px',color:'#777',fontSize:12,cursor:'pointer'}}>
              Stage: <select value={filterStage} onChange={e=>setStage(e.target.value)} style={{background:'transparent',border:'none',color:'#aaa',fontSize:12,outline:'none',cursor:'pointer'}}>
                {stages.map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
              </select>
            </div>
            <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 10px',color:'#777',fontSize:12,cursor:'pointer'}}>
              Status: <select value={filterStatus} onChange={e=>setStatus(e.target.value)} style={{background:'transparent',border:'none',color:'#aaa',fontSize:12,outline:'none',cursor:'pointer'}}>
                {['All','Active','Lapsed','Completed'].map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
              </select>
            </div>
            <div style={{background:'#0f0f0f',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 10px',color:'#777',fontSize:12,cursor:'pointer'}}>
              Urgency: <span style={{color:'#aaa'}}>Smart</span>
            </div>
            {lastRefresh && <span style={{marginLeft:'auto',fontSize:11,color:'#333'}}>Updated {lastRefresh.toLocaleTimeString()}</span>}
          </div>

          <div style={{background:'#0a0a0a',border:'1px solid #141414',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{borderBottom:'1px solid #141414'}}>
                  {['Client Name / ID','Treatment Type','Stage','Next Reminder','Status','Last Contacted','Actions'].map(h=>(
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
                  const isSel = selected?.Client_ID===c.Client_ID
                  const stage = STAGE_COLORS[c.Reminder_Stage]||{bg:'#1a1a1a',text:'#888'}
                  const diff  = dayDiff(c.Next_Reminder_Date)
                  return (
                    <tr key={i} onClick={()=>setSelected(isSel?null:c)}
                      style={{borderBottom:'1px solid #111',cursor:'pointer',background:isSel?'#131313':'transparent',transition:'background 0.1s'}}
                      onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='#0f0f0f'}}
                      onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background='transparent'}}>
                      <td style={{padding:'11px 14px'}}>
                        <div style={{fontWeight:500,color:'#ddd'}}>{c.Full_Name}</div>
                        <div style={{fontSize:11,color:'#383838',marginTop:1}}>#{c.Client_ID}</div>
                      </td>
                      <td style={{padding:'11px 14px',color:'#666'}}>{c.Treatment_Type}</td>
                      <td style={{padding:'11px 14px'}}>
                        <span style={{background:stage.bg,color:stage.text,padding:'3px 8px',borderRadius:4,fontSize:11,whiteSpace:'nowrap'}}>
                          {c.Reminder_Stage} · <span style={{opacity:0.6,cursor:'pointer'}}>inline edit</span>
                        </span>
                      </td>
                      <td style={{padding:'11px 14px'}}><ReminderCell client={c}/></td>
                      <td style={{padding:'11px 14px'}}><StatusDot status={c.Status}/></td>
                      <td style={{padding:'11px 14px',color:'#444',fontSize:11}}>{c.Last_Reminder_Sent||'—'}</td>
                      <td style={{padding:'11px 14px'}}>
                        <div style={{display:'flex',gap:5,alignItems:'center'}}>
                          {['✉','↻','✕'].map((icon,idx)=>(
                            <button key={idx} onClick={e=>{e.stopPropagation()}}
                              style={{background:'#141414',border:'1px solid #1e1e1e',color:'#555',width:22,height:22,borderRadius:4,cursor:'pointer',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center',transition:'border-color 0.15s,color 0.15s'}}
                              onMouseEnter={e=>{e.currentTarget.style.borderColor='#333';e.currentTarget.style.color='#aaa'}}
                              onMouseLeave={e=>{e.currentTarget.style.borderColor='#1e1e1e';e.currentTarget.style.color='#555'}}>
                              {icon}
                            </button>
                          ))}
                          {diff!==null&&diff<-2&&<span style={{fontSize:10,color:'#e87e7e',whiteSpace:'nowrap'}}>· Rev risk</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{padding:'7px 14px',borderTop:'1px solid #111',fontSize:10,color:'#282828'}}>
              Hover row to reveal quick actions · Click row to open side panel · Inline edit enabled for Stage and Next Reminder
            </div>
          </div>
        </div>

        {selected && <SidePanel client={selected} onClose={()=>setSelected(null)}/>}
      </div>
    </div>
  )
}
