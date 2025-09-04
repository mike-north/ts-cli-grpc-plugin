import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

export interface LoadProtosOptions {
	files: string[];
	includeDirs?: string[];
}

export function loadProtos(opts: LoadProtosOptions): unknown;
export function loadProtos<T>(opts: LoadProtosOptions, assert: (value: unknown) => value is T): T;
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

export type RegisterFn = (server: grpc.Server) => void;

export function createRegistrar(register: RegisterFn): RegisterFn {
	return (server) => register(server);
}


