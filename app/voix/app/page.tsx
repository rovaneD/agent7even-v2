import { redirect } from 'next/navigation'
import { SignOutButton } from '@clerk/nextjs'
import { requireVoixViewer } from '@/lib/voix/access'
import PilotForm from '../PilotForm'

export const dynamic = 'force-dynamic'

export default async function VoixAppHome() {
  const { viewer } = await requireVoixViewer()

  if (viewer.memberships.length) redirect(`/voix/app/${viewer.memberships[0].account.id}/calls`)
  if (viewer.isAdmin) redirect('/voix/app/admin')

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-6 inline-block h-10 w-10 rounded-full bg-gradient-to-br from-[#F7B3CF] to-[#3355D6]" />
      <h1 className="mb-3 text-[32px] leading-tight" style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}>
        You&apos;re signed in, but not linked to a spa yet
      </h1>
      <p className="mb-6 text-[15px] leading-relaxed text-[#4A5061]">
        {viewer.email ? <>You&apos;re signed in as <strong>{viewer.email}</strong>. </> : null}
        If your spa already uses Voix, ask your spa owner to add this email, or reply to your invite email.
      </p>
      <SignOutButton redirectUrl="/voix/sign-in">
        <button className="rounded-full border border-[#D5D8E0] bg-white px-5 py-2.5 text-sm font-medium">
          Sign in with a different email
        </button>
      </SignOutButton>

      <div className="mt-14 w-full border-t border-[#E2E5EC] pt-12 text-left">
        <h2 className="mb-2 text-center text-[28px] leading-tight" style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}>
          New to Voix? Try it free for 14&nbsp;days.
        </h2>
        <p className="mb-8 text-center text-[15px] leading-relaxed text-[#4A5061]">
          We&apos;re opening 10 founding spots. Apply below and we&apos;ll reply within one business&nbsp;day.
        </p>
        <div className="rounded-[28px] bg-white p-6 sm:p-8">
          <PilotForm />
        </div>
      </div>
    </div>
  )
}
