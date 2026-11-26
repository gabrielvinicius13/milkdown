# @milkdown/plugin-mermaid-pele

Render `mermaid` and `pele` code blocks as themeable SVG with [Pele](https://pele.run/), the synchronous Mermaid renderer from the Obsidian team.

```typescript
import { Editor } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { mermaidPele } from '@milkdown/plugin-mermaid-pele'
import '@milkdown/plugin-mermaid-pele/style.css'

await Editor.make().use(commonmark).use(mermaidPele).create()
```

With Crepe, register the diagram languages and pass `withMermaidPreview()` as `renderPreview`. The block stays on Crepe's code view, which already has copy and show/hide:

```typescript
import { languages } from '@codemirror/language-data'
import { Crepe } from '@milkdown/crepe'
import {
  mermaidPele,
  withDiagramLanguages,
  withMermaidPreview,
} from '@milkdown/plugin-mermaid-pele'

const crepe = new Crepe({
  featureConfigs: {
    [Crepe.Feature.CodeMirror]: {
      // Crepe replaces the language list when `languages` is set.
      languages: withDiagramLanguages(languages),
      renderPreview: withMermaidPreview(),
      previewOnlyByDefault: true,
    },
  },
})

crepe.editor.use(mermaidPele)
await crepe.create()
```

Crepe keeps its code-block toolbar, so a diagram block can copy the source and toggle the editor. `withDiagramLanguages` adds `mermaid` and `pele` to that picker; both fences render with Pele. Without the code-block component, the plugin draws its own copy and edit controls.

Click a diagram to edit its source. Leaving the block, or blurring the editor, shows only the SVG again. A Pele syntax error keeps the source open and shows the parser message.

Colors follow `--pele-*` variables mapped to Milkdown Crepe and VS Code theme tokens, including light, dark, and high contrast.
