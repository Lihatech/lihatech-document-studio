import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './modal.css';

export default function Modal({title,children,onClose,busy=false,wide=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    ref.current?.showModal();
    return ()=>{document.body.style.overflow=overflow;previous?.focus({preventScroll:true});};
  },[]);
  return createPortal(<dialog ref={ref} className={`portal-dialog${wide?' is-wide':''}`} aria-label={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header><h2>{title}</h2><button type="button" disabled={busy} aria-label="Close window" onClick={onClose}><X size={20}/></button></header>
    <div className="portal-dialog-body lms-workspace">{children}</div>
  </dialog>,document.body);
}
