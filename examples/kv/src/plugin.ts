/**
 * KV example – standalone plugin main
 *
 * This file demonstrates using the library API {@link servePlugin} directly to
 * start a plugin process that is compatible with HashiCorp go-plugin (gRPC mode).
 *
 * Compare with `register.ts` which only exports a `register(server)` function and
 * relies on the `ts-cli-plugin` CLI wrapper to manage the server lifecycle.
 */
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import * as path from 'node:path'
import * as fsp from 'node:fs/promises'

import { servePlugin } from 'ts-cli-grpc-plugin'

// For simplicity, this example resolves kv.proto relative to the repo layout.
// In your own project, point to your compiled protos or absolute proto paths.
const kvProtoPath = path.resolve(
  __dirname,
  '../../../go-plugin/examples/grpc/proto/kv.proto',
)
const packageDefinition = protoLoader.loadSync(kvProtoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})
/** Loaded gRPC package containing the KV service definition. */
const loaded = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  proto: {
    KV: {
      service: grpc.ServiceDefinition
    }
  }
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

// Start the plugin server and print the go-plugin handshake line to stdout
void servePlugin({
  appProtocolVersion: 1,
  address: '127.0.0.1',
  networkType: 'tcp',
  register(server: grpc.Server) {
    server.addService(
      proto.KV.service,
      kvImpl as unknown as grpc.UntypedServiceImplementation,
    )
  },
}).catch((err: unknown) => {
  // Ensure any startup error is visible to the host
  if (err instanceof Error) {
    console.error('Plugin startup failed:', err.message)
  } else {
    console.error('Plugin startup failed with unknown error:', String(err))
  }
  process.exit(1)
})
