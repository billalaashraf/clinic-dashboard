'use client'
import { useState, useEffect } from 'react'

const WEBHOOK_URL = '/api/clients'
const UPDATE_URL  = '/api/update-client'
const REMIND_URL  = '/api/send-reminder'
const ADD_URL     = '/api/add-client'

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
  if (c.Status === 'Lapsed') return { score:95, label:'CRITICAL', sub:'Lapsed', color:'#ef4444' }
  const diff = dayDiff(c.Next_Reminder_Date)
  if (diff === null) return { score:10, label:'LOW', sub:'No date', color:'#9ca3af' }
  if (diff < -2) return { score:90+Math.min(Math.abs(diff),9), label:'CRITICAL', sub:`${Math.abs(diff)}d overdue`, color:'#ef4444' }
  if (diff < 0)  return { score:75, label:'HIGH', sub:`${Math.abs(diff)}d overdue`, color:'#f97316' }
  if (diff === 0) return { score:70, label:'DUE TODAY', sub:'Act now', color:'#eab308' }
  if (diff <= 3)  return { score:50, label:'HIGH', sub:`In ${diff}d`, color:'#3b82f6' }
  return { score:20, label:'MED', sub:`In ${diff}d`, color:'#6b7280' }
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
  const base = {'Botox':150,'Dermal Filler - Lips':300,'Dermal Filler - Cheeks':350,'Dermal Filler - Jawline':400,'HydraFacial':120,'Laser Hair Removal':200,'Chemical Peel':180,'CoolSculpting':800,'Microneedling':250,'HIFU':600,'Anti-Sweat Injection':300,'Laser Skin Resurfacing':400,'IPL / Photofacial':250,'RF Body Tightening':300,'Cavitation':200,'RF Microneedling':280}
  const v = base[c.Treatment_Type] || 200
  const diff = dayDiff(c.Next_Reminder_Date)
  return v * (c.Status==='Lapsed' ? 3 : diff!==null&&diff<0 ? 2 : 1)
}
const STAGES = ['Aftercare','Results Check','Rebooking','Win-back','Next Session','Lapsed']
const TREATMENTS = ['Botox','Dermal Filler - Lips','Dermal Filler - Cheeks','Dermal Filler - Jawline','Anti-Sweat Injection','Laser Hair Removal','Laser Skin Resurfacing','Chemical Peel','HydraFacial','Microneedling / RF Microneedling','IPL / Photofacial','CoolSculpting / Cryolipolysis','HIFU / Ultherapy','RF Body Tightening','Cavitation']
const STAGE_STYLE = {
  'Aftercare':     {bg:'#dcfce7', color:'#15803d'},
  'Results Check': {bg:'#dbeafe', color:'#1d4ed8'},
  'Next Session':  {bg:'#fef9c3', color:'#854d0e'},
  'Rebooking':     {bg:'#f0fdf4', color:'#166534'},
  'Win-back':      {bg:'#faf5ff', color:'#7e22ce'},
  'Lapsed':        {bg:'#fee2e2', color:'#b91c1c'},
}
const inp = {width:'100%',padding:'8px 10px',background:'#f9fafb',border:'0.5px solid #d1d5db',borderRadius:6,color:'#111',fontSize:13,outline:'none',boxSizing:'border-box'}
const lbl = {fontSize:12,color:'#6b7280',marginBottom:4,display:'block'}
const sect = {fontSize:10,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,paddingBottom:6,borderBottom:'0.5px solid #e5e7eb'}
const card = {background:'#fff',border:'0.5px solid #e5e7eb',borderRadius:12,padding:16}

function Toast({msg,type,onDone}) {
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t)},[])
  const ok=type!=='error'
  return <div style={{position:'fixed',top:20,right:20,zIndex:1000,background:ok?'#dcfce7':'#fee2e2',border:`1px solid ${ok?'#86efac':'#fca5a5'}`,color:ok?'#166534':'#991b1b',padding:'12px 18px',borderRadius:8,fontSize:13,fontWeight:500,boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>{ok?'✓':'✗'} {msg}</div>
}

function AddModal({onClose,onAdd}) {
  const [f,setF]=useState({Full_Name:'',WhatsApp_Number:'',Email:'',Treatment_Type:'Botox',Treatment_Date:'',Session_Number:'1',Total_Sessions_Planned:'',Reminder_Stage:'Aftercare',Notes:''})
  const [saving,setSaving]=useState(false)
  const [err,setErr]=useState('')
  const set=(k,v)=>setF(x=>({...x,[k]:v}))
  async function submit() {
    if(!f.Full_Name.trim()) return setErr('Full name is required')
    if(!f.WhatsApp_Number.trim()) return setErr('WhatsApp number is required')
    if(!f.Email.trim()) return setErr('Email is required')
    if(!f.Treatment_Date) return setErr('Treatment date is required')
    setErr('');setSaving(true)
    try { await fetch(ADD_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)}); onAdd(f) }
    catch(e){ setErr('Failed to add client.') }
    finally { setSaving(false) }
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:480,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 8px 40px rgba(0,0,0,0.15)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 20px',borderBottom:'0.5px solid #e5e7eb'}}>
          <div><div style={{fontSize:16,fontWeight:600,color:'#111'}}>Add Patient</div><div style={{fontSize:11,color:'#6b7280',marginTop:2}}>Fill in details to add to follow-up system</div></div>
          <button onClick={onClose} style={{background:'#f3f4f6',border:'none',borderRadius:6,color:'#6b7280',cursor:'pointer',fontSize:18,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        <div style={{padding:20}}>
          <div style={sect}>Client Information</div>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:18}}>
            <div><label style={lbl}>Full Name *</label><input style={inp} value={f.Full_Name} onChange={e=>set('Full_Name',e.target.value)} placeholder="e.g. Sara Ahmed"/></div>
            <div><label style={lbl}>WhatsApp Number *</label><input style={inp} value={f.WhatsApp_Number} onChange={e=>set('WhatsApp_Number',e.target.value)} placeholder="+923001234567"/></div>
            <div><label style={lbl}>Email *</label><input style={inp} type="email" value={f.Email} onChange={e=>set('Email',e.target.value)} placeholder="client@example.com"/></div>
          </div>
          <div style={sect}>Treatment Details</div>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:18}}>
            <div><label style={lbl}>Treatment Type *</label>
              <select style={inp} value={f.Treatment_Type} onChange={e=>set('Treatment_Type',e.target.value)}>
                {TREATMENTS.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Treatment Date *</label><input style={inp} type="date" value={f.Treatment_Date} onChange={e=>set('Treatment_Date',e.target.value)}/></div>
              <div><label style={lbl}>Session Number</label><input style={inp} type="number" min="1" value={f.Session_Number} onChange={e=>set('Session_Number',e.target.value)}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Total Sessions Planned</label><input style={inp} type="number" value={f.Total_Sessions_Planned} onChange={e=>set('Total_Sessions_Planned',e.target.value)} placeholder="Blank if one-off"/></div>
              <div><label style={lbl}>Initial Stage</label>
                <select style={inp} value={f.Reminder_Stage} onChange={e=>set('Reminder_Stage',e.target.value)}>
                  {STAGES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={sect}>Additional</div>
          <div style={{marginBottom:16}}>
            <label style={lbl}>Notes <span style={{color:'#9ca3af'}}>(optional)</span></label>
            <textarea style={{...inp,resize:'vertical',minHeight:72,fontFamily:'inherit'}} value={f.Notes} onChange={e=>set('Notes',e.target.value)} placeholder="Any relevant notes..."/>
          </div>
          {err&&<div style={{background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:6,padding:'8px 12px',marginBottom:14,fontSize:12,color:'#991b1b'}}>{err}</div>}
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{flex:1,background:'#f3f4f6',border:'none',color:'#374151',padding:10,borderRadius:8,cursor:'pointer',fontSize:13}}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{flex:2,background:saving?'#93c5fd':'#2563eb',border:'none',color:'#fff',padding:10,borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}>{saving?'Adding...':'+ Add Patient'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppointmentsPage() {
  const days=[{day:'Mon',date:22,count:6},{day:'Tue',date:23,count:8},{day:'Wed',date:24,count:10,active:true},{day:'Thu',date:25,count:7},{day:'Fri',date:26,count:5}]
  const appointments=[{time:'09:30 AM',patient:'Emma Stone',doctor:'Dr. Patel',status:'Booked'},{time:'11:00 AM',patient:'Noah Diaz',doctor:'Dr. Khan',status:'Completed'},{time:'02:45 PM',patient:'Ava Kim',doctor:'Dr. Rogers',status:'Missed'}]
  const ss={'Booked':{bg:'#dbeafe',color:'#1d4ed8'},'Completed':{bg:'#dcfce7',color:'#15803d'},'Missed':{bg:'#fee2e2',color:'#b91c1c'}}
  return (
    <div style={{flex:1,overflowY:'auto',padding:24}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <h1 style={{fontSize:28,fontWeight:700,color:'#111',margin:0}}>Appointments</h1>
        <div style={{display:'flex',gap:8}}>
          <input placeholder="Search patients or doctor" style={{...inp,width:200,borderRadius:20,fontSize:12,padding:'6px 14px'}}/>
          <select style={{padding:'6px 14px',border:'0.5px solid #d1d5db',borderRadius:20,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>Filter: This Week</option></select>
          <select style={{padding:'6px 14px',border:'0.5px solid #d1d5db',borderRadius:20,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>Status: All</option><option>Booked</option><option>Completed</option><option>Missed</option></select>
        </div>
      </div>
      <div style={{...card,marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:14}}>Calendar View</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
          {days.map(d=>(
            <div key={d.day} style={{padding:'14px 16px',borderRadius:8,background:d.active?'#eff6ff':'#f9fafb',border:`0.5px solid ${d.active?'#93c5fd':'#e5e7eb'}`,cursor:'pointer'}}>
              <div style={{fontSize:13,color:d.active?'#1d4ed8':'#374151',fontWeight:d.active?600:400}}>{d.day} {d.date}</div>
              <div style={{fontSize:12,color:d.active?'#3b82f6':'#6b7280',marginTop:3}}>{d.count} Appointments</div>
            </div>
          ))}
        </div>
      </div>
      <div style={card}>
        <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:14}}>Upcoming Appointments</div>
        {appointments.map((a,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 0',borderBottom:i<appointments.length-1?'0.5px solid #f3f4f6':'none'}}>
            <div style={{fontSize:13,color:'#374151'}}>
              <span style={{fontWeight:500}}>{a.time}</span>
              <span style={{color:'#9ca3af',margin:'0 6px'}}>•</span>
              <span>{a.patient}</span>
              <span style={{color:'#9ca3af',margin:'0 6px'}}>•</span>
              <span style={{color:'#6b7280'}}>{a.doctor}</span>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{background:ss[a.status].bg,color:ss[a.status].color,padding:'3px 10px',borderRadius:4,fontSize:12,fontWeight:500}}>{a.status}</span>
              <button style={{fontSize:12,padding:'4px 12px',border:'0.5px solid #d1d5db',borderRadius:6,background:'#fff',color:'#374151',cursor:'pointer'}}>Reschedule</button>
              {a.status==='Booked'&&<button style={{fontSize:12,padding:'4px 12px',border:'0.5px solid #fca5a5',borderRadius:6,background:'#fff',color:'#ef4444',cursor:'pointer'}}>Cancel</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsPage({clients}) {
  const totalRisk=clients.reduce((s,c)=>s+getRevenue(c),0)
  const weeks=[18,21,19,24,28,25,31,35,38,42,47,52]
  const maxW=Math.max(...weeks)
  return (
    <div style={{flex:1,overflowY:'auto',padding:24}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <h1 style={{fontSize:28,fontWeight:700,color:'#111',margin:0}}>Analytics</h1>
        <div style={{display:'flex',gap:8}}>
          <div><div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>Label Text</div><select style={{padding:'6px 12px',border:'0.5px solid #d1d5db',borderRadius:20,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>Select Option</option></select></div>
          <div><div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>Label Text</div><select style={{padding:'6px 12px',border:'0.5px solid #d1d5db',borderRadius:20,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>Select Option</option></select></div>
        </div>
      </div>
      <div style={{...card,marginBottom:20,background:'linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)'}}>
        <div style={{fontSize:14,fontWeight:500,color:'#1e3a8a',marginBottom:16}}>Revenue Trend</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:8,height:160,padding:'0 8px'}}>
          {weeks.map((v,i)=>(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{width:'100%',background:`hsl(${220-i*7},${55+i*3}%,${65-i*4}%)`,borderRadius:'4px 4px 0 0',height:`${(v/maxW)*140}px`,minHeight:8}}/>
              <span style={{fontSize:9,color:'#6b7280'}}>W{i+1}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
        <div style={card}>
          <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:6}}>Patient Retention</div>
          <div style={{fontSize:20,fontWeight:600,color:'#2563eb',marginBottom:8}}>78% returning in 90 days</div>
          <div style={{height:6,background:'#f3f4f6',borderRadius:3}}><div style={{height:'100%',width:'78%',background:'#3b82f6',borderRadius:3}}/></div>
        </div>
        <div style={card}>
          <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:6}}>Conversion Mix</div>
          <div style={{fontSize:13,color:'#6b7280',marginBottom:10}}>WhatsApp 72% | Call 64% | SMS 55%</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[{l:'WhatsApp',p:72,c:'#3b82f6'},{l:'Call',p:64,c:'#22c55e'},{l:'SMS',p:55,c:'#8b5cf6'}].map(ch=>(
              <div key={ch.l} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:11,color:'#374151',width:64}}>{ch.l}</span>
                <div style={{flex:1,height:6,background:'#f3f4f6',borderRadius:3}}><div style={{height:'100%',width:`${ch.p}%`,background:ch.c,borderRadius:3}}/></div>
                <span style={{fontSize:11,color:ch.c,fontWeight:500,width:32}}>{ch.p}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
        {[{label:'Total Patients',value:clients.length,color:'#1d4ed8',sub:'Active in system'},{label:'Revenue at Risk',value:`AED ${Math.round(totalRisk).toLocaleString()}`,color:'#b91c1c',sub:'Needs follow-up'},{label:'Avg Revenue/Patient',value:`AED ${clients.length?Math.round(totalRisk/clients.length):0}`,color:'#15803d',sub:'Per treatment'}].map(m=>(
          <div key={m.label} style={card}>
            <div style={{fontSize:11,color:'#6b7280',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>{m.label}</div>
            <div style={{fontSize:22,fontWeight:600,color:m.color}}>{m.value}</div>
            <div style={{fontSize:11,color:'#9ca3af',marginTop:4}}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsPage() {
  const [clinicName,setClinicName]=useState('ClinicPulse Downtown')
  const [contact,setContact]=useState('(555) 012-5541')
  const [timezone,setTimezone]=useState('UTC-05:00')
  const [saved,setSaved]=useState(false)
  function save(){setSaved(true);setTimeout(()=>setSaved(false),2000)}
  return (
    <div style={{flex:1,overflowY:'auto',padding:24}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <h1 style={{fontSize:28,fontWeight:700,color:'#111',margin:0}}>Settings</h1>
        <div style={{display:'flex',gap:8}}>
          <input placeholder="Search settings" style={{...inp,width:160,borderRadius:20,fontSize:12,padding:'6px 14px'}}/>
          <select style={{padding:'6px 14px',border:'0.5px solid #d1d5db',borderRadius:20,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>Filter: General</option></select>
        </div>
      </div>
      <div style={{...card,marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:600,color:'#111',marginBottom:14}}>Clinic Details</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
          <div><label style={lbl}>Clinic Name</label><input style={inp} value={clinicName} onChange={e=>setClinicName(e.target.value)}/></div>
          <div><label style={lbl}>Contact</label><input style={inp} value={contact} onChange={e=>setContact(e.target.value)}/></div>
          <div><label style={lbl}>Timezone</label><select style={inp} value={timezone} onChange={e=>setTimezone(e.target.value)}><option>UTC-05:00</option><option>UTC+00:00</option><option>UTC+04:00</option><option>UTC+05:00</option><option>UTC+05:30</option></select></div>
        </div>
        <div style={{marginTop:14}}><button onClick={save} style={{background:saved?'#22c55e':'#2563eb',border:'none',color:'#fff',padding:'8px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}>{saved?'Saved!':'Save Changes'}</button></div>
      </div>
      <div style={card}>
        <div style={{fontSize:14,fontWeight:600,color:'#111',marginBottom:14}}>Notification & Integrations</div>
        {[{label:'Appointment reminders',status:'Enabled',color:'#15803d'},{label:'Daily summary emails',status:'Enabled',color:'#15803d'},{label:'EHR Integration',status:'Connected',color:'#1d4ed8'},{label:'Billing Platform',status:'Not Connected',color:'#d97706'}].map((item,i,arr)=>(
          <div key={item.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 0',borderBottom:i<arr.length-1?'0.5px solid #f3f4f6':'none'}}>
            <span style={{fontSize:13,color:'#374151'}}>{item.label}</span>
            <span style={{fontSize:13,fontWeight:500,color:item.color}}>{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PatientsPage({clients,loading,error,showAdd,setShowAdd,sending,setSending,doing,setDoing,editRow,setEditRow,editV,setEditV,setClients,showToast,selected,setSelected}) {
  const [search,setSearch]=useState('')
  const [fStage,setFStage]=useState('All')
  const [fStatus,setFStatus]=useState('All')
  async function sendReminder(c,e) {
    e.stopPropagation();setSending(c.Client_ID)
    try { await fetch(REMIND_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:c.Client_ID,row_number:c.row_number,name:c.Full_Name,email:c.Email,treatment:c.Treatment_Type})}); showToast(`Reminder sent to ${c.Full_Name}`) }
    catch { showToast('Failed','error') } finally { setSending(null) }
  }
  async function markDone(c,e) {
    e.stopPropagation();setDoing(c.Client_ID)
    try { const ds=new Date().toLocaleDateString('en-GB'); await fetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row_number:c.row_number,field:'Last_Reminder_Sent',value:ds})}); setClients(cs=>cs.map(x=>x.Client_ID===c.Client_ID?{...x,Last_Reminder_Sent:ds}:x)); showToast(`Marked done for ${c.Full_Name}`) }
    catch { showToast('Failed','error') } finally { setDoing(null) }
  }
  async function saveEdit(c,e) {
    e.stopPropagation()
    try { await fetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row_number:c.row_number,...editV})}); setClients(cs=>cs.map(x=>x.Client_ID===c.Client_ID?{...x,...editV}:x)); if(selected?.Client_ID===c.Client_ID) setSelected(s=>({...s,...editV})); showToast('Client updated');setEditRow(null) }
    catch { showToast('Failed','error') }
  }
  const sorted=[...clients].sort((a,b)=>getPriority(b).score-getPriority(a).score)
  const filtered=sorted.filter(c=>{
    const ms=!search||[c.Full_Name,c.Treatment_Type,c.Client_ID].some(v=>v?.toLowerCase().includes(search.toLowerCase()))
    return ms&&(fStage==='All'||c.Reminder_Stage===fStage)&&(fStatus==='All'||c.Status===fStatus)
  })
  return (
    <div style={{flex:1,overflowY:'auto',padding:24}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <h1 style={{fontSize:28,fontWeight:700,color:'#111',margin:0}}>Patients</h1>
        <button onClick={()=>setShowAdd(true)} style={{background:'#2563eb',border:'none',color:'#fff',padding:'8px 18px',borderRadius:20,cursor:'pointer',fontSize:13,fontWeight:500}}>+ Add Patient</button>
      </div>
      <div style={{display:'flex',gap:12,marginBottom:20,alignItems:'flex-end'}}>
        <div style={{flex:1,maxWidth:280}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{...inp,borderRadius:20,paddingLeft:14}}/>
        </div>
        <div><div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>Label Text</div><select value={fStage} onChange={e=>setFStage(e.target.value)} style={{padding:'6px 12px',border:'0.5px solid #d1d5db',borderRadius:20,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option value="All">Select Option</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>Label Text</div><select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{padding:'6px 12px',border:'0.5px solid #d1d5db',borderRadius:20,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option value="All">Select Option</option><option>Active</option><option>Lapsed</option></select></div>
        <div><div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>Label Text</div><select style={{padding:'6px 12px',border:'0.5px solid #d1d5db',borderRadius:20,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>Select Option</option>{TREATMENTS.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <div style={{...card,padding:0,overflow:'hidden'}}>
        {loading?<div style={{padding:40,textAlign:'center',color:'#6b7280'}}>Loading...</div>:error?<div style={{padding:40,textAlign:'center',color:'#ef4444'}}>{error}</div>:(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{borderBottom:'0.5px solid #e5e7eb'}}>{['Patient Name','Treatment','Status','Last Visit','Follow-up','Revenue','Actions'].map(h=><th key={h} style={{fontSize:11,color:'#6b7280',textAlign:'left',padding:'12px 16px',fontWeight:500,background:'#f9fafb'}}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((c,i)=>{
                const pri=getPriority(c);const rev=getRevenue(c);const diff=dayDiff(c.Next_Reminder_Date)
                const stage=STAGE_STYLE[c.Reminder_Stage]||{bg:'#f3f4f6',color:'#374151'}
                const cid=c.Client_ID||`row-${i}`;const isEdit=editRow===cid
                const td={padding:'12px 16px',borderBottom:'0.5px solid #f3f4f6',color:'#111',verticalAlign:'middle'}
                return (
                  <tr key={cid} onClick={()=>{if(!isEdit){setSelected(c===selected?null:c);setEditRow(null)}}} style={{cursor:'pointer',background:selected===c?'#f0f9ff':'#fff'}}>
                    <td style={td}><div style={{fontWeight:500}}>{c.Full_Name}</div><div style={{fontSize:11,color:'#9ca3af'}}>{c.Client_ID}</div></td>
                    <td style={{...td,fontSize:12,color:'#6b7280'}}>{c.Treatment_Type}</td>
                    <td style={td}><span style={{background:stage.bg,color:stage.color,padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:500}}>{c.Reminder_Stage}</span></td>
                    <td style={{...td,fontSize:12,color:'#6b7280'}}>{c.Treatment_Date||'—'}</td>
                    <td style={td}>
                      {isEdit?<input type="date" value={editV.Next_Reminder_Date?editV.Next_Reminder_Date.split('/').reverse().join('-'):''} onClick={e=>e.stopPropagation()} onChange={e=>{const p=e.target.value.split('-');setEditV(v=>({...v,Next_Reminder_Date:`${p[2]}/${p[1]}/${p[0]}`}))}} style={{...inp,fontSize:11,padding:'3px 6px'}}/>
                      :<div style={{fontSize:11,color:diff!==null&&diff<0?'#ef4444':diff===0?'#22c55e':'#6b7280',fontWeight:diff!==null&&diff<=0?600:400}}>{diff===null?'Not set':diff===0?'Today':diff<0?`${Math.abs(diff)}d overdue`:`In ${diff}d`}{c.Next_Reminder_Date&&<div style={{fontSize:10,color:'#9ca3af'}}>{c.Next_Reminder_Date}</div>}</div>}
                    </td>
                    <td style={{...td,fontWeight:500}}>AED {rev.toLocaleString()}</td>
                    <td style={td}>
                      {isEdit?<div style={{display:'flex',gap:4}}><button onClick={e=>saveEdit(c,e)} style={{fontSize:11,padding:'4px 10px',border:'none',borderRadius:6,background:'#dcfce7',color:'#15803d',cursor:'pointer'}}>Save</button><button onClick={e=>{e.stopPropagation();setEditRow(null)}} style={{fontSize:11,padding:'4px 8px',border:'0.5px solid #d1d5db',borderRadius:6,background:'#fff',color:'#6b7280',cursor:'pointer'}}>×</button></div>
                      :<div style={{display:'flex',gap:4}}>
                        <button onClick={e=>sendReminder(c,e)} disabled={sending===c.Client_ID} style={{fontSize:11,padding:'4px 10px',border:'none',borderRadius:6,background:'#eff6ff',color:'#1d4ed8',cursor:'pointer',opacity:sending===c.Client_ID?0.5:1}}>{sending===c.Client_ID?'...':'+ WA'}</button>
                        <button onClick={e=>markDone(c,e)} disabled={doing===c.Client_ID} style={{fontSize:11,padding:'4px 8px',border:'none',borderRadius:6,background:'#f0fdf4',color:'#15803d',cursor:'pointer',opacity:doing===c.Client_ID?0.5:1}}>{doing===c.Client_ID?'...':'✓'}</button>
                        <button onClick={e=>{e.stopPropagation();setEditRow(isEdit?null:cid);setEditV({Reminder_Stage:c.Reminder_Stage,Next_Reminder_Date:c.Next_Reminder_Date||''})}} style={{fontSize:11,padding:'4px 8px',border:'0.5px solid #d1d5db',borderRadius:6,background:'#fff',color:'#6b7280',cursor:'pointer'}}>✎</button>
                      </div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {selected&&(
        <div style={{position:'fixed',right:0,top:0,bottom:0,width:280,background:'#fff',borderLeft:'0.5px solid #e5e7eb',padding:20,overflowY:'auto',zIndex:100,boxShadow:'-4px 0 12px rgba(0,0,0,0.05)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div style={{fontSize:15,fontWeight:600,color:'#111'}}>{selected.Full_Name}</div><button onClick={()=>setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#6b7280',fontSize:20}}>×</button></div>
          {[['Client ID',selected.Client_ID],['Treatment',selected.Treatment_Type],['WhatsApp',selected.WhatsApp_Number],['Email',selected.Email||'—'],['Status',selected.Status]].map(([k,v])=>(
            <div key={k} style={{marginBottom:12}}><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>{k}</div><div style={{fontSize:13,color:'#111'}}>{v}</div></div>
          ))}
          <div style={{marginBottom:12}}><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>Stage</div><select value={editV.Reminder_Stage||selected.Reminder_Stage} onChange={e=>{setEditV(v=>({...v,Reminder_Stage:e.target.value}));setEditRow(selected.Client_ID)}} style={{...inp,fontSize:12}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div style={{marginBottom:16}}><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>Next Follow-up</div><input type="date" value={editV.Next_Reminder_Date?editV.Next_Reminder_Date.split('/').reverse().join('-'):selected.Next_Reminder_Date?selected.Next_Reminder_Date.split('/').reverse().join('-'):''} onChange={e=>{const p=e.target.value.split('-');setEditV(v=>({...v,Next_Reminder_Date:`${p[2]}/${p[1]}/${p[0]}`}));setEditRow(selected.Client_ID)}} style={{...inp,fontSize:12}}/></div>
          {editRow===selected.Client_ID&&<button onClick={e=>saveEdit(selected,e)} style={{width:'100%',background:'#2563eb',border:'none',color:'#fff',padding:'8px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500,marginBottom:12}}>Save Changes</button>}
          <div><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>AI Recommendation</div><div style={{fontSize:12,color:'#374151',padding:'8px 10px',background:'#f0fdf4',borderRadius:6,border:'0.5px solid #bbf7d0'}}>{getAIMove(selected)}</div></div>
        </div>
      )}
      {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={c=>{const nc={Client_ID:`CLT-${crypto.randomUUID().slice(0,8)}`,...c,Status:'Active',Last_Reminder_Sent:'',Next_Reminder_Date:'',row_number:Date.now()+Math.random()};setClients(cs=>[...cs,nc]);showToast(`${c.Full_Name} added`);setTimeout(()=>setShowAdd(false),500)}}/>}
    </div>
  )
}

export default function Dashboard() {
  const [clients,setClients]     = useState([])
  const [loading,setLoading]     = useState(true)
  const [error,setError]         = useState(null)
  const [showAdd,setShowAdd]     = useState(false)
  const [toast,setToast]         = useState(null)
  const [sending,setSending]     = useState(null)
  const [doing,setDoing]         = useState(null)
  const [editRow,setEditRow]     = useState(null)
  const [editV,setEditV]         = useState({})
  const [activeNav,setActiveNav] = useState('Dashboard')
  const [selected,setSelected]   = useState(null)

  useEffect(()=>{
    fetch(WEBHOOK_URL).then(r=>r.json()).then(d=>{setClients(Array.isArray(d)?d:[]);setLoading(false)}).catch(e=>{setError(e.message);setLoading(false)})
  },[])

  function showToast(msg,type='success'){setToast({msg,type})}

  async function sendReminder(c,e) {
    e.stopPropagation();setSending(c.Client_ID)
    try { await fetch(REMIND_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:c.Client_ID,row_number:c.row_number,name:c.Full_Name,email:c.Email,treatment:c.Treatment_Type})}); showToast(`Reminder sent to ${c.Full_Name}`) }
    catch { showToast('Failed','error') } finally { setSending(null) }
  }
  async function markDone(c,e) {
    e.stopPropagation();setDoing(c.Client_ID)
    try { const ds=new Date().toLocaleDateString('en-GB'); await fetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row_number:c.row_number,field:'Last_Reminder_Sent',value:ds})}); setClients(cs=>cs.map(x=>x.Client_ID===c.Client_ID?{...x,Last_Reminder_Sent:ds}:x)); showToast(`Marked done for ${c.Full_Name}`) }
    catch { showToast('Failed','error') } finally { setDoing(null) }
  }
  async function saveEdit(c,e) {
    e.stopPropagation()
    try { await fetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row_number:c.row_number,...editV})}); setClients(cs=>cs.map(x=>x.Client_ID===c.Client_ID?{...x,...editV}:x)); if(selected?.Client_ID===c.Client_ID) setSelected(s=>({...s,...editV})); showToast('Client updated');setEditRow(null) }
    catch { showToast('Failed','error') }
  }
  function handleAdd(form) {
    const nc={Client_ID:`CLT-${crypto.randomUUID().slice(0,8)}`,...form,Status:'Active',Last_Reminder_Sent:'',Next_Reminder_Date:'',row_number:Date.now()+Math.random()}
    setClients(cs=>[...cs,nc]);showToast(`${form.Full_Name} added`);setTimeout(()=>setShowAdd(false),500)
  }

  const sorted=[...clients].sort((a,b)=>getPriority(b).score-getPriority(a).score)
  const totalRisk=clients.reduce((s,c)=>s+getRevenue(c),0)
  const recovered=clients.filter(c=>c.Last_Reminder_Sent).reduce((s,c)=>s+getRevenue(c)*0.3,0)
  const lost=clients.filter(c=>c.Status==='Lapsed').reduce((s,c)=>s+getRevenue(c)*0.5,0)
  const actionQueue=clients.filter(c=>{const d=dayDiff(c.Next_Reminder_Date);return(d!==null&&d<=0)||c.Status==='Lapsed'}).length
  const topClient=sorted[0]
  const navItems=['Dashboard','Patients','Appointments','Analytics','Settings']

  function DashboardPage() {
    const [search,setSearch]=useState('')
    const [fStage,setFStage]=useState('All')
    const [fStatus,setFStatus]=useState('All')
    const filtered=sorted.filter(c=>{
      const ms=!search||[c.Full_Name,c.Treatment_Type,c.Client_ID].some(v=>v?.toLowerCase().includes(search.toLowerCase()))
      return ms&&(fStage==='All'||c.Reminder_Stage===fStage)&&(fStatus==='All'||c.Status===fStatus)
    })
    return (
      <div style={{flex:1,overflowY:'auto',padding:24}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <div style={{fontSize:24,fontWeight:700,color:'#111'}}>Clinic Command Center</div>
            <div style={{fontSize:13,color:'#6b7280',marginTop:3}}>AI-powered revenue recovery, follow-ups, and appointment intelligence</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <select style={{padding:'6px 10px',border:'0.5px solid #d1d5db',borderRadius:8,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>All Clinics</option></select>
            <select style={{padding:'6px 10px',border:'0.5px solid #d1d5db',borderRadius:8,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>Last 30 days</option><option>Last 12 weeks</option></select>
            <select style={{padding:'6px 10px',border:'0.5px solid #d1d5db',borderRadius:8,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>All Treatments</option>{TREATMENTS.map(t=><option key={t}>{t}</option>)}</select>
            <button onClick={()=>setShowAdd(true)} style={{background:'#2563eb',border:'none',color:'#fff',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}>+ Add Client</button>
          </div>
        </div>
        {topClient&&<div style={{background:'#fffbeb',border:'0.5px solid #fcd34d',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:13,color:'#92400e'}}> ⚡ Priority: <strong>{topClient.Full_Name}</strong> is {getPriority(topClient).sub}. Send reminder now to recover <strong>AED {getRevenue(topClient).toLocaleString()}</strong> today.</div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
          {[{label:'Revenue at Risk',value:`AED ${Math.round(totalRisk).toLocaleString()}`,color:'#1d4ed8',bars:['#bfdbfe','#93c5fd','#3b82f6','#1d4ed8','#1e3a8a']},{label:'Recovered Revenue',value:`AED ${Math.round(recovered).toLocaleString()}`,color:'#15803d',bars:['#bbf7d0','#86efac','#22c55e','#15803d','#14532d']},{label:'Lost Revenue',value:`AED ${Math.round(lost).toLocaleString()}`,color:'#b91c1c',bars:['#fecaca','#fca5a5','#ef4444','#b91c1c','#7f1d1d']},{label:'Action Queue',value:actionQueue,color:'#1d4ed8',bars:['#bfdbfe','#93c5fd','#3b82f6','#1d4ed8','#1e3a8a']}].map(m=>(
            <div key={m.label} style={{background:'#fff',border:'0.5px solid #e5e7eb',borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:11,color:'#6b7280',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>{m.label}</div>
              <div style={{fontSize:22,fontWeight:600,color:m.color}}>{m.value}</div>
              <div style={{display:'flex',gap:2,marginTop:8,height:4}}>{m.bars.map((b,i)=><span key={i} style={{flex:1,background:b,borderRadius:2}}/>)}</div>
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:12,marginBottom:20}}>
          <div style={card}>
            <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:3}}>Revenue Trend</div>
            <div style={{fontSize:11,color:'#6b7280',marginBottom:14}}>Last 12 weeks</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:4,height:120}}>
              {[18,21,19,24,28,25,31,35,38,42,47,52].map((v,i)=>(
                <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <div style={{width:'100%',background:`hsl(${220-i*7},${55+i*3}%,${65-i*4}%)`,borderRadius:'3px 3px 0 0',height:`${(v/52)*100}%`,minHeight:4}}/>
                  <span style={{fontSize:9,color:'#9ca3af'}}>W{i+1}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={card}>
            <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:3}}>Follow-up Conversions</div>
            <div style={{fontSize:11,color:'#6b7280',marginBottom:14}}>Success rate by channel</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[{label:'WhatsApp',pct:72,color:'#3b82f6'},{label:'Call',pct:64,color:'#22c55e'},{label:'SMS',pct:55,color:'#8b5cf6'},{label:'Email',pct:39,color:'#6b7280'}].map(ch=>(
                <div key={ch.label}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}><span style={{color:'#374151'}}>{ch.label}</span><span style={{color:ch.color,fontWeight:500}}>{ch.pct}%</span></div>
                  <div style={{height:6,background:'#f3f4f6',borderRadius:3}}><div style={{height:'100%',width:`${ch.pct}%`,background:ch.color,borderRadius:3}}/></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{fontSize:15,fontWeight:500,color:'#111',marginBottom:14}}>Patient Journey Insights</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
          <div style={card}>
            <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:12}}>Patient Funnel</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {[{label:'Lead',count:clients.length,pct:100,color:'#bfdbfe',tc:'#1e3a8a'},{label:'Appointment',count:Math.round(clients.length*0.82),pct:82,color:'#3b82f6',tc:'#fff'},{label:'Visit',count:Math.round(clients.length*0.65),pct:65,color:'#1d4ed8',tc:'#fff'},{label:'Revenue',count:`AED ${Math.round(totalRisk*0.4).toLocaleString()}`,pct:40,color:'#1e3a8a',tc:'#fff'}].map(f=>(
                <div key={f.label} style={{position:'relative',height:28,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
                  <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${f.pct}%`,background:f.color,borderRadius:4,display:'flex',alignItems:'center',paddingLeft:10}}>
                    <span style={{fontSize:12,fontWeight:500,color:f.tc,whiteSpace:'nowrap'}}>{f.label}</span>
                  </div>
                  <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'#6b7280'}}>{f.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={card}>
            <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:12}}>Patient Segmentation</div>
            <div style={{display:'flex',alignItems:'center',gap:16}}>
              <div style={{flex:1}}>
                {[{label:'New Patients',pct:42,color:'#22c55e'},{label:'Returning',pct:46,color:'#3b82f6'},{label:'Lost',pct:12,color:'#ef4444'}].map(s=>(
                  <div key={s.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,fontSize:13}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0,display:'inline-block'}}/>
                    <span style={{color:s.color,fontWeight:500}}>{s.label} {s.pct}%</span>
                  </div>
                ))}
              </div>
              <div style={{position:'relative',width:90,height:90,flexShrink:0}}>
                <svg viewBox="0 0 36 36" style={{width:90,height:90,transform:'rotate(-90deg)'}}>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f3f4f6" strokeWidth="4"/>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="46 88" strokeDashoffset="0"/>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#22c55e" strokeWidth="4" strokeDasharray="42 88" strokeDashoffset="-46"/>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#ef4444" strokeWidth="4" strokeDasharray="12 88" strokeDashoffset="-88"/>
                </svg>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:15,fontWeight:600,color:'#111'}}>{clients.length}</span>
                  <span style={{fontSize:9,color:'#6b7280'}}>Patients</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={card}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div style={{fontSize:15,fontWeight:500,color:'#111'}}>Prioritized Patients</div>
            <div style={{display:'flex',gap:8}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{padding:'6px 10px',border:'0.5px solid #d1d5db',borderRadius:8,background:'#fff',color:'#374151',fontSize:12,outline:'none',width:160}}/>
              <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{padding:'6px 10px',border:'0.5px solid #d1d5db',borderRadius:8,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>All</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
              <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{padding:'6px 10px',border:'0.5px solid #d1d5db',borderRadius:8,background:'#fff',color:'#374151',fontSize:12,outline:'none'}}><option>All</option><option>Active</option><option>Lapsed</option></select>
            </div>
          </div>
          {loading?<div style={{padding:40,textAlign:'center',color:'#6b7280'}}>Loading...</div>:error?<div style={{padding:40,textAlign:'center',color:'#ef4444'}}>{error}</div>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr>{['Patient','Priority','Next Action','Stage','Follow-up','Revenue','Quick Actions'].map(h=><th key={h} style={{fontSize:11,color:'#6b7280',textAlign:'left',padding:'6px 10px',borderBottom:'0.5px solid #e5e7eb',fontWeight:400}}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((c,i)=>{
                  const pri=getPriority(c);const rev=getRevenue(c);const diff=dayDiff(c.Next_Reminder_Date)
                  const stage=STAGE_STYLE[c.Reminder_Stage]||{bg:'#f3f4f6',color:'#374151'}
                  const cid=c.Client_ID||`row-${i}`;const isEdit=editRow===cid
                  const td={padding:'10px 10px',borderBottom:'0.5px solid #e5e7eb',color:'#111',verticalAlign:'middle'}
                  return (
                    <tr key={cid} onClick={()=>{if(!isEdit){setSelected(c===selected?null:c);setEditRow(null)}}} style={{cursor:'pointer',background:selected===c?'#f0f9ff':'#fff'}}>
                      <td style={td}><div style={{fontWeight:500}}>{c.Full_Name}</div><div style={{fontSize:10,color:'#9ca3af'}}>· {c.Client_ID}</div></td>
                      <td style={td}><div style={{fontSize:11,fontWeight:700,color:pri.color}}>{pri.label}</div><div style={{fontSize:10,color:'#9ca3af'}}>{pri.sub}</div></td>
                      <td style={{...td,fontSize:12,color:'#6b7280',maxWidth:180}}>{getAIMove(c)}</td>
                      <td style={td}>{isEdit?<select value={editV.Reminder_Stage} onClick={e=>e.stopPropagation()} onChange={e=>setEditV(v=>({...v,Reminder_Stage:e.target.value}))} style={{background:'#f9fafb',border:'0.5px solid #d1d5db',borderRadius:4,color:'#111',fontSize:11,padding:'3px 5px',outline:'none'}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>:<span style={{background:stage.bg,color:stage.color,padding:'3px 8px',borderRadius:4,fontSize:10,fontWeight:500,whiteSpace:'nowrap'}}>{c.Reminder_Stage}</span>}</td>
                      <td style={td}>{isEdit?<input type="date" value={editV.Next_Reminder_Date?editV.Next_Reminder_Date.split('/').reverse().join('-'):''} onClick={e=>e.stopPropagation()} onChange={e=>{const p=e.target.value.split('-');setEditV(v=>({...v,Next_Reminder_Date:`${p[2]}/${p[1]}/${p[0]}`}))}} style={{background:'#f9fafb',border:'0.5px solid #d1d5db',borderRadius:4,color:'#111',fontSize:11,padding:'3px 5px',outline:'none'}}/>:<div><div style={{fontSize:11,color:diff!==null&&diff<0?'#ef4444':diff===0?'#22c55e':'#6b7280',fontWeight:diff!==null&&diff<=0?600:400}}>{diff===null?'Not set':diff===0?'Today':diff<0?`Overdue · ${Math.abs(diff)}d`:`In ${diff}d`}</div>{c.Next_Reminder_Date&&<div style={{fontSize:10,color:'#9ca3af'}}>{c.Next_Reminder_Date}</div>}</div>}</td>
                      <td style={{...td,fontWeight:500}}>AED {rev.toLocaleString()}</td>
                      <td style={td}>{isEdit?<div style={{display:'flex',gap:4}}><button onClick={e=>saveEdit(c,e)} style={{fontSize:11,padding:'4px 8px',border:'none',borderRadius:6,background:'#dcfce7',color:'#15803d',cursor:'pointer'}}>Save</button><button onClick={e=>{e.stopPropagation();setEditRow(null)}} style={{fontSize:11,padding:'4px 8px',border:'0.5px solid #d1d5db',borderRadius:6,background:'#fff',color:'#6b7280',cursor:'pointer'}}>×</button></div>:<div style={{display:'flex',gap:4}}><button onClick={e=>sendReminder(c,e)} disabled={sending===c.Client_ID} style={{fontSize:11,padding:'4px 8px',border:'none',borderRadius:6,background:'#eff6ff',color:'#1d4ed8',cursor:'pointer',opacity:sending===c.Client_ID?0.5:1}}>{sending===c.Client_ID?'...':'+ WA'}</button><button onClick={e=>markDone(c,e)} disabled={doing===c.Client_ID} style={{fontSize:11,padding:'4px 8px',border:'none',borderRadius:6,background:'#f0fdf4',color:'#15803d',cursor:'pointer',opacity:doing===c.Client_ID?0.5:1}}>{doing===c.Client_ID?'...':'✓'}</button><button onClick={e=>{e.stopPropagation();setEditRow(isEdit?null:cid);setEditV({Reminder_Stage:c.Reminder_Stage,Next_Reminder_Date:c.Next_Reminder_Date||''})}} style={{fontSize:11,padding:'4px 8px',border:'0.5px solid #d1d5db',borderRadius:6,background:'#fff',color:'#6b7280',cursor:'pointer'}}>✎</button><button onClick={e=>{e.stopPropagation();setSelected(c===selected?null:c)}} style={{fontSize:11,padding:'4px 8px',border:'0.5px solid #d1d5db',borderRadius:6,background:'#fff',color:'#6b7280',cursor:'pointer'}}>→</button></div>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div style={{padding:'8px 10px',borderTop:'0.5px solid #e5e7eb',fontSize:11,color:'#9ca3af',display:'flex',justifyContent:'space-between',marginTop:4}}><span>Top-priority actions are ranked by risk score and projected revenue.</span><span>{filtered.length} clients</span></div>
        </div>
        {selected&&(
          <div style={{position:'fixed',right:0,top:0,bottom:0,width:280,background:'#fff',borderLeft:'0.5px solid #e5e7eb',padding:20,overflowY:'auto',zIndex:100,boxShadow:'-4px 0 12px rgba(0,0,0,0.05)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div style={{fontSize:15,fontWeight:600,color:'#111'}}>{selected.Full_Name}</div><button onClick={()=>setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#6b7280',fontSize:20}}>×</button></div>
            {[['Client ID',selected.Client_ID],['Treatment',selected.Treatment_Type],['WhatsApp',selected.WhatsApp_Number],['Email',selected.Email||'—'],['Status',selected.Status]].map(([k,v])=>(<div key={k} style={{marginBottom:12}}><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>{k}</div><div style={{fontSize:13,color:'#111'}}>{v}</div></div>))}
            <div style={{marginBottom:12}}><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>Stage</div><select value={editV.Reminder_Stage||selected.Reminder_Stage} onChange={e=>{setEditV(v=>({...v,Reminder_Stage:e.target.value}));setEditRow(selected.Client_ID)}} style={{...inp,fontSize:12}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
            <div style={{marginBottom:16}}><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>Next Follow-up</div><input type="date" value={editV.Next_Reminder_Date?editV.Next_Reminder_Date.split('/').reverse().join('-'):selected.Next_Reminder_Date?selected.Next_Reminder_Date.split('/').reverse().join('-'):''} onChange={e=>{const p=e.target.value.split('-');setEditV(v=>({...v,Next_Reminder_Date:`${p[2]}/${p[1]}/${p[0]}`}));setEditRow(selected.Client_ID)}} style={{...inp,fontSize:12}}/></div>
            {editRow===selected.Client_ID&&<button onClick={e=>saveEdit(selected,e)} style={{width:'100%',background:'#2563eb',border:'none',color:'#fff',padding:'8px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500,marginBottom:12}}>Save Changes</button>}
            <div><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>AI Recommendation</div><div style={{fontSize:12,color:'#374151',padding:'8px 10px',background:'#f0fdf4',borderRadius:6,border:'0.5px solid #bbf7d0'}}>{getAIMove(selected)}</div></div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f5f6f7',fontFamily:'system-ui,sans-serif'}}>
      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      <div style={{width:160,flexShrink:0,background:'#fff',borderRight:'0.5px solid #e5e7eb',padding:'20px 0',display:'flex',flexDirection:'column'}}>
        <div style={{fontSize:15,fontWeight:700,color:'#111',padding:'0 16px 16px',borderBottom:'0.5px solid #e5e7eb',marginBottom:12}}>ClinicPulse</div>
        {navItems.map(n=>(
          <div key={n} onClick={()=>{setActiveNav(n);setSelected(null)}} style={{padding:'8px 16px',fontSize:13,cursor:'pointer',color:activeNav===n?'#1d4ed8':'#6b7280',background:activeNav===n?'#eff6ff':'transparent',borderRight:activeNav===n?'2px solid #3b82f6':'2px solid transparent',fontWeight:activeNav===n?500:400}}>{n}</div>
        ))}
      </div>
      {activeNav==='Dashboard'&&<DashboardPage/>}
      {activeNav==='Patients'&&<PatientsPage clients={clients} loading={loading} error={error} showAdd={showAdd} setShowAdd={setShowAdd} sending={sending} setSending={setSending} doing={doing} setDoing={setDoing} editRow={editRow} setEditRow={setEditRow} editV={editV} setEditV={setEditV} setClients={setClients} showToast={showToast} selected={selected} setSelected={setSelected}/>}
      {activeNav==='Appointments'&&<AppointmentsPage/>}
      {activeNav==='Analytics'&&<AnalyticsPage clients={clients}/>}
      {activeNav==='Settings'&&<SettingsPage/>}
      {activeNav==='Dashboard'&&showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={handleAdd}/>}
    </div>
  )
}
