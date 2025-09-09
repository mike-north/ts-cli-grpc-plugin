import type { KnipConfig } from 'knip'

const cfg: KnipConfig = {
  ignore: [],
  ignoreDependencies: ['@commitlint/types'],
  ignoreBinaries: [],
  workspaces: {
    'ts-cli-grpc-plugin': {
      ignoreDependencies: ['rollup'],
      entry: ['src/index.ts', './bin/ts-cli-plugin'],
    },
    'examples/kv': {
      entry: ['src/register.ts', 'src/plugin.ts'],
    },
  },
}

export default cfg
