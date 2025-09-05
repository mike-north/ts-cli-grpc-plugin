import { describe, it, expect } from 'vitest'
import { formatHandshake } from '../src/index'

describe('formatHandshake', () => {
  it('should match go-plugin format', () => {
    const line = formatHandshake(1, 42, 'tcp', '127.0.0.1:1234', 'grpc')
    expect(line).toBe('1|42|tcp|127.0.0.1:1234|grpc')
  })
})
