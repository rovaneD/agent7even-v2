import type { Metadata } from 'next'
import DesignConceptPage from './DesignConceptPage'
import '../lab5/styles.css'
import './layout.css'

export const metadata: Metadata = {
  title: 'Design concept — Agent7even',
  description: 'Layout experiment — production components rearranged. Not the live homepage.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <DesignConceptPage />
}
