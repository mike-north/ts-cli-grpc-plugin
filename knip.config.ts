import type { KnipConfig } from 'knip'

const cfg: KnipConfig = {
  ignore: ['commitlint.config.ts'],
  ignoreDependencies: ['@commitlint/config-conventional', '@commitlint/types'],
  ignoreBinaries: ['commitlint'],
  workspaces: {
    'ts-cli-plugin': {
      ignoreDependencies: ['rollup'],
      entry: ['src/index.ts', './bin/ts-cli-plugin'],
    },
    'examples/kv': {
      entry: ['src/register.ts', 'src/plugin.ts'],
    },
  },
}

export default cfg
