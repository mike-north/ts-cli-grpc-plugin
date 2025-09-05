import * as grpc from '@grpc/grpc-js'

export interface GrpcHealthPackage {
  Health: { service: grpc.ServiceDefinition }
}

export interface LoadedRootHealth {
  grpc?: { health?: { v1?: GrpcHealthPackage } }
}

export function isGrpcHealthPackage(value: unknown): value is GrpcHealthPackage {
  const v = value as Partial<GrpcHealthPackage> | null
  return !!v && typeof v === 'object' && 'Health' in v
}

export interface PluginInternalPackages {
  plugin: {
    GRPCStdio?: { service: grpc.ServiceDefinition }
    GRPCController?: { service: grpc.ServiceDefinition }
  }
}

export interface LoadedRootPlugin {
  plugin?: PluginInternalPackages['plugin']
}

export function isPluginInternalPackages(
  value: unknown,
): value is PluginInternalPackages {
  const v = value as Partial<PluginInternalPackages> | null
  return !!v && typeof v === 'object' && 'plugin' in v
}
