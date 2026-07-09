'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface UnsplashImage {
  url: string
  alt: string
  credit: string
  creditUrl: string
}

interface BlogImageProps {
  query: string
  aspectRatio?: 'hero' | 'inline' | 'card'
  className?: string
  /** Plain-text credit when true — required inside another link (e.g. blog index cards). */
  creditLinks?: boolean
}

async function fetchUnsplashImage(query: string): Promise<UnsplashImage | null> {
  try {
    const res = await fetch(`/api/unsplash/image?query=${encodeURIComponent(query)}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default function BlogImage({
  query,
  aspectRatio = 'inline',
  className = '',
  creditLinks = aspectRatio !== 'card',
}: BlogImageProps) {
  const [image, setImage] = useState<UnsplashImage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUnsplashImage(query).then((img) => {
      setImage(img)
      setLoading(false)
    })
  }, [query])

  const ratioClass =
    aspectRatio === 'hero' ? 'blog-img-hero' : aspectRatio === 'card' ? 'blog-img-card' : 'blog-img-inline'

  if (loading) {
    return <div className={`blog-img-skeleton ${ratioClass} ${className}`} />
  }

  if (!image) return null

  return (
    <figure className={`blog-figure ${className}`}>
      <div className={`blog-img ${ratioClass}`}>
        <Image
          src={image.url}
          alt={image.alt}
          fill
          className="blog-img-fill"
          sizes={aspectRatio === 'card' ? '(max-width: 768px) 100vw, 400px' : '(max-width: 768px) 100vw, 672px'}
        />
      </div>
      <figcaption className="blog-img-credit">
        Photo by{' '}
        {creditLinks ? (
          <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">
            {image.credit}
          </a>
        ) : (
          <span>{image.credit}</span>
        )}{' '}
        on{' '}
        {creditLinks ? (
          <a
            href="https://unsplash.com?utm_source=agent7even&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
          >
            Unsplash
          </a>
        ) : (
          <span>Unsplash</span>
        )}
      </figcaption>
    </figure>
  )
}
