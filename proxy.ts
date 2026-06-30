import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/features',
  '/how-it-works',
  '/ai-vs-agency',
  '/integrations',
  '/for-coaches',
  '/for-consultants',
  '/blog(.*)',
  '/about',
  '/careers',
  '/contact',
  '/pricing',
  '/privacy',
  '/terms',
  '/security',
  '/data-deletion',
  '/api/data-deletion/request',
  '/agents',
  '/use-cases(.*)',
  '/lab(.*)',
  '/lab1(.*)',
  '/lab2(.*)',
  '/lab3(.*)',
  '/lab-use-cases(.*)',
  '/api/webhooks(.*)',
  '/api/analytics/ga-callback(.*)',
  '/api/analytics/meta-callback(.*)',
  '/api/integrations/zernio/callback(.*)',
  '/api/team/accept(.*)',
  // Internal server-to-server dispatch — authenticated via taskId UUID + userId in body
  '/api/agents/run/(.*)',
  '/api/unsplash/image',
  '/robots.txt',
  '/sitemap.xml',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)',
    '/(api|trpc)(.*)',
  ],
}
