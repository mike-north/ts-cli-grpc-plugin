import { describe, it, expect, expectTypeOf, vi } from "vitest";
import * as grpc from "@grpc/grpc-js";
import {
  formatHandshake,
  servePlugin,
  type NetworkType,
  type ServeOptions,
} from "../src/index";

describe("index:formatHandshake", () => {
  it("produces expected string and type (runtime + type)", () => {
    const s = formatHandshake(1, 2, "tcp", "127.0.0.1:1234", "grpc");
    expect(s).toBe("1|2|tcp|127.0.0.1:1234|grpc");
    expectTypeOf(s).toBeString();
  });

  it("supports NetworkType union (type positive)", () => {
    const n: NetworkType = "unix";
    expectTypeOf(n).toEqualTypeOf<"tcp" | "unix">();

    // @ts-expect-error - invalid network type
    const bad: NetworkType = "udp";
    void bad;
  });
});

describe("index:servePlugin", () => {
  it("starts a server, outputs handshake, and returns address (runtime)", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );
    const { server, address } = await servePlugin({
      appProtocolVersion: 1,
      address: "127.0.0.1:0",
      register(s: grpc.Server) {
        // no-op registration
        void s;
      },
    });
    expect(typeof address).toBe("string");
    expect(address).toMatch(/^127\.0\.0\.1:\d+$/);
    expect(writeSpy).toHaveBeenCalled();
    server.forceShutdown();
    writeSpy.mockRestore();
  });

  it("accepts ServeOptions and returns expected shape (type)", async () => {
    const opts: ServeOptions = {
      appProtocolVersion: 1,
      address: "127.0.0.1:0",
      networkType: "tcp",
    };
    const result = await servePlugin(opts);
    expectTypeOf(result).toMatchTypeOf<{ server: grpc.Server; address: string }>();
    result.server.forceShutdown();
  });

  it("uses unix: prefix for unix sockets (runtime)", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );
    const { server, address } = await servePlugin({
      appProtocolVersion: 1,
      address: `${process.cwd()}/tmp.sock`,
      networkType: "unix",
    });
    expect(address.startsWith("unix:")).toBe(true);
    expect(typeof address).toBe("string");
    writeSpy.mockRestore();
    server.forceShutdown();
  });
  
  it("rejects invalid protocol argument to formatHandshake (type negative)", () => {
    // @ts-expect-error - protocol must be "grpc" | "netrpc"
    const s = formatHandshake(1, 1, "tcp", "127.0.0.1:1", "http");
    void s;
  });
});


