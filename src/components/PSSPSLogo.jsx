import React from 'react';

export default function PSSPSLogo({ size = 44, customUrl = null }) {
  if (customUrl) {
    return (
      <img
        src={customUrl}
        alt="Logo PSSPS"
        style={{ width: size, height: size }}
        className="rounded-full object-cover border-2 border-amber-400 shadow"
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0 drop-shadow">
      <polygon points="10,20 55,60 15,95" fill="#111827" />
      <polygon points="18,26 55,60 22,88" fill="#dc2626" />
      <polygon points="24,32 55,60 28,82" fill="#facc15" />
      <polygon points="110,20 65,60 105,95" fill="#111827" />
      <polygon points="102,26 65,60 98,88" fill="#dc2626" />
      <polygon points="96,32 65,60 92,82" fill="#facc15" />
      <path d="M60 18 L92 30 L88 78 Q60 106 60 106 Q32 78 28 30 Z" fill="#09090b" stroke="#facc15" strokeWidth="3" />
      <path d="M46 16 Q60 4 74 16 L70 24 L50 24 Z" fill="#3f3f26" stroke="#facc15" strokeWidth="1.5" />
      <circle cx="60" cy="58" r="21" fill="none" stroke="#dc2626" strokeWidth="3" />
      <path d="M51 44 Q60 60 69 44 Q60 72 51 72 Q60 60 69 72" fill="none" stroke="#facc15" strokeWidth="2.5" />
      <text x="41" y="62" fill="#facc15" fontSize="11" fontWeight="bold" textAnchor="middle">١٣</text>
      <text x="79" y="62" fill="#facc15" fontSize="11" fontWeight="bold" textAnchor="middle">١٧</text>
      <text x="60" y="92" fill="#facc15" fontSize="6.5" fontWeight="bold" textAnchor="middle">PSSPS</text>
    </svg>
  );
}
