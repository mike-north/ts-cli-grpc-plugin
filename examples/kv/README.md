## KV Example

Key-value plugin implemented in TypeScript using `ts-cli-grpc-plugin`, interoperating with the upstream Go host from `hashicorp/go-plugin`.

### Build

```bash
pnpm --filter ts-cli-grpc-plugin build
pnpm --filter @examples/kv build
```

### Run with the upstream Go host

```bash
# Build the Go host
cd ../../go-plugin/examples/grpc
go build -o kv
cd -

# Point the host to this plugin via the CLI wrapper
export KV_PLUGIN="node $(pwd)/ts-cli-grpc-plugin/bin/ts-cli-plugin \
  --module $(pwd)/examples/kv/src/register.ts \
  --address 127.0.0.1 \
  --app-proto-version 1"

./go-plugin/examples/grpc/kv put hello world
./go-plugin/examples/grpc/kv get hello
# -> prints: world
```

### Implementation notes

- The plugin registers the `proto.KV` service defined in `go-plugin/examples/grpc/proto/kv.proto`.
- Data is persisted to files named `kv_<key>` in the current working directory for simplicity.
- The TypeScript entrypoints are `src/register.ts` (exports a `register(server)` function) and `src/plugin.ts` (standalone runner using `servePlugin`).
