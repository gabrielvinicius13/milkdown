import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from '@codemirror/language'

const plain = StreamLanguage.define({
  token(stream) {
    stream.skipToEnd()
    return null
  },
})

function diagramLanguage(name: string) {
  return LanguageDescription.of({
    name,
    alias: [name],
    load: async () => new LanguageSupport(plain),
  })
}

/// CodeMirror language for a `mermaid` fence. The name is the fence info string.
export const mermaidLanguage = diagramLanguage('mermaid')

/// CodeMirror language for a `pele` fence. It renders with the same Pele preview.
export const peleLanguage = diagramLanguage('pele')

/// Append `mermaid` and `pele` when the list does not already define them.
/// Crepe replaces its language array when `languages` is passed, so pass the
/// result of this function instead of only the two diagram languages.
export function withDiagramLanguages(
  languages: readonly LanguageDescription[]
): LanguageDescription[] {
  const known = new Set<string>()
  for (const language of languages) {
    known.add(language.name.toLowerCase())
    for (const alias of language.alias) known.add(alias.toLowerCase())
  }
  const extra = [mermaidLanguage, peleLanguage].filter(
    (language) => !known.has(language.name.toLowerCase())
  )
  return [...languages, ...extra]
}
