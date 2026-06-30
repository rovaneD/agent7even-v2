import type { ReactNode } from 'react'
import BlogImage from '@/components/marketing/BlogImage'

export function renderBlogContent(content: string, inlineQueries: string[] = []) {
  const lines = content.split('\n')
  const elements: ReactNode[] = []
  let sectionCount = 0

  lines.forEach((line, i) => {
    if (line.startsWith('## ')) {
      sectionCount++
      if (sectionCount > 1 && sectionCount % 2 === 0 && inlineQueries.length) {
        const queryIndex = Math.floor((sectionCount - 2) / 2) % inlineQueries.length
        elements.push(
          <BlogImage
            key={`img-${i}`}
            query={inlineQueries[queryIndex]}
            aspectRatio="inline"
            className="blog-inline-img"
          />
        )
      }
      elements.push(
        <h2 key={i} className="blog-h2">
          {line.replace('## ', '')}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="blog-h3">
          {line.replace('### ', '')}
        </h3>
      )
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} className="blog-strong">
          {line.replace(/\*\*/g, '')}
        </p>
      )
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={i} className="blog-li">
          {line.replace('- ', '')}
        </li>
      )
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="blog-quote">
          {line.replace('> ', '')}
        </blockquote>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="blog-spacer" />)
    } else {
      elements.push(
        <p key={i} className="blog-p">
          {line}
        </p>
      )
    }
  })

  return elements
}

export function formatPostDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatPostDateShort(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export type BlogPostView = import('@/lib/blog').Post
