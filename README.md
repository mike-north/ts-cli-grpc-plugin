## ts-cli-grpc-plugin (monorepo) [![CI](https://github.com/mike-north/ts-cli-grpc-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/mike-north/ts-cli-grpc-plugin/actions/workflows/ci.yml)

TypeScript gRPC plugin toolkit compatible with HashiCorp's go-plugin, plus runnable examples and the upstream `go-plugin` pinned as a submodule.

- `ts-cli-plugin/`: TypeScript library and CLI wrapper for serving plugins over gRPC
- `examples/`: Example plugins built with the library (e.g., `kv/`)
- `go-plugin/`: Upstream HashiCorp `go-plugin` submodule used for proto definitions and host examples (pinned)

Upstream reference: [hashicorp/go-plugin](https://github.com/hashicorp/go-plugin)

### Prerequisites

- Node.js and pnpm (this repo uses pnpm workspaces)
- Go toolchain (for building/running the upstream Go host examples)

### Setup

```bash
git submodule update --init
pnpm install
```

### Build and test

```bash
pnpm build   # builds all workspaces
pnpm test    # runs workspace tests
```

### Run the KV example end-to-end

1. Build the TypeScript library and example code

```bash
pnpm --filter ts-cli-plugin build
pnpm --filter @examples/kv build
```

2. Build the Go host (from the upstream example)

```bash
cd go-plugin/examples/grpc
go build -o kv
cd -
```

3. Launch the Go host, pointing it at the Node plugin via the CLI wrapper

```bash
export KV_PLUGIN="node $(pwd)/ts-cli-plugin/bin/ts-cli-plugin \
  --module $(pwd)/examples/kv/src/register.ts \
  --address 127.0.0.1 \
  --app-proto-version 1"

./go-plugin/examples/grpc/kv put hello world
./go-plugin/examples/grpc/kv get hello
# -> prints: world
```

### How hosts locate and launch plugins

- Hosts decide how to obtain the plugin command to execute (binary or shell command). The mechanism is host-defined and not part of this library.
- The upstream Go KV example uses an environment variable and shells it:

```go
// go-plugin/examples/grpc/main.go
Cmd: exec.Command("sh", "-c", os.Getenv("KV_PLUGIN")),
```

- Other hosts may use a different env var name, a config file, or CLI flags. In this repo, `KV_PLUGIN` is specific to the KV example; adapt the name/mechanism to your host.

### Notes:

- The library automatically registers the gRPC Health service (service name "plugin") and the internal `plugin.GRPCStdio` and `plugin.GRPCController` services expected by the host.
- The handshake line printed to stdout follows the upstream format `CORE|APP|NETWORK|ADDR|grpc`.

### Repository structure

```
ts-cli-grpc-plugin/
  README.md                 # this file (monorepo overview)
  ts-cli-plugin/            # TypeScript library and CLI wrapper
  examples/                 # example plugins (see README inside)
  go-plugin/                # upstream submodule (HashiCorp go-plugin)
```

### More docs

- TypeScript library: `ts-cli-plugin/README.md`
- Examples: `examples/README.md`
- Upstream background and architecture: [hashicorp/go-plugin](https://github.com/hashicorp/go-plugin)
