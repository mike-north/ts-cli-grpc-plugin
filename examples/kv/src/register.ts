/**
 * KV example – register(server) entrypoint
 *
 * This module exports a single function, {@link register}, which is consumed by the
 * `ts-cli-plugin` CLI via the `--module` flag. The CLI will dynamically import this
 * module (using jiti), call `register(server)`, and then handle the go-plugin
 * lifecycle (handshake to stdout, health service, GRPCStdio/GRPCController, etc.).
 *
 * Responsibilities of this module:
 * - Locate and load the example `kv.proto` used by the go-plugin KV example
 * - Define a minimal KV service implementation with `get` and `put`
 * - Register that implementation onto the provided gRPC server
 *
 * Notes:
 * - Method names are lowerCamelCase (`get`, `put`) to match @grpc/proto-loader
 *   mapping rules for service method names.
 * - File paths are resolved robustly at runtime so the module works when executed
 *   from different working directories (tests, CLI, or manual runs).
 */
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import { packageUpSync } from 'package-up'

/**
 * Walk up the directory tree from `startDir` until we find the repository root
 * (identified by the presence of the `go-plugin` submodule directory).
 *
 * Throws a descriptive error if the root cannot be found in a reasonable number
 * of steps. This allows the example to be executed from various CWDs reliably.
 */
function findWorkspaceRoot(startDir: string): string {
  let curDir = startDir
  for (let i = 0; i < 12; i++) {
    const pkgPath = packageUpSync({ cwd: curDir })
    if (!pkgPath) break
    const root = path.dirname(pkgPath)
    const pnpmWorkspace = path.join(root, 'pnpm-workspace.yaml')
    if (fs.existsSync(pnpmWorkspace)) return root
    const parent = path.dirname(root)
    if (parent === root) break
    curDir = parent
  }
  throw new Error(`Could not locate workspace root from ${startDir}`)
}

/** Absolute path to the monorepo root (folder with pnpm-workspace.yaml). */
const REPO_ROOT = findWorkspaceRoot(__dirname)
/** Absolute path to the example kv.proto used by the go-plugin KV sample. */
const kvProtoPath = path.join(REPO_ROOT, 'go-plugin/examples/grpc/proto/kv.proto')
const packageDefinition = protoLoader.loadSync(kvProtoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})
/** Loaded gRPC package containing the KV service definition. */
const loaded = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  proto: { KV: { service: grpc.ServiceDefinition } }
}
const proto = loaded.proto

/** Request message for KV.Get – mirrors the proto. */
type GetRequest = { key: string }
/** Response message for KV.Get – a bytes buffer is returned. */
type GetResponse = { value: Buffer }
/** Request message for KV.Put – key and raw bytes value. */
type PutRequest = { key: string; value: Buffer }
/** Empty response – mirrors the proto `Empty`. */
type Empty = Record<string, never>

/**
 * Minimal KV implementation backed by local files next to the working dir.
 *
 * - `get` reads `kv_<key>` as bytes
 * - `put` writes value bytes to `kv_<key>`
 */
const kvImpl = {
  async get(
    call: grpc.ServerUnaryCall<GetRequest, GetResponse>,
    callback: grpc.sendUnaryData<GetResponse>,
  ) {
    try {
      const key = call.request?.key || ''
      const filename = `kv_${key}`
      const data = await fsp.readFile(filename).catch(() => Buffer.from(''))
      callback(null, { value: data })
    } catch (err) {
      callback(err as Error)
    }
  },
  async put(
    call: grpc.ServerUnaryCall<PutRequest, Empty>,
    callback: grpc.sendUnaryData<Empty>,
  ) {
    try {
      const key = call.request?.key || ''
      const value = call.request?.value || Buffer.from('')
      const filename = `kv_${key}`
      await fsp.writeFile(filename, value)
      callback(null, {})
    } catch (err) {
      callback(err as Error)
    }
  },
}

/**
 * Register the KV service implementation with the provided gRPC server.
 *
 * This function is called by the `ts-cli-plugin` CLI runtime. Once registered,
 * the CLI handles listening/binding, health checks, and handshake/stdio
 * integration expected by HashiCorp go-plugin.
 */
export function register(server: grpc.Server) {
  server.addService(
    proto.KV.service,
    kvImpl as unknown as grpc.UntypedServiceImplementation,
  )
}
