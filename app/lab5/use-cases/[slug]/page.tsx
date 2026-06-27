import { notFound } from 'next/navigation'
import { cases } from '../../../lab-use-cases/_data'
import UseCaseDetailClient from '../UseCaseDetailClient'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return cases.map((c) => ({ slug: c.slug }))
}

export default async function UseCaseDetailPage({ params }: Props) {
  const { slug } = await params
  if (!cases.some((c) => c.slug === slug)) notFound()
  return <UseCaseDetailClient slug={slug} />
}
