import { redirect } from 'next/navigation'

/** Legacy URL — agency multi-client is a separate future tier, not this ICP. */
export default function AgenciesUseCaseRedirect() {
  redirect('/use-cases/startups')
}
