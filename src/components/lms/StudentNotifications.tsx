import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, BookOpen, CalendarDays, ChevronRight, FileText, X } from 'lucide-react';
import { confirmAction } from '../../lib/dialogs';
import { displayDate, rpc } from '../../lib/lms';
import '../../styles/notifications.css';

type Category = 'materials' | 'documents' | 'mocks';
type Notification = {id:string;category:Category;title:string;body:string;created_at:string;read_at:string|null;resolved_at?:string|null};
type Feed = {items:Notification[];counts:Partial<Record<Category,number>>};
const empty:Feed={items:[],counts:{}};
const Notifications=createContext({feed:empty,loading:false,error:'',reading:false,role:'student',refresh:async()=>{},read:async(_id?:string,_category?:Category)=>{},clear:async(_id?:string,_readOnly?:boolean)=>{}});
export function notificationCategory(path:string):Category|undefined {
  if(['/materials','/student/learning'].includes(path))return 'materials';
  if(['/mock-interviews','/student/mocks'].includes(path))return 'mocks';
  if(['/documents','/document-requests','/certificate-requests','/student/documents'].includes(path))return 'documents';
}
export function NotificationProvider({role,children}:{role:'admin'|'student';children:ReactNode;key?:string}) {
  const [feed,setFeed]=useState<Feed>(empty),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reading,setReading]=useState(false);
  const alive=useRef(true),sequence=useRef(0);
  async function refresh(){
    if(!navigator.onLine){if(alive.current){setLoading(false);setError('You’re offline. Reconnect to see new updates.');}return;}
    const request=++sequence.current;
    try{const result=await rpc<Feed>('lms_notifications');if(alive.current&&request===sequence.current){setFeed(result);setError('');}}
    catch{if(alive.current&&request===sequence.current)setError('Updates could not load. Please retry.');}
    finally{if(alive.current&&request===sequence.current)setLoading(false);}
  }
  async function read(id?:string,category?:Category){
    setReading(true);
    try{await rpc('lms_read_notifications',{p_id:id??null,p_category:category??null});await refresh();}
    catch{if(alive.current)setError('Could not mark updates as read. Please retry.');}
    finally{if(alive.current)setReading(false);}
  }
  async function clear(id?:string,readOnly=false){
    setReading(true);
    try{await rpc('lms_clear_notifications',{p_id:id??null,p_read_only:readOnly});await refresh();}
    catch{if(alive.current)setError('Could not clear notifications. Please retry.');}
    finally{if(alive.current)setReading(false);}
  }
  useEffect(()=>{
    alive.current=true;void refresh();
    const update=()=>{if(document.visibilityState!=='hidden')void refresh();};
    const timer=window.setInterval(update,30000);
    window.addEventListener('focus',update);window.addEventListener('online',update);window.addEventListener('lihatech-activity',update);document.addEventListener('visibilitychange',update);
    return()=>{alive.current=false;sequence.current++;window.clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('online',update);window.removeEventListener('lihatech-activity',update);document.removeEventListener('visibilitychange',update);};
  },[]);
  return <Notifications.Provider value={{feed,loading,error,reading,role,refresh,read,clear}}>{children}</Notifications.Provider>;
}
export function NotificationBadge({path}:{path:string}){
  const {feed}=useContext(Notifications),category=notificationCategory(path),count=category?feed.counts[category]??0:0;
  return count>0?<span className="portal-notification-badge" aria-label={`${count} unread updates`}>{count>99?'99+':count}</span>:null;
}
export default function StudentNotifications({navigate}:{navigate:(path:string)=>void}){
  const {feed,loading,error,reading,role,refresh,read,clear}=useContext(Notifications);
  const details=useRef<HTMLDetailsElement>(null);
  const total:number=(['materials','documents','mocks'] as const).reduce((sum,category)=>sum+(feed.counts[category]??0),0);
  useEffect(()=>{const outside=(event:MouseEvent)=>{if(details.current?.open&&!details.current.contains(event.target as Node))details.current.open=false;};document.addEventListener('click',outside);return()=>document.removeEventListener('click',outside);},[]);
  const go=(notification:Notification)=>{void read(notification.id);if(details.current)details.current.open=false;navigate(role==='admin'?{materials:'/materials',documents:'/document-requests',mocks:'/mock-interviews'}[notification.category]:{materials:'/student/learning',documents:'/student/documents',mocks:'/student/mocks'}[notification.category]);window.dispatchEvent(new CustomEvent('lihatech-notification-open',{detail:notification.category}));};
  return <details className="portal-notifications" ref={details} onToggle={event=>{if(event.currentTarget.open)void refresh();}} onKeyDown={event=>{if(event.key==='Escape'&&details.current?.open){details.current.open=false;details.current.querySelector('summary')?.focus();}}}>
    <summary aria-label={`Notifications${total?`, ${total} unread`:''}`} title="Notifications"><Bell size={20}/>{total>0&&<span className="portal-notification-badge" aria-hidden="true">{total>99?'99+':total}</span>}</summary>
    <section className="portal-notifications-panel" aria-label="Notification updates">
      <div className="portal-notifications-heading"><h2>Notifications</h2><button type="button" disabled={!total||reading} onClick={()=>void read()}>{reading?'Saving…':'Mark all read'}</button></div>
      <p className="portal-notifications-caption">Materials, documents and interview updates.</p>
      <div className="portal-notifications-controls"><button type="button" disabled={reading||!feed.items.some(row=>row.read_at||row.resolved_at)} onClick={()=>void clear(undefined,true)}>Clear read</button><button type="button" disabled={reading||!feed.items.length} onClick={async()=>{if(await confirmAction('Clear your current notifications? Requests, documents and calendar events will not be deleted.','Clear notifications'))void clear();}}>Clear all</button></div>
      {error&&<p className="portal-notifications-error" role="alert">{error} <button type="button" onClick={()=>void refresh()}>Retry</button></p>}
      {loading&&<p role="status">Loading updates…</p>}
      {!loading&&!error&&!feed.items.length&&<p className="portal-notifications-caption">You’re all caught up. New updates will appear here.</p>}
      {[{label:'New',items:feed.items.filter(row=>!row.read_at&&!row.resolved_at)},{label:'Earlier',items:feed.items.filter(row=>row.read_at||row.resolved_at)}].map(group=>group.items.length>0&&<div className="portal-notifications-group" key={group.label}><h3>{group.label}</h3>{group.items.map(row=>{const Icon={materials:BookOpen,documents:FileText,mocks:CalendarDays}[row.category];return <div className="portal-notification-row" key={row.id}><button className={`portal-notification-item ${row.read_at||row.resolved_at?'':'is-unread'}`} type="button" onClick={()=>go(row)}><span className="portal-notification-icon"><Icon size={18}/></span><span><strong>{row.title}{!row.read_at&&!row.resolved_at&&<span className="portal-unread-dot" aria-label="Unread"/>}</strong><span>{row.body}</span><small>{displayDate(row.created_at)}</small></span><ChevronRight size={16}/></button><button type="button" className="portal-notification-dismiss" aria-label={`Clear ${row.title}`} disabled={reading} onClick={()=>void clear(row.id)}><X size={16}/></button></div>;})}</div>)}
    </section>
  </details>;
}
