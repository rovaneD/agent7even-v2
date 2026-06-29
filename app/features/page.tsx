import { permanentRedirect } from 'next/navigation'

/** Legacy /features URL — product capabilities live at /agents */
export default function FeaturesRedirectPage() {
  permanentRedirect('/agents')
}
