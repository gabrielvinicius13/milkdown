import type { Ctx, MilkdownPlugin } from '@milkdown/ctx'
import type { NodeViewConstructor } from '@milkdown/prose/view'

import {
  EditorStateReady,
  editorViewTimerCtx,
  nodeViewCtx,
} from '@milkdown/core'
import { codeBlockSchema } from '@milkdown/preset-commonmark'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose, addTimer } from '@milkdown/utils'

import { isMermaidLanguage } from './language'
import {
  DefaultCodeBlockView,
  MermaidCodeBlockView,
  notifyMermaidFocus,
  notifyMermaidSelection,
} from './node-view'
import {
  withMermaidPreview,
  type MermaidPreviewRenderer,
} from './render-preview'

const CODE_BLOCK_ID = 'code_block'
const PREVIEW_CONFIG = 'codeBlockConfigCtx'

interface PreviewConfig {
  renderPreview?: MermaidPreviewRenderer
  previewOnlyByDefault?: boolean
}

function codeBlockNodeId() {
  return codeBlockSchema.node.id || CODE_BLOCK_ID
}

function installPreviewConfig(ctx: Ctx) {
  if (!ctx.isInjected(PREVIEW_CONFIG)) return

  ctx.update(PREVIEW_CONFIG, (previous: PreviewConfig) => ({
    ...previous,
    renderPreview: withMermaidPreview(previous.renderPreview),
  }))
}

function installNodeView(ctx: Ctx) {
  const nodeId = codeBlockNodeId()
  const snapshot = ctx.get(nodeViewCtx).slice()
  const previous = [...snapshot].reverse().find(([id]) => id === nodeId)?.[1]

  const wrapped: NodeViewConstructor = (
    node,
    view,
    getPos,
    decorations,
    innerDecorations
  ) => {
    const position = typeof getPos === 'function' ? getPos : () => undefined
    if (!isMermaidLanguage(node.attrs.language)) {
      if (previous) {
        return previous(node, view, getPos, decorations, innerDecorations)
      }
      return new DefaultCodeBlockView(node, ctx)
    }
    // Crepe's code block already draws the copy button, language picker and
    // preview toggle. Keep that view and render the diagram through renderPreview.
    if (ctx.isInjected(PREVIEW_CONFIG) && previous) {
      return previous(node, view, getPos, decorations, innerDecorations)
    }
    return new MermaidCodeBlockView(node, view, position, ctx)
  }

  const next: Array<[string, NodeViewConstructor]> = [
    ...snapshot.filter((entry) => entry[0] !== nodeId),
    [nodeId, wrapped],
  ]
  ctx.set(nodeViewCtx, next)

  return () => {
    if (ctx.isInjected(nodeViewCtx)) ctx.set(nodeViewCtx, snapshot)
  }
}

/// Registers the Mermaid node view after every other code-block view.
export const mermaidPeleView = addTimer(
  (ctx, plugin, done) => {
    plugin.meta = {
      package: '@milkdown/plugin-mermaid-pele',
      displayName: 'NodeView<mermaid-pele>',
    }

    const ready = (async () => {
      await ctx.wait(EditorStateReady)
      installPreviewConfig(ctx)
      return installNodeView(ctx)
    })()

    return ready.finally(() => {
      done()
    })
  },
  editorViewTimerCtx,
  'mermaid-pele-view'
)

function revealInvalidCrepeBlocks(root: HTMLElement) {
  for (const block of root.querySelectorAll<HTMLElement>(
    '.milkdown-code-block'
  )) {
    const invalid = Boolean(block.querySelector('.milkdown-mermaid-error'))
    const host = block.querySelector('.codemirror-host')
    const toggle = block.querySelector<HTMLButtonElement>(
      '.preview-toggle-button'
    )
    if (!host || !toggle) continue

    if (!invalid) {
      delete block.dataset.mermaidRevealed
      continue
    }

    if (
      host.classList.contains('hidden') &&
      block.dataset.mermaidRevealed !== '1'
    ) {
      block.dataset.mermaidRevealed = '1'
      toggle.click()
    }
  }
}

function hideCrepeSource(root: HTMLElement) {
  for (const block of root.querySelectorAll<HTMLElement>(
    '.milkdown-code-block'
  )) {
    if (!block.querySelector('.milkdown-mermaid-preview')) continue
    if (block.querySelector('.milkdown-mermaid-error')) continue
    const host = block.querySelector('.codemirror-host')
    if (!host || host.classList.contains('hidden')) continue
    block.querySelector<HTMLButtonElement>('.preview-toggle-button')?.click()
  }
}

/// Selection, focus, and Crepe preview interactions for diagram blocks.
export const mermaidPeleBehavior = $prose(
  () =>
    new Plugin({
      key: new PluginKey('MILKDOWN_MERMAID_PELE'),
      props: {
        handleDOMEvents: {
          mousedown(_view, event) {
            const target = event.target
            if (!(target instanceof Element)) return false
            if (target.closest('.milkdown-mermaid-block')) return false
            const preview = target.closest('.milkdown-mermaid-preview')
            if (!preview) return false
            const block = preview.closest('.milkdown-code-block')
            if (!block) return false
            const host = block.querySelector('.codemirror-host')
            if (!host?.classList.contains('hidden')) return false
            event.preventDefault()
            block
              .querySelector<HTMLButtonElement>('.preview-toggle-button')
              ?.click()
            return true
          },
        },
      },
      view(editorView) {
        const onFocus = () => {
          notifyMermaidFocus()
        }
        const onFocusOut = (event: FocusEvent) => {
          const next = event.relatedTarget
          if (next instanceof Node && editorView.dom.contains(next)) return
          hideCrepeSource(editorView.dom)
          notifyMermaidFocus()
        }
        editorView.dom.addEventListener('focus', onFocus)
        editorView.dom.addEventListener('focusout', onFocusOut)
        return {
          update(view, previous) {
            if (!view.state.selection.eq(previous.selection)) {
              notifyMermaidSelection()
            }
            revealInvalidCrepeBlocks(view.dom)
          },
          destroy() {
            editorView.dom.removeEventListener('focus', onFocus)
            editorView.dom.removeEventListener('focusout', onFocusOut)
            notifyMermaidFocus()
          },
        }
      },
    })
)

mermaidPeleBehavior.meta = {
  package: '@milkdown/plugin-mermaid-pele',
  displayName: 'Prose<mermaid-pele>',
}

/// Mermaid diagrams for Milkdown code blocks, rendered synchronously by Pele.
export const mermaidPele: MilkdownPlugin[] = [
  mermaidPeleView,
  mermaidPeleBehavior,
]
