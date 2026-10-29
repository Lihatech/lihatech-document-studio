import React from 'react';
import type { Certificate } from '../../types';
import royalBadge from './completion-badge-royal.svg';
import emeraldBadge from './completion-badge-emerald.svg';

// A self-contained image keeps the seal, gradients and ribbons together during PDF capture.
export default function CompletionBadge({template,scale}:{template:Certificate['designTemplate'];scale:number}){
  return <div className="relative w-28 h-28" style={{transform:`rotate(-3deg) translateY(4px) scale(${scale})`,transformOrigin:'center'}}>
    <img data-certificate-badge="seal" src={template==='emerald'?emeraldBadge:royalBadge} alt="Certificate of completion badge" width={112} height={136} style={{position:'absolute',left:0,top:0,width:112,height:136,maxWidth:'none'}}/>
  </div>;
}
