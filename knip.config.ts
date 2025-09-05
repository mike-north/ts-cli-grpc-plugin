import type { KnipConfig } from "knip";

const cfg: KnipConfig = {
  workspaces: {
    "ts-cli-plugin": {
      ignoreDependencies: ["rollup"],
      entry: ["src/index.ts", "./bin/ts-cli-plugin"],
    },
    "examples/kv": {
      entry: ["src/register.ts", "src/plugin.ts"],
    },
  },
} satisfies KnipConfig;

export default cfg;
