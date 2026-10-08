// Lumi, a coruja mascote: mesmo desenho do app (apps/mobile/src/components/lumi/LumiOwl.tsx).
export function Owl({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 200 220" role="img" aria-label="Lumi">
      <path d="M60 40 L73 16 L86 42 Z" fill="#7C70D6" />
      <path d="M114 42 L127 16 L140 40 Z" fill="#7C70D6" />
      <ellipse cx="100" cy="122" rx="66" ry="78" fill="#5B4FB5" />
      <ellipse cx="41" cy="138" rx="15" ry="33" fill="#453A94" transform="rotate(16 41 138)" />
      <ellipse cx="159" cy="138" rx="15" ry="33" fill="#453A94" transform="rotate(-16 159 138)" />
      <ellipse cx="100" cy="155" rx="40" ry="37" fill="#EDEBFF" />
      <circle cx="76" cy="92" r="30" fill="#6F63C8" />
      <circle cx="124" cy="92" r="30" fill="#6F63C8" />
      <circle cx="76" cy="92" r="22" fill="#fff" />
      <circle cx="124" cy="92" r="22" fill="#fff" />
      <circle cx="79" cy="94" r="10" fill="#241D4F" />
      <circle cx="127" cy="94" r="10" fill="#241D4F" />
      <circle cx="82.5" cy="90.5" r="3.5" fill="#fff" />
      <circle cx="130.5" cy="90.5" r="3.5" fill="#fff" />
      <path d="M92 112 L108 112 L100 125 Z" fill="#F4976C" />
      <ellipse cx="84" cy="199" rx="10" ry="6" fill="#F4976C" />
      <ellipse cx="116" cy="199" rx="10" ry="6" fill="#F4976C" />
    </svg>
  );
}
