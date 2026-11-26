import type { LibraryOptions } from 'vite'

import { pluginViteConfig } from '@milkdown/dev/vite'

export default pluginViteConfig(import.meta.url, {
  build: {
    lib: { cssFileName: 'style' } as LibraryOptions,
  },
})
