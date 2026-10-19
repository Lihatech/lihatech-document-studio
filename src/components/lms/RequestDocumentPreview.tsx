import React, { Suspense, useEffect, useId, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { Certificate, Letter } from '../../types';
import type { RequestDocumentContent } from '../../lib/requestDocumentPreview';
import { normalizeSettings } from '../../utils/storage';

const CertificatePreview=React.lazy(()=>import('../certificate/CertificatePreview'));
const LetterPreview=React.lazy(()=>import('../letter/LetterPreview'));

export default function RequestDocumentPreview({content}:{content:RequestDocumentContent}) {
  const settings=normalizeSettings(content.settings);
  return <div className="request-document-preview">
    <Suspense fallback={<p role="status">Loading document preview…</p>}>
      {content.kind==='certificate' ? <CertificatePreview certificate={content.document as Certificate} settings={settings} showActions={false}/> : <LetterPreview letter={content.document as Letter} settings={settings} showActions={false}/>}
    </Suspense>
  </div>;
}

export function DocumentPreviewDialog({content,onClose,downloadOnOpen=false}:{content:RequestDocumentContent;onClose:()=>void;downloadOnOpen?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null),sheet=useRef<HTMLDivElement>(null);
  const automaticStarted=useRef(false);
  const heading=useId();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const settings=normalizeSettings(content.settings);
  const filename=`LihaTech_${content.kind}_${content.document.candidateName}`.replace(/[^\p{L}\p{N}_-]/gu,'_')+'.pdf';
  async function download() {
    if(content.draft) return;
    setBusy(true);setError('');
    try {
      let blob:Blob;
      if(content.kind==='certificate') {
        if(!sheet.current) throw new Error('The certificate is still loading. Please try again.');
        const {captureCertificate,createCertificatePdf}=await import('../../utils/certificateExport');
        blob=(await createCertificatePdf(await captureCertificate(sheet.current),{includePreview:false})).pdfBlob;
      } else {
        const [{pdf},{default:OfferLetterPDF}]=await Promise.all([import('@react-pdf/renderer'),import('../letter/OfferLetterPDF')]);
        blob=await pdf(<OfferLetterPDF letter={content.document as Letter} settings={settings}/>).toBlob();
      }
      const {saveAs}=await import('file-saver');saveAs(blob,filename);
    } catch(e) {setError(e instanceof Error?e.message:'Could not download the document. Please try again.');}
    finally {setBusy(false);}
  }
  useEffect(()=>{if(!dialog.current?.open)dialog.current?.showModal();},[]);
  // Wait for the lazy-loaded, full-resolution certificate sheet before an automatic download.
  const exportReady=()=>{if(downloadOnOpen&&!content.draft&&!automaticStarted.current){automaticStarted.current=true;void download();}};
  useEffect(()=>{if(content.kind==='offer_letter')exportReady();},[]);
  return <dialog ref={dialog} className="request-preview-dialog" aria-labelledby={heading} onClose={onClose}>
    <header><div><h2 id={heading}>{content.draft?'Document preview':'Your approved document'}</h2><p>{content.draft?'For review only. Admin confirms the final document before publishing.':content.document.candidateName}</p></div><div>{!content.draft&&<button className="primary-button" disabled={busy} onClick={()=>void download()}><Download size={17}/>{busy?'Preparing PDF…':'Download PDF'}</button>}<button className="outline-button" aria-label="Close document preview" onClick={()=>dialog.current?.close()}><X size={18}/></button></div></header>
    {error&&<p className="request-error" role="alert">{error}</p>}
    <RequestDocumentPreview content={content}/>
    {!content.draft&&content.kind==='certificate'&&<div className="request-export-sheet" aria-hidden="true"><Suspense fallback={null}><CertificatePreview certificate={content.document as Certificate} settings={settings} showActions={false} renderOnlySheet divRef={sheet}/><ExportReady onReady={exportReady}/></Suspense></div>}
  </dialog>;
}
function ExportReady({onReady}:{onReady:()=>void}) {useEffect(onReady,[]);return null;}
