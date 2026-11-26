# @milkdown/plugin-mermaid-pele

Render `mermaid` code blocks as themeable SVG with [Pele](https://pele.run/), the synchronous Mermaid renderer from the Obsidian team.

```typescript
import { Editor } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { mermaidPele } from '@milkdown/plugin-mermaid-pele'
import '@milkdown/plugin-mermaid-pele/style.css'

await Editor.make().use(commonmark).use(mermaidPele).create()
```

With Crepe, use the plugin after the editor is constructed and pass `withMermaidPreview()` as `renderPreview` so a block that stays on the CodeMirror view still draws a diagram:

```typescript
import { Crepe } from '@milkdown/crepe'
import { mermaidPele, withMermaidPreview } from '@milkdown/plugin-mermaid-pele'

const crepe = new Crepe({
  featureConfigs: {
    [Crepe.Feature.CodeMirror]: {
      renderPreview: withMermaidPreview(),
      previewOnlyByDefault: true,
    },
  },
})

crepe.editor.use(mermaidPele)
await crepe.create()
```

Click a diagram to edit its source. Leaving the block, or blurring the editor, shows only the SVG again. A Pele syntax error keeps the source open and shows the parser message.

Colors follow `--pele-*` variables mapped to Milkdown Crepe and VS Code theme tokens, including light, dark, and high contrast.
