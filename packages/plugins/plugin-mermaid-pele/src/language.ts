/// A fenced code block is a Mermaid diagram when its language is `mermaid`.
export function isMermaidLanguage(language: unknown): boolean {
  return typeof language === 'string' && language.trim().toLowerCase() === 'mermaid'
}
