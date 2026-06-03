export function safePdfText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}

function escapePdfText(value: string) {
  return safePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapPdfLine(line: string, maxChars = 88) {
  const words = safePdfText(line).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (!current) {
      current = word
    } else if (`${current} ${word}`.length <= maxChars) {
      current += ` ${word}`
    } else {
      lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

export function buildTextPdf(title: string, subtitle: string, body: string) {
  const contentLines = body
    .split('\n')
    .flatMap(line => line.trim() ? wrapPdfLine(line) : [''])

  const pages: string[][] = []
  const firstPageLines = [
    ...wrapPdfLine(title, 60),
    subtitle,
    '',
    ...contentLines,
  ]

  for (let i = 0; i < firstPageLines.length; i += 46) {
    pages.push(firstPageLines.slice(i, i + 46))
  }

  const objects: string[] = []
  const pageObjectIds: number[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  pages.forEach((pageLines, index) => {
    const pageId = objects.length + 1
    const contentId = pageId + 1
    pageObjectIds.push(pageId)

    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`)

    const textCommands = pageLines.map((line, lineIndex) => {
      const fontSize = index === 0 && lineIndex === 0 ? 18 : lineIndex === 1 && index === 0 ? 10 : 11
      const leading = fontSize === 18 ? 22 : 15
      const escaped = escapePdfText(line)
      return lineIndex === 0
        ? `/F1 ${fontSize} Tf 50 742 Td ${leading} TL (${escaped}) Tj`
        : `/F1 ${fontSize} Tf T* (${escaped}) Tj`
    }).join('\n')
    const stream = `BT\n${textCommands}\nET`
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return pdf
}
