'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/** Legacy `/dashboard/agents?useAsset=` → image post workflow. */
export default function AgentsLegacyRedirects() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const useAsset = searchParams.get('useAsset')
    if (useAsset) {
      router.replace(`/dashboard/agents/content-posting/image?format=ig-feed-post&useAsset=${encodeURIComponent(useAsset)}`)
    }
  }, [router, searchParams])

  return null
}
