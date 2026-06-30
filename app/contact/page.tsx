import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import ContactPage from '../lab5/contact/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'Contact Agent7even — Support & Billing',
  description:
    'Reach Agent7even support and billing by email — product help, account questions, invoices, and plan changes.',
  path: '/contact',
})

export default ContactPage
