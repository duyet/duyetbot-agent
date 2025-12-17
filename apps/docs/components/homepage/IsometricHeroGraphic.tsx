export function IsometricHeroGraphic() {
  return (
    <svg viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full max-w-[800px]">
      <title>Isometric Cloud Architecture</title>
      
      {/* Decorative Grid Floor */}
      <path opacity="0.1" d="M400 350 L700 200 M400 350 L100 200 M400 350 L400 550" stroke="#f38020" strokeWidth="1" strokeDasharray="4 4"/>
      
      {/* Stack: Private Cloud (Bottom Layer) */}
      <g transform="translate(400, 480)">
        <path d="M0 0 L180 -90 L0 -180 L-180 -90 Z" fill="#fff" stroke="#3b82f6" strokeWidth="2" className="drop-shadow-xl" />
        <path d="M-180 -90 L-180 -70 L0 20 L0 0 Z" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
        <path d="M0 20 L180 -70 L180 -90 L0 0 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
        <text x="-160" y="-80" fontSize="12" fill="#3b82f6" fontFamily="monospace">dedicated_resources</text>
        
        {/* Hatched Side Detail */}
        <path d="M-180 -70 L0 20 L0 0 L-180 -90 Z" fill="url(#hatch-blue)" opacity="0.2" />
      </g>

      {/* Stack: Dedicated Compute (Middle Layer) */}
      <g transform="translate(400, 400)">
        <path d="M0 0 L180 -90 L0 -180 L-180 -90 Z" fill="#fff" stroke="#3b82f6" strokeWidth="2" className="drop-shadow-xl" />
        <path d="M-180 -90 L-180 -70 L0 20 L0 0 Z" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
        <path d="M0 20 L180 -70 L180 -90 L0 0 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
        <text x="-160" y="-80" fontSize="12" fill="#3b82f6" fontFamily="monospace">dedicated_compute</text>
      </g>

      {/* Stack: Private Networking (Top Layer) */}
      <g transform="translate(400, 320)">
        <path d="M0 0 L180 -90 L0 -180 L-180 -90 Z" fill="#fff" stroke="#3b82f6" strokeWidth="2" className="drop-shadow-xl" />
        <path d="M-180 -90 L-180 -70 L0 20 L0 0 Z" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
        <path d="M0 20 L180 -70 L180 -90 L0 0 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
        <text x="-160" y="-80" fontSize="12" fill="#3b82f6" fontFamily="monospace">private_networking</text>
      </g>

      {/* Input Traffic Blocks (Left) */}
      <g transform="translate(150, 250)">
        <path d="M0 0 L40 -20 L0 -40 L-40 -20 Z" fill="#fee2e2" stroke="#ef4444" strokeWidth="2" />
        <path d="M-40 -20 L-40 0 L0 20 L0 0 Z" fill="#fecaca" stroke="#ef4444" strokeWidth="2" />
        <path d="M0 20 L40 0 L40 -20 L0 0 Z" fill="#fca5a5" stroke="#ef4444" strokeWidth="2" />
        <path d="M-40 -20 L-40 0 L0 20 L0 0 Z" fill="url(#hatch-red)" opacity="0.3" />
        <text x="-50" y="-50" fontSize="10" fill="#ef4444" fontFamily="monospace">attacks</text>
      </g>

      {/* User Block (Top) */}
      <g transform="translate(500, 100)">
        <path d="M0 0 L40 -20 L0 -40 L-40 -20 Z" fill="#ffedd5" stroke="#f97316" strokeWidth="2" />
        <path d="M-40 -20 L-40 0 L0 20 L0 0 Z" fill="#fed7aa" stroke="#f97316" strokeWidth="2" />
        <path d="M0 20 L40 0 L40 -20 L0 0 Z" fill="#fdba74" stroke="#f97316" strokeWidth="2" />
        <text x="50" y="-20" fontSize="10" fill="#f97316" fontFamily="monospace">user</text>
      </g>

      {/* Connecting Lines */}
      <path d="M500 120 L500 230" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" markerEnd="url(#arrow)" />
      <path d="M190 250 L300 350" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />

      {/* Definitions */}
      <defs>
        <pattern id="hatch-blue" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#3b82f6" strokeWidth="1" />
        </pattern>
        <pattern id="hatch-red" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#ef4444" strokeWidth="1" />
        </pattern>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
        </marker>
        <linearGradient id="glow-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
