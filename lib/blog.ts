import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  category: string
  readTime: string
  service: string
  heroQuery: string
  inlineQueries: string[]
  content: string
}

export type PostSummary = Omit<Post, 'content'>

export function getAllPosts(): PostSummary[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'))

  return files
    .map((file) => {
      const slug = file.replace('.mdx', '')
      const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
      const { data } = matter(raw)
      return {
        slug,
        title: data.title as string,
        excerpt: data.excerpt as string,
        date: data.date as string,
        category: data.category as string,
        readTime: data.readTime as string,
        service: data.service as string,
        heroQuery: (data.heroQuery as string) || (data.category as string),
        inlineQueries: (data.inlineQueries as string[]) || [],
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getPostBySlug(slug: string): Post | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  return {
    slug,
    title: data.title as string,
    excerpt: data.excerpt as string,
    date: data.date as string,
    category: data.category as string,
    readTime: data.readTime as string,
    service: data.service as string,
    heroQuery: (data.heroQuery as string) || (data.category as string),
    inlineQueries: (data.inlineQueries as string[]) || [],
    content,
  }
}
