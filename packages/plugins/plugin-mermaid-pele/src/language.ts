const DIAGRAM_LANGUAGES = new Set(['mermaid', 'pele'])

/// A fenced code block is a diagram when its language is `mermaid` or `pele`.
export function isMermaidLanguage(language: unknown): boolean {
  return (
    typeof language === 'string' &&
    DIAGRAM_LANGUAGES.has(language.trim().toLowerCase())
  )
}
