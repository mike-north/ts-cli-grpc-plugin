## ts-cli-plugin

TypeScript library for writing CLI plugins compatible with HashiCorp's go-plugin (gRPC protocol). It boots a gRPC server that:

- Registers the gRPC Health service and reports SERVING for service "plugin"
- Prints the expected handshake line to stdout: `CORE|APP|NETWORK|ADDR|grpc`
- Implements the internal `GRPCStdio` and `GRPCController` services expected by the go-plugin host

The repo includes the upstream `hashicorp/go-plugin` as a git submodule (pinned) so we can reuse internal protos and validate examples. See upstream project for background and architecture: [hashicorp/go-plugin](https://github.com/hashicorp/go-plugin).


## Install and build

This package is built with pnpm. From `ts-cli-plugin/`:

```bash
pnpm install
pnpm run build
```

You can consume the library via source in this monorepo, or publish it and install it in your own project.


## Quick start

### Use the library API

Implement your service, then call `servePlugin` and pass a `register(server)` callback that registers your gRPC service(s).

```ts
import { servePlugin } from "ts-cli-plugin";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// Load your service definition (example)
const def = protoLoader.loadSync(["./proto/kv.proto"], { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const { proto } = (grpc.loadPackageDefinition(def) as any);

const kvImpl = {
  async get(call: any, cb: any) { /* ... */ },
  async put(call: any, cb: any) { /* ... */ }
};

servePlugin({
  appProtocolVersion: 1,
  address: "127.0.0.1", // host will connect to 127.0.0.1:<ephemeral>
  networkType: "tcp",
  register(server) {
    server.addService(proto.KV.service, kvImpl);
  },
});
```

The process will print one line like `1|1|tcp|127.0.0.1:12345|grpc` and keep serving until the host requests shutdown.

### Use the CLI wrapper

The included CLI bin lets you export a `register(server)` function from a JS module and run a plugin without writing a full `main`.

```bash
# Build first
pnpm run build

# Run the CLI; the module must export register(server)
node ./bin/ts-cli-plugin \
  --module /absolute/path/to/register.js \
  --address 127.0.0.1 \
  --app-proto-version 1
```

Supported flags:
- `--address` (default `127.0.0.1`)
- `--network` (`tcp`|`unix`, default `tcp`)
- `--app-proto-version` (number, default `1`)
- `--module` (path to module exporting `register(server)`)


## End-to-end with the upstream KV example

This repository includes the upstream `go-plugin` as a submodule; we use its KV example host to validate.

```bash
# Build the TS library
cd ts-cli-plugin
pnpm run build

# Build the Go KV host
cd ../go-plugin/examples/grpc
go build -o kv

# Point the host at our Node plugin (register.js provided in examples/kv)
export KV_PLUGIN='node /absolute/path/to/ts-cli-plugin/bin/ts-cli-plugin \
  --module /absolute/path/to/ts-cli-plugin/examples/kv/register.js \
  --address 127.0.0.1 \
  --app-proto-version 1'

./kv put hello world
./kv get hello
# -> prints: world
```

Seeing EOF/GOAWAY messages in plugin logs during shutdown is expected; the host closes the transport after the request.


## API reference

### `servePlugin(options)`

Boots the plugin gRPC server and prints the handshake line.

```ts
type NetworkType = "tcp" | "unix";

interface ServeOptions {
  appProtocolVersion: number; // host-defined application version
  address: string;            // e.g. "127.0.0.1" (ephemeral port auto-assigned) or unix socket path
  networkType?: NetworkType;  // default "tcp"
  register?: (server: grpc.Server) => void; // register your gRPC services
}
```

Behavior:
- Health service is registered and returns SERVING for service "plugin"
- Internal `GRPCStdio` and `GRPCController` services are registered automatically
- For `tcp`, the server binds to an ephemeral port and prints the final `host:port` in the handshake

### `formatHandshake(core, app, network, addr, protocol)`

Returns a string in the format required by go-plugin, e.g. `1|1|tcp|127.0.0.1:1234|grpc`.

### Helpers

```ts
import { loadProtos, createRegistrar } from "ts-cli-plugin/dist/helpers";

const pkgs = loadProtos({ files: ["./proto/kv.proto"] });
const register = createRegistrar((server) => {
  server.addService(pkgs.proto.KV.service, kvImpl);
});
```


## Internal plugin services

This library auto-loads and serves the internal services that the go-plugin host expects:

- `plugin.GRPCStdio` (streams STDOUT/STDERR)
- `plugin.GRPCController` (shutdown)

The proto files are loaded from the `go-plugin` submodule, and `google-proto-files` is used to resolve standard Google imports.


## Handshake and health

- Handshake line format: `CORE-PROTOCOL-VERSION|APP-PROTOCOL-VERSION|NETWORK-TYPE|NETWORK-ADDR|grpc`.
- Health service must report `SERVING` for the service name `"plugin"`. The library sets this for you.

For more details, see the upstream docs on writing non-Go plugins and internals:
- Writing plugins without Go (gRPC): see `docs/guide-plugin-write-non-go.md` in upstream [hashicorp/go-plugin](https://github.com/hashicorp/go-plugin).


## Submodule and version pin

The `go-plugin` submodule is pinned to a specific tag to keep behavior stable with internal protos. To update:

```bash
git submodule update --init
cd go-plugin && git fetch --tags && git checkout <tag>
cd .. && git add go-plugin && git commit -m "chore: pin go-plugin to <tag>"
```


## Troubleshooting

- "The server does not implement /plugin.GRPCStdio/StreamStdio": Ensure you built the library and that the submodule is present; the internal services are registered on startup.
- EOF/GOAWAY on shutdown: Normal; the host closes the transport after completing the request.
- Unix sockets: set `networkType: "unix"` and pass a socket path as `address`. The library will advertise `unix:<path>` in the handshake.


## License

This package is licensed under ISC. The `go-plugin` submodule is licensed under MPL-2.0 (see its LICENSE).


