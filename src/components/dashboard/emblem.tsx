/**
 * Emblem & logo SVG buatan sendiri untuk tampilan dashboard keuangan daerah.
 */

export function DkiEmblem({ className = 'h-8 w-8' }: { className?: string }) {
  // Perisai sederhana dengan bintang — pengganti logo provinsi
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" role="presentation">
      <path
        d="M24 2 L42 8 V24 C42 35 34 43 24 46 C14 43 6 35 6 24 V8 Z"
        fill="#1d4ed8"
        stroke="#facc15"
        strokeWidth="2"
      />
      <path
        d="M24 12 l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7 Z"
        fill="#fefce8"
      />
      <path d="M14 33 q10 6 20 0" stroke="#facc15" strokeWidth="2" fill="none" />
    </svg>
  )
}

export function BpkdLogo({
  className = '',
  text = 'BPKD',
  subtext = 'Provinsi DKI Jakarta',
}: {
  className?: string
  text?: string
  subtext?: string
}) {
  // Logo geometris: tiga segitiga warna (merah/kuning/biru) + teks brand
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-12 w-12 shrink-0" aria-hidden="true" role="presentation">
        <polygon points="32,4 44,26 20,26" fill="#dc2626" />
        <polygon points="32,4 44,26 32,26" fill="#b91c1c" />
        <polygon points="8,40 20,26 32,40" fill="#f59e0b" />
        <polygon points="56,40 44,26 32,40" fill="#1d4ed8" />
        <polygon points="20,26 44,26 32,40" fill="#0e7490" opacity="0.85" />
        <rect x="8" y="44" width="48" height="6" rx="2" fill="#334155" />
        <rect x="14" y="54" width="36" height="4" rx="2" fill="#64748b" />
      </svg>
      <div className="leading-tight">
        <div className="text-lg font-extrabold tracking-wide text-white drop-shadow-sm">
          {text}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
          {subtext}
        </div>
      </div>
    </div>
  )
}

export function GoldEmblem({ className = 'h-24 w-24' }: { className?: string }) {
  // Lencana emas bundar dengan teks melingkar
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" role="presentation">
      <defs>
        <path id="emblem-arc-top" d="M 100,100 m -74,0 a 74,74 0 1,1 148,0" fill="none" />
        <path id="emblem-arc-bottom" d="M 100,100 m -74,0 a 74,74 0 1,0 148,0" fill="none" />
      </defs>
      <circle cx="100" cy="100" r="96" fill="#b45309" />
      <circle cx="100" cy="100" r="90" fill="#fbbf24" />
      <circle cx="100" cy="100" r="62" fill="none" stroke="#92400e" strokeWidth="2" />
      <circle cx="100" cy="100" r="86" fill="none" stroke="#92400e" strokeWidth="2" />
      <text fill="#78350f" fontSize="13.5" fontWeight="700" letterSpacing="3.5">
        <textPath href="#emblem-arc-top" startOffset="50%" textAnchor="middle">
          DASHBOARD KEUANGAN DAERAH
        </textPath>
      </text>
      <text fill="#78350f" fontSize="13.5" fontWeight="700" letterSpacing="3.5">
        <textPath href="#emblem-arc-bottom" startOffset="50%" textAnchor="middle">
          PEMPROV DKI JAKARTA
        </textPath>
      </text>
      {/* gedung */}
      <g stroke="#78350f" strokeWidth="3" fill="#fde68a">
        <rect x="62" y="92" width="18" height="30" />
        <rect x="84" y="80" width="32" height="42" />
        <rect x="120" y="92" width="18" height="30" />
        <path d="M52 126 h96" />
        <rect x="84" y="72" width="8" height="8" />
      </g>
      <g fill="#78350f">
        <rect x="88" y="88" width="5" height="6" />
        <rect x="98" y="88" width="5" height="6" />
        <rect x="108" y="88" width="5" height="6" />
        <rect x="88" y="100" width="5" height="6" />
        <rect x="98" y="100" width="5" height="6" />
        <rect x="108" y="100" width="5" height="6" />
        <rect x="66" y="98" width="4" height="6" />
        <rect x="74" y="98" width="4" height="6" />
        <rect x="124" y="98" width="4" height="6" />
        <rect x="132" y="98" width="4" height="6" />
      </g>
    </svg>
  )
}
