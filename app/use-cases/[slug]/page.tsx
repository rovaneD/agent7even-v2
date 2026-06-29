import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cases } from '@/app/lab-use-cases/_data'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import '../../lab5/styles.css'
import UseCaseDetailClient from '../../lab5/use-cases/UseCaseDetailClient'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return cases.map(c => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const useCase = cases.find(c => c.slug === slug)
  if (!useCase) return {}
  return marketingPageMetadata({
    title: `${useCase.label} — AI Marketing | Agent7even`,
    description: useCase.hero.subhead.slice(0, 160),
    path: `/use-cases/${slug}`,
  })
}

export default async function UseCaseDetailPage({ params }: Props) {
  const { slug } = await params
  if (!cases.some(c => c.slug === slug)) notFound()
  return <UseCaseDetailClient slug={slug} />
}
