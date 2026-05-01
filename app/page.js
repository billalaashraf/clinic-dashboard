'use client'
import { useState, useEffect } from 'react'

const WEBHOOK_URL = '/api/clients'
const UPDATE_URL  = '/api/update-client'
const REMIND_URL  = '/api/send-reminder'
const ADD_URL     = '/api/add-client'

// ─── design tokens ───────────────────────────────────────────────────────────
// Theme-sensitive tokens reference CSS custom properties so dark mode works
// by toggling data-theme="dark" on the root element.
const C = {
  // semantic accent colors — unchanged in both themes
  blue:'#2563eb', blueSoft:'#dbeafe', blueDark:'#1d4ed8',
  green:'#16a34a', greenSoft:'#dcfce7',
  red:'#dc2626', redSoft:'#fee2e2',
  amber:'#d97706', amberSoft:'#fef3c7',
  teal:'#0891b2', tealSoft:'#cffafe',
  orange:'#ea580c', orangeSoft:'#ffedd5',
  purple:'#7c3aed', purpleSoft:'#ede9fe',
  // theme-aware surface/text/border tokens
  bg:     'var(--c-bg)',
  white:  'var(--c-white)',
  body:   'var(--c-body)',
  label:  'var(--c-label)',
  muted:  'var(--c-muted)',
  border: 'var(--c-border)',
  inputBg:'var(--c-input-bg)',
  subtle: 'var(--c-subtle)',      // var(--c-subtle) equivalent
  unread: 'var(--c-unread-bg)',   // unread notification rows
}
const THEME_CSS = `
  :root,[data-theme="light"]{
    --c-bg:#f0f2f7;--c-white:#ffffff;--c-body:#111827;--c-label:#374151;
    --c-muted:#6b7280;--c-border:#e5e7eb;--c-input-bg:#f9fafb;
    --c-subtle:#f3f4f6;--c-unread-bg:#fafbff;
  }
  [data-theme="dark"]{
    --c-bg:#0d0f17;--c-white:#161925;--c-body:#f1f5f9;--c-label:#cbd5e1;
    --c-muted:#94a3b8;--c-border:#2a3044;--c-input-bg:#1e2235;
    --c-subtle:#1e2235;--c-unread-bg:#1a1e30;
  }
  [data-theme="dark"] *{color-scheme:dark}
  *{transition:background-color 200ms ease,border-color 200ms ease,color 200ms ease}
`
const card = { background:C.white, border:`1px solid ${C.border}`, borderRadius:14, boxShadow:'0 1px 4px rgba(0,0,0,0.045)' }
const inp  = { width:'100%', padding:'10px 12px', background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:8, color:C.body, fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }
const lbl  = { fontSize:12, color:C.muted, marginBottom:4, display:'block', fontWeight:500 }
const pill = (bg,color) => ({ background:bg, color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap', display:'inline-block' })
const btn  = (variant='solid') => variant==='solid'
  ? { background:C.blue, border:'none', color:'#fff', padding:'9px 18px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit', transition:'background 150ms' }
  : { background:C.white, border:`1px solid ${C.border}`, color:C.label, padding:'9px 16px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit' }

// ─── helpers (unchanged logic) ────────────────────────────────────────────────
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
  if (c.Status === 'Lapsed') return { score:95, label:'CRITICAL', sub:'Lapsed', color:C.red }
  const diff = dayDiff(c.Next_Reminder_Date)
  if (diff === null) return { score:10, label:'LOW', sub:'No date', color:C.muted }
  if (diff < -2) return { score:90+Math.min(Math.abs(diff),9), label:'CRITICAL', sub:`${Math.abs(diff)}d overdue`, color:C.red }
  if (diff < 0)  return { score:75, label:'HIGH', sub:`${Math.abs(diff)}d overdue`, color:C.orange }
  if (diff === 0) return { score:70, label:'DUE TODAY', sub:'Act now', color:C.amber }
  if (diff <= 3)  return { score:50, label:'HIGH', sub:`In ${diff}d`, color:C.blue }
  return { score:20, label:'MED', sub:`In ${diff}d`, color:C.muted }
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
  'Aftercare':    {bg:C.greenSoft,  color:C.green},
  'Results Check':{bg:C.blueSoft,   color:C.blueDark},
  'Next Session': {bg:'#fef9c3',    color:'#854d0e'},
  'Rebooking':    {bg:'#f0fdf4',    color:'#166534'},
  'Win-back':     {bg:C.purpleSoft, color:C.purple},
  'Lapsed':       {bg:C.redSoft,    color:C.red},
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({msg, type, onDone}) {
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t)},[])
  const ok = type !== 'error'
  return (
    <div style={{position:'fixed',top:20,right:20,zIndex:2000,background:ok?C.greenSoft:C.redSoft,border:`1px solid ${ok?'#86efac':'#fca5a5'}`,color:ok?C.green:C.red,padding:'12px 20px',borderRadius:10,fontSize:13,fontWeight:600,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',display:'flex',alignItems:'center',gap:8}}>
      <span>{ok?'✓':'✗'}</span> {msg}
    </div>
  )
}

// ─── Logout Modal ─────────────────────────────────────────────────────────────
function LogoutModal({onConfirm, onCancel}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,20,30,0.45)',backdropFilter:'blur(4px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)onCancel()}}>
      <div style={{...card,width:360,padding:'32px 28px',textAlign:'center'}}>
        <div style={{width:48,height:48,borderRadius:14,background:C.redSoft,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:22}}>🚪</div>
        <div style={{fontSize:18,fontWeight:700,color:C.body,marginBottom:8}}>Sign out?</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:24}}>You'll be returned to the login screen.</div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onCancel} style={{...btn('outline'),flex:1}}>Cancel</button>
          <button onClick={onConfirm} style={{...btn(),flex:1,background:C.red}}>Sign out</button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Patient Modal ────────────────────────────────────────────────────────
function AddModal({onClose, onAdd}) {
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
    try {
      const res  = await fetch(ADD_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)})
      const data = await res.json().catch(()=>({}))
      console.log('[AddModal] response', res.status, data)
      if (!res.ok) throw new Error(data.error || data.detail || `Server error ${res.status}`)
      onAdd(f, data.row_number ?? null)
    }
    catch(e) { console.error('[AddModal] failed:', e); setErr(e.message||'Failed to add client.') }
    finally { setSaving(false) }
  }
  const sect = {fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${C.border}`,fontWeight:600}
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,20,30,0.45)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{...card,width:'100%',maxWidth:480,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 24px 60px rgba(0,0,0,0.18)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:`1px solid ${C.border}`}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.body}}>Add Patient</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>Fill in details to add to follow-up system</div>
          </div>
          <button onClick={onClose} style={{background:'var(--c-subtle)',border:'none',borderRadius:8,color:C.muted,cursor:'pointer',fontSize:18,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        <div style={{padding:24}}>
          <div style={sect}>Client Information</div>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
            <div><label style={lbl}>Full Name *</label><input style={inp} value={f.Full_Name} onChange={e=>set('Full_Name',e.target.value)} placeholder="e.g. Sara Ahmed"/></div>
            <div><label style={lbl}>WhatsApp Number *</label><input style={inp} value={f.WhatsApp_Number} onChange={e=>set('WhatsApp_Number',e.target.value)} placeholder="+923001234567"/></div>
            <div><label style={lbl}>Email *</label><input style={inp} type="email" value={f.Email} onChange={e=>set('Email',e.target.value)} placeholder="client@example.com"/></div>
          </div>
          <div style={sect}>Treatment Details</div>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
            <div><label style={lbl}>Treatment Type *</label>
              <select style={inp} value={f.Treatment_Type} onChange={e=>set('Treatment_Type',e.target.value)}>{TREATMENTS.map(t=><option key={t}>{t}</option>)}</select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={lbl}>Treatment Date *</label><input style={inp} type="date" value={f.Treatment_Date} onChange={e=>set('Treatment_Date',e.target.value)}/></div>
              <div><label style={lbl}>Session Number</label><input style={inp} type="number" min="1" value={f.Session_Number} onChange={e=>set('Session_Number',e.target.value)}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={lbl}>Total Sessions Planned</label><input style={inp} type="number" value={f.Total_Sessions_Planned} onChange={e=>set('Total_Sessions_Planned',e.target.value)} placeholder="Blank if one-off"/></div>
              <div><label style={lbl}>Initial Stage</label>
                <select style={inp} value={f.Reminder_Stage} onChange={e=>set('Reminder_Stage',e.target.value)}>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
              </div>
            </div>
          </div>
          <div style={sect}>Additional</div>
          <div style={{marginBottom:16}}>
            <label style={lbl}>Notes <span style={{color:'#9ca3af'}}>(optional)</span></label>
            <textarea style={{...inp,resize:'vertical',minHeight:72}} value={f.Notes} onChange={e=>set('Notes',e.target.value)} placeholder="Any relevant notes..."/>
          </div>
          {err&&<div style={{background:C.redSoft,border:`1px solid #fca5a5`,borderRadius:8,padding:'8px 12px',marginBottom:14,fontSize:12,color:C.red}}>{err}</div>}
          <div style={{display:'flex',gap:10}}>
            <button onClick={onClose} style={{...btn('outline'),flex:1}}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{...btn(),flex:2,opacity:saving?0.7:1}}>{saving?'Adding...':'+ Add Patient'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {id:'Dashboard'},
  {id:'Patients', badge:3},
  {id:'Appointments'},
  {id:'Analytics'},
  {id:'Settings'},
]

function Sidebar({active, onNav, onSignOut}) {
  return (
    <div style={{width:220,flexShrink:0,background:C.white,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',height:'100vh',position:'sticky',top:0,alignSelf:'flex-start'}}>
      <div style={{padding:'20px 20px 16px'}}>
        <div style={{fontSize:18,fontWeight:800,color:C.blueDark,letterSpacing:'-0.4px'}}>ClinicPulse 2.0</div>
        <div style={{fontSize:10,color:C.muted,fontWeight:500,marginTop:2}}>Command Center</div>
      </div>
      <div style={{borderTop:`1px solid ${C.border}`,padding:'10px 10px',flex:1}}>
        {NAV_ITEMS.map(n=>{
          const isActive = active === n.id
          return (
            <div key={n.id} onClick={()=>onNav(n.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:9,cursor:'pointer',marginBottom:2,background:isActive?C.blueSoft:'transparent',color:isActive?C.blue:C.label,fontWeight:isActive?600:400,fontSize:13,transition:'background 120ms',position:'relative'}}>
              <span>{n.id}</span>
              {n.badge&&!isActive&&<span style={{...pill(C.redSoft,C.red),padding:'1px 7px',fontSize:10,marginLeft:'auto'}}>{n.badge}</span>}
            </div>
          )
        })}
      </div>
      <div style={{borderTop:`1px solid ${C.border}`,padding:'14px 10px'}}>
        <div onClick={()=>onNav('Profile')} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',marginBottom:4,borderRadius:9,cursor:'pointer',background:active==='Profile'?C.blueSoft:'transparent',transition:'background 120ms'}}>
          <div style={{width:32,height:32,borderRadius:10,background:C.blueSoft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:C.blueDark,flexShrink:0}}>Dr</div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:active==='Profile'?C.blue:C.body}}>Dr. Admin</div>
            <div style={{fontSize:10,color:C.muted}}>Clinic Manager</div>
          </div>
        </div>
        <button onClick={onSignOut} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:9,cursor:'pointer',background:'none',border:'none',color:C.red,fontSize:13,fontWeight:500,width:'100%',transition:'background 120ms',fontFamily:'inherit'}}>
          <span>↪</span> Sign out
        </button>
      </div>
    </div>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
const SAMPLE_NOTIFS = [
  {id:1, type:'reminder',     title:'Sara Ahmed — reminder sent',             body:'WhatsApp reminder delivered successfully. Botox follow-up.',   time:'4m ago',   unread:true},
  {id:2, type:'critical',     title:'3 clients lapsed today',                 body:'Aarav Mehta, Priya Nair, Carlos Vega marked as Lapsed.',       time:'9m ago',   unread:true},
  {id:3, type:'revenue',      title:'Ravi Sharma rebooked — AED 5,300',       body:'Confirmed via WhatsApp after win-back reminder.',              time:'1h ago',   unread:true},
  {id:4, type:'appointments', title:'Maya Collins — appointment today 2 PM',  body:'HydraFacial with Dr. Patel. Check prep notes.',               time:'2h ago',   unread:false},
  {id:5, type:'critical',     title:'Omar Al Farsi — 12 days overdue',        body:'No response to last 2 reminders. AED 6,850 at risk.',         time:'3h ago',   unread:false},
  {id:6, type:'system',       title:'Daily lapsed check completed',           body:'42 clients checked. 3 newly lapsed, 0 errors.',               time:'Yesterday',unread:false},
]

function Topbar({page, search, setSearch, onNav, onSignOut, notifs, setNotifs, avatar}) {
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUser,   setShowUser]   = useState(false)
  const unreadCount = notifs.filter(n=>n.unread).length

  useEffect(()=>{
    function handleClick(e) {
      if (!e.target.closest('[data-dropdown]')) { setShowNotifs(false); setShowUser(false) }
    }
    document.addEventListener('mousedown', handleClick)
    return ()=>document.removeEventListener('mousedown', handleClick)
  }, [])

  const ddBox = { position:'absolute', top:'calc(100% + 8px)', right:0, background:C.white, border:`1px solid ${C.border}`, borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.10)', zIndex:200, minWidth:300 }

  return (
    <div style={{height:58,background:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',padding:'0 28px',gap:16,flexShrink:0,position:'sticky',top:0,zIndex:10}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search patients, treatments..." style={{...inp,width:280,borderRadius:10,background:'var(--c-input-bg)',fontSize:13,height:36,padding:'0 14px'}}/>
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:12}}>

        {/* Bell */}
        <div data-dropdown="notifs" style={{position:'relative'}}>
          <div onClick={()=>{setShowNotifs(v=>!v);setShowUser(false)}} style={{width:36,height:36,borderRadius:10,background:'var(--c-input-bg)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{color:unreadCount>0?C.body:'var(--c-muted)'}}>
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
            </svg>
            {unreadCount>0&&(
              <span style={{position:'absolute',top:-5,right:-5,minWidth:17,height:17,borderRadius:9,background:C.red,border:'2px solid var(--c-white)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#fff',padding:'0 3px',lineHeight:1}}>
                {unreadCount}
              </span>
            )}
          </div>
          {showNotifs&&(
            <div style={{...ddBox,minWidth:340}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontSize:13,fontWeight:700,color:C.body}}>Notifications {unreadCount>0&&<span style={{...pill(C.redSoft,C.red),fontSize:10,padding:'2px 7px',marginLeft:6}}>{unreadCount} new</span>}</div>
                {unreadCount>0&&<button onClick={()=>setNotifs(n=>n.map(x=>({...x,unread:false})))} style={{fontSize:11,color:C.blue,background:'none',border:'none',cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>Mark all read</button>}
              </div>
              <div style={{maxHeight:320,overflowY:'auto'}}>
                {notifs.map(n=>(
                  <div key={n.id} onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,unread:false}:x))} style={{display:'flex',gap:12,padding:'12px 16px',borderBottom:`1px solid var(--c-subtle)`,cursor:'pointer',background:n.unread?'var(--c-unread-bg)':C.white,transition:'background 120ms'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:n.unread?700:500,color:C.body,marginBottom:2}}>{n.title}</div>
                      <div style={{fontSize:11,color:C.muted,lineHeight:1.4}}>{n.body}</div>
                      <div style={{fontSize:10,color:'#9ca3af',marginTop:4}}>{n.time}</div>
                    </div>
                    {n.unread&&<span style={{width:7,height:7,borderRadius:'50%',background:C.blue,flexShrink:0,marginTop:4}}/>}
                  </div>
                ))}
              </div>
              <div style={{padding:'10px 16px',borderTop:`1px solid ${C.border}`,textAlign:'center'}}>
                <button onClick={()=>{setShowNotifs(false);onNav('Notifications')}} style={{fontSize:12,color:C.blue,background:'none',border:'none',cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>View all notifications →</button>
              </div>
            </div>
          )}
        </div>

        <div style={{width:1,height:24,background:C.border}}/>

        {/* User avatar */}
        <div data-dropdown="user" style={{position:'relative'}}>
          <div onClick={()=>{setShowUser(v=>!v);setShowNotifs(false)}} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'4px 6px',borderRadius:9,transition:'background 120ms'}}>
            <div style={{width:32,height:32,borderRadius:10,background:C.blueSoft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.blueDark,overflow:'hidden'}}>
              {avatar?<img src={avatar} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="avatar"/>:'Dr'}
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:C.body}}>Dr. Admin</div>
              <div style={{fontSize:10,color:C.muted}}>Clinic Manager</div>
            </div>
            <span style={{fontSize:10,color:C.muted,marginLeft:2}}>▾</span>
          </div>
          {showUser&&(
            <div style={{...ddBox,minWidth:200}}>
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontSize:13,fontWeight:700,color:C.body}}>Dr. Admin</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>admin@clinic.com</div>
              </div>
              {[
                {label:'My Profile',   action:()=>{onNav('Profile');       setShowUser(false)}},
                {label:'Notifications',action:()=>{onNav('Notifications'); setShowUser(false)}},
                {label:'Settings',     action:()=>{onNav('Settings');      setShowUser(false)}},
              ].map(item=>(
                <div key={item.label} onClick={item.action} style={{display:'flex',alignItems:'center',padding:'10px 16px',cursor:'pointer',fontSize:13,color:C.label,fontWeight:500,transition:'background 120ms'}}>
                  {item.label}
                </div>
              ))}
              <div style={{borderTop:`1px solid ${C.border}`,padding:'8px 4px 4px'}}>
                <div onClick={()=>{setShowUser(false);onSignOut()}} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',cursor:'pointer',fontSize:13,color:C.red,fontWeight:500,borderRadius:8,transition:'background 120ms'}}>
                  <span>↪</span> Sign out
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({label, value, color, subtext, bars}) {
  return (
    <div style={{...card,padding:'16px 18px',flex:1,minWidth:0}}>
      <div style={{fontSize:11,color:C.muted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color,letterSpacing:'-0.5px',marginBottom:6}}>{value}</div>
      {bars&&<div style={{display:'flex',gap:3,height:4,marginBottom:6}}>{bars.map((b,i)=><span key={i} style={{flex:1,background:b,borderRadius:2}}/>)}</div>}
      {subtext&&<div style={{fontSize:10,color:C.muted,fontWeight:500}}>{subtext}</div>}
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage({clients, loading, error, onShowAdd, sending, setSending, doing, setDoing, editRow, setEditRow, editV, setEditV, setClients, showToast, selected, setSelected, search, setSearch}) {
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
  const totalRisk=clients.reduce((s,c)=>s+getRevenue(c),0)
  const recovered=clients.filter(c=>c.Last_Reminder_Sent).reduce((s,c)=>s+getRevenue(c)*0.3,0)
  const lost=clients.filter(c=>c.Status==='Lapsed').reduce((s,c)=>s+getRevenue(c)*0.5,0)
  const actionQueue=clients.filter(c=>{const d=dayDiff(c.Next_Reminder_Date);return(d!==null&&d<=0)||c.Status==='Lapsed'}).length
  const topClient=sorted[0]
  const filtered=sorted.filter(c=>{
    const ms=!search||[c.Full_Name,c.Treatment_Type,c.Client_ID].some(v=>v?.toLowerCase().includes(search.toLowerCase()))
    return ms&&(fStage==='All'||c.Reminder_Stage===fStage)&&(fStatus==='All'||c.Status===fStatus)
  })
  const weeks=[18,21,19,24,28,25,31,35,38,42,47,52]
  const maxW=Math.max(...weeks)
  return (
    <div style={{padding:28}}>
      <div style={{marginBottom:6}}><span style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>Above the Fold</span></div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22}}>
        <div>
          <div style={{fontSize:26,fontWeight:800,color:C.body,letterSpacing:'-0.7px'}}>Clinic Command Center</div>
          <div style={{fontSize:13,color:C.muted,marginTop:4}}>AI-powered revenue recovery, follow-ups, and appointment intelligence</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select style={{padding:'7px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option>Last 30 days</option><option>Last 12 weeks</option></select>
          <select style={{padding:'7px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option>All Departments</option></select>
          <select style={{padding:'7px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option>All Providers</option></select>
          <button onClick={onShowAdd} style={{...btn(),padding:'8px 16px'}}>+ Add Client</button>
        </div>
      </div>

      {topClient&&<div style={{background:'#fffbeb',border:`1px solid #fcd34d`,borderRadius:10,padding:'10px 18px',marginBottom:18,fontSize:13,color:'#92400e',fontWeight:500}}>⚡ Priority: <strong>{topClient.Full_Name}</strong> is {getPriority(topClient).sub}. Send reminder now to recover <strong>AED {getRevenue(topClient).toLocaleString()}</strong> today.</div>}

      <div style={{display:'flex',gap:14,marginBottom:20}}>
        <KpiCard label="Revenue at Risk"    value={`AED ${Math.round(totalRisk).toLocaleString()}`}    color={C.red}    bars={['#fecaca','#fca5a5','#ef4444',C.red,'#7f1d1d']}   subtext="Needs follow-up"/>
        <KpiCard label="Recovered Revenue"  value={`AED ${Math.round(recovered).toLocaleString()}`}    color={C.green}  bars={['#bbf7d0','#86efac','#22c55e',C.green,'#14532d']}  subtext="From reminders sent"/>
        <KpiCard label="Lost Revenue"       value={`AED ${Math.round(lost).toLocaleString()}`}         color={C.orange} bars={['#fed7aa','#fdba74','#fb923c',C.orange,'#9a3412']} subtext="Lapsed patients"/>
        <KpiCard label="Active Follow-ups"  value={actionQueue}                                         color={C.teal}   bars={['#a5f3fc','#67e8f9','#22d3ee',C.teal,'#164e63']}  subtext="Action required"/>
      </div>

      <div style={{display:'flex',gap:16,marginBottom:20}}>
        <div style={{...card,padding:'18px 20px',flex:1.8}}>
          <div style={{fontSize:14,fontWeight:700,color:C.body,marginBottom:2}}>Revenue Trend</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Last 12 weeks</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:5,height:120}}>
            {weeks.map((v,i)=>(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                <div style={{width:'100%',background:`hsl(${220-i*6},${55+i*3}%,${62-i*3}%)`,borderRadius:'4px 4px 0 0',height:`${(v/maxW)*110}px`,minHeight:4,transition:'height 200ms'}}/>
                <span style={{fontSize:9,color:C.muted}}>W{i+1}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{...card,padding:'18px 20px',flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:C.body,marginBottom:2}}>Follow-up Conversions</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Success rate by channel</div>
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            {[{label:'WhatsApp',pct:72,color:C.blue},{label:'Call',pct:64,color:C.green},{label:'SMS',pct:56,color:C.purple},{label:'Email',pct:38,color:C.muted}].map(ch=>(
              <div key={ch.label}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}><span style={{color:C.label,fontWeight:500}}>{ch.label}</span><span style={{color:ch.color,fontWeight:600}}>{ch.pct}%</span></div>
                <div style={{height:6,background:'var(--c-subtle)',borderRadius:3}}><div style={{height:'100%',width:`${ch.pct}%`,background:ch.color,borderRadius:3}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
        <div style={{...card,padding:'18px 20px'}}>
          <div style={{fontSize:14,fontWeight:700,color:C.body,marginBottom:14}}>Patient Funnel</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[{label:'Lead',count:clients.length,pct:100,color:'#bfdbfe',tc:C.blueDark},{label:'Appointment',count:Math.round(clients.length*0.82),pct:82,color:C.blue,tc:'#fff'},{label:'Visit',count:Math.round(clients.length*0.65),pct:65,color:C.blueDark,tc:'#fff'},{label:'Revenue',count:`AED ${Math.round(totalRisk*0.4).toLocaleString()}`,pct:40,color:'#1e3a8a',tc:'#fff'}].map(f=>(
              <div key={f.label} style={{position:'relative',height:30,background:'var(--c-subtle)',borderRadius:6,overflow:'hidden'}}>
                <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${f.pct}%`,background:f.color,borderRadius:6,display:'flex',alignItems:'center',paddingLeft:12}}>
                  <span style={{fontSize:12,fontWeight:600,color:f.tc}}>{f.label}</span>
                </div>
                <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',fontSize:12,color:C.muted}}>{f.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{...card,padding:'18px 20px'}}>
          <div style={{fontSize:14,fontWeight:700,color:C.body,marginBottom:14}}>Patient Segmentation</div>
          <div style={{display:'flex',alignItems:'center',gap:20}}>
            <div style={{flex:1}}>
              {[{label:'New Patients',pct:42,color:C.blue},{label:'Returning',pct:40,color:C.green},{label:'At Risk',pct:6,color:C.amber},{label:'Lost',pct:12,color:C.red}].map(s=>(
                <div key={s.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0,display:'inline-block'}}/>
                  <span style={{fontSize:12,color:C.label,fontWeight:500}}>{s.label}</span>
                  <span style={{fontSize:12,color:s.color,fontWeight:600,marginLeft:'auto'}}>{s.pct}%</span>
                </div>
              ))}
            </div>
            <div style={{position:'relative',width:90,height:90,flexShrink:0}}>
              <svg viewBox="0 0 36 36" style={{width:90,height:90,transform:'rotate(-90deg)'}}>
                <circle cx="18" cy="18" r="14" fill="none" stroke="var(--c-subtle)" strokeWidth="4"/>
                <circle cx="18" cy="18" r="14" fill="none" stroke={C.blue}  strokeWidth="4" strokeDasharray="40 88" strokeDashoffset="0"/>
                <circle cx="18" cy="18" r="14" fill="none" stroke={C.green} strokeWidth="4" strokeDasharray="40 88" strokeDashoffset="-40"/>
                <circle cx="18" cy="18" r="14" fill="none" stroke={C.amber} strokeWidth="4" strokeDasharray="6 88"  strokeDashoffset="-80"/>
                <circle cx="18" cy="18" r="14" fill="none" stroke={C.red}   strokeWidth="4" strokeDasharray="12 88" strokeDashoffset="-86"/>
              </svg>
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontSize:15,fontWeight:700,color:C.body}}>{clients.length}</span>
                <span style={{fontSize:9,color:C.muted,fontWeight:500}}>Patients</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{...card,padding:'18px 20px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:700,color:C.body}}>Action Queue</div>
          <div style={{display:'flex',gap:8}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{...inp,width:180,height:32,padding:'0 12px',borderRadius:8,fontSize:12}}/>
            <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{padding:'6px 10px',border:`1px solid ${C.border}`,borderRadius:8,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option>All</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{padding:'6px 10px',border:`1px solid ${C.border}`,borderRadius:8,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option>All</option><option>Active</option><option>Lapsed</option></select>
          </div>
        </div>
        {loading?<div style={{padding:40,textAlign:'center',color:C.muted}}>Loading patients...</div>
         :error?<div style={{padding:40,textAlign:'center',color:C.red}}>{error}</div>
         :(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr>{['Patient','Priority','Next Action','Revenue','Quick Actions'].map(h=><th key={h} style={{fontSize:11,color:C.muted,textAlign:'left',padding:'8px 12px',borderBottom:`1px solid ${C.border}`,fontWeight:600,background:'var(--c-input-bg)'}}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((c,i)=>{
                const pri=getPriority(c);const rev=getRevenue(c);const diff=dayDiff(c.Next_Reminder_Date)
                const stage=STAGE_STYLE[c.Reminder_Stage]||{bg:'var(--c-subtle)',color:C.label}
                const cid=c.Client_ID||`row-${i}`;const isEdit=editRow===cid
                const td={padding:'11px 12px',borderBottom:`1px solid var(--c-subtle)`,color:C.body,verticalAlign:'middle'}
                return (
                  <tr key={cid} onClick={()=>{if(!isEdit){setSelected(c===selected?null:c);setEditRow(null)}}} style={{cursor:'pointer',background:selected===c?'#eff6ff':'#fff',transition:'background 120ms'}}>
                    <td style={td}><div style={{fontWeight:600}}>{c.Full_Name}</div><div style={{fontSize:10,color:C.muted,marginTop:1}}>· {c.Client_ID}</div></td>
                    <td style={td}><div style={{fontSize:11,fontWeight:700,color:pri.color}}>{pri.label}</div><div style={{fontSize:10,color:C.muted}}>{pri.sub}</div></td>
                    <td style={{...td,fontSize:12,color:C.muted,maxWidth:180}}>{getAIMove(c)}</td>
                    <td style={{...td,fontWeight:600}}>AED {rev.toLocaleString()}</td>
                    <td style={td}>
                      {isEdit
                        ?<div style={{display:'flex',gap:4}}><button onClick={e=>saveEdit(c,e)} style={{fontSize:11,padding:'4px 10px',border:'none',borderRadius:7,background:C.greenSoft,color:C.green,cursor:'pointer',fontFamily:'inherit'}}>Save</button><button onClick={e=>{e.stopPropagation();setEditRow(null)}} style={{fontSize:11,padding:'4px 8px',border:`1px solid ${C.border}`,borderRadius:7,background:C.white,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>×</button></div>
                        :<div style={{display:'flex',gap:4}}>
                          <button onClick={e=>sendReminder(c,e)} disabled={sending===c.Client_ID} style={{fontSize:11,padding:'4px 10px',border:'none',borderRadius:7,background:C.blueSoft,color:C.blueDark,cursor:'pointer',opacity:sending===c.Client_ID?0.5:1,fontFamily:'inherit'}}>{sending===c.Client_ID?'...':'WA'}</button>
                          <button onClick={e=>markDone(c,e)} disabled={doing===c.Client_ID} style={{fontSize:11,padding:'4px 8px',border:'none',borderRadius:7,background:C.greenSoft,color:C.green,cursor:'pointer',opacity:doing===c.Client_ID?0.5:1,fontFamily:'inherit'}}>{doing===c.Client_ID?'...':'✓'}</button>
                          <button onClick={e=>{e.stopPropagation();setEditRow(isEdit?null:cid);setEditV({Reminder_Stage:c.Reminder_Stage,Next_Reminder_Date:c.Next_Reminder_Date||''})}} style={{fontSize:11,padding:'4px 8px',border:`1px solid ${C.border}`,borderRadius:7,background:C.white,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>✎</button>
                        </div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div style={{padding:'10px 12px',borderTop:`1px solid ${C.border}`,fontSize:11,color:C.muted,display:'flex',justifyContent:'space-between',marginTop:4}}><span>Top-priority actions ranked by risk score and projected revenue.</span><span>{filtered.length} clients</span></div>
      </div>

      {selected&&(
        <div style={{position:'fixed',right:0,top:0,bottom:0,width:290,background:C.white,borderLeft:`1px solid ${C.border}`,padding:20,overflowY:'auto',zIndex:200,boxShadow:'-4px 0 20px rgba(0,0,0,0.07)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
            <div style={{fontSize:15,fontWeight:700,color:C.body}}>{selected.Full_Name}</div>
            <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22,lineHeight:1}}>×</button>
          </div>
          {[['Client ID',selected.Client_ID],['Treatment',selected.Treatment_Type],['WhatsApp',selected.WhatsApp_Number],['Email',selected.Email||'—'],['Status',selected.Status]].map(([k,v])=>(
            <div key={k} style={{marginBottom:14}}><div style={{fontSize:11,color:C.muted,marginBottom:3,fontWeight:600}}>{k}</div><div style={{fontSize:13,color:C.body}}>{v}</div></div>
          ))}
          <div style={{marginBottom:14}}><div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:600}}>Stage</div><select value={editV.Reminder_Stage||selected.Reminder_Stage} onChange={e=>{setEditV(v=>({...v,Reminder_Stage:e.target.value}));setEditRow(selected.Client_ID)}} style={{...inp,fontSize:12}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div style={{marginBottom:18}}><div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:600}}>Next Follow-up</div><input type="date" value={editV.Next_Reminder_Date?editV.Next_Reminder_Date.split('/').reverse().join('-'):selected.Next_Reminder_Date?selected.Next_Reminder_Date.split('/').reverse().join('-'):''} onChange={e=>{const p=e.target.value.split('-');setEditV(v=>({...v,Next_Reminder_Date:`${p[2]}/${p[1]}/${p[0]}`}));setEditRow(selected.Client_ID)}} style={{...inp,fontSize:12}}/></div>
          {editRow===selected.Client_ID&&<button onClick={e=>saveEdit(selected,e)} style={{...btn(),width:'100%',marginBottom:14}}>Save Changes</button>}
          <div><div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:600}}>AI Recommendation</div><div style={{fontSize:12,color:C.label,padding:'10px 12px',background:'#f0fdf4',borderRadius:8,border:`1px solid #bbf7d0`,lineHeight:1.5}}>{getAIMove(selected)}</div></div>
        </div>
      )}
    </div>
  )
}

// ─── Patient Detail Panel ─────────────────────────────────────────────────────
function PatientDetailPanel({client:c, onClose, sending, setSending, doing, setDoing, editRow, setEditRow, editV, setEditV, setClients, showToast, setSelected}) {
  const [tab, setTab]         = useState('overview')
  const noteKey               = `clinicNote_${c.Client_ID}`
  const [note, setNote]       = useState(()=>typeof window!=='undefined'?localStorage.getItem(noteKey)||'':'')
  const [noteSaved,setNoteSaved] = useState(false)

  const pri  = getPriority(c)
  const rev  = getRevenue(c)
  const diff = dayDiff(c.Next_Reminder_Date)
  const stage= STAGE_STYLE[c.Reminder_Stage]||{bg:'var(--c-subtle)',color:C.label}
  const initials = c.Full_Name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?'

  async function sendReminder(e) {
    e.stopPropagation(); setSending(c.Client_ID)
    try { await fetch(REMIND_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:c.Client_ID,row_number:c.row_number,name:c.Full_Name,email:c.Email,treatment:c.Treatment_Type})}); showToast(`Reminder sent to ${c.Full_Name}`) }
    catch { showToast('Failed to send reminder','error') } finally { setSending(null) }
  }
  async function markDone(e) {
    e.stopPropagation(); setDoing(c.Client_ID)
    try { const ds=new Date().toLocaleDateString('en-GB'); await fetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row_number:c.row_number,field:'Last_Reminder_Sent',value:ds})}); setClients(cs=>cs.map(x=>x.Client_ID===c.Client_ID?{...x,Last_Reminder_Sent:ds}:x)); setSelected(s=>({...s,Last_Reminder_Sent:ds})); showToast(`Marked done for ${c.Full_Name}`) }
    catch { showToast('Failed','error') } finally { setDoing(null) }
  }
  async function saveEdit(e) {
    e.stopPropagation()
    try { await fetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row_number:c.row_number,...editV})}); setClients(cs=>cs.map(x=>x.Client_ID===c.Client_ID?{...x,...editV}:x)); setSelected(s=>({...s,...editV})); showToast('Patient updated'); setEditRow(null) }
    catch { showToast('Failed','error') }
  }
  function saveNote() {
    if(typeof window!=='undefined') localStorage.setItem(noteKey, note)
    setNoteSaved(true); setTimeout(()=>setNoteSaved(false),2000)
  }

  // Build a reminders log from available fields
  const remindersLog = [
    c.Last_Reminder_Sent && { date:c.Last_Reminder_Sent, type:'Reminder Sent', status:'Delivered' },
    c.Next_Reminder_Date && { date:c.Next_Reminder_Date, type:'Upcoming Reminder', status: diff===null?'Scheduled':diff<0?'Overdue':diff===0?'Due Today':'Scheduled' },
    c.Treatment_Date     && { date:c.Treatment_Date,     type:'Treatment',        status:'Completed' },
  ].filter(Boolean)

  const TABS = ['Overview','Reminders','Notes']

  return (
    <div style={{position:'fixed',right:0,top:0,bottom:0,width:440,background:C.white,borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',zIndex:200,boxShadow:'-4px 0 24px rgba(0,0,0,0.08)'}}>

      {/* Header */}
      <div style={{padding:'20px 22px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:48,height:48,borderRadius:14,background:C.blueSoft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:800,color:C.blueDark,flexShrink:0}}>{initials}</div>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:C.body,letterSpacing:'-0.3px'}}>{c.Full_Name}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{c.Client_ID}</div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                <span style={pill(stage.bg,stage.color)}>{c.Reminder_Stage}</span>
                <span style={{fontSize:11,fontWeight:700,color:pri.color}}>{pri.label}</span>
                <span style={{fontSize:11,color:C.muted}}>· {pri.sub}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22,lineHeight:1,padding:4}}>×</button>
        </div>
        <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{c.Treatment_Type}</div>

        {/* Action buttons */}
        <div style={{display:'flex',gap:8}}>
          <button onClick={sendReminder} disabled={sending===c.Client_ID} style={{flex:1,...btn(),padding:'8px 10px',fontSize:12,opacity:sending===c.Client_ID?0.6:1}}>
            {sending===c.Client_ID?'Sending…':'Send Reminder'}
          </button>
          <button onClick={markDone} disabled={doing===c.Client_ID} style={{flex:1,...btn('outline'),padding:'8px 10px',fontSize:12,color:C.green,border:`1px solid ${C.green}`,opacity:doing===c.Client_ID?0.6:1}}>
            {doing===c.Client_ID?'Saving…':'✓ Mark Done'}
          </button>
          <button onClick={e=>{e.stopPropagation();setEditRow(editRow===c.Client_ID?null:c.Client_ID);setEditV({Reminder_Stage:c.Reminder_Stage,Next_Reminder_Date:c.Next_Reminder_Date||''})}} style={{...btn('outline'),padding:'8px 12px',fontSize:12}}>✎</button>
        </div>

        {/* Inline edit save when edit row is active */}
        {editRow===c.Client_ID&&(
          <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Stage</label><select style={{...inp,fontSize:12}} value={editV.Reminder_Stage} onClick={e=>e.stopPropagation()} onChange={e=>setEditV(v=>({...v,Reminder_Stage:e.target.value}))}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
              <div><label style={lbl}>Next Follow-up</label><input type="date" style={{...inp,fontSize:12}} value={editV.Next_Reminder_Date?editV.Next_Reminder_Date.split('/').reverse().join('-'):''} onClick={e=>e.stopPropagation()} onChange={e=>{const p=e.target.value.split('-');setEditV(v=>({...v,Next_Reminder_Date:`${p[2]}/${p[1]}/${p[0]}`}))}}/></div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={saveEdit} style={{...btn(),flex:1,padding:'8px',fontSize:12}}>Save Changes</button>
              <button onClick={e=>{e.stopPropagation();setEditRow(null)}} style={{...btn('outline'),padding:'8px 12px',fontSize:12}}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'11px 8px',border:'none',borderBottom:`2px solid ${tab===t?C.blue:'transparent'}`,background:'none',cursor:'pointer',fontSize:13,fontWeight:tab===t?700:400,color:tab===t?C.blue:C.muted,fontFamily:'inherit',transition:'all 150ms'}}>{t}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{flex:1,overflowY:'auto',padding:'20px 22px'}}>

        {tab==='Overview'&&(
          <div>
            {[
              ['Phone / WhatsApp', c.WhatsApp_Number||'—'],
              ['Email',            c.Email||'—'],
              ['Treatment Date',   c.Treatment_Date||'—'],
              ['Next Follow-up',   diff===null?'Not set':diff===0?`${c.Next_Reminder_Date} (Today)`:diff<0?`${c.Next_Reminder_Date} (${Math.abs(diff)}d overdue)`:c.Next_Reminder_Date?`${c.Next_Reminder_Date} (in ${diff}d)`:'Not set'],
              ['Session',          c.Session_Number&&c.Total_Sessions_Planned?`${c.Session_Number} of ${c.Total_Sessions_Planned}`:c.Session_Number||'—'],
              ['Revenue at Risk',  `AED ${rev.toLocaleString()}`],
              ['Status',           c.Status||'—'],
              ['Last Reminder',    c.Last_Reminder_Sent||'Never'],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'10px 0',borderBottom:`1px solid var(--c-subtle)`}}>
                <span style={{fontSize:12,color:C.muted,fontWeight:600,flexShrink:0,marginRight:12}}>{k}</span>
                <span style={{fontSize:12,color:C.body,textAlign:'right',wordBreak:'break-word'}}>{v}</span>
              </div>
            ))}
            <div style={{marginTop:16,padding:'12px 14px',background:'#f0fdf4',borderRadius:10,border:'1px solid #bbf7d0'}}>
              <div style={{fontSize:11,color:C.green,fontWeight:700,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>AI Recommendation</div>
              <div style={{fontSize:12,color:C.label,lineHeight:1.6}}>{getAIMove(c)}</div>
            </div>
          </div>
        )}

        {tab==='Reminders'&&(
          <div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Reminder history for {c.Full_Name}</div>
            {remindersLog.length===0
              ? <div style={{padding:'32px 0',textAlign:'center',color:C.muted,fontSize:13}}>No reminder records found.</div>
              : remindersLog.map((r,i)=>{
                  const statusColor = r.status==='Delivered'?C.green:r.status==='Overdue'?C.red:r.status==='Due Today'?C.amber:r.status==='Completed'?C.teal:C.muted
                  const statusBg    = r.status==='Delivered'?C.greenSoft:r.status==='Overdue'?C.redSoft:r.status==='Due Today'?C.amberSoft:r.status==='Completed'?C.tealSoft:'var(--c-subtle)'
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0',borderBottom:`1px solid var(--c-subtle)`}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:statusColor,flexShrink:0,marginTop:2}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.body}}>{r.type}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:2}}>{r.date}</div>
                      </div>
                      <span style={pill(statusBg,statusColor)}>{r.status}</span>
                    </div>
                  )
                })
            }
            {c.Reminders_Log&&Array.isArray(c.Reminders_Log)&&c.Reminders_Log.map((r,i)=>(
              <div key={`log-${i}`} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0',borderBottom:`1px solid var(--c-subtle)`}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:C.blue,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.body}}>{r.type||'Reminder'}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{r.date||r.Date||'—'}</div>
                  {r.notes&&<div style={{fontSize:11,color:C.muted,marginTop:2,fontStyle:'italic'}}>{r.notes}</div>}
                </div>
                {r.status&&<span style={pill('var(--c-subtle)',C.muted)}>{r.status}</span>}
              </div>
            ))}
          </div>
        )}

        {tab==='Notes'&&(
          <div>
            <label style={{...lbl,marginBottom:8}}>Notes for {c.Full_Name}</label>
            <textarea
              value={note}
              onChange={e=>setNote(e.target.value)}
              placeholder="Add notes about this patient — follow-up context, preferences, concerns…"
              style={{...inp,minHeight:200,resize:'vertical',lineHeight:1.6,fontSize:13}}
            />
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10}}>
              <span style={{fontSize:11,color:C.muted}}>{note.length} characters</span>
              <button onClick={saveNote} style={{...btn(),padding:'8px 20px',fontSize:12,background:noteSaved?C.green:C.blue}}>{noteSaved?'Saved!':'Save Notes'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Patients Page ────────────────────────────────────────────────────────────
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
  const activeCount=clients.filter(c=>c.Status!=='Lapsed').length
  const atRiskCount=clients.filter(c=>{const d=dayDiff(c.Next_Reminder_Date);return d!==null&&d<0}).length

  const summaryCards=[
    {label:'Active',   value:activeCount,        color:C.green,  bg:C.greenSoft},
    {label:'At Risk',  value:atRiskCount,         color:C.red,    bg:C.redSoft},
    {label:'New',      value:Math.round(clients.length*0.18), color:C.teal,   bg:C.tealSoft},
    {label:'Lost',     value:clients.filter(c=>c.Status==='Lapsed').length, color:C.muted, bg:'var(--c-subtle)'},
    {label:'Returning',value:Math.round(clients.length*0.4),  color:C.blue,   bg:C.blueSoft},
  ]

  return (
    <div style={{padding:28}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <div style={{fontSize:26,fontWeight:800,color:C.body,letterSpacing:'-0.7px'}}>Patients</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>{clients.length} total · {activeCount} active</div>
        </div>
        <button onClick={()=>setShowAdd(true)} style={btn()}>+ Add Patient</button>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:20}}>
        {summaryCards.map(s=>(
          <div key={s.label} onClick={()=>s.label==='At Risk'?setFStatus('Lapsed'):setFStage('All')} style={{...card,padding:'14px 18px',flex:1,cursor:'pointer',transition:'box-shadow 120ms'}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{s.label}</div>
            <div style={{fontSize:22,fontWeight:700,color:s.color,letterSpacing:'-0.5px'}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{...card,padding:'14px 18px',marginBottom:16}}>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search patients..." style={{...inp,flex:1,maxWidth:280,height:36,padding:'0 12px',borderRadius:9}}/>
          <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{padding:'7px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option value="All">All Stages</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
          <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{padding:'7px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option value="All">All Status</option><option>Active</option><option>Lapsed</option></select>
          {(search||fStage!=='All'||fStatus!=='All')&&<button onClick={()=>{setSearch('');setFStage('All');setFStatus('All')}} style={{fontSize:12,color:C.blue,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Clear filters</button>}
        </div>
      </div>

      <div style={{...card,padding:0,overflow:'hidden'}}>
        {loading?<div style={{padding:48,textAlign:'center',color:C.muted}}>Loading...</div>
         :error?<div style={{padding:48,textAlign:'center',color:C.red}}>{error}</div>
         :(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{['Patient Name','Treatment','Status','Last Visit','Follow-up','Revenue','Actions'].map(h=><th key={h} style={{fontSize:11,color:C.muted,textAlign:'left',padding:'12px 16px',fontWeight:600,background:'var(--c-input-bg)'}}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((c,i)=>{
                const pri=getPriority(c);const rev=getRevenue(c);const diff=dayDiff(c.Next_Reminder_Date)
                const stage=STAGE_STYLE[c.Reminder_Stage]||{bg:'var(--c-subtle)',color:C.label}
                const cid=c.Client_ID||`row-${i}`;const isEdit=editRow===cid
                const td={padding:'13px 16px',borderBottom:`1px solid var(--c-subtle)`,color:C.body,verticalAlign:'middle'}
                return (
                  <tr key={cid} onClick={()=>{if(!isEdit){setSelected(c===selected?null:c);setEditRow(null)}}} style={{cursor:'pointer',background:selected===c?'#eff6ff':'#fff',transition:'background 120ms'}}>
                    <td style={td}><div style={{fontWeight:600}}>{c.Full_Name}</div><div style={{fontSize:11,color:C.muted}}>{c.Client_ID}</div></td>
                    <td style={{...td,fontSize:12,color:C.muted}}>{c.Treatment_Type}</td>
                    <td style={td}><span style={pill(stage.bg,stage.color)}>{c.Reminder_Stage}</span></td>
                    <td style={{...td,fontSize:12,color:C.muted}}>{c.Treatment_Date||'—'}</td>
                    <td style={td}>
                      {isEdit
                        ?<input type="date" value={editV.Next_Reminder_Date?editV.Next_Reminder_Date.split('/').reverse().join('-'):''} onClick={e=>e.stopPropagation()} onChange={e=>{const p=e.target.value.split('-');setEditV(v=>({...v,Next_Reminder_Date:`${p[2]}/${p[1]}/${p[0]}`}))}} style={{...inp,fontSize:11,padding:'4px 8px',width:130}}/>
                        :<div style={{fontSize:12,color:diff!==null&&diff<0?C.red:diff===0?C.green:C.muted,fontWeight:diff!==null&&diff<=0?600:400}}>{diff===null?'Not set':diff===0?'Today':diff<0?`${Math.abs(diff)}d overdue`:`In ${diff}d`}{c.Next_Reminder_Date&&<div style={{fontSize:10,color:C.muted,fontWeight:400}}>{c.Next_Reminder_Date}</div>}</div>}
                    </td>
                    <td style={{...td,fontWeight:600}}>AED {rev.toLocaleString()}</td>
                    <td style={td}>
                      {isEdit
                        ?<div style={{display:'flex',gap:4}}><button onClick={e=>saveEdit(c,e)} style={{fontSize:11,padding:'5px 10px',border:'none',borderRadius:7,background:C.greenSoft,color:C.green,cursor:'pointer',fontFamily:'inherit'}}>Save</button><button onClick={e=>{e.stopPropagation();setEditRow(null)}} style={{fontSize:11,padding:'5px 8px',border:`1px solid ${C.border}`,borderRadius:7,background:C.white,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>×</button></div>
                        :<div style={{display:'flex',gap:4}}>
                          <button onClick={e=>sendReminder(c,e)} disabled={sending===c.Client_ID} style={{fontSize:11,padding:'5px 10px',border:'none',borderRadius:7,background:C.blueSoft,color:C.blueDark,cursor:'pointer',opacity:sending===c.Client_ID?0.5:1,fontFamily:'inherit'}}>{sending===c.Client_ID?'...':'WA'}</button>
                          <button onClick={e=>markDone(c,e)} disabled={doing===c.Client_ID} style={{fontSize:11,padding:'5px 8px',border:'none',borderRadius:7,background:C.greenSoft,color:C.green,cursor:'pointer',opacity:doing===c.Client_ID?0.5:1,fontFamily:'inherit'}}>{doing===c.Client_ID?'...':'✓'}</button>
                          <button onClick={e=>{e.stopPropagation();setEditRow(isEdit?null:cid);setEditV({Reminder_Stage:c.Reminder_Stage,Next_Reminder_Date:c.Next_Reminder_Date||''})}} style={{fontSize:11,padding:'5px 8px',border:`1px solid ${C.border}`,borderRadius:7,background:C.white,color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>✎</button>
                        </div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected&&<PatientDetailPanel client={selected} onClose={()=>setSelected(null)} sending={sending} setSending={setSending} doing={doing} setDoing={setDoing} editRow={editRow} setEditRow={setEditRow} editV={editV} setEditV={setEditV} setClients={setClients} showToast={showToast} setSelected={setSelected}/>}
      {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={(c,rowNum)=>{const nc={Client_ID:`CLT-${crypto.randomUUID().slice(0,8)}`,...c,Status:'Active',Last_Reminder_Sent:'',Next_Reminder_Date:'',row_number:rowNum??Date.now()};setClients(cs=>[...cs,nc]);showToast(`${c.Full_Name} added`);setTimeout(()=>setShowAdd(false),500)}}/>}
    </div>
  )
}

// ─── Appointments Page ────────────────────────────────────────────────────────
function AppointmentsPage() {
  const APPTS=[
    {time:'9:00 AM', patient:'Aarav Mehta',     doctor:'Dr. Sarah Khan',status:'Confirmed',   type:'Follow-up', dept:'Cardiology'},
    {time:'10:30 AM',patient:'Sophia Reed',     doctor:'Dr. Priya Nair',status:'Confirmed',   type:'New Visit',  dept:'Dermatology'},
    {time:'11:00 AM',patient:'Omar Al Farsi',   doctor:'Dr. Ali Raza',  status:'In Progress', type:'Check-up',   dept:'Cardiology'},
    {time:'12:00 PM',patient:'Maya Collins',    doctor:'Dr. Sarah Khan',status:'Pending',     type:'Follow-up',  dept:'Orthopedics'},
    {time:'2:00 PM', patient:'Leila Hassan',    doctor:'Dr. Priya Nair',status:'Confirmed',   type:'New Visit',  dept:'General'},
    {time:'3:30 PM', patient:'Ravi Sharma',     doctor:'Dr. Ali Raza',  status:'Cancelled',   type:'Check-up',   dept:'Cardiology'},
    {time:'4:00 PM', patient:'Fatima Al Zaabi', doctor:'Dr. Sarah Khan',status:'Confirmed',   type:'Follow-up',  dept:'Orthopedics'},
  ]
  const SS={'Confirmed':{bg:C.greenSoft,color:C.green},'In Progress':{bg:C.blueSoft,color:C.blueDark},'Pending':{bg:C.amberSoft,color:C.amber},'Cancelled':{bg:C.redSoft,color:C.red}}
  const counts={Total:APPTS.length,Confirmed:APPTS.filter(a=>a.status==='Confirmed').length,'In Progress':APPTS.filter(a=>a.status==='In Progress').length,Pending:APPTS.filter(a=>a.status==='Pending').length,Cancelled:APPTS.filter(a=>a.status==='Cancelled').length}
  return (
    <div style={{padding:28}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <div style={{fontSize:26,fontWeight:800,color:C.body,letterSpacing:'-0.7px'}}>Appointments</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>{APPTS.filter(a=>a.status!=='Cancelled').length} appointments scheduled today</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <select style={{padding:'8px 14px',border:`1px solid ${C.border}`,borderRadius:9,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option>Today — Apr 30</option></select>
          <button style={btn()}>+ New Appointment</button>
        </div>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:20}}>
        {Object.entries(counts).map(([k,v])=>(
          <div key={k} style={{...card,padding:'14px 18px',flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{k}</div>
            <div style={{fontSize:22,fontWeight:700,color:SS[k]?.color||C.body}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{...card,padding:0,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{['Time','Patient','Doctor','Department','Type','Status','Actions'].map(h=><th key={h} style={{fontSize:11,color:C.muted,textAlign:'left',padding:'12px 16px',fontWeight:600,background:'var(--c-input-bg)'}}>{h}</th>)}</tr></thead>
          <tbody>
            {APPTS.map((a,i)=>{
              const s=SS[a.status]||{bg:'var(--c-subtle)',color:C.muted}
              const td={padding:'13px 16px',borderBottom:`1px solid var(--c-subtle)`,color:C.body,verticalAlign:'middle'}
              return (
                <tr key={i} style={{cursor:'pointer',background:C.white,transition:'background 120ms'}}>
                  <td style={{...td,fontWeight:600,color:C.body,whiteSpace:'nowrap'}}>{a.time}</td>
                  <td style={td}><div style={{fontWeight:600}}>{a.patient}</div></td>
                  <td style={{...td,color:C.muted,fontSize:12}}>{a.doctor}</td>
                  <td style={{...td,color:C.muted,fontSize:12}}>{a.dept}</td>
                  <td style={{...td,color:C.muted,fontSize:12}}>{a.type}</td>
                  <td style={td}><span style={pill(s.bg,s.color)}>{a.status}</span></td>
                  <td style={td}>
                    <div style={{display:'flex',gap:6}}>
                      <button style={{fontSize:11,padding:'5px 10px',border:`1px solid ${C.border}`,borderRadius:7,background:C.white,color:C.label,cursor:'pointer',fontFamily:'inherit'}}>Edit</button>
                      {a.status==='Confirmed'&&<button style={{fontSize:11,padding:'5px 10px',border:`1px solid #fca5a5`,borderRadius:7,background:C.white,color:C.red,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Analytics Page ───────────────────────────────────────────────────────────
function AnalyticsPage({clients}) {
  const totalRisk=clients.reduce((s,c)=>s+getRevenue(c),0)
  const weeks=[18,21,19,24,28,25,31,35,38,42,47,52]
  const maxW=Math.max(...weeks)
  const kpis=[
    {label:'Total Revenue',        value:'AED 684,200', change:'+14.2%', up:true},
    {label:'Recovery Rate',        value:'52.8%',       change:'+6.1%',  up:true},
    {label:'Avg Revenue/Patient',  value:`AED ${clients.length?Math.round(totalRisk/clients.length):0}`, change:'+9.3%', up:true},
    {label:'Churn Rate',           value:'12%',         change:'-2.1%',  up:false},
  ]
  return (
    <div style={{padding:28}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
        <div>
          <div style={{fontSize:26,fontWeight:800,color:C.body,letterSpacing:'-0.7px'}}>Analytics</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>Performance overview and revenue insights</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <select style={{padding:'7px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option>Last 30 days</option><option>Last 12 weeks</option></select>
          <select style={{padding:'7px 12px',border:`1px solid ${C.border}`,borderRadius:9,background:C.white,color:C.label,fontSize:12,outline:'none',fontFamily:'inherit'}}><option>All Departments</option></select>
          <button style={{...btn('outline'),padding:'7px 14px'}}>↓ Export</button>
        </div>
      </div>

      <div style={{display:'flex',gap:14,marginBottom:20}}>
        {kpis.map(k=>(
          <div key={k.label} style={{...card,padding:'16px 18px',flex:1}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{k.label}</div>
            <div style={{fontSize:22,fontWeight:700,color:C.body,letterSpacing:'-0.5px',marginBottom:6}}>{k.value}</div>
            <div style={{fontSize:12,color:k.up?C.green:C.red,fontWeight:600}}>{k.up?'↑':'↓'} {k.change}</div>
          </div>
        ))}
      </div>

      <div style={{...card,padding:'20px 22px',marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div><div style={{fontSize:14,fontWeight:700,color:C.body}}>Revenue Trend</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Last 12 weeks</div></div>
          <div style={{display:'flex',gap:16,fontSize:12}}>
            <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:20,height:3,background:C.blue,borderRadius:2,display:'inline-block'}}/><span style={{color:C.muted}}>Recovered</span></span>
            <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:20,height:3,background:C.red,borderRadius:2,display:'inline-block',opacity:0.6}}/><span style={{color:C.muted}}>At Risk</span></span>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'flex-end',gap:5,height:140}}>
          {weeks.map((v,i)=>(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
              <div style={{width:'100%',background:`hsl(${220-i*6},${55+i*3}%,${62-i*3}%)`,borderRadius:'4px 4px 0 0',height:`${(v/maxW)*130}px`,minHeight:4}}/>
              <span style={{fontSize:9,color:C.muted}}>W{i+1}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:'flex',gap:16}}>
        <div style={{...card,padding:'18px 20px',flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:C.body,marginBottom:14}}>Conversion by Channel</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[{label:'WhatsApp',pct:72,color:C.blue},{label:'Phone',pct:64,color:C.green},{label:'SMS',pct:56,color:C.purple},{label:'Email',pct:38,color:C.muted}].map(ch=>(
              <div key={ch.label}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}><span style={{color:C.label,fontWeight:500}}>{ch.label}</span><span style={{color:ch.color,fontWeight:600}}>{ch.pct}%</span></div>
                <div style={{height:8,background:'var(--c-subtle)',borderRadius:4}}><div style={{height:'100%',width:`${ch.pct}%`,background:ch.color,borderRadius:4}}/></div>
              </div>
            ))}
          </div>
        </div>
        <div style={{...card,padding:'18px 20px',flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:C.body,marginBottom:14}}>Revenue by Department</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[{label:'Cardiology',value:'AED 210k',pct:80,color:C.blue},{label:'Orthopedics',value:'AED 185k',pct:70,color:C.teal},{label:'Dermatology',value:'AED 156k',pct:59,color:C.purple},{label:'General',value:'AED 133k',pct:51,color:C.green}].map(d=>(
              <div key={d.label}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}><span style={{color:C.label,fontWeight:500}}>{d.label}</span><span style={{color:C.muted}}>{d.value}</span></div>
                <div style={{height:8,background:'var(--c-subtle)',borderRadius:4}}><div style={{height:'100%',width:`${d.pct}%`,background:d.color,borderRadius:4}}/></div>
              </div>
            ))}
          </div>
          <div style={{marginTop:16,padding:'10px 14px',background:C.blueSoft,borderRadius:9,border:`1px solid #bfdbfe`}}>
            <div style={{fontSize:12,fontWeight:600,color:C.blueDark}}>78% returning in 90 days</div>
            <div style={{fontSize:11,color:C.blue,marginTop:2}}>Patient retention rate</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage() {
  const [tab,setTab]=useState('General')
  const [clinicName,setClinicName]=useState('ClinicPulse Downtown')
  const [contact,setContact]=useState('(555) 012-5541')
  const [timezone,setTimezone]=useState('UTC+04:00')
  const [editing,setEditing]=useState(false)
  const [saved,setSaved]=useState(false)
  const [notifs,setNotifs]=useState({apptReminders:true,dailySummary:true,weeklyReport:false,smsAlerts:true,emailDigest:false})
  const [integrations,setIntegrations]=useState({ehr:true,billing:false,whatsapp:true,calendar:false})

  function save(){setSaved(true);setEditing(false);setTimeout(()=>setSaved(false),2500)}

  const tabs=['General','Notifications','Integrations','Security','Team']
  const Toggle=({on,onToggle})=>(
    <div onClick={onToggle} style={{width:40,height:22,borderRadius:11,background:on?C.blue:'#d1d5db',cursor:'pointer',position:'relative',transition:'background 200ms',flexShrink:0}}>
      <div style={{position:'absolute',top:3,left:on?21:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left 200ms',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
    </div>
  )
  const teamMembers=[
    {name:'Dr. Sarah Khan',role:'Admin',email:'sarah@clinic.com',status:'Active'},
    {name:'Dr. Ali Raza',  role:'Doctor',email:'ali@clinic.com',  status:'Active'},
    {name:'Dr. Priya Nair',role:'Doctor',email:'priya@clinic.com',status:'Active'},
    {name:'Nurse Aisha',   role:'Nurse', email:'aisha@clinic.com',status:'Active'},
    {name:'John Smith',    role:'Front Desk',email:'john@clinic.com',status:'Invited'},
  ]
  return (
    <div style={{padding:28}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
        <div style={{fontSize:26,fontWeight:800,color:C.body,letterSpacing:'-0.7px'}}>Settings</div>
        {tab==='Team'&&<button style={btn()}>+ Invite Member</button>}
      </div>
      <div style={{display:'flex',gap:4,marginBottom:22,background:'var(--c-subtle)',borderRadius:11,padding:4,width:'fit-content'}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'7px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:tab===t?600:400,background:tab===t?C.white:' transparent',color:tab===t?C.body:C.muted,boxShadow:tab===t?'0 1px 4px rgba(0,0,0,0.08)':'none',transition:'all 150ms',fontFamily:'inherit'}}>{t}</button>
        ))}
      </div>

      {tab==='General'&&(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{...card,padding:'22px 24px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <div style={{fontSize:15,fontWeight:700,color:C.body}}>Clinic Details</div>
              {!editing&&<button onClick={()=>setEditing(true)} style={{...btn('outline'),padding:'6px 14px'}}>Edit</button>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:16}}>
              <div><label style={lbl}>Clinic Name</label><input style={inp} value={clinicName} onChange={e=>setClinicName(e.target.value)} disabled={!editing}/></div>
              <div><label style={lbl}>Contact</label><input style={inp} value={contact} onChange={e=>setContact(e.target.value)} disabled={!editing}/></div>
              <div><label style={lbl}>Timezone</label><select style={inp} value={timezone} onChange={e=>setTimezone(e.target.value)} disabled={!editing}><option>UTC-05:00</option><option>UTC+00:00</option><option>UTC+04:00</option><option>UTC+05:00</option><option>UTC+05:30</option></select></div>
            </div>
            {editing&&<div style={{display:'flex',gap:8}}><button onClick={save} style={{...btn(),background:saved?C.green:C.blue}}>{saved?'Saved!':'Save Changes'}</button><button onClick={()=>setEditing(false)} style={btn('outline')}>Cancel</button></div>}
          </div>
          <div style={{...card,padding:'22px 24px'}}>
            <div style={{fontSize:15,fontWeight:700,color:C.body,marginBottom:18}}>Working Hours</div>
            {[{day:'Mon – Thu',open:'09:00',close:'18:00'},{day:'Friday',open:'09:00',close:'17:00'},{day:'Saturday',open:'10:00',close:'15:00'},{day:'Sunday',open:'',close:'',closed:true}].map(h=>(
              <div key={h.day} style={{display:'flex',alignItems:'center',gap:16,padding:'12px 0',borderBottom:`1px solid var(--c-subtle)`}}>
                <span style={{fontSize:13,color:C.label,fontWeight:500,width:90}}>{h.day}</span>
                {h.closed?<span style={pill(C.redSoft,C.red)}>Closed</span>:<><input style={{...inp,width:100}} value={h.open} readOnly/><span style={{color:C.muted,fontSize:13}}>–</span><input style={{...inp,width:100}} value={h.close} readOnly/></>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='Notifications'&&(
        <div style={{...card,padding:'22px 24px'}}>
          <div style={{fontSize:15,fontWeight:700,color:C.body,marginBottom:18}}>Notification Preferences</div>
          {[['apptReminders','Appointment Reminders','Send automated reminders before appointments'],['dailySummary','Daily Summary Emails','Receive a daily digest of clinic activity'],['weeklyReport','Weekly Report','Weekly performance report every Monday'],['smsAlerts','SMS Alerts','Critical alerts via SMS'],['emailDigest','Email Digest','Periodic email summary of patient activity']].map(([k,label,desc])=>(
            <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 0',borderBottom:`1px solid var(--c-subtle)`}}>
              <div><div style={{fontSize:13,fontWeight:500,color:C.body}}>{label}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{desc}</div></div>
              <Toggle on={notifs[k]} onToggle={()=>setNotifs(n=>({...n,[k]:!n[k]}))}/>
            </div>
          ))}
        </div>
      )}

      {tab==='Integrations'&&(
        <div style={{...card,padding:'22px 24px'}}>
          <div style={{fontSize:15,fontWeight:700,color:C.body,marginBottom:18}}>Connected Integrations</div>
          {[['ehr','EHR Integration','Electronic health records system','Connected','🏥'],['billing','Billing Platform','Payment and invoicing system','Not Connected','💳'],['whatsapp','WhatsApp Business','Patient messaging via WhatsApp','Connected','💬'],['calendar','Google Calendar','Sync appointments with Google Calendar','Not Connected','📆']].map(([k,name,desc,status,icon])=>(
            <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0',borderBottom:`1px solid var(--c-subtle)`}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:40,height:40,borderRadius:10,background:'var(--c-subtle)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{icon}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.body}}>{name}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:1}}>{desc}</div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={pill(integrations[k]?C.greenSoft:C.redSoft, integrations[k]?C.green:C.red)}>{integrations[k]?'Connected':'Disconnected'}</span>
                <Toggle on={integrations[k]} onToggle={()=>setIntegrations(i=>({...i,[k]:!i[k]}))}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='Security'&&(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{...card,padding:'22px 24px',maxWidth:520}}>
            <div style={{fontSize:15,fontWeight:700,color:C.body,marginBottom:18}}>Change Password</div>
            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
              <div><label style={lbl}>Current Password</label><input style={inp} type="password" placeholder="••••••••"/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={lbl}>New Password</label><input style={inp} type="password" placeholder="••••••••"/></div>
                <div><label style={lbl}>Confirm Password</label><input style={inp} type="password" placeholder="••••••••"/></div>
              </div>
            </div>
            <button style={btn()}>Update Password</button>
          </div>
          <div style={{...card,padding:'22px 24px',maxWidth:520}}>
            <div style={{fontSize:15,fontWeight:700,color:C.body,marginBottom:4}}>Two-Factor Authentication</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Add an extra layer of security to your account.</div>
            <button style={btn()}>Enable 2FA</button>
          </div>
        </div>
      )}

      {tab==='Team'&&(
        <div style={{...card,padding:0,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{['Member','Role','Email','Status','Actions'].map(h=><th key={h} style={{fontSize:11,color:C.muted,textAlign:'left',padding:'12px 18px',fontWeight:600,background:'var(--c-input-bg)'}}>{h}</th>)}</tr></thead>
            <tbody>
              {teamMembers.map((m,i)=>{
                const td={padding:'14px 18px',borderBottom:`1px solid var(--c-subtle)`,color:C.body,verticalAlign:'middle'}
                const initials=m.name.split(' ').map(p=>p[0]).join('').slice(0,2)
                return (
                  <tr key={i} style={{background:C.white}}>
                    <td style={td}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:32,height:32,borderRadius:9,background:C.blueSoft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:C.blueDark,flexShrink:0}}>{initials}</div><span style={{fontWeight:600}}>{m.name}</span></div></td>
                    <td style={{...td,color:C.muted,fontSize:12}}>{m.role}</td>
                    <td style={{...td,color:C.muted,fontSize:12}}>{m.email}</td>
                    <td style={td}><span style={pill(m.status==='Active'?C.greenSoft:C.amberSoft, m.status==='Active'?C.green:C.amber)}>{m.status}</span></td>
                    <td style={td}><button style={{fontSize:12,padding:'5px 12px',border:`1px solid ${C.border}`,borderRadius:7,background:C.white,color:C.label,cursor:'pointer',fontFamily:'inherit'}}>Edit</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Notifications Page ───────────────────────────────────────────────────────
function NotificationsPage({notifs, setNotifs}) {
  const [filter, setFilter] = useState('All')
  const FILTERS = ['All','Unread','Critical','Revenue','Appointments','System']
  const filtered = notifs.filter(n=>{
    if (filter==='All')          return true
    if (filter==='Unread')       return n.unread
    if (filter==='Critical')     return n.type==='critical'
    if (filter==='Revenue')      return n.type==='revenue'
    if (filter==='Appointments') return n.type==='appointments'
    if (filter==='System')       return n.type==='system'
    return true
  })
  const unreadCount = notifs.filter(n=>n.unread).length
  return (
    <div style={{padding:28}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
        <div>
          <div style={{fontSize:26,fontWeight:800,color:C.body,letterSpacing:'-0.7px'}}>Notifications</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>{unreadCount} unread · {notifs.length} total</div>
        </div>
        {unreadCount>0&&<button onClick={()=>setNotifs(ns=>ns.map(n=>({...n,unread:false})))} style={btn('outline')}>Mark all read</button>}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {FILTERS.map(f=>{
          const isActive = filter===f
          const fUnread = f==='Unread' ? unreadCount : 0
          return (
            <button key={f} onClick={()=>setFilter(f)} style={{padding:'6px 16px',borderRadius:20,border:`1px solid ${isActive?C.blue:C.border}`,background:isActive?C.blue:'#fff',color:isActive?'#fff':C.label,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 150ms'}}>
              {f}{fUnread>0&&<span style={{marginLeft:6,background:isActive?'rgba(255,255,255,0.3)':C.red,color:'#fff',borderRadius:10,padding:'0 5px',fontSize:10}}>{fUnread}</span>}
            </button>
          )
        })}
      </div>
      <div style={{...card,overflow:'hidden'}}>
        {filtered.length===0&&<div style={{padding:48,textAlign:'center',color:C.muted,fontSize:13}}>No notifications in this category.</div>}
        {filtered.map((n,i)=>(
          <div key={n.id} onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,unread:false}:x))} style={{display:'flex',gap:14,padding:'16px 20px',background:n.unread?'var(--c-unread-bg)':C.white,borderBottom:i<filtered.length-1?`1px solid ${C.border}`:'none',cursor:'pointer',alignItems:'flex-start',transition:'background 120ms'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                <div style={{fontSize:13,fontWeight:n.unread?700:600,color:C.body,lineHeight:1.4}}>{n.title}</div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  {n.unread&&<div style={{width:8,height:8,borderRadius:'50%',background:C.blue,flexShrink:0}}/>}
                  <span style={{fontSize:11,color:'#9ca3af',fontWeight:500,whiteSpace:'nowrap'}}>{n.time}</span>
                  <button onClick={e=>{e.stopPropagation();setNotifs(ns=>ns.filter(x=>x.id!==n.id))}} style={{width:22,height:22,borderRadius:6,border:'none',background:'transparent',cursor:'pointer',color:C.muted,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',opacity:0.5}}>×</button>
                </div>
              </div>
              <div style={{fontSize:12,color:C.muted,marginTop:4,lineHeight:1.5}}>{n.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
function ProfilePage({darkMode, setDarkMode, avatar, setAvatar}) {
  const [tab,setTab]         = useState('profile')
  const [saved,setSaved]     = useState(false)
  const [deleteConf,setDeleteConf] = useState(false)
  const [showPw,setShowPw]   = useState({cur:false,nw:false,cf:false})
  const [profile,setProfile] = useState({firstName:'Admin',lastName:'Dr',displayName:'Dr. Admin',email:'admin@clinic.com',phone:'+971 50 000 0000',department:'General',timezone:'UTC+04:00',licenseNo:'DHA-12345',bio:''})
  const [notifPrefs,setNotifPrefs] = useState({email:true,sms:true,push:false,weeklyDigest:true,reminders:true})
  const [pw,setPw] = useState({cur:'',nw:'',cf:''})

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (file) { const r=new FileReader(); r.onload=ev=>{if(typeof window!=='undefined')localStorage.setItem('clinicAvatar',ev.target.result);setAvatar(ev.target.result)}; r.readAsDataURL(file) }
  }
  function saveProfile(){setSaved(true);setTimeout(()=>setSaved(false),2500)}

  const pwStrength = pw.nw.length===0?0:pw.nw.length<6?1:pw.nw.length<10?2:/[A-Z]/.test(pw.nw)&&/[0-9]/.test(pw.nw)&&pw.nw.length>=10?4:3
  const pwColors   = ['#e5e7eb',C.red,C.orange,C.amber,C.green]
  const pwLabels   = ['','Weak','Fair','Good','Strong']

  const TABS = [{id:'profile',label:'Profile Info'},{id:'password',label:'Password'},{id:'preferences',label:'Preferences'},{id:'danger',label:'Danger Zone'}]

  const Toggle=({on,onToggle})=>(
    <div onClick={onToggle} style={{width:40,height:22,borderRadius:11,background:on?C.blue:'#d1d5db',cursor:'pointer',position:'relative',transition:'background 200ms',flexShrink:0}}>
      <div style={{position:'absolute',top:3,left:on?21:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left 200ms',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
    </div>
  )

  return (
    <div style={{padding:28,maxWidth:720}}>
      <div style={{fontSize:26,fontWeight:800,color:C.body,letterSpacing:'-0.7px',marginBottom:24}}>My Profile</div>

      {/* Avatar */}
      <div style={{...card,padding:'24px 28px',marginBottom:20,display:'flex',alignItems:'center',gap:24}}>
        <div style={{position:'relative',flexShrink:0}}>
          <div style={{width:80,height:80,borderRadius:20,background:C.blueSoft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:800,color:C.blueDark,overflow:'hidden',border:`2px solid ${C.border}`}}>
            {avatar?<img src={avatar} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="avatar"/>:'Dr'}
          </div>
          <label style={{position:'absolute',bottom:-6,right:-6,width:24,height:24,borderRadius:'50%',background:C.blue,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'2px solid #fff',fontSize:12}}>
            <span style={{color:'#fff'}}>✎</span>
            <input type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarChange}/>
          </label>
        </div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.body}}>{profile.displayName}</div>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>{profile.email}</div>
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <label style={{...btn(),padding:'6px 14px',fontSize:12,cursor:'pointer'}}>
              Upload photo<input type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarChange}/>
            </label>
            {avatar&&<button onClick={()=>{if(typeof window!=='undefined')localStorage.removeItem('clinicAvatar');setAvatar(null)}} style={{...btn('outline'),padding:'6px 14px',fontSize:12}}>Remove</button>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--c-subtle)',borderRadius:11,padding:4,width:'fit-content'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'7px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:tab===t.id?600:400,background:tab===t.id?C.white:'transparent',color:tab===t.id?C.body:C.muted,boxShadow:tab===t.id?'0 1px 4px rgba(0,0,0,0.08)':'none',transition:'all 150ms',fontFamily:'inherit'}}>{t.label}</button>
        ))}
      </div>

      {/* Profile Info */}
      {tab==='profile'&&(
        <div style={{...card,padding:'24px 28px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            {[['First Name','firstName'],['Last Name','lastName'],['Display Name','displayName'],['Email Address','email'],['Phone Number','phone'],['Department','department'],['Timezone','timezone'],['License No.','licenseNo']].map(([label,key])=>(
              <div key={key}><label style={lbl}>{label}</label><input style={inp} value={profile[key]} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))}/></div>
            ))}
          </div>
          <div style={{marginBottom:16}}>
            <label style={lbl}>Bio <span style={{color:'#9ca3af'}}>(optional)</span></label>
            <textarea style={{...inp,resize:'vertical',minHeight:80}} value={profile.bio} onChange={e=>setProfile(p=>({...p,bio:e.target.value}))} placeholder="A short bio about yourself..."/>
            <div style={{fontSize:11,color:C.muted,marginTop:4,textAlign:'right'}}>{profile.bio.length}/300</div>
          </div>
          <button onClick={saveProfile} style={{...btn(),background:saved?C.green:C.blue}}>{saved?'Saved!':'Save Changes'}</button>
        </div>
      )}

      {/* Password */}
      {tab==='password'&&(
        <div style={{...card,padding:'24px 28px'}}>
          <div style={{fontSize:15,fontWeight:700,color:C.body,marginBottom:18}}>Change Password</div>
          <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20,maxWidth:440}}>
            {[['Current Password','cur'],['New Password','nw'],['Confirm Password','cf']].map(([label,key])=>(
              <div key={key}>
                <label style={lbl}>{label}</label>
                <div style={{position:'relative'}}>
                  <input type={showPw[key]?'text':'password'} style={{...inp,paddingRight:40}} value={pw[key]} onChange={e=>setPw(p=>({...p,[key]:e.target.value}))} placeholder="••••••••"/>
                  <button onClick={()=>setShowPw(s=>({...s,[key]:!s[key]}))} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:13,fontFamily:'inherit'}}>{showPw[key]?'Hide':'Show'}</button>
                </div>
              </div>
            ))}
            {pw.nw.length>0&&(
              <div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.muted,marginBottom:4}}><span>Password strength</span><span style={{color:pwColors[pwStrength],fontWeight:600}}>{pwLabels[pwStrength]}</span></div>
                <div style={{height:4,background:'var(--c-subtle)',borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pwStrength*25}%`,background:pwColors[pwStrength],borderRadius:2,transition:'all 300ms'}}/>
                </div>
              </div>
            )}
            {pw.cf.length>0&&pw.nw!==pw.cf&&<div style={{fontSize:12,color:C.red}}>Passwords do not match.</div>}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setPw({cur:'',nw:'',cf:''})} style={btn()}>Update Password</button>
            <button onClick={()=>setPw({cur:'',nw:'',cf:''})} style={btn('outline')}>Cancel</button>
          </div>
          <div style={{...card,padding:'20px 24px',marginTop:20,background:'var(--c-input-bg)'}}>
            <div style={{fontSize:14,fontWeight:700,color:C.body,marginBottom:4}}>Two-Factor Authentication</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Add an extra layer of security to your account.</div>
            <button style={btn()}>Enable 2FA</button>
          </div>
        </div>
      )}

      {/* Preferences */}
      {tab==='preferences'&&(
        <div style={{...card,padding:'24px 28px'}}>
          <div style={{fontSize:15,fontWeight:700,color:C.body,marginBottom:4}}>Notifications</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Choose how you receive notifications.</div>
          {[['email','Email notifications'],['sms','SMS alerts'],['push','Push notifications'],['weeklyDigest','Weekly digest'],['reminders','Appointment reminders']].map(([k,label])=>(
            <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:`1px solid var(--c-subtle)`}}>
              <span style={{fontSize:13,color:C.label,fontWeight:500}}>{label}</span>
              <Toggle on={notifPrefs[k]} onToggle={()=>setNotifPrefs(p=>({...p,[k]:!p[k]}))}/>
            </div>
          ))}
          <div style={{fontSize:15,fontWeight:700,color:C.body,marginTop:22,marginBottom:4}}>Display</div>
          {[['darkMode','Dark mode'],['compactView','Compact view']].map(([k,label])=>(
            <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:`1px solid var(--c-subtle)`}}>
              <span style={{fontSize:13,color:C.label,fontWeight:500}}>{label}</span>
              <Toggle
                on={k==='darkMode' ? darkMode : false}
                onToggle={k==='darkMode' ? ()=>setDarkMode(d=>!d) : ()=>{}}
              />
            </div>
          ))}
        </div>
      )}

      {/* Danger Zone */}
      {tab==='danger'&&(
        <div style={{...card,padding:'24px 28px',border:'1.5px solid #fecaca'}}>
          <div style={{fontSize:15,fontWeight:700,color:'#991b1b',marginBottom:4}}>Danger Zone</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:22}}>These actions are permanent and cannot be undone.</div>
          {[
            {label:'Export My Data',      desc:'Download a copy of all your data.',                                              btnLabel:'Export',         color:C.blue,  solid:true},
            {label:'Deactivate Account',  desc:'Temporarily disable your account. You can reactivate anytime by signing in.',   btnLabel:'Deactivate',     color:C.amber, solid:false},
            {label:'Delete Account',      desc:'Permanently delete your account and all associated data.',                       btnLabel:'Delete Account', color:C.red,   solid:false, danger:true},
          ].map((item,i,arr)=>(
            <div key={item.label} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:20,padding:'18px 0',borderBottom:i<arr.length-1?`1px solid #fecaca`:'none'}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.body,marginBottom:4}}>{item.label}</div>
                <div style={{fontSize:12,color:C.muted,maxWidth:380,lineHeight:1.5}}>{item.desc}</div>
              </div>
              <button onClick={item.danger?()=>setDeleteConf(true):undefined} style={{...btn(item.solid?'solid':'outline'),background:item.solid?item.color:'#fff',color:item.solid?'#fff':item.color,border:item.solid?'none':`1px solid ${item.color}`,flexShrink:0,fontSize:12,padding:'8px 16px'}}>{item.btnLabel}</button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConf&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,20,30,0.45)',backdropFilter:'blur(4px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{...card,width:400,padding:'32px 28px',textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:700,color:C.body,marginBottom:8}}>Delete account?</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:24}}>This action is permanent and cannot be undone. All your data will be lost.</div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setDeleteConf(false)} style={{...btn('outline'),flex:1}}>Cancel</button>
              <button onClick={()=>setDeleteConf(false)} style={{...btn(),flex:1,background:C.red}}>Delete Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{...card,width:400,padding:'48px 44px',boxShadow:'0 8px 40px rgba(0,0,0,0.10)',borderRadius:20}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:22,fontWeight:800,color:C.blueDark,letterSpacing:'-0.5px'}}>ClinicPulse 2.0</div>
          <div style={{fontSize:13,color:C.muted,marginTop:6,fontWeight:500}}>Command Center Access</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
          <div>
            <label style={lbl}>Email</label>
            <input style={{...inp,height:44,padding:'0 14px',fontSize:14}} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="doctor@clinic.com"/>
          </div>
          <div>
            <label style={lbl}>Password</label>
            <input style={{...inp,height:44,padding:'0 14px',fontSize:14}} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&onLogin()}/>
          </div>
        </div>
        <button onClick={onLogin} style={{...btn(),width:'100%',padding:'13px',fontSize:15,fontWeight:700,borderRadius:11,letterSpacing:'-0.2px'}}>Sign In</button>
        <div style={{textAlign:'center',marginTop:16,fontSize:12,color:C.muted}}>Forgot password? <span style={{color:C.blue,cursor:'pointer',fontWeight:500}}>Reset</span></div>
      </div>
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn,setLoggedIn]       = useState(false)
  const [showLogout,setShowLogout]   = useState(false)
  const [clients,setClients]         = useState([])
  const [loading,setLoading]         = useState(true)
  const [error,setError]             = useState(null)
  const [showAdd,setShowAdd]         = useState(false)
  const [toast,setToast]             = useState(null)
  const [sending,setSending]         = useState(null)
  const [doing,setDoing]             = useState(null)
  const [editRow,setEditRow]         = useState(null)
  const [editV,setEditV]             = useState({})
  const [activeNav,setActiveNav]     = useState('Dashboard')
  const [selected,setSelected]       = useState(null)
  const [navSearch,setNavSearch]     = useState('')
  const [notifs,setNotifs]           = useState(SAMPLE_NOTIFS)
  const [darkMode,setDarkMode]       = useState(false)
  const [avatar,setAvatar]           = useState(()=>typeof window!=='undefined'?localStorage.getItem('clinicAvatar')||null:null)

  useEffect(()=>{
    fetch(WEBHOOK_URL).then(r=>r.json()).then(d=>{setClients(Array.isArray(d)?d:[]);setLoading(false)}).catch(e=>{setError(e.message);setLoading(false)})
  },[])

  function showToast(msg, type='success') { setToast({msg,type}) }
  function handleNav(page) { setActiveNav(page); setSelected(null) }

  if (!loggedIn) return <LoginScreen onLogin={()=>setLoggedIn(true)}/>

  const sharedProps = { clients,loading,error,sending,setSending,doing,setDoing,editRow,setEditRow,editV,setEditV,setClients,showToast,selected,setSelected }

  return (
    <div data-theme={darkMode?'dark':'light'} style={{display:'flex',height:'100vh',overflow:'hidden',background:C.bg,fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style dangerouslySetInnerHTML={{__html:THEME_CSS}}/>
      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      {showLogout&&<LogoutModal onConfirm={()=>{setLoggedIn(false);setShowLogout(false)}} onCancel={()=>setShowLogout(false)}/>}
      <Sidebar active={activeNav} onNav={handleNav} onSignOut={()=>setShowLogout(true)}/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <Topbar page={activeNav} search={navSearch} setSearch={setNavSearch} onNav={handleNav} onSignOut={()=>setShowLogout(true)} notifs={notifs} setNotifs={setNotifs} avatar={avatar}/>
        <div style={{flex:1,overflowY:'auto'}}>
          {activeNav==='Dashboard'&&<DashboardPage {...sharedProps} onShowAdd={()=>setShowAdd(true)} search={navSearch} setSearch={setNavSearch}/>}
          {activeNav==='Patients'&&<PatientsPage {...sharedProps} showAdd={showAdd} setShowAdd={setShowAdd}/>}
          {activeNav==='Appointments'&&<AppointmentsPage/>}
          {activeNav==='Analytics'&&<AnalyticsPage clients={clients}/>}
          {activeNav==='Settings'&&<SettingsPage/>}
          {activeNav==='Notifications'&&<NotificationsPage notifs={notifs} setNotifs={setNotifs}/>}
          {activeNav==='Profile'&&<ProfilePage darkMode={darkMode} setDarkMode={setDarkMode} avatar={avatar} setAvatar={setAvatar}/>}
        </div>
      </div>
      {activeNav==='Dashboard'&&showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={(c,rowNum)=>{const nc={Client_ID:`CLT-${crypto.randomUUID().slice(0,8)}`,...c,Status:'Active',Last_Reminder_Sent:'',Next_Reminder_Date:'',row_number:rowNum??Date.now()};setClients(cs=>[...cs,nc]);showToast(`${c.Full_Name} added`);setShowAdd(false)}}/>}
    </div>
  )
}
