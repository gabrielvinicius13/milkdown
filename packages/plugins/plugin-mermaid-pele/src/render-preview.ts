import type { RenderOptions } from 'pele'

import { PeleError, render } from 'pele'

import { isMermaidLanguage } from './language'

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/// Value accepted by Crepe `codeBlockConfig.renderPreview`.
export type MermaidPreviewValue = null | string | HTMLElement

/// Signature of `codeBlockComponent` / Crepe `renderPreview`.
export type MermaidPreviewRenderer = (
  language: string,
  content: string,
  applyPreview: (value: MermaidPreviewValue) => void
) => MermaidPreviewValue | void

export type MermaidSvgResult = { svg: string; error: null } | { svg: null; error: string }

/// Turn a Pele failure into a message that names the line when Pele has one.
export function formatMermaidError(error: unknown): string {
  if (error instanceof PeleError) {
    const location =
      error.line > 0 ? ` (line ${error.line}, column ${error.column})` : ''
    return `Mermaid diagram error${location}:\n${error.message}`
  }

  if (error instanceof Error && error.message) {
    return `Mermaid diagram error: ${error.message}`
  }

  return 'Mermaid diagram error: the diagram could not be rendered.'
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char] ?? char)
}

/// Render Mermaid source with Pele. Failures stay in `error` instead of throwing.
export function renderMermaidSvg(
  source: string,
  options?: RenderOptions
): MermaidSvgResult {
  try {
    return { svg: render(source, options).svg, error: null }
  } catch (error) {
    return { svg: null, error: formatMermaidError(error) }
  }
}

/// HTML fragment for Crepe's preview panel. The panel sanitizes this string.
export function renderMermaidMarkup(source: string, options?: RenderOptions) {
  const rendered = renderMermaidSvg(source, options)
  if (rendered.error) {
    return `<div class="milkdown-mermaid-preview pele milkdown-mermaid-preview-invalid"><p class="milkdown-mermaid-error" role="alert">${escapeHtml(rendered.error)}</p></div>`
  }

  return `<div class="milkdown-mermaid-preview pele">${rendered.svg}</div>`
}

/// `renderPreview` implementation. Non-mermaid languages return `null`.
export function renderMermaidPreview(
  language: string,
  content: string
): MermaidPreviewValue {
  if (!isMermaidLanguage(language)) return null
  return renderMermaidMarkup(content)
}

/// Chain Pele in front of an existing Crepe `renderPreview`.
export function withMermaidPreview(
  previous?: MermaidPreviewRenderer
): MermaidPreviewRenderer {
  return (language, content, applyPreview) => {
    if (!isMermaidLanguage(language)) {
      if (typeof previous === 'function') {
        return previous(language, content, applyPreview)
      }
      return null
    }

    return renderMermaidMarkup(content)
  }
}
