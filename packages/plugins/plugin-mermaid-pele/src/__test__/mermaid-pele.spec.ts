import { defaultValueCtx, Editor, editorViewCtx, rootCtx } from '@milkdown/core'
import { prism } from '@milkdown/plugin-prism'
import { commonmark } from '@milkdown/preset-commonmark'
import { TextSelection } from '@milkdown/prose/state'
import { expect, it } from 'vitest'

import { mermaidPele, renderMermaidPreview, withMermaidPreview } from '../index'

const DIAGRAM = ['flowchart LR', '  A[Start] --> B[End]'].join('\n')

const MARKDOWN = [
  '```javascript',
  'const value = 1',
  '```',
  '',
  '```mermaid',
  DIAGRAM,
  '```',
  '',
  '```mermaid',
  'flowchart LR',
  '  A -->',
  '```',
  '',
].join('\n')

async function createEditor(markdown: string) {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = Editor.make()
  editor.config((ctx) => {
    ctx.set(rootCtx, root)
    ctx.set(defaultValueCtx, markdown)
  })
  editor.use(commonmark).use(prism).use(mermaidPele)
  await editor.create()
  return { editor, root }
}

it('renders mermaid with pele and leaves other code blocks as pre > code', async () => {
  const { editor, root } = await createEditor(MARKDOWN)
  const view = editor.ctx.get(editorViewCtx)
  const javascript = view.dom.querySelector('pre[data-language="javascript"]')
  expect(javascript?.tagName).toBe('PRE')
  expect(javascript?.querySelector(':scope > code')?.textContent).toContain('const value = 1')
  expect(javascript?.querySelector('span')).toBeTruthy()

  const diagrams = [
    ...view.dom.querySelectorAll<HTMLElement>('.milkdown-mermaid-block'),
  ]
  expect(diagrams).toHaveLength(2)

  const valid = diagrams[0]
  expect(valid?.dataset.editing).toBe('false')
  expect(valid?.dataset.invalid).toBe('false')
  expect(valid?.querySelector('.milkdown-mermaid-preview.pele svg')).toBeTruthy()
  expect(valid?.querySelector('pre.milkdown-mermaid-source code')?.textContent).toContain(
    'A[Start]'
  )

  const invalid = diagrams[1]
  expect(invalid?.dataset.invalid).toBe('true')
  expect(invalid?.dataset.editing).toBe('true')
  expect(invalid?.querySelector('.milkdown-mermaid-error')?.textContent).toContain(
    'Mermaid diagram error'
  )

  const preview = valid?.querySelector<HTMLElement>('.milkdown-mermaid-preview')
  preview?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
  expect(valid?.dataset.editing).toBe('true')

  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))
  expect(valid?.dataset.editing).toBe('false')

  await editor.destroy()
  root.remove()
})

it('returns null for other languages and chains an existing preview', () => {
  expect(renderMermaidPreview('javascript', 'const a = 1')).toBeNull()
  const html = renderMermaidPreview('Mermaid', DIAGRAM)
  expect(html).toContain('<svg')
  expect(html).toContain('milkdown-mermaid-preview pele')

  const broken = renderMermaidPreview('mermaid', 'flowchart LR\n  A -->')
  expect(broken).toContain('milkdown-mermaid-error')

  const chained = withMermaidPreview((language) => `other:${language}`)
  expect(chained('typescript', 'let a = 1', () => undefined)).toBe('other:typescript')
  expect(String(chained('mermaid', DIAGRAM, () => undefined))).toContain('<svg')
})
