import { describe, it, expect, expectTypeOf } from 'vitest'
import { isGrpcHealthPackage, isPluginInternalPackages } from '../src/guards'
import type { GrpcHealthPackage, PluginInternalPackages } from '../src/guards'

describe('guards:isGrpcHealthPackage', () => {
  it('returns true for object with Health key (runtime positive)', () => {
    const candidate: unknown = { Health: {} }
    expect(isGrpcHealthPackage(candidate)).toBe(true)
  })

  it('returns false for null, primitives, or missing key (runtime negative)', () => {
    expect(isGrpcHealthPackage(null)).toBe(false)
    expect(isGrpcHealthPackage('not-an-object')).toBe(false)
    expect(isGrpcHealthPackage({})).toBe(false)
  })

  it('narrows unknown to GrpcHealthPackage (type positive)', () => {
    const value: unknown = { Health: {} }
    if (isGrpcHealthPackage(value)) {
      // After narrowing, value should be GrpcHealthPackage
      expectTypeOf(value).toEqualTypeOf<GrpcHealthPackage>()
    }
  })

  it('does not narrow when guard is false (type negative)', () => {
    const value: unknown = {}
    if (!isGrpcHealthPackage(value)) {
      // Here value is still unknown, not GrpcHealthPackage
      expectTypeOf(value).not.toEqualTypeOf<GrpcHealthPackage>()
    }
  })

  it('enforces GrpcHealthPackage shape in assignments (type negative)', () => {
    // @ts-expect-error - 'Health' is required
    const _missingHealth: GrpcHealthPackage = {}

    // @ts-expect-error - 'service' must exist under Health
    const _missingService: GrpcHealthPackage = { Health: {} }
  })
})

describe('guards:isPluginInternalPackages', () => {
  it('returns true for object with plugin key (runtime positive)', () => {
    const candidate: unknown = { plugin: {} }
    expect(isPluginInternalPackages(candidate)).toBe(true)
  })

  it('returns false for null, primitives, or missing key (runtime negative)', () => {
    expect(isPluginInternalPackages(null)).toBe(false)
    expect(isPluginInternalPackages(42)).toBe(false)
    expect(isPluginInternalPackages({})).toBe(false)
  })

  it('narrows unknown to PluginInternalPackages (type positive)', () => {
    const value: unknown = { plugin: {} }
    if (isPluginInternalPackages(value)) {
      expectTypeOf(value).toEqualTypeOf<PluginInternalPackages>()
    }
  })

  it('does not narrow when guard is false (type negative)', () => {
    const value: unknown = {}
    if (!isPluginInternalPackages(value)) {
      expectTypeOf(value).not.toEqualTypeOf<PluginInternalPackages>()
    }
  })

  it('enforces PluginInternalPackages shape in assignments (type negative)', () => {
    // @ts-expect-error - 'plugin' is required
    const _missingPlugin: PluginInternalPackages = {}
  })
})
