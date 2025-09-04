import { describe, it, expect, expectTypeOf } from "vitest";
import * as path from "node:path";
import * as grpc from "@grpc/grpc-js";
import {
  loadProtos,
  createRegistrar,
  type RegisterFn,
} from "../src/helpers";
import {
  isGrpcHealthPackage,
  type GrpcHealthPackage,
  type LoadedRootHealth,
} from "../src/guards";

describe("helpers:loadProtos", () => {
  const healthProto = path.join(
    process.cwd(),
    "src/protos/grpc/health/v1/health.proto",
  );

  it("returns typed root when assert passes (runtime + type positive)", () => {
    const isLoadedRootHealth = (v: unknown): v is LoadedRootHealth => {
      const root = v as LoadedRootHealth | null;
      const pkg = root?.grpc?.health?.v1;
      return isGrpcHealthPackage(pkg);
    };
    const loadedRoot = loadProtos<LoadedRootHealth>(
      { files: [healthProto] },
      isLoadedRootHealth,
    );
    expect(typeof loadedRoot).toBe("object");
    const pkg = loadedRoot.grpc?.health?.v1;
    expect(pkg && "Health" in pkg).toBe(true);
    expectTypeOf(loadedRoot).toEqualTypeOf<LoadedRootHealth>();
  });

  it("throws when user assert fails (runtime negative)", () => {
    const alwaysFalse = (_: unknown): _ is { never: true } => false;
    expect(() => loadProtos({ files: [healthProto] }, alwaysFalse)).toThrow(
      /did not match expected shape/i,
    );
  });

  it("returns unknown without assert (type negative)", () => {
    const withoutAssert = loadProtos({ files: [healthProto] });
    expectTypeOf(withoutAssert).toEqualTypeOf<unknown>();
    // @ts-expect-error - unknown is not assignable to GrpcHealthPackage
    const typed: GrpcHealthPackage = loadProtos({ files: [healthProto] });
  });
});

describe("helpers:createRegistrar", () => {
  it("wraps and calls the provided register function (runtime positive)", () => {
    let called = false;
    const registrar = createRegistrar((_server: grpc.Server) => {
      called = true;
    });
    expectTypeOf(registrar).toEqualTypeOf<RegisterFn>();
    const server = new grpc.Server();
    registrar(server);
    expect(called).toBe(true);
    server.forceShutdown();
  });

  it("enforces RegisterFn signature (type negative)", () => {
    // @ts-expect-error - parameter type must be grpc.Server
    const badRegistrar = createRegistrar((x: number) => {
      void x;
    });
    void badRegistrar;
  });
});


