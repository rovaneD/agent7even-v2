'use client'

/**
 * BEFORE: InstagramReel.mp4 (~22MB) autoplayed with preload="auto" for all viewports.
 * AFTER: Mobile never mounts the video (static post image only). Desktop loads the
 * reel only when the showcase is near the viewport, with preload="none".
 */

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Heart, MessageCircle, MoreHorizontal, Send, Bookmark } from 'lucide-react'

export default function CreativeShowcase() {
  const hostRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [allowVideo, setAllowVideo] = useState(false)
  const [videoInView, setVideoInView] = useState(false)

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 721px)').matches
    if (!desktop) return

    const host = hostRef.current
    if (!host) {
      setAllowVideo(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setAllowVideo(true)
          setVideoInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '160px', threshold: 0.05 },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !allowVideo) return

    const play = () => {
      void video.play().catch(() => {})
    }

    if (videoInView) play()

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
  }, [allowVideo, videoInView])

  return (
    <div
      ref={hostRef}
      className="creative-showcase"
      aria-label="Sample AI-generated Instagram post and reel"
    >
      <div className="creative-showcase-stage">
        {allowVideo ? (
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
                  preload="none"
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
        ) : null}

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
                  src="/InstagramPost.webp"
                  alt="Sample AI-generated product photo for Instagram"
                  width={800}
                  height={1061}
                  sizes="(max-width: 720px) 70vw, 196px"
                  className="creative-post-image"
                  loading="lazy"
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
