# Brand Kit Expansion — Claude Code Handoff
*Full visual and verbal identity system*

Read MAYA_CONTEXT.md and CONTEXTV8.md before starting.
Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

Replace the current Brand Kit (empty "Start brand build" state pointing at the
unused `brand_documents` table) with a complete 6-section brand identity system.

Foundation-generated documents live in `foundation_documents` — Section 5
reads from there. The `brand_documents` table is empty and unused — ignore it.

Six sections:
1. Identity — logos and usage rules
2. Colors — palette with HEX/RGB values
3. Typography — fonts and hierarchy
4. Imagery — photography style and asset library
5. Voice & Messaging — Foundation documents + additional messaging
6. Templates — uploaded or linked templates

---

## Part 1 — Schema Migration

Run in Supabase SQL Editor:

```sql
-- Section completion tracking
CREATE TABLE IF NOT EXISTS brand_kit_sections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  section_key  text NOT NULL,
  completed    boolean DEFAULT false,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, section_key)
);

-- Color palette
CREATE TABLE IF NOT EXISTS brand_kit_colors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL,   -- primary | secondary | accent | neutral
  name       text,            -- e.g. "Brand Orange"
  hex        text NOT NULL,   -- e.g. "#c8522a"
  rgb        text,            -- e.g. "200, 82, 42"
  notes      text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Typography
CREATE TABLE IF NOT EXISTS brand_kit_fonts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL,   -- heading | subheading | body | accent
  family     text NOT NULL,   -- e.g. "Geist"
  weight     text,            -- e.g. "400, 600, 700"
  size_guide text,            -- e.g. "H1: 32px, H2: 24px, Body: 16px"
  source_url text,            -- Google Fonts or similar
  notes      text,
  created_at timestamptz DEFAULT now()
);

-- Assets (logos, photos, templates — uploaded or linked)
CREATE TABLE IF NOT EXISTS brand_kit_assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  section_key  text NOT NULL,  -- identity | imagery | templates
  asset_type   text NOT NULL,  -- logo_primary | logo_alternate | logo_icon |
                               -- photo | pattern | icon | template_canva |
                               -- template_slides | template_figma | other
  name         text NOT NULL,
  file_url     text,           -- Supabase Storage URL
  external_url text,           -- Canva, Figma, Google Drive, etc.
  thumbnail_url text,
  metadata     jsonb,          -- { usageRules, dimensions, format, etc. }
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_brand_kit_colors_user ON brand_kit_colors(user_id);
CREATE INDEX idx_brand_kit_fonts_user  ON brand_kit_fonts(user_id);
CREATE INDEX idx_brand_kit_assets_user ON brand_kit_assets(user_id, section_key);

-- Storage bucket for brand assets
-- Run in Supabase Storage dashboard: create bucket 'brand-assets' (private)
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', false)
ON CONFLICT (id) DO NOTHING;
```

---

## Part 2 — Brand Kit Page Structure

Replace `app/dashboard/brand-kit/page.tsx` entirely.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  BRAND KIT                                                       │
│  Your complete brand identity                                    │
│                                                                  │
│  [Identity] [Colors] [Typography] [Imagery] [Voice] [Templates] │
│  ← Section tabs                                                  │
│                                                                  │
│  ┌─────────────────────────────────────┐  ┌──────────────────┐  │
│  │  Active section content             │  │  Maya sidebar    │  │
│  │                                     │  │                  │  │
│  │                                     │  │  Tips for this   │  │
│  │                                     │  │  section +       │  │
│  │                                     │  │  completeness    │  │
│  └─────────────────────────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Section tabs with completion indicators

```tsx
const SECTIONS = [
  { key: 'identity',    label: 'Identity',    icon: <ShapesIcon /> },
  { key: 'colors',      label: 'Colors',      icon: <PaletteIcon /> },
  { key: 'typography',  label: 'Typography',  icon: <TypeIcon /> },
  { key: 'imagery',     label: 'Imagery',     icon: <ImageIcon /> },
  { key: 'voice',       label: 'Voice',       icon: <MessageIcon /> },
  { key: 'templates',   label: 'Templates',   icon: <LayoutIcon /> },
]

// Tab renders with green dot when section is completed
<button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
  ${active ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
  {section.icon}
  {section.label}
  {completed && (
    <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />
  )}
</button>
```

### Overall completion score in page header

```tsx
<div className="flex items-center gap-3 mb-6">
  <div>
    <h1 className="text-2xl font-semibold text-gray-900">Brand Kit</h1>
    <p className="text-sm text-gray-400">Your complete brand identity</p>
  </div>
  <div className="ml-auto flex items-center gap-3">
    <div className="text-right">
      <p className="text-xs text-gray-400">Complete</p>
      <p className="text-lg font-semibold text-gray-900">{completedCount}/6</p>
    </div>
    <div className="w-24 bg-gray-100 rounded-full h-2">
      <div
        className="bg-black rounded-full h-2 transition-all"
        style={{ width: `${(completedCount / 6) * 100}%` }}
      />
    </div>
  </div>
</div>
```

---

## Part 3 — Section 1: Identity

**What it contains:** Logo uploads, usage rules, brand name, tagline

```tsx
// Logo upload zones — three slots
const LOGO_TYPES = [
  { type: 'logo_primary',   label: 'Primary Logo',   description: 'Main logo used in most contexts' },
  { type: 'logo_alternate', label: 'Alternate Logo',  description: 'Stacked or horizontal variant' },
  { type: 'logo_icon',      label: 'Icon / Mark',     description: 'Symbol or monogram only' },
]

// Each slot: upload box + optional external URL field
// Upload → Supabase Storage bucket 'brand-assets'
// After upload: show thumbnail + file name + delete button

// Usage rules — free text
<textarea
  placeholder="Describe how the logo should and shouldn't be used. E.g., minimum size, clear space requirements, what backgrounds it works on..."
  rows={4}
/>

// Brand name + tagline fields
<input placeholder="Your brand name as it appears in all materials" />
<input placeholder="Your tagline or slogan (if you have one)" />
```

**Mark section complete** when at least one logo is uploaded or linked.

---

## Part 4 — Section 2: Colors

**What it contains:** Color swatches with HEX/RGB, role labels, add/remove

```tsx
const COLOR_ROLES = ['primary', 'secondary', 'accent', 'neutral']

// Color row component
function ColorRow({ color, onUpdate, onDelete }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100">
      {/* Color swatch — click to open color picker */}
      <div
        className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 flex-shrink-0"
        style={{ backgroundColor: color.hex }}
        onClick={() => setShowPicker(true)}
      />
      {/* Fields */}
      <div className="flex-1 grid grid-cols-4 gap-3">
        <input value={color.name} placeholder="Color name" onChange={...} className="..." />
        <input value={color.hex}  placeholder="#000000"    onChange={...} className="font-mono ..." />
        <input value={color.rgb}  placeholder="0, 0, 0"    onChange={...} className="font-mono ..." />
        <select value={color.role} onChange={...} className="...">
          {COLOR_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <button onClick={onDelete} className="text-gray-300 hover:text-red-400">
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

// Add color button
<button onClick={addColor} className="text-sm font-medium text-gray-600 hover:text-black">
  + Add color
</button>

// Auto-save on blur for each field
// Save to brand_kit_colors table
```

**Maya context from this section:**
When colors are saved, dispatch canvas context event:
```typescript
`Brand colors: ${colors.map(c => `${c.name} (${c.hex}, ${c.role})`).join(', ')}`
```

**Mark section complete** when at least one primary color is saved.

---

## Part 5 — Section 3: Typography

**What it contains:** Font entries by role with size guide and source

```tsx
const FONT_ROLES = [
  { role: 'heading',    label: 'Heading Font',    description: 'H1, H2, H3 — large display text' },
  { role: 'subheading', label: 'Subheading Font', description: 'H4, H5 — section headers' },
  { role: 'body',       label: 'Body Font',       description: 'Paragraphs and general text' },
  { role: 'accent',     label: 'Accent Font',     description: 'Callouts, quotes, special use' },
]

// Font card per role
function FontCard({ role, font, onSave }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{role.label}</p>
          <p className="text-xs text-gray-400">{role.description}</p>
        </div>
        {font && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            Set
          </span>
        )}
      </div>
      <div className="space-y-3">
        <input
          value={font?.family ?? ''}
          placeholder="Font family (e.g. Geist, Inter, Playfair Display)"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        />
        <input
          value={font?.weight ?? ''}
          placeholder="Weights used (e.g. 400, 600, 700)"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        />
        <input
          value={font?.source_url ?? ''}
          placeholder="Source URL (Google Fonts, Adobe Fonts, etc.)"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        />
        <textarea
          value={font?.size_guide ?? ''}
          placeholder="Size guide (e.g. H1: 48px/3rem, H2: 32px/2rem, Body: 16px/1rem)"
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none"
        />
      </div>
    </div>
  )
}
```

**Mark section complete** when at least heading and body fonts are set.

---

## Part 6 — Section 4: Imagery

**What it contains:** Photography style description + asset library

```tsx
// Photography style — text description
<textarea
  placeholder="Describe your visual style. E.g., 'Clean, bright product photography on white backgrounds. Real people, not stock. Warm color grading. Avoid busy or cluttered backgrounds.'"
  rows={4}
/>

// Asset library — photo uploads and links
// Grid of uploaded assets with type badges
// Upload: drag-and-drop or click — stores to Supabase Storage
// Asset types: photo | pattern | icon | illustration

// Asset card
function AssetCard({ asset, onDelete }) {
  return (
    <div className="relative group">
      <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
        {asset.thumbnail_url
          ? <img src={asset.thumbnail_url} className="w-full h-full object-cover" />
          : <div className="flex items-center justify-center h-full">
              <ImageIcon className="w-8 h-8 text-gray-300" />
            </div>
        }
      </div>
      <p className="text-xs text-gray-600 mt-1 truncate">{asset.name}</p>
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                   bg-white rounded-lg p-1 shadow-sm transition-opacity"
      >
        <TrashIcon className="w-3 h-3 text-gray-500" />
      </button>
    </div>
  )
}

// Upload zone
<div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center
                hover:border-gray-400 transition-colors cursor-pointer">
  <UploadIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
  <p className="text-sm text-gray-500">Drop files here or click to upload</p>
  <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG, WebP up to 10MB</p>
</div>
```

**Mark section complete** when photography style is filled OR at least one asset is uploaded.

---

## Part 7 — Section 5: Voice & Messaging

**What it contains:** Foundation documents + additional messaging blocks

This section reads from `foundation_documents` table.

```typescript
// Document types from foundation
const FOUNDATION_DOC_TYPES = [
  'brand_voice',
  'brand_story',
  'ideal_client_profile',
  'positioning_statement',
]

// Additional messaging blocks (stored in foundation_documents with new types)
const ADDITIONAL_DOC_TYPES = [
  { type: 'tagline',        title: 'Tagline',         placeholder: 'Your one-line brand statement' },
  { type: 'elevator_pitch', title: 'Elevator Pitch',  placeholder: '30-second verbal description of what you do and for who' },
  { type: 'about_us',       title: 'About Us',        placeholder: 'Standard About Us block for website, bio, and directories' },
  { type: 'mission',        title: 'Mission Statement', placeholder: 'Why your company exists' },
]
```

**Document display:**
```tsx
function DocumentCard({ doc, onSave }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(doc?.content ?? '')

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{doc.title}</h3>
          {doc.version && (
            <p className="text-xs text-gray-400 mt-0.5">Version {doc.version}</p>
          )}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-gray-600 hover:text-black px-3 py-1.5
                         border border-gray-200 rounded-lg"
            >
              Edit
            </button>
          )}
          {/* Maya regenerate button — only for Foundation docs */}
          {FOUNDATION_DOC_TYPES.includes(doc.type) && (
            <button
              onClick={() => handleRegenerate(doc.type)}
              className="text-xs font-medium text-gray-600 hover:text-black px-3 py-1.5
                         border border-gray-200 rounded-lg flex items-center gap-1"
            >
              <SparklesIcon className="w-3 h-3" />
              Regenerate
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={8}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                       resize-none focus:outline-none focus:border-black"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={() => onSave(doc.type, content)}
              className="px-4 py-2 bg-black text-white text-sm rounded-xl">
              Save
            </button>
            <button onClick={() => { setContent(doc.content); setEditing(false) }}
              className="px-4 py-2 border border-gray-200 text-sm rounded-xl">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {doc?.content ?? (
            <span className="text-gray-400 italic">
              Not yet created — click Edit to add or Regenerate to have Maya write this.
            </span>
          )}
        </p>
      )}
    </div>
  )
}
```

**Save handler** — upserts to `foundation_documents`:
```typescript
async function saveDocument(type: string, content: string) {
  await fetch('/api/brand-kit/documents', {
    method: 'POST',
    body: JSON.stringify({ type, content }),
  })
}
```

**Regenerate handler** — calls `/api/foundation/generate` for a single doc type:
```typescript
async function handleRegenerate(docType: string) {
  // Call generate API with current Foundation answers
  // Update only the specified document type
  // Show "Regenerating..." state
}
```

**Mark section complete** when all 4 Foundation doc types have content.

---

## Part 8 — Section 6: Templates

**What it contains:** Links and uploads to brand templates

```tsx
const TEMPLATE_TYPES = [
  { type: 'template_canva',  label: 'Canva',        icon: <CanvaIcon />,  placeholder: 'https://canva.com/...' },
  { type: 'template_slides', label: 'Google Slides', icon: <SlidesIcon />, placeholder: 'https://docs.google.com/presentation/...' },
  { type: 'template_figma',  label: 'Figma',        icon: <FigmaIcon />,  placeholder: 'https://figma.com/...' },
  { type: 'other',           label: 'Other',        icon: <LinkIcon />,   placeholder: 'https://...' },
]

// Two ways to add a template:
// 1. External link — paste URL, add name
// 2. Upload file — PDF, PPT, KEY stored in Supabase Storage

// Template card
function TemplateCard({ asset }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200
                      flex items-center justify-center flex-shrink-0">
        <TemplateTypeIcon type={asset.asset_type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
        <p className="text-xs text-gray-400 truncate">
          {asset.external_url || 'Uploaded file'}
        </p>
      </div>
      <div className="flex gap-2">
        {asset.external_url && (
          <a href={asset.external_url} target="_blank"
             className="text-xs text-gray-500 hover:text-black px-3 py-1.5
                        border border-gray-200 rounded-lg">
            Open →
          </a>
        )}
        <button onClick={() => deleteAsset(asset.id)}
          className="text-gray-300 hover:text-red-400">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
```

**Mark section complete** when at least one template is added.

---

## Part 9 — API Routes

### `GET /api/brand-kit`
Returns all brand kit data for the current user:
```typescript
{
  sections: brand_kit_sections[],
  colors: brand_kit_colors[],
  fonts: brand_kit_fonts[],
  assets: brand_kit_assets[],
  documents: foundation_documents[], // where type in Foundation + additional types
}
```

### `POST /api/brand-kit/colors`
Upsert color — insert or update by id.

### `DELETE /api/brand-kit/colors/[id]`
Delete color row.

### `POST /api/brand-kit/fonts`
Upsert font by role (one font per role per user).

### `POST /api/brand-kit/assets`
Handle file upload to Supabase Storage + insert asset row.
Or insert asset with external_url only.

### `DELETE /api/brand-kit/assets/[id]`
Delete asset + remove from Supabase Storage if file_url exists.

### `POST /api/brand-kit/documents`
Upsert document to `foundation_documents` by type.
Increments version on update.

### `POST /api/brand-kit/sections/complete`
Mark a section as complete/incomplete.
Body: `{ sectionKey: string, completed: boolean }`

---

## Part 10 — Maya Context from Brand Kit

When Brand Kit page is active, dispatch rich canvas context:

```typescript
useEffect(() => {
  if (!data) return
  const ctx = [
    `Brand Kit — ${completedSections}/6 sections complete`,
    data.colors.length > 0
      ? `Colors: ${data.colors.map(c => `${c.name} ${c.hex} (${c.role})`).join(', ')}`
      : 'Colors: not set',
    data.fonts.length > 0
      ? `Fonts: ${data.fonts.map(f => `${f.family} (${f.role})`).join(', ')}`
      : 'Typography: not set',
    data.assets.length > 0
      ? `Assets: ${data.assets.length} files uploaded`
      : 'Assets: none uploaded',
    data.documents.length > 0
      ? `Documents: ${data.documents.map(d => d.type).join(', ')}`
      : 'Voice documents: not yet generated',
  ].join('\n')

  window.dispatchEvent(new CustomEvent('maya:canvas-context', {
    detail: { context: ctx }
  }))
}, [data])
```

---

## Part 11 — Remove Old Brand Kit Flow

Delete or redirect:
- The old "Start brand build" questionnaire flow
- Any routes pointing to `brand_documents` table
- The old `BrandKitClient` component if it uses the old flow

The new Brand Kit page replaces everything at `/dashboard/brand-kit`.

---

## Definition of Done

- [ ] SQL migration run — 4 new tables + storage bucket
- [ ] `/dashboard/brand-kit` replaced with 6-section tabbed layout
- [ ] Section tabs show with completion dots
- [ ] Overall completion score (X/6) in page header
- [ ] Section 1: Identity — 3 logo upload zones + external URL + usage rules
- [ ] Section 2: Colors — add/edit/delete colors with HEX/RGB/role
- [ ] Section 3: Typography — 4 font role cards with all fields
- [ ] Section 4: Imagery — photography style text + asset upload grid
- [ ] Section 5: Voice — all 4 Foundation docs + 4 additional messaging blocks, editable + regenerate button
- [ ] Section 6: Templates — link + upload support, template cards
- [ ] File uploads go to Supabase Storage 'brand-assets' bucket
- [ ] All API routes protected by auth
- [ ] Section complete marking works and persists
- [ ] Old "Start brand build" flow removed
- [ ] Maya canvas context dispatched from Brand Kit page with colors + fonts + docs
- [ ] Colors and fonts available to agents via brand kit API for on-brand generation

