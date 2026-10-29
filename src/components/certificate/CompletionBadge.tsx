import React, { useId } from 'react';
import type { Certificate } from '../../types';

function GoldGradient({id}:{id:string}){
  return <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E8C875"/><stop offset="25%" stopColor="#FFF3CD"/><stop offset="50%" stopColor="#D6B56D"/><stop offset="75%" stopColor="#FFF3CD"/><stop offset="100%" stopColor="#A8812D"/></linearGradient>;
}

// Each SVG must contain its own gradients: PDF capture serializes SVGs individually.
export default function CompletionBadge({template,scale}:{template:Certificate['designTemplate'];scale:number}){
  const id='certificate-badge-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
  return (<div
    className="relative w-28 h-28 flex items-center justify-center"
    style={{ transform: `rotate(-3deg) translateY(4px) scale(${scale})`, transformOrigin: 'center' }}
  >
    {/* Ribbon Tails with shiny gold metallic borders (themed) */}
    <svg data-certificate-badge="ribbons" xmlns="http://www.w3.org/2000/svg" width="96" height="112" className="absolute bottom-[-24px] w-24 h-28 select-none pointer-events-none z-0" viewBox="0 0 100 120">
      <defs><GoldGradient id={`${id}-ribbon-gold`}/></defs>
      {/* Left Ribbon with gold border */}
      <polygon points="15,0 42,0 35,110 10,120 15,0" fill={`url(#${id}-ribbon-gold)`} />
      <polygon points="17,0 40,0 34,107 13,116 17,0" fill={template === 'emerald' ? '#0F766E' : '#43080F'} />
      
      {/* Right Ribbon with gold border */}
      <polygon points="58,0 85,0 90,120 65,110 58,0" fill={`url(#${id}-ribbon-gold)`} />
      <polygon points="60,0 83,0 87,116 66,107 60,0" fill={template === 'emerald' ? '#0D9488' : '#43080F'} opacity="0.95" />
    </svg>
    {/* Gold Badge SVG (Exact Laurel Wreath & stars layout from image) */}
    <svg data-certificate-badge="seal" xmlns="http://www.w3.org/2000/svg" width="112" height="112" className="absolute w-28 h-28 text-amber-500 drop-shadow-md z-10" viewBox="0 0 100 100">
      <defs><GoldGradient id={`${id}-seal-gold`}/><linearGradient id={`${id}-seal-burgundy`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#43080F"/><stop offset="50%" stopColor="#250205"/><stop offset="100%" stopColor="#120001"/></linearGradient></defs>
      {/* Wavy/spoked gold metallic seal border */}
      <path 
        d="M50 2 L53 14 L64 8 L65 20 L76 17 L73 28 L83 29 L77 40 L85 44 L77 53 L83 61 L73 65 L76 76 L65 73 L64 85 L53 79 L50 91 L47 79 L36 85 L35 73 L24 76 L27 65 L17 61 L23 53 L15 44 L23 40 L17 29 L27 28 L24 17 L35 20 L36 8 L47 14 Z" 
        fill={`url(#${id}-seal-gold)`} 
      />
      
      {/* Inner themed background */}
      <circle cx="50" cy="50" r="34" fill={template === 'emerald' ? '#115E59' : `url(#${id}-seal-burgundy)`} />
      
      {/* Thin inner gold ring */}
      <circle cx="50" cy="50" r="31" fill="none" stroke={`url(#${id}-seal-gold)`} strokeWidth="1.2" />
      <circle cx="50" cy="50" r="29" fill="none" stroke={`url(#${id}-seal-gold)`} strokeWidth="0.6" opacity="0.8" />
      
      {/* Stylized Laurel Wreath */}
      {/* Left Branch */}
      <path d="M 31,50 C 31,63 42,70 50,70" fill="none" stroke={`url(#${id}-seal-gold)`} strokeWidth="1" strokeLinecap="round" />
      {/* Leaves Left */}
      <path d="M 31,50 Q 27,47 31,44 Q 35,47 31,50 Z" fill={`url(#${id}-seal-gold)`} />
      <path d="M 31,56 Q 26,54 30,50 Q 34,52 31,56 Z" fill={`url(#${id}-seal-gold)`} />
      <path d="M 33,62 Q 28,61 31,56 Q 35,57 33,62 Z" fill={`url(#${id}-seal-gold)`} />
      <path d="M 37,67 Q 32,67 35,62 Q 39,62 37,67 Z" fill={`url(#${id}-seal-gold)`} />
      <path d="M 43,70 Q 39,71 41,66 Q 45,65 43,70 Z" fill={`url(#${id}-seal-gold)`} />
      
      {/* Right Branch */}
      <path d="M 69,50 C 69,63 58,70 50,70" fill="none" stroke={`url(#${id}-seal-gold)`} strokeWidth="1" strokeLinecap="round" />
      {/* Leaves Right */}
      <path d="M 69,50 Q 73,47 69,44 Q 65,47 69,50 Z" fill={`url(#${id}-seal-gold)`} />
      <path d="M 69,56 Q 74,54 70,50 Q 66,52 69,56 Z" fill={`url(#${id}-seal-gold)`} />
      <path d="M 67,62 Q 72,61 69,56 Q 65,57 67,62 Z" fill={`url(#${id}-seal-gold)`} />
      <path d="M 63,67 Q 68,67 65,62 Q 61,62 63,67 Z" fill={`url(#${id}-seal-gold)`} />
      <path d="M 57,70 Q 61,71 59,66 Q 55,65 57,70 Z" fill={`url(#${id}-seal-gold)`} />
      
      {/* Stars at the top */}
      {/* Center large star */}
      <polygon points="50,21 52,25 57,25 53,28 55,32 50,30 45,32 47,28 43,25 48,25" fill={`url(#${id}-seal-gold)`} />
      {/* Left star */}
      <polygon points="41,24 42.5,27 45.5,27 43,29 44,32 41,30.5 38,32 39,29 36.5,27 39.5,27" fill={`url(#${id}-seal-gold)`} transform="rotate(-12 41 24)" />
      {/* Right star */}
      <polygon points="59,24 60.5,27 63.5,27 61,29 62,32 59,30.5 56,32 57,29 54.5,27 57.5,27" fill={`url(#${id}-seal-gold)`} transform="rotate(12 59 24)" />
    </svg>
    <div className="relative text-center flex flex-col items-center justify-center z-20 p-1">
      <span className="text-[7.5px] font-black tracking-wider text-[#F3D78E] uppercase leading-none block">CERTIFICATE</span>
      <span className="text-[5.5px] font-bold text-slate-300 tracking-normal uppercase leading-none block my-0.5">OF</span>
      <span className="text-[7.5px] font-black tracking-wider text-[#F3D78E] uppercase leading-none block">COMPLETION</span>
    </div>
  </div>);
}
