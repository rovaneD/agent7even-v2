'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { Heart, MessageCircle, MoreHorizontal, Send, Bookmark } from 'lucide-react'

/** Homepage Creative row — real sample image + reel video in Instagram-style frames. */
export default function CreativeShowcase() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const play = () => {
      void video.play().catch(() => {})
    }

    play()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) play()
          else video.pause()
        }
      },
      { threshold: 0.2 },
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="creative-showcase" aria-label="Sample AI-generated Instagram post and reel">
      <div className="creative-showcase-stage">
        <article className="creative-device creative-device-reel">
          <div className="creative-card">
            <div className="creative-reel-frame">
              <video
                ref={videoRef}
                className="creative-reel-video"
                src="/InstagramReel.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-label="Sample AI-generated brand reel"
              />
              <div className="creative-reel-gradient" aria-hidden="true" />
              <div className="creative-reel-top">
                <span>Reels</span>
              </div>
              <div className="creative-reel-side" aria-hidden="true">
                <Heart size={15} strokeWidth={2} />
                <span>4.2k</span>
                <MessageCircle size={15} strokeWidth={2} />
                <span>318</span>
                <Send size={15} strokeWidth={2} />
                <span>96</span>
              </div>
              <div className="creative-reel-caption">
                <div className="creative-reel-user">
                  <span className="creative-avatar" aria-hidden="true" />
                  <strong>embercoffee</strong>
                  <span className="creative-follow">Follow</span>
                </div>
                <p>Fresh roast drop — shot on-brand in one run.</p>
                <p className="creative-hashtags">#brewdaily #specialtycoffee #shipsfresh</p>
              </div>
            </div>
          </div>
        </article>

        <article className="creative-device creative-device-post">
          <div className="creative-card">
            <div className="creative-post-frame">
              <header className="creative-post-head">
                <span className="creative-avatar" aria-hidden="true" />
                <strong>embercoffee</strong>
                <MoreHorizontal size={14} className="creative-post-more" aria-hidden="true" />
              </header>
              <div className="creative-post-media">
                <Image
                  src="/InstagramPost.png"
                  alt="Sample AI-generated product photo for Instagram"
                  width={1080}
                  height={1433}
                  sizes="(max-width: 720px) 42vw, 196px"
                  className="creative-post-image"
                />
              </div>
              <div className="creative-post-actions" aria-hidden="true">
                <Heart size={16} strokeWidth={2} className="creative-heart" />
                <MessageCircle size={16} strokeWidth={2} />
                <Send size={16} strokeWidth={2} />
                <Bookmark size={16} strokeWidth={2} className="creative-bookmark" />
              </div>
              <div className="creative-post-meta">
                <p className="creative-post-likes">1,204 likes</p>
                <p className="creative-post-caption">
                  <strong>embercoffee</strong> Morning ritual, packaged — generated in your brand style.
                </p>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
