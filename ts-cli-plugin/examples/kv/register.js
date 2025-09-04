/* eslint-disable */
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("node:path");
const fsp = require("node:fs/promises");

const kvProtoPath = path.resolve(__dirname, "../../../go-plugin/examples/grpc/proto/kv.proto");
const packageDefinition = protoLoader.loadSync(kvProtoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const loaded = grpc.loadPackageDefinition(packageDefinition);
const proto = loaded.proto;

const kvImpl = {
  async get(call, callback) {
    try {
      const key = call.request?.key || "";
      const filename = `kv_${key}`;
      const data = await fsp.readFile(filename).catch(() => Buffer.from(""));
      callback(null, { value: data });
    } catch (err) {
      callback(err);
    }
  },
  async put(call, callback) {
    try {
      const key = call.request?.key || "";
      const value = call.request?.value || Buffer.from("");
      const filename = `kv_${key}`;
      await fsp.writeFile(filename, value);
      callback(null, {});
    } catch (err) {
      callback(err);
    }
  },
};

function register(server) {
  server.addService(proto.KV.service, kvImpl);
}

module.exports = { register };



