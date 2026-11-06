/** Identidad mecánica ornamental, completamente separada de las funciones. */
export default function MechaEmblem() {
  return (
    <span className="mecha-badge" aria-hidden="true">
      <svg viewBox="0 0 92 92" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mecha-metal" x1="6" y1="7" x2="83" y2="88" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C8F0FF"/>
            <stop offset=".24" stopColor="#5684AC"/>
            <stop offset=".53" stopColor="#162840"/>
            <stop offset=".76" stopColor="#749FBE"/>
            <stop offset="1" stopColor="#E8F8FF"/>
          </linearGradient>
          <linearGradient id="mecha-eye" x1="18" y1="46" x2="76" y2="53" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1F8FFD"/>
            <stop offset=".42" stopColor="#B8FAFF"/>
            <stop offset="1" stopColor="#48CFFF"/>
          </linearGradient>
        </defs>
        <path d="M45.8 3.5L74.1 14.6L87.5 38.2L76 72.9L46 88.5L15 72.6L4.8 38L18.7 14.5Z"
          fill="#071626" stroke="url(#mecha-metal)" strokeWidth="2.2"/>
        <path d="M19 17L31 11.5L39 26L31 43.8L13.8 35L15.8 25Z"
          fill="url(#mecha-metal)"/>
        <path d="M73 17L61 11.5L53 26L61 43.8L78.2 35L76.2 25Z"
          fill="url(#mecha-metal)"/>
        <path d="M45.8 18L53.5 30L60 37L54 56L46 61L38 56L32 37L38.5 30Z"
          fill="#345A7B" stroke="#8EC9EA" strokeWidth="1.2"/>
        <path d="M18 46L38.8 46L41.2 52.4L25 57L15.5 52Z" fill="#0E3C68" stroke="#95D9F3" strokeWidth="1.2"/>
        <path d="M74 46L53.2 46L50.8 52.4L67 57L76.5 52Z" fill="#0E3C68" stroke="#95D9F3" strokeWidth="1.2"/>
        <path className="mecha-badge__eyes" d="M19 46.7L37.9 47.2L32.5 52.2L22.5 50.7ZM73 46.7L54.1 47.2L59.5 52.2L69.5 50.7Z"
          fill="url(#mecha-eye)"/>
        <path d="M38 61L46 65L54 61L60.2 73L46 80L31.8 73Z" fill="#162B42" stroke="#5A89AC" strokeWidth="1.3"/>
        <path d="M39 72.5L46 75.3L53 72.5" stroke="#89DFFF" strokeWidth="1.3"/>
        <path d="M15.6 58L10.5 68L22.6 75L28.6 69Z" fill="#3D5D78" stroke="#86B7DA"/>
        <path d="M76.4 58L81.5 68L69.4 75L63.4 69Z" fill="#3D5D78" stroke="#86B7DA"/>
        <path d="M43 25L46 20L49 25L49 42L46 45L43 42Z" fill="#90EAFF" opacity=".9"/>
      </svg>
    </span>
  )
}
