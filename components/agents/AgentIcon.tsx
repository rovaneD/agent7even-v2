import {
  BarChart2,
  Eye,
  Image,
  Mail,
  Megaphone,
  Pencil,
  Rocket,
  Search,
  ShieldCheck,
  TrendingUp,
  Bot,
  type LucideIcon,
} from 'lucide-react'
import type { AgentId } from '@/lib/agents/registry'

const AGENT_LUCIDE_ICONS: Record<AgentId, LucideIcon> = {
  content_posting: Image,
  post_caption: Image,
  weekly_content: Pencil,
  competitor_watcher: Eye,
  campaign_builder: Rocket,
  performance_digest: BarChart2,
  trend_spotter: TrendingUp,
  email_sequence_builder: Mail,
  ad_variations: Megaphone,
  seo_scanner: Search,
  brand_voice_guardian: ShieldCheck,
}

interface Props {
  agentId: AgentId | string
  size?: number
  className?: string
}

export default function AgentIcon({ agentId, size = 20, className }: Props) {
  const Icon = AGENT_LUCIDE_ICONS[agentId as AgentId] ?? Bot
  return <Icon size={size} className={className} aria-hidden />
}
