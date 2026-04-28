'use client'
import { useState, useEffect } from 'react'

const WEBHOOK_URL = '/api/clients'
const UPDATE_URL  = 'https://bilalashraf234.app.n8n.cloud/webhook/update-client'
const REMIND_URL  = 'https://bilalashraf234.app.n8n.cloud/webhook/send-reminder'
const ADD_URL     = 'https://bilalashraf234.app.n8n.cloud/webhook/add-client'

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
  if (c.Status === 'Lapsed') return { score:95, label:'CRITICAL', sub:'Lapsed', color:'#e87e7e', bg:'#1a0808', border:'#3d1010' }
  const diff = dayDiff(c.Next_Reminder_Date)
  if (diff === null) return { score:10, label:'LOW', sub:'No date', color:'#444', bg:'transparent', border:'transparent' }
  if (diff < -2) return { score:90+Math.min(Math.abs(diff),9), label:'CRITICAL', sub:`${Math.abs(diff)}d overdue`, color:'#e87e7e', bg:'#1a0808', border:'#3d1010' }
  if (diff < 0)  return { score:75, label:'HIGH', sub:`${Math.abs(diff)}d overdue`, color:'#e8a87e', bg:'#1a1208', border:'#3d2810' }
  if (diff === 0) return { score:70, label:'DUE TODAY', sub:'Act now', color:'#e8c87e', bg:'#1a1808', border:'#3d3010' }
  if (diff <= 3)  return { score:50, label:'HIGH', sub:`In ${diff}d`, color:'#7eb3e8', bg:'transparent', border:'transparent' }
  return { score:20, label:'MED', sub:`In ${diff}d`, color:'#555', bg:'transparent', border:'transparent' }
}
function getAIMove(c) {
  const diff = dayDiff(c.Next_Reminder_Date)
  if (c.Status === 'Lapsed') return 'Send win-back WhatsApp. Offer loyalty discount.'
  if (diff !== null && diff < -2) return 'Send WhatsApp now. If no reply in 10 min, create call task.'
  if (diff !== null && diff < 0)  return 'Send reminder + booking link. Queue fallback call if unread.'
  if (diff === 0) return 'Call first, then send prep note using short script.'
  return 'Scheduled — no action needed yet.'
}
function getRevenue(c) {
  const base = {'Botox':150,'Dermal Filler - Lips':300,'Dermal Filler - Cheeks':350,'Dermal Filler - Jawline':400,'HydraFacial':120,'Laser Hair Removal':200,'Chemical Peel':180,'CoolSculpting':800,'Microneedling':250,'HIFU':600,'Anti-Sweat Injection':300,'Laser Resurfacing':400,'IPL':250,'RF Body Tightening':300,'Cavitation':200,'RF Microneedling':280}
  const v = base[c.Treatment_Type] || 200
  const diff = dayDiff(c.Next_Reminder_Date)
  return v * (c.Status==='Lapsed' ? 3 : diff!==null&&diff<0 ? 2 : 1)
}
const STAGE_STYLE = {
  'Aftercare':    {bg:'#1a2e1a', color:'#7ec87e'},
  'Results Check':{bg:'#1a1e2e', color:'#7eb3e8'},
  'Next Session': {bg:'#2e2a1a', color:'#e8c87e'},
  'Rebooking':    {bg:'#251a2e', color:'#c87ee8'},
  'Win-back':     {bg:'#2e1a1a', color:'#e87e7e'},
}
const STAGES     = ['Aftercare','Results Check','Next Session','Rebooking','Win-back']
const TREATMENTS = ['Botox','Dermal Filler - Lips','Dermal Filler - Cheeks','Dermal Filler - Jawline','Anti-Sweat Injection','Laser Hair Removal','Laser Resurfacing','Chemical Peel','HydraFacial','Microneedling','RF Microneedling','IPL','CoolSculpting','HIFU','RF Body Tightening','Cavitation']

const inp  = {background:'#111',border:'1px solid #2a2a2a',borderRadius:6,padding:'8px 12px',color:'#f0f0f0',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'}
const lbl  = {fontSize:11,color:'#555',display:'block',marginBottom:5,letterSpacing:'0.03em'}
const sect = {fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,paddingBottom:6,borderBottom:'1px solid #1a1a1a'}

// ── Toast ──────────────────────────────────────────────────────
function Toast({msg,type,onDone}) {
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t)},[])
  return (
    <div style={{position:'fixed',top:20,right:20,zIndex:1000,background:type==='success'?'#1a2e1a':'#2e1a1a',border:`1px solid ${type==='success'?'#2d5a2d':'#5a2d2d'}`,color:type==='success'?'#7ec87e':'#e87e7e',padding:'12px 18px',borderRadius:8,fontSize:13,fontWeight:500,boxShadow:'0 4px 24px rgba(0,0,0,0.6)',display:'flex',alignItems:'center',gap:8}}>
      <span>{type==='success'?'✓':'✗'}</span> {msg}
    </div>
  )
}

// ── Add Client Modal ───────────────────────────────────────────
function AddModal({onClose, onAdd}) {
  const [f,setF] = useState({Full_Name:'',WhatsApp_Number:'',Treatment_Type:'Botox',Treatment_Date:'',Session_Number:'1',Total_Sessions_Planned:'',Reminder_Stage:'Aftercare',Notes:''})
  const [saving,setSaving] = useState(false)
  const [err,setErr] = useState('')
  const set = (k,v) => setF(x=>({...x,[k]:v}))

  async function submit() {
    if(!f.Full_Name.trim()) return setErr('Full name is required')
    if(!f.WhatsApp_Number.trim()) return setErr('WhatsApp number is required')
    if(!f.Treatment_Date) return setErr('Treatment date is required')
    setErr(''); setSaving(true)
    try {
      await fetch(ADD_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)})
      onAdd(f)
    } catch(e){ setErr('Failed to add client. Please try again.') }
    finally { setSaving(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#0f0f0f',border:'1px solid #222',borderRadius:14,width:'100%',maxWidth:480,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 8px 40px rgba(0,0,0,0.8)'}}>
        
        {/* Modal header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 20px',borderBottom:'1px solid #1a1a1a'}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:'#f0f0f0',letterSpacing:'-0.01em'}}>Add Client</div>
            <div style={{fontSize:11,color:'#555',marginTop:2}}>Fill in the details to add them to your follow-up system</div>
          </div>
          <button onClick={onClose} style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:6,color:'#666',cursor:'pointer',fontSize:16,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>

        {/* Form body */}
        <div style={{padding:'20px'}}>

          {/* Section 1 — Client Info */}
          <div style={sect}>Client Information</div>
          <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
            <div>
              <label style={lbl}>Full Name <span style={{color:'#e87e7e'}}>*</span></label>
              <input style={inp} value={f.Full_Name} onChange={e=>set('Full_Name',e.target.value)} placeholder="e.g. Sara Ahmed"/>
            </div>
            <div>
              <label style={lbl}>WhatsApp Number <span style={{color:'#e87e7e'}}>*</span></label>
              <input style={inp} value={f.WhatsApp_Number} onChange={e=>set('WhatsApp_Number',e.target.value)} placeholder="+923001234567"/>
            </div>
          </div>

          {/* Section 2 — Treatment */}
          <div style={sect}>Treatment Details</div>
          <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
            <div>
              <label style={lbl}>Treatment Type <span style={{color:'#e87e7e'}}>*</span></label>
              <select style={inp} value={f.Treatment_Type} onChange={e=>set('Treatment_Type',e.target.value)}>
                {TREATMENTS.map(t=><option key={t} style={{background:'#111'}}>{t}</option>)}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={lbl}>Treatment Date <span style={{color:'#e87e7e'}}>*</span></label>
                <input style={inp} type="date" value={f.Treatment_Date} onChange={e=>set('Treatment_Date',e.target.value)}/>
              </div>
              <div>
                <label style={lbl}>Session Number</label>
                <input style={inp} type="number" min="1" value={f.Session_Number} onChange={e=>set('Session_Number',e.target.value)}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={lbl}>Total Sessions Planned</label>
                <input style={inp} type="number" value={f.Total_Sessions_Planned} onChange={e=>set('Total_Sessions_Planned',e.target.value)} placeholder="Blank if one-off"/>
              </div>
              <div>
                <label style={lbl}>Initial Stage</label>
                <select style={inp} value={f.Reminder_Stage} onChange={e=>set('Reminder_Stage',e.target.value)}>
                  {STAGES.map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3 — Notes */}
          <div style={sect}>Additional</div>
          <div style={{marginBottom:20}}>
            <label style={lbl}>Notes <span style={{color:'#444'}}>(optional)</span></label>
            <textarea style={{...inp,resize:'vertical',minHeight:72,fontFamily:'inherit'}} value={f.Notes} onChange={e=>set('Notes',e.target.value)} placeholder="Any relevant notes about this client..."/>
          </div>

          {/* Error */}
          {err && <div style={{background:'#2e1a1a',border:'1px solid #5a2d2d',borderRadius:6,padding:'8px 12px',marginBottom:14,fontSize:12,color:'#e87e7e'}}>{err}</div>}

          {/* Buttons */}
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{flex:1,background:'#141414',border:'1px solid #222',color:'#888',padding:'10px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#444';e.currentTarget.style.color='#aaa'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#222';e.currentTarget.style.color='#888'}}>
              Cancel
            </button>
            <button onClick={submit} disabled={saving} style={{flex:2,background:saving?'#141414':'#1a2e1a',border:`1px solid ${saving?'#222':'#2d5a2d'}`,color:saving?'#555':'#7ec87e',padding:'10px',borderRadius:8,cursor:saving?'default':'pointer',fontSize:13,fontWeight:600,transition:'all 0.15s'}}>
              {saving ? 'Adding client...' : '+ Add Client'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────
export default function Dashboard() {
  const [clients,setClients]   = useState([])
  const [loading,setLoading]   = useState(true)
  const [error,setError]       = useState(null)
  const [search,setSearch]     = useState('')
  const [fStage,setFStage]     = useState('All')
  const [fStatus,setFStatus]   = useState('All')
  const [selected,setSelected] = useState(null)
  const [showAdd,setShowAdd]   = useState(false)
  const [toast,setToast]       = useState(null)
  const [sending,setSending]   = useState(null)
  const [doing,setDoing]       = useState(null)
  const [editRow,setEditRow]   = useState(null)
  const [editV,setEditV]       = useState({})
  const [width,setWidth]       = useState(1200)

  useEffect(()=>{
    setWidth(window.innerWidth)
    const fn=()=>setWidth(window.innerWidth)
    window.addEventListener('resize',fn)
    return()=>window.removeEventListener('resize',fn)
  },[])

  async function load() {
    try {
      setLoading(true); setError(null)
      const res = await fetch(WEBHOOK_URL)
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setClients(Array.isArray(data)?data.map(d=>d.json||d):[])
    } catch(e){ setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(()=>{ load(); const i=setInterval(load,300000); return()=>clearInterval(i) },[])

  const showToast = (msg,type='success') => setToast({msg,type})

  async function sendReminder(c,e) {
    e.stopPropagation(); setSending(c.Client_ID)
    try {
      await fetch(REMIND_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client:c})})
      showToast(`Reminder sent to ${c.Full_Name}`)
    } catch { showToast('Failed to send reminder','error') }
    finally { setSending(null) }
  }

  async function markDone(c,e) {
    e.stopPropagation(); setDoing(c.Client_ID)
    const t=new Date(); const ds=`${String(t.getDate()).padStart(2,'0')}/${String(t.getMonth()+1).padStart(2,'0')}/${t.getFullYear()}`
    try {
      await fetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row_number:c.row_number,field:'Last_Reminder_Sent',value:ds})})
      setClients(cs=>cs.map(x=>x.Client_ID===c.Client_ID?{...x,Last_Reminder_Sent:ds}:x))
      if(selected?.Client_ID===c.Client_ID) setSelected(s=>({...s,Last_Reminder_Sent:ds}))
      showToast(`Marked done for ${c.Full_Name}`)
    } catch { showToast('Failed to update','error') }
    finally { setDoing(null) }
  }

  async function saveEdit(c,e) {
    e.stopPropagation()
    try {
      await fetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row_number:c.row_number,...editV})})
      setClients(cs=>cs.map(x=>x.Client_ID===c.Client_ID?{...x,...editV}:x))
      if(selected?.Client_ID===c.Client_ID) setSelected(s=>({...s,...editV}))
      showToast('Client updated'); setEditRow(null)
    } catch { showToast('Failed to save','error') }
  }

  function handleAdd(form) {
    const nc = {Client_ID:`CLT-${String(clients.length+1).padStart(3,'0')}`,...form,Status:'Active',Last_Reminder_Sent:'',Next_Reminder_Date:'',row_number:clients.length+2}
    setClients(cs=>[...cs,nc]); setShowAdd(false); showToast(`${form.Full_Name} added successfully`)
  }

  const isMobile = width < 768
  const isTablet = width < 1100

  const sorted   = [...clients].sort((a,b)=>getPriority(b).score-getPriority(a).score)
  const filtered = sorted.filter(c=>{
    const ms = !search||[c.Full_Name,c.Treatment_Type,c.Client_ID].some(v=>v?.toLowerCase().includes(search.toLowerCase()))
    return ms && (fStage==='All'||c.Reminder_Stage===fStage) && (fStatus==='All'||c.Status===fStatus)
  })

  const totalRev  = clients.reduce((s,c)=>{const d=dayDiff(c.Next_Reminder_Date);return(c.Status==='Lapsed'||(d!==null&&d<0))?s+getRevenue(c):s},0)
  const recovered = clients.filter(c=>c.Last_Reminder_Sent).reduce((s,c)=>s+getRevenue(c),0)
  const lostRev   = clients.filter(c=>c.Status==='Lapsed').reduce((s,c)=>s+getRevenue(c)*2,0)
  const actionQ   = clients.filter(c=>{if(c.Status==='Lapsed')return true;const d=dayDiff(c.Next_Reminder_Date);return d!==null&&d<=0}).length
  const topClient = filtered[0]
  const topPri    = topClient ? getPriority(topClient) : null
  const diffSel   = selected ? dayDiff(selected.Next_Reminder_Date) : null
  const revSel    = selected ? getRevenue(selected) : 0

  // Action Hub content
  const HubContent = selected ? (
    <div style={{display:'flex',flexDirection:'column',gap:'1rem',height:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#f0f0f0'}}>Follow-up Action Hub</div>
        <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'#444',cursor:'pointer',fontSize:20,lineHeight:1}}>×</button>
      </div>

      <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:8,padding:'12px'}}>
        <div style={{fontSize:13,fontWeight:600,color:'#f0f0f0',marginBottom:2}}>
          Client: {selected.Full_Name}{revSel>400?' · High Value':''}
        </div>
        <div style={{fontSize:11,color:'#555',lineHeight:1.6}}>
          <div>Botox · Stage: {selected.Reminder_Stage} · Reminder: {diffSel===0?'Today':diffSel!==null&&diffSel<0?`${Math.abs(diffSel)}d overdue`:diffSel!==null?`In ${diffSel}d`:'Not set'}</div>
          <div style={{color:'#e87e7e',marginTop:4}}>AI: {getAIMove(selected)}</div>
          <div style={{marginTop:4}}>Revenue at risk: <span style={{color:'#e8c87e'}}>${revSel.toLocaleString()}</span></div>
          <div style={{marginTop:4}}>Primary goal: <span style={{color:'#aaa'}}>Send reminder and secure reply today</span></div>
          {selected.Last_Reminder_Sent&&<div style={{marginTop:4,color:'#7ec87e'}}>✓ Last sent: {selected.Last_Reminder_Sent}</div>}
        </div>
      </div>

      <div style={{display:'flex',gap:6}}>
        <button onClick={e=>sendReminder(selected,e)} disabled={sending===selected.Client_ID}
          style={{flex:2,background:'#1a2e1a',border:'1px solid #2d5a2d',color:'#7ec87e',padding:'9px 8px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:'0.01em'}}>
          {sending===selected.Client_ID?'Sending...':'↗ Send Reminder Now'}
        </button>
      </div>
      <div style={{display:'flex',gap:6}}>
        <button onClick={e=>markDone(selected,e)} disabled={doing===selected.Client_ID}
          style={{flex:1,background:'#141414',border:'1px solid #222',color:'#aaa',padding:'8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:500}}>
          {doing===selected.Client_ID?'Saving...':'✓ Mark Done'}
        </button>
        <a href={`tel:${selected.WhatsApp_Number}`}
          style={{flex:1,background:'#141414',border:'1px solid #222',color:'#aaa',padding:'8px',borderRadius:7,cursor:'pointer',fontSize:11,textDecoration:'none',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
          📞 Call
        </a>
      </div>

      <div>
        <div style={sect}>Guided Workflow</div>
        <div style={{fontSize:11,color:'#7ec87e',marginBottom:4}}>Step 1: Send Reminder Now</div>
        <div style={{fontSize:11,color:'#555'}}>Step 2: Mark Contacted → Step 3: Auto-schedule next step</div>
      </div>

      <div>
        <div style={sect}>Edit Client</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div>
            <label style={lbl}>Reminder Stage</label>
            <select
              value={editRow===selected.Client_ID?editV.Reminder_Stage:selected.Reminder_Stage}
              onChange={e=>{
                if(editRow!==selected.Client_ID){setEditRow(selected.Client_ID);setEditV({Reminder_Stage:e.target.value,Next_Reminder_Date:selected.Next_Reminder_Date||''})}
                else setEditV(v=>({...v,Reminder_Stage:e.target.value}))
              }}
              style={{...inp,fontSize:12}}>
              {STAGES.map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Next Reminder Date</label>
            <input type="date"
              value={editRow===selected.Client_ID?(editV.Next_Reminder_Date?editV.Next_Reminder_Date.split('/').reverse().join('-'):''):(selected.Next_Reminder_Date?selected.Next_Reminder_Date.split('/').reverse().join('-'):'')}
              onChange={e=>{
                const p=e.target.value.split('-'); const fmt=`${p[2]}/${p[1]}/${p[0]}`
                if(editRow!==selected.Client_ID){setEditRow(selected.Client_ID);setEditV({Reminder_Stage:selected.Reminder_Stage,Next_Reminder_Date:fmt})}
                else setEditV(v=>({...v,Next_Reminder_Date:fmt}))
              }}
              style={{...inp,fontSize:12}}/>
          </div>
          {editRow===selected.Client_ID&&(
            <button onClick={e=>saveEdit(selected,e)}
              style={{background:'#1a2e1a',border:'1px solid #2d5a2d',color:'#7ec87e',padding:'8px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
              Save Changes
            </button>
          )}
        </div>
      </div>

      <div>
        <div style={sect}>Automation Triggers</div>
        <div style={{fontSize:11,color:'#555',lineHeight:1.8}}>
          <div>• If overdue &gt; 3 days → escalate to call queue</div>
          <div>• If lapsed + high value → notify manager</div>
          <div>• On rebooking → send confirmation</div>
        </div>
      </div>

      {selected.Notes&&(
        <div style={{background:'#141414',border:'1px solid #1a1a1a',borderRadius:8,padding:'10px 12px',marginTop:'auto'}}>
          <div style={{fontSize:10,color:'#444',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Notes</div>
          <div style={{fontSize:12,color:'#777'}}>{selected.Notes}</div>
        </div>
      )}
    </div>
  ) : (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:10,opacity:0.4}}>
      <div style={{fontSize:32}}>⚡</div>
      <div style={{fontSize:12,color:'#555',textAlign:'center',lineHeight:1.6}}>Click any client row<br/>to open the Action Hub</div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#0c0c0c',color:'#f0f0f0',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:13,display:'flex',flexDirection:'column'}}>
      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={handleAdd}/>}

      {/* Urgent banner */}
      {!loading&&topClient&&topPri?.score>=70&&(
        <div style={{background:'#1a1208',borderBottom:'1px solid #3d2810',padding:'9px 1.5rem',fontSize:12,color:'#e8c87e',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span style={{fontWeight:700}}>⚡ Priority:</span>
          <span>{topClient.Full_Name} is {topPri.sub}. Send reminder now to recover <strong>${getRevenue(topClient).toLocaleString()}</strong> today.</span>
        </div>
      )}

      {/* Main layout */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* Left — main content */}
        <div style={{flex:1,overflowY:'auto',padding:isMobile?'0.75rem':'1.5rem 1.75rem',minWidth:0}}>

          {/* Page header */}
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.25rem',gap:12,flexWrap:'wrap'}}>
            <div>
              <h1 style={{fontSize:isMobile?17:22,fontWeight:700,margin:0,letterSpacing:'-0.03em',color:'#f0f0f0'}}>Clinic Command Center</h1>
              <p style={{fontSize:12,color:'#555',margin:'3px 0 0'}}>Live follow-up execution, urgency triage, and revenue recovery.</p>
            </div>
            <button onClick={()=>setShowAdd(true)}
              style={{background:'#1a2e1a',border:'1px solid #2d5a2d',color:'#7ec87e',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',letterSpacing:'0.01em'}}
              onMouseEnter={e=>e.currentTarget.style.background='#223d22'}
              onMouseLeave={e=>e.currentTarget.style.background='#1a2e1a'}>
              + Add Client
            </button>
          </div>

          {error&&<div style={{background:'#2e1a1a',border:'1px solid #5a2d2d',borderRadius:8,padding:'10px',marginBottom:'1rem',fontSize:12,color:'#e87e7e'}}>⚠ Could not load data: {error}</div>}

          {/* Metrics */}
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10,marginBottom:'1.25rem'}}>
            {[
              {label:'Revenue At Risk',           value:`$${totalRev.toLocaleString()}`,  sub:`${clients.filter(c=>c.Status==='Lapsed'||(dayDiff(c.Next_Reminder_Date)??1)<0).length} overdue clients`, bg:'#160a0a',border:'#2e1a1a',vc:'#e87e7e',sc:'#e87e7e'},
              {label:'Recovered This Week',       value:`$${recovered.toLocaleString()}`, sub:`${clients.filter(c=>c.Last_Reminder_Sent).length} clients reactivated`, bg:'#0a160a',border:'#1a2e1a',vc:'#7ec87e',sc:'#7ec87e'},
              {label:'Lost Revenue (No Follow-up)',value:`$${lostRev.toLocaleString()}`,  sub:'7-day trailing impact', bg:'#12100a',border:'#2e2810',vc:'#e8c87e',sc:'#e8c87e'},
              {label:'Action Queue',              value:actionQ,                           sub:'Need attention now', bg:'#0a0f16',border:'#1a2030',vc:'#f0f0f0',sc:'#7eb3e8'},
            ].map(m=>(
              <div key={m.label} style={{background:m.bg,border:`1px solid ${m.border}`,borderRadius:10,padding:'13px 15px'}}>
                <div style={{fontSize:10,color:'#444',marginBottom:7,textTransform:'uppercase',letterSpacing:'0.05em'}}>{m.label}</div>
                <div style={{fontSize:isMobile?20:26,fontWeight:700,lineHeight:1,color:m.vc,letterSpacing:'-0.02em'}}>{loading?'—':m.value}</div>
                <div style={{fontSize:10,color:m.sc,marginTop:6,opacity:0.8}}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={{display:'flex',gap:8,marginBottom:'1rem',flexWrap:'wrap',alignItems:'center'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client, ID, phone..."
              style={{flex:1,minWidth:140,background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'7px 11px',color:'#e0e0e0',fontSize:12,outline:'none'}}/>
            <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 10px',fontSize:11,color:'#555'}}>
              Urgency: <select style={{background:'transparent',border:'none',color:'#888',fontSize:11,outline:'none'}}>
                <option style={{background:'#111'}}>All ↕</option>
              </select>
            </div>
            <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 10px',fontSize:11,color:'#555'}}>
              Stage: <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{background:'transparent',border:'none',color:'#888',fontSize:11,outline:'none'}}>
                {['All',...STAGES].map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
              </select>
            </div>
            <div style={{background:'#111',border:'1px solid #1e1e1e',borderRadius:6,padding:'6px 10px',fontSize:11,color:'#555'}}>
              Status: <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{background:'transparent',border:'none',color:'#888',fontSize:11,outline:'none'}}>
                {['All','Active','Lapsed','Completed'].map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
              </select>
            </div>
            <div style={{marginLeft:'auto',background:'#1a1a2e',border:'1px solid #2a2a5a',borderRadius:6,padding:'6px 10px',fontSize:11,color:'#7eb3e8',cursor:'pointer',whiteSpace:'nowrap'}}>
              Quick sort: Risk ↓
            </div>
          </div>

          {/* Table */}
          <div style={{background:'#0a0a0a',border:'1px solid #141414',borderRadius:10,overflow:'hidden'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,tableLayout:'fixed'}}>
                <colgroup>
                  <col style={{width:'90px'}}/>
                  <col style={{width:'140px'}}/>
                  {!isMobile&&<col style={{width:'220px'}}/>}
                  <col style={{width:'110px'}}/>
                  <col style={{width:'120px'}}/>
                  {!isMobile&&<col style={{width:'90px'}}/>}
                  <col style={{width:'100px'}}/>
                </colgroup>
                <thead>
                  <tr style={{borderBottom:'1px solid #141414',background:'#0d0d0d'}}>
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11}}>Priority</th>
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11}}>Client</th>
                    {!isMobile&&<th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11}}>AI Next Move (desktop)</th>}
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11}}>Stage</th>
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11}}>Follow-up Date</th>
                    {!isMobile&&<th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11}}>Revenue</th>}
                    <th style={{textAlign:'left',padding:'9px 14px',color:'#383838',fontWeight:500,fontSize:11}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading?(
                    <tr><td colSpan={7} style={{padding:'3rem',textAlign:'center',color:'#333',fontSize:13}}>Loading from Google Sheets...</td></tr>
                  ):filtered.length===0?(
                    <tr><td colSpan={7} style={{padding:'3rem',textAlign:'center',color:'#333',fontSize:13}}>No clients match your filters</td></tr>
                  ):filtered.map((c,i)=>{
                    const pri   = getPriority(c)
                    const rev   = getRevenue(c)
                    const stage = STAGE_STYLE[c.Reminder_Stage]||{bg:'#1a1a1a',color:'#666'}
                    const diff  = dayDiff(c.Next_Reminder_Date)
                    const isSel = selected?.Client_ID===c.Client_ID
                    const isEdit = editRow===c.Client_ID
                    return (
                      <tr key={i}
                        onClick={()=>{ if(!isEdit){setSelected(isSel?null:c); setEditRow(null)} }}
                        style={{borderBottom:'1px solid #0f0f0f',cursor:'pointer',background:isSel?'#161616':pri.bg,transition:'background 0.1s'}}
                        onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background='#111111' }}
                        onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background=pri.bg }}>

                        {/* Priority */}
                        <td style={{padding:'11px 14px'}}>
                          <div style={{fontSize:10,fontWeight:700,color:pri.color,letterSpacing:'0.02em'}}>{pri.label} · {pri.score}</div>
                          <div style={{fontSize:10,color:pri.color,opacity:0.65,marginTop:2}}>{pri.sub}</div>
                        </td>

                        {/* Client */}
                        <td style={{padding:'11px 14px',overflow:'hidden'}}>
                          <div style={{fontWeight:600,color:'#e0e0e0',fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.Full_Name}</div>
                          <div style={{fontSize:10,color:'#3a3a3a',marginTop:2}}>· {c.Client_ID}</div>
                        </td>

                        {/* AI Next Move */}
                        {!isMobile&&(
                          <td style={{padding:'11px 14px',overflow:'hidden'}}>
                            <div style={{fontSize:11,color:'#666',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={getAIMove(c)}>
                              {getAIMove(c)}
                            </div>
                          </td>
                        )}

                        {/* Stage */}
                        <td style={{padding:'11px 14px'}}>
                          {isEdit ? (
                            <select value={editV.Reminder_Stage} onClick={e=>e.stopPropagation()}
                              onChange={e=>setEditV(v=>({...v,Reminder_Stage:e.target.value}))}
                              style={{background:'#1a1a1a',border:'1px solid #333',borderRadius:4,color:'#f0f0f0',fontSize:11,padding:'3px 5px',outline:'none',width:'100%'}}>
                              {STAGES.map(s=><option key={s} style={{background:'#111'}}>{s}</option>)}
                            </select>
                          ):(
                            <span style={{background:stage.bg,color:stage.color,padding:'3px 8px',borderRadius:4,fontSize:10,fontWeight:500,whiteSpace:'nowrap',display:'inline-block',maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis'}}>
                              {c.Reminder_Stage}
                            </span>
                          )}
                        </td>

                        {/* Follow-up date */}
                        <td style={{padding:'11px 14px'}}>
                          {isEdit ? (
                            <input type="date"
                              value={editV.Next_Reminder_Date?editV.Next_Reminder_Date.split('/').reverse().join('-'):''}
                              onClick={e=>e.stopPropagation()}
                              onChange={e=>{ const p=e.target.value.split('-'); setEditV(v=>({...v,Next_Reminder_Date:`${p[2]}/${p[1]}/${p[0]}`})) }}
                              style={{background:'#1a1a1a',border:'1px solid #333',borderRadius:4,color:'#f0f0f0',fontSize:11,padding:'3px 5px',outline:'none',width:'100%'}}/>
                          ):(
                            <div>
                              <div style={{fontSize:11,color:diff!==null&&diff<0?'#e87e7e':diff===0?'#7ec87e':'#666',fontWeight:diff!==null&&diff<=0?600:400}}>
                                {diff===null?'Not set':diff===0?'Today · Now':diff<0?`Overdue · ${Math.abs(diff)}d`:`In ${diff}d`}
                              </div>
                              {c.Next_Reminder_Date&&<div style={{fontSize:10,color:'#333',marginTop:1}}>{c.Next_Reminder_Date}</div>}
                            </div>
                          )}
                        </td>

                        {/* Revenue */}
                        {!isMobile&&(
                          <td style={{padding:'11px 14px'}}>
                            <div style={{fontSize:12,color:rev>400?'#e8c87e':'#555',fontWeight:rev>400?600:400}}>${rev.toLocaleString()}</div>
                          </td>
                        )}

                        {/* Actions */}
                        <td style={{padding:'11px 14px'}}>
                          {isEdit ? (
                            <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                              <button onClick={e=>saveEdit(c,e)} style={{background:'#1a2e1a',border:'none',color:'#7ec87e',padding:'4px 8px',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:700}}>Save</button>
                              <button onClick={e=>{e.stopPropagation();setEditRow(null)}} style={{background:'#1e1e1e',border:'none',color:'#666',padding:'4px 6px',borderRadius:4,cursor:'pointer',fontSize:10}}>✕</button>
                            </div>
                          ):(
                            <div style={{display:'flex',gap:4}}>
                              <button onClick={e=>sendReminder(c,e)} disabled={sending===c.Client_ID}
                                style={{background:'#1a2e1a',border:'none',color:'#7ec87e',padding:'4px 7px',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:700,opacity:sending===c.Client_ID?0.5:1}}>
                                {sending===c.Client_ID?'...':'WA'}
                              </button>
                              <button onClick={e=>markDone(c,e)} disabled={doing===c.Client_ID}
                                style={{background:'#1a1e2e',border:'none',color:'#7eb3e8',padding:'4px 7px',borderRadius:4,cursor:'pointer',fontSize:10,opacity:doing===c.Client_ID?0.5:1}}>
                                {doing===c.Client_ID?'...':'✓'}
                              </button>
                              <button onClick={e=>{e.stopPropagation();setEditRow(isEdit?null:c.Client_ID);setEditV({Reminder_Stage:c.Reminder_Stage,Next_Reminder_Date:c.Next_Reminder_Date||''})}}
                                style={{background:'#1e1e1e',border:'none',color:'#555',padding:'4px 7px',borderRadius:4,cursor:'pointer',fontSize:10}}>
                                ✎
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:'7px 14px',borderTop:'1px solid #0f0f0f',fontSize:10,color:'#252525',display:'flex',justifyContent:'space-between'}}>
              <span>Mobile: hide AI Next Move + Revenue columns · keep Priority, Client, Stage, Follow-up, Actions</span>
              <span style={{color:'#333'}}>{filtered.length} clients</span>
            </div>
          </div>

          {/* Mobile: Action Hub inline */}
          {selected&&isMobile&&(
            <div style={{marginTop:'1rem',background:'#0f0f0f',border:'1px solid #1a1a1a',borderRadius:12,padding:'1.25rem'}}>
              {HubContent}
            </div>
          )}
        </div>

        {/* Right — Action Hub (desktop) */}
        {!isTablet&&(
          <div style={{width:290,minWidth:290,background:'#0f0f0f',borderLeft:'1px solid #141414',padding:'1.25rem',overflowY:'auto',display:'flex',flexDirection:'column'}}>
            {HubContent}
          </div>
        )}

        {/* Tablet — bottom sheet */}
        {isTablet&&!isMobile&&selected&&(
          <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#0f0f0f',borderTop:'1px solid #1a1a1a',padding:'1.5rem',zIndex:100,maxHeight:'55vh',overflowY:'auto',boxShadow:'0 -8px 32px rgba(0,0,0,0.7)'}}>
            {HubContent}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{borderTop:'1px solid #0f0f0f',padding:'7px 1.5rem',display:'flex',justifyContent:'space-between',fontSize:10,color:'#2a2a2a',background:'#0c0c0c',flexShrink:0}}>
        <span>Clinic Command Center</span>
        <span>{new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</span>
      </div>
    </div>
  )
}
