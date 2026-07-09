import { currentUser, type User } from '@clerk/nextjs/server'

/** Clerk user from Backend API; null when session is valid but the API call fails. */
export async function getClerkUserSafe(): Promise<User | null> {
  try {
    return await currentUser()
  } catch (error) {
    console.error('[clerk] currentUser failed:', error)
    return null
  }
}

/** Primary email for the signed-in Clerk user, when the Backend API is reachable. */
export async function getClerkSessionEmail(): Promise<string | null> {
  const user = await getClerkUserSafe()
  return user?.emailAddresses?.[0]?.emailAddress ?? null
}
