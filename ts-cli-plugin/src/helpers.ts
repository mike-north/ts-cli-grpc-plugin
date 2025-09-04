import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

/**
 * Options for loading protobuf files.
 * @public
 */
export interface LoadProtosOptions {
  files: string[];
  includeDirs?: string[];
}

/**
 * Load protobuf files using proto-loader and return a gRPC package definition object.
 *
 * When an assertion function is provided, the loaded value is validated and returned as type `T`.
 * @public
 */
export function loadProtos(opts: LoadProtosOptions): unknown;
/** @public */
export function loadProtos<T>(
  opts: LoadProtosOptions,
  assert: (value: unknown) => value is T,
): T;
export function loadProtos<T>(
  { files, includeDirs }: LoadProtosOptions,
  assert?: (value: unknown) => value is T,
) {
  const def = protoLoader.loadSync(files, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs,
  });
  const loaded = grpc.loadPackageDefinition(def) as unknown;
  if (assert) {
    if (assert(loaded)) return loaded;
    throw new Error("Loaded protos did not match expected shape");
  }
  return loaded;
}

/**
 * Function signature for registering services on a grpc.Server.
 * @public
 */
export type RegisterFn = (server: grpc.Server) => void;

/**
 * Wrap a register function for convenience.
 * @public
 */
export function createRegistrar(register: RegisterFn): RegisterFn {
  return (server) => register(server);
}
