export type PermissionKey =
  | 'billing'
  | 'services'
  | 'ai_toolkit'
  | 'analytics'
  | 'brand_kit'
  | 'deliverables'
  | 'support'

export type TeamPermissions = {
  isOwner: boolean
  permissions: Record<PermissionKey, boolean>
  accountId: string | null
}

export function hasPermission(permissions: TeamPermissions, key: PermissionKey): boolean {
  if (permissions.isOwner) return true
  return permissions.permissions[key] ?? false
}
