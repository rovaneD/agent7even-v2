import qrcode from 'qrcode-generator'
import { DEMO_TEL, ink } from './voixStyles'

/**
 * Small "scan to call from your phone" QR for the demo line, shown next to the existing
 * "Call the spa demo" button on larger screens only. It adds a way to call; it doesn't replace
 * the button (which works on Macs through iPhone calling). Pure render, no client JS.
 */
export default function DemoQr({ size = 84, dark = false }: { size?: number; dark?: boolean }) {
  if (!DEMO_TEL) return null
  const qr = qrcode(0, 'M')
  qr.addData(DEMO_TEL)
  qr.make()
  const n = qr.getModuleCount()
  const q = 2 // quiet zone
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`
  return (
    <div className="voix-demo-qr" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <style>{`@media (max-width: 760px), (pointer: coarse) { .voix-demo-qr { display: none !important; } }`}</style>
      <svg role="img" aria-label="QR code: scan to call the demo line" width={size} height={size} viewBox={`0 0 ${n + q * 2} ${n + q * 2}`} shapeRendering="crispEdges" style={{ borderRadius: 8, flex: '0 0 auto' }}>
        <rect width="100%" height="100%" fill="#FFFFFF" />
        <path d={d} fill={ink} />
      </svg>
      <span style={{ fontSize: 12, lineHeight: 1.35, maxWidth: 90, color: dark ? 'rgba(255,255,255,0.85)' : '#5B6070' }}>Or scan to call from your phone</span>
    </div>
  )
}
