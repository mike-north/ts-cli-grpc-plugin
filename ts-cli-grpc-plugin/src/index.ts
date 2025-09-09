/**
 * TypeScript library for writing CLI plugins compatible with HashiCorp's go-plugin (gRPC protocol).
 *
 * This package exposes small, focused primitives to help you bring up a gRPC server
 * that can speak to a go-plugin host:
 *
 * - Registers the gRPC Health service and reports SERVING for service "plugin" so the host can probe readiness
 * - Emits the expected handshake line on stdout in the form `CORE|APP|NETWORK|ADDR|grpc` so the host can connect
 * - Optionally wires up the internal `GRPCStdio` and `GRPCController` services when the corresponding protos are present
 * - Lets you register your own gRPC services via a simple callback
 *
 * The most common entry point is {@link ts-cli-plugin#servePlugin}, which binds a local server and
 * writes the handshake line that the host process consumes on stdout. For convenience,
 * {@link ts-cli-plugin#formatHandshake} is also exported if you need to compute the handshake string manually.
 *
 * @packageDocumentation
 */

import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import * as path from 'node:path'
import * as fs from 'node:fs'
import {
  GrpcHealthPackage,
  LoadedRootHealth,
  isGrpcHealthPackage,
  PluginInternalPackages,
  LoadedRootPlugin,
  isPluginInternalPackages,
} from './guards'
// Re-export public helper utilities (documented in `helpers.ts`).
export * from './helpers'
/**
 * Union of supported network types for the gRPC server.
 *
 * - "tcp": bind to a host:port (e.g. `127.0.0.1:0` for an ephemeral port)
 * - "unix": bind to a filesystem UNIX domain socket path
 *
 * @public
 */
export type NetworkType = 'tcp' | 'unix'

/**
 * Options for {@link servePlugin}.
 *
 * @remarks
 * - When {@link ServeOptions.networkType} is "tcp" and the `address` omits a port,
 *   an ephemeral port is chosen automatically.
 * - When {@link ServeOptions.networkType} is "unix", the address is treated as a
 *   filesystem path and will be prefixed with `unix:` for gRPC if not already present.
 *
 * @example
 * Using an ephemeral TCP port and registering your own service:
 * ```ts
 * import * as grpc from "@grpc/grpc-js";
 * import { servePlugin } from "ts-cli-plugin";
 *
 * await servePlugin({
 *   appProtocolVersion: 1,
 *   address: "127.0.0.1:0",
 *   register(server: grpc.Server) {
 *     server.addService(MyServiceDefinition, myHandlers)
 *   },
 * });
 * ```
 * @public
 */
export interface ServeOptions {
  /** Application protocol version expected by the host application. */
  appProtocolVersion: number
  /**
   * Address to bind.
   * - For "tcp", use `host:port` (e.g. `127.0.0.1:0` to select an ephemeral port)
   * - For "unix", provide the socket path (e.g. `/tmp/my.sock`)
   */
  address: string
  /** Network type for the gRPC server. Defaults to "tcp". */
  networkType?: NetworkType
  /** Optional callback to register your gRPC service definition(s) on the server. */
  register?: (server: grpc.Server) => void
}

/**
 * Formats the handshake line that the go-plugin host expects on stdout.
 *
 * The format is: `CORE|APP|NETWORK|ADDR|PROTOCOL` (example: `1|1|tcp|127.0.0.1:12345|grpc`).
 *
 * @param coreProtocolVersion - The core protocol version (typically `1`).
 * @param appProtocolVersion - The application protocol version that your plugin implements.
 * @param networkType - The network type to advertise to the host.
 * @param address - The advertised address. For "tcp" this is `host:port`. For "unix" this is a path.
 * @param protocol - The transport protocol identifier. Defaults to `"grpc"`.
 * @returns The handshake string that should be written to stdout.
 *
 * @example
 * ```ts
 * const line = formatHandshake(1, 1, "tcp", "127.0.0.1:34567", "grpc");
 * // => "1|1|tcp|127.0.0.1:34567|grpc"
 * ```
 *
 * @public
 */
export function formatHandshake(
  coreProtocolVersion: number,
  appProtocolVersion: number,
  networkType: NetworkType,
  address: string,
  protocol: 'grpc' | 'netrpc' = 'grpc',
): string {
  return `${coreProtocolVersion}|${appProtocolVersion}|${networkType}|${address}|${protocol}`
}

function loadHealthDefinition(): GrpcHealthPackage {
  const protoPath = path.join(__dirname, 'protos/grpc/health/v1/health.proto')
  // When running from ts-node, fall back to src path
  const altProtoPath = path.join(
    process.cwd(),
    'ts-cli-plugin/src/protos/grpc/health/v1/health.proto',
  )
  const finalPath = fs.existsSync(protoPath)
    ? protoPath
    : fs.existsSync(altProtoPath)
      ? altProtoPath
      : protoPath
  const packageDefinition = protoLoader.loadSync(finalPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  })
  const loadedRootUnknown = grpc.loadPackageDefinition(packageDefinition) as unknown
  const loadedRoot = loadedRootUnknown as LoadedRootHealth
  const loaded = loadedRoot?.grpc?.health?.v1
  if (isGrpcHealthPackage(loaded)) return loaded
  throw new Error('Failed loading grpc.health.v1 package definition')
}

async function loadInternalPluginDefinition(): Promise<
  PluginInternalPackages | undefined
> {
  // Load go-plugin internal protos from submodule if available. We try
  // multiple candidate paths to support running from different CWDs.
  const candidates = [
    path.join(__dirname, '../../go-plugin/internal/plugin'),
    path.join(__dirname, '../go-plugin/internal/plugin'),
    path.join(process.cwd(), 'go-plugin/internal/plugin'),
  ]
  let baseDir: string | undefined
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'grpc_stdio.proto'))) {
      baseDir = c
      break
    }
  }
  if (!baseDir) return undefined
  const stdioPath = path.join(baseDir, 'grpc_stdio.proto')
  const controllerPath = path.join(baseDir, 'grpc_controller.proto')
  const files: string[] = [stdioPath, controllerPath]
  // Resolve google imports via google-proto-files
  let includePaths: string[] = []
  try {
    const gpfMod: unknown = await import('google-proto-files')
    const getProtoPath = (gpfMod as { getProtoPath?: () => string }).getProtoPath
    if (typeof getProtoPath === 'function') {
      includePaths = [getProtoPath()]
    }
  } catch {
    // ignore optional include dir resolution
  }
  const packageDefinition = protoLoader.loadSync(files, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: includePaths,
  })
  const loadedUnknown = grpc.loadPackageDefinition(packageDefinition) as unknown
  if (isPluginInternalPackages(loadedUnknown)) return loadedUnknown
  const nested = loadedUnknown as LoadedRootPlugin
  if (nested && typeof nested === 'object' && nested.plugin) {
    return { plugin: nested.plugin }
  }
  return undefined
}

/**
 * Starts a gRPC server suitable for a go-plugin host and writes the handshake line to stdout.
 *
 * This function:
 * - Registers a minimal gRPC Health service and reports `SERVING` for service "plugin"
 * - Optionally registers the internal `GRPCStdio` and `GRPCController` services if the
 *   corresponding protos are available (when the `go-plugin` submodule exists)
 * - Invokes your {@link ServeOptions.register | register} callback so you can add your own services
 * - Binds the server to the requested address (choosing an ephemeral port for TCP if none supplied)
 * - Emits a single handshake line to stdout using {@link formatHandshake}
 *
 * @param options - Server configuration and (optional) service registration callback.
 * @returns An object containing the started `server` and the final `address` it is bound to.
 *
 * @remarks
 * - For `networkType` "tcp", if you omit the port (e.g. `127.0.0.1`), an ephemeral port is chosen and returned.
 * - For `networkType` "unix", the path will be prefixed with `unix:` as required by gRPC if not already present.
 * - This function writes the handshake line to `process.stdout` exactly once after the server starts.
 * - When internal protos are present, stdout/stderr writes are mirrored over the `GRPCStdio` stream expected by the host.
 *
 * @throws If the server fails to bind to the requested address.
 *
 * @example
 * Start a server on an ephemeral port and register your own service(s):
 * ```ts
 * import * as grpc from "@grpc/grpc-js";
 * import { servePlugin } from "ts-cli-plugin";
 *
 * const { server, address } = await servePlugin({
 *   appProtocolVersion: 1,
 *   address: "127.0.0.1:0",
 *   register(s: grpc.Server) {
 *     s.addService(MyServiceDefinition, handlers)
 *   },
 * });
 * console.log("listening on", address);
 * ```
 *
 * @public
 */
export async function servePlugin(
  options: ServeOptions,
): Promise<{ server: grpc.Server; address: string }> {
  const networkType: NetworkType = options.networkType ?? 'tcp'
  const server = new grpc.Server()

  // Register health service (status for "plugin" must be SERVING)
  const healthPkg = loadHealthDefinition()
  // Minimal Health implementation
  const statusMap = new Map<string, number>()
  const ServingStatus = {
    UNKNOWN: 0,
    SERVING: 1,
    NOT_SERVING: 2,
    SERVICE_UNKNOWN: 3,
  }
  statusMap.set('plugin', ServingStatus.SERVING)
  type HealthCheckRequest = { service?: string }
  type HealthCheckResponse = { status: number }
  server.addService(healthPkg.Health.service, {
    Check(
      call: grpc.ServerUnaryCall<HealthCheckRequest, HealthCheckResponse>,
      callback: grpc.sendUnaryData<HealthCheckResponse>,
    ) {
      const service = call.request?.service || ''
      const status = statusMap.get(service || 'plugin') ?? ServingStatus.SERVICE_UNKNOWN
      callback(null, { status })
    },
    Watch(call: grpc.ServerWritableStream<HealthCheckRequest, HealthCheckResponse>) {
      const service = call.request?.service || 'plugin'
      const status = statusMap.get(service) ?? ServingStatus.SERVICE_UNKNOWN
      call.write({ status })
    },
  })

  // Register internal services expected by go-plugin if protos are available
  const internalPkgs = await loadInternalPluginDefinition()
  if (internalPkgs && internalPkgs.plugin) {
    // GRPCStdio
    const stdioSvc = internalPkgs.plugin.GRPCStdio?.service
    if (stdioSvc) {
      type StdioChunk = { channel: number; data: Buffer }
      type Empty = Record<string, never>
      let stdioStream: grpc.ServerWritableStream<Empty, StdioChunk> | undefined
      const Channel = { INVALID: 0, STDOUT: 1, STDERR: 2 }
      const origStdoutWrite: typeof process.stdout.write = process.stdout.write.bind(
        process.stdout,
      )
      const origStderrWrite: typeof process.stderr.write = process.stderr.write.bind(
        process.stderr,
      )
      function forward(channel: number, chunk: string | Uint8Array) {
        if (!stdioStream) return
        const data: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
        stdioStream.write({ channel, data })
      }
      function wrapWrite(
        original: typeof process.stdout.write,
        channel: number,
      ): typeof process.stdout.write {
        return function write(
          chunk: string | Uint8Array,
          encoding?: BufferEncoding | ((err?: Error | null) => void),
          cb?: (err?: Error | null) => void,
        ): boolean {
          forward(channel, chunk)
          if (typeof encoding === 'function') {
            return original(chunk, encoding as (err?: Error | null) => void)
          }
          return original(chunk, encoding, cb)
        } as typeof process.stdout.write
      }
      process.stdout.write = wrapWrite(origStdoutWrite, Channel.STDOUT)
      process.stderr.write = wrapWrite(origStderrWrite, Channel.STDERR)

      server.addService(stdioSvc, {
        streamStdio(call: grpc.ServerWritableStream<Empty, StdioChunk>) {
          stdioStream = call
          call.on('cancelled', () => {
            stdioStream = undefined
          })
          call.on('close', () => {
            stdioStream = undefined
          })
        },
      })
    }

    // GRPCController
    const controllerSvc = internalPkgs.plugin.GRPCController?.service
    if (controllerSvc) {
      server.addService(controllerSvc, {
        shutdown(
          call: grpc.ServerUnaryCall<Record<string, never>, Record<string, never>>,
          callback: grpc.sendUnaryData<Record<string, never>>,
        ) {
          // Force shutdown to avoid hanging due to open stdio/broker streams
          try {
            server.forceShutdown()
          } catch {
            // ignore errors during shutdown to avoid masking host behavior
          }
          callback(null, {})
          setImmediate(() => process.exit(0))
        },
      })
    }
  }

  // Allow user to register their services
  if (options.register) {
    options.register(server)
  }

  // Bind
  let bindAddress = options.address
  if (networkType === 'unix' && !bindAddress.startsWith('unix:')) {
    bindAddress = `unix:${bindAddress}`
  }
  if (networkType === 'tcp' && /:\d+$/.test(bindAddress) === false) {
    // If host omitted port, default to ephemeral
    bindAddress = `${bindAddress}:0`
  }

  const creds = grpc.ServerCredentials.createInsecure()
  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync(bindAddress, creds, (err, actualPort) => {
      if (err) return reject(err)
      resolve(actualPort)
    })
  })

  let advertisedAddress = bindAddress
  if (networkType === 'tcp') {
    const host = bindAddress.split(':')[0] || '127.0.0.1'
    advertisedAddress = `${host}:${port}`
  }

  server.start()

  // Output handshake to stdout exactly once
  const handshake = formatHandshake(
    1,
    options.appProtocolVersion,
    networkType,
    advertisedAddress,
    'grpc',
  )
  process.stdout.write(handshake + '\n')

  return { server, address: advertisedAddress }
}
