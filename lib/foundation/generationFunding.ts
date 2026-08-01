/**
 * Platform-funded Foundation document generation is only for first-time
 * onboarding (before profiles.foundation_complete). Post-completion regenerates
 * from Hub/Editor must reserve user credits via runAgent.
 */
export function shouldChargeFoundationGenerationCredits(
  foundationComplete: boolean | null | undefined,
): boolean {
  return Boolean(foundationComplete)
}
