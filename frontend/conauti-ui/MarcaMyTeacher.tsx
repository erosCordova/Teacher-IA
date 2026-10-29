/** Identidad original de My Teacher IA: tutor robótico, birrete y libro abierto.
 * SVG vectorial ligero que funciona en tema claro/oscuro, incluido móvil.
 */
export default function MarcaMyTeacher({className = ""}: {className?: string}) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg"
    width="66" height="66" viewBox="0 0 128 128" fill="none" role="img"
    aria-label="Logotipo de My Teacher IA: robot educativo y libro">
    <defs>
      <linearGradient id="mtiaBook" x1="18" y1="88" x2="112" y2="117" gradientUnits="userSpaceOnUse">
        <stop stopColor="#169BEC"/><stop offset="0.55" stopColor="#5279EF"/><stop offset="1" stopColor="#9A5EED"/>
      </linearGradient>
      <linearGradient id="mtiaHead" x1="28" y1="35" x2="105" y2="92" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFF"/><stop offset="1" stopColor="#D2E9FF"/>
      </linearGradient>
      <linearGradient id="mtiaCap" x1="29" y1="22" x2="104" y2="39" gradientUnits="userSpaceOnUse">
        <stop stopColor="#126CE6"/><stop offset="1" stopColor="#564FE2"/>
      </linearGradient>
    </defs>
    <path d="M64 115C49 104 35 105 16 111V84c19-6 35-4 48 7 13-11 29-13 48-7v27c-19-6-33-7-48 4Z" fill="url(#mtiaBook)"/>
    <path d="M64 92v22M21 93c17-4 29-2 40 5M107 93c-17-4-29-2-40 5" stroke="#C4EAFF" strokeWidth="2.3" strokeLinecap="round" opacity=".8"/>
    <rect x="25" y="43" width="78" height="59" rx="25" fill="url(#mtiaHead)" stroke="#76B4EE" strokeWidth="2"/>
    <rect x="34" y="51" width="60" height="42" rx="17" fill="#102458"/>
    <path d="M47 69q7-10 14 0M67 69q7-10 14 0" stroke="#87E7FF" strokeWidth="4.5" strokeLinecap="round"/>
    <path d="M58 80q6 6 12 0" stroke="#87E7FF" strokeWidth="3.4" strokeLinecap="round"/>
    <circle cx="25" cy="70" r="8" fill="#1988F0" stroke="#D3EEFF" strokeWidth="3"/>
    <circle cx="103" cy="70" r="8" fill="#1988F0" stroke="#D3EEFF" strokeWidth="3"/>
    <path d="M24 37 64 17l40 20-40 18-40-18Z" fill="url(#mtiaCap)" stroke="#B3DCFF" strokeWidth="1.5"/>
    <path d="M42 46v8q22 15 44 0v-8" fill="#1649BC"/>
    <path d="M104 38v18" stroke="#326DE1" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="104" cy="59" r="4" fill="#55C7F9"/>
  </svg>
}
