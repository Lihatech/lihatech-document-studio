import { useEffect, useState } from 'react';
import Modal from '../components/Modal';

type Message={message:string;confirm:boolean;label:string;resolve:(accepted:boolean)=>void};
export function confirmAction(message:string,label='Continue'):Promise<boolean>{
  return new Promise(resolve=>window.dispatchEvent(new CustomEvent<Message>('lihatech-warning',{detail:{message,confirm:true,label,resolve}})));
}
export function showWarning(message:string){
  window.dispatchEvent(new CustomEvent<Message>('lihatech-warning',{detail:{message,confirm:false,label:'OK',resolve:()=>{}}}));
}
export function AppDialogs(){
  const [messages,setMessages]=useState<Message[]>([]);
  useEffect(()=>{const receive=(event:Event)=>setMessages(items=>[...items,(event as CustomEvent<Message>).detail]);window.addEventListener('lihatech-warning',receive);return()=>window.removeEventListener('lihatech-warning',receive);},[]);
  const message=messages[0];
  function finish(accepted:boolean){message.resolve(accepted);setMessages(items=>items.slice(1));}
  return message?<Modal title={message.confirm?'Please confirm':'Please check'} onClose={()=>finish(false)}><p>{message.message}</p><div className="app-warning-actions">{message.confirm&&<button type="button" onClick={()=>finish(false)} autoFocus>Cancel</button>}<button type="button" className="warning-confirm" onClick={()=>finish(true)}>{message.label}</button></div></Modal>:null;
}
