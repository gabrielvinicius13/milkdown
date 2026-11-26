import type { Ctx } from '@milkdown/ctx'
import type { Node as ProseNode } from '@milkdown/prose/model'
import type { EditorView, NodeView, ViewMutationRecord } from '@milkdown/prose/view'
import type { RenderOptions } from 'pele'

import { codeBlockAttr } from '@milkdown/preset-commonmark'
import { TextSelection } from '@milkdown/prose/state'

import { isMermaidLanguage } from './language'
import { renderMermaidSvg } from './render-preview'

interface CodeBlockDomAttrs {
  pre?: Record<string, unknown>
  code?: Record<string, unknown>
}

const selectionListeners = new Set<() => void>()
const focusListeners = new Set<() => void>()

let viewSerial = 0

/// Notify Mermaid node views that the ProseMirror selection moved.
export function notifyMermaidSelection() {
  for (const listener of selectionListeners) listener()
}

/// Notify Mermaid node views that editor focus changed.
export function notifyMermaidFocus() {
  for (const listener of focusListeners) listener()
}

function subscribe(selection: () => void, focus: () => void) {
  selectionListeners.add(selection)
  focusListeners.add(focus)
  return () => {
    selectionListeners.delete(selection)
    focusListeners.delete(focus)
  }
}

function assignAttrs(element: HTMLElement, attrs: Record<string, unknown> | undefined) {
  if (!attrs) return

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false || typeof value === 'object') continue
    if (key === 'class') {
      for (const className of String(value).split(/\s+/)) {
        if (className) element.classList.add(className)
      }
      continue
    }
    element.setAttribute(key, String(value))
  }
}

function readDomAttrs(ctx: Ctx, node: ProseNode): CodeBlockDomAttrs {
  if (!ctx.isInjected(codeBlockAttr.key)) return {}
  const value = ctx.get(codeBlockAttr.key)(node) as CodeBlockDomAttrs
  return value ?? {}
}

function cssFont(styles: CSSStyleDeclaration, variable: string, fallback: string) {
  const value = styles.getPropertyValue(variable).trim()
  if (!value || value.includes('var(')) return fallback
  return value
}

function selectionInside(view: EditorView, pos: number, nodeSize: number) {
  const { selection } = view.state
  const end = pos + nodeSize
  if (selection.from === pos && selection.to === end) return true
  return selection.from >= pos + 1 && selection.to <= end - 1
}

/// Default `pre > code` shell so non-mermaid blocks keep schema DOM and decorations.
export class DefaultCodeBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private node: ProseNode

  constructor(node: ProseNode, ctx: Ctx) {
    this.node = node
    const attrs = readDomAttrs(ctx, node)
    const pre = document.createElement('pre')
    assignAttrs(pre, attrs.pre)
    const language = String(node.attrs.language ?? '')
    if (language) pre.dataset.language = language

    const code = document.createElement('code')
    assignAttrs(code, attrs.code)
    pre.append(code)
    this.dom = pre
    this.contentDOM = code
  }

  update(node: ProseNode) {
    if (node.type !== this.node.type) return false
    if (isMermaidLanguage(node.attrs.language)) return false

    const language = String(node.attrs.language ?? '')
    const previous = String(this.node.attrs.language ?? '')
    this.node = node
    if (language !== previous) {
      if (language) this.dom.dataset.language = language
      else delete this.dom.dataset.language
    }
    return true
  }
}

/// Diagram preview for a `code_block` whose language is `mermaid`.
export class MermaidCodeBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private node: ProseNode
  private readonly preview: HTMLElement
  private readonly errorEl: HTMLElement
  private readonly source: HTMLElement
  private readonly idPrefix: string
  private readonly unsubscribe: () => void
  private readonly onResize: ResizeObserver | null
  private open = false
  private invalid = false
  private lastSource = ''
  private lastWidth = 0

  constructor(
    node: ProseNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    ctx: Ctx
  ) {
    this.node = node
    viewSerial += 1
    this.idPrefix = `milkdown-mermaid-${viewSerial}-`

    const block = document.createElement('div')
    block.className = 'milkdown-mermaid-block'
    block.dataset.language = 'mermaid'
    block.dataset.editing = 'false'
    block.dataset.invalid = 'false'

    this.preview = document.createElement('div')
    this.preview.className = 'milkdown-mermaid-preview pele'
    this.preview.contentEditable = 'false'
    this.preview.tabIndex = 0
    this.preview.setAttribute('role', 'button')
    this.preview.setAttribute('aria-label', 'Edit Mermaid diagram')
    this.preview.addEventListener('mousedown', this.onPreviewMouseDown)
    this.preview.addEventListener('keydown', this.onPreviewKeyDown)

    this.errorEl = document.createElement('p')
    this.errorEl.className = 'milkdown-mermaid-error'
    this.errorEl.setAttribute('role', 'alert')
    this.errorEl.contentEditable = 'false'
    this.errorEl.hidden = true

    const attrs = readDomAttrs(ctx, node)
    this.source = document.createElement('pre')
    this.source.className = 'milkdown-mermaid-source'
    assignAttrs(this.source, attrs.pre)
    this.source.dataset.language = 'mermaid'
    const code = document.createElement('code')
    assignAttrs(code, attrs.code)
    code.spellcheck = false
    this.source.append(code)

    block.append(this.preview, this.errorEl, this.source)
    this.dom = block
    this.contentDOM = code

    this.unsubscribe = subscribe(this.onSelection, this.onFocus)
    this.onResize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            const width = this.preview.clientWidth
            if (!width || Math.abs(width - this.lastWidth) < 8) return
            this.lastWidth = width
            this.renderDiagram(true)
          })
    this.onResize?.observe(this.preview)
    this.renderDiagram(true)
    this.sync()
  }

  update(node: ProseNode) {
    if (node.type !== this.node.type) return false
    if (!isMermaidLanguage(node.attrs.language)) return false
    this.node = node
    this.renderDiagram(false)
    this.sync()
    return true
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode')
    this.open = true
    this.view.focus()
    this.sync()
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode')
    if (!this.invalid) this.open = false
    this.sync()
  }

  stopEvent(event: Event) {
    const target = event.target
    if (!(target instanceof globalThis.Node)) return false
    if (this.contentDOM.contains(target)) return false
    return this.preview.contains(target) || this.errorEl.contains(target)
  }

  ignoreMutation(record: ViewMutationRecord) {
    return !this.contentDOM.contains(record.target)
  }

  destroy() {
    this.preview.removeEventListener('mousedown', this.onPreviewMouseDown)
    this.preview.removeEventListener('keydown', this.onPreviewKeyDown)
    this.onResize?.disconnect()
    this.unsubscribe()
  }

  private onPreviewMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || this.isSourceVisible()) return
    event.preventDefault()
    event.stopPropagation()
    this.edit()
  }

  private onPreviewKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (this.isSourceVisible()) return
    event.preventDefault()
    this.edit()
  }

  private onSelection = () => {
    const pos = this.getPos()
    if (pos == null) return
    const inside = selectionInside(this.view, pos, this.node.nodeSize)
    if (!inside && !this.invalid) this.open = false
    this.sync()
  }

  private onFocus = () => {
    if (!this.view.hasFocus() && !this.invalid) this.open = false
    this.sync()
  }

  private edit() {
    const pos = this.getPos()
    if (pos == null) return
    const node = this.view.state.doc.nodeAt(pos)
    if (!node) return
    const caret = pos + node.nodeSize - 1
    this.view.dispatch(
      this.view.state.tr.setSelection(TextSelection.create(this.view.state.doc, caret))
    )
    this.open = true
    this.view.focus()
    this.sync()
  }

  private isSourceVisible() {
    return this.dom.dataset.editing === 'true' || this.invalid
  }

  private renderDiagram(force: boolean) {
    const source = this.node.textContent
    const width = this.preview.clientWidth
    if (!force && source === this.lastSource && width === this.lastWidth) return
    this.lastSource = source
    if (width) this.lastWidth = width

    const styles = getComputedStyle(this.preview)
    const options: RenderOptions = {
      idPrefix: this.idPrefix,
      responsive: true,
      fontFamily: cssFont(styles, '--pele-font', styles.fontFamily || 'sans-serif'),
      fontFamilyMono: cssFont(styles, '--pele-font-mono', 'monospace'),
    }
    if (width > 0) options.maxWidth = width

    const rendered = renderMermaidSvg(source, options)
    if (rendered.svg) {
      this.invalid = false
      this.preview.innerHTML = rendered.svg
      this.errorEl.hidden = true
      this.errorEl.textContent = ''
      return
    }

    this.invalid = true
    this.open = true
    this.preview.replaceChildren()
    this.errorEl.hidden = false
    this.errorEl.textContent = rendered.error
  }

  private sync() {
    const showSource = this.invalid || this.open
    this.dom.dataset.editing = showSource ? 'true' : 'false'
    this.dom.dataset.invalid = this.invalid ? 'true' : 'false'
    this.preview.tabIndex = showSource ? -1 : 0
    this.preview.setAttribute('role', showSource ? 'img' : 'button')
    if (showSource) this.preview.removeAttribute('aria-label')
    else this.preview.setAttribute('aria-label', 'Edit Mermaid diagram')
  }
}
