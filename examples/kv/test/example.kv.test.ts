import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { packageUpSync } from 'package-up'

/**
 * Find the pnpm workspace root by walking upwards from the given directory.
 *
 * Strategy:
 * - Use package-up to locate the nearest package.json (supports nested workspaces)
 * - Treat the directory containing pnpm-workspace.yaml as the workspace root
 *
 * This makes tests resilient to being executed from different CWDs because
 * paths such as the Go host (under `go-plugin/`) can be resolved from a
 * canonical root instead of the current working directory.
 *
 * @param startDir - Directory to begin the upward search
 * @returns Absolute path to the workspace root directory
 * @throws Error when no pnpm workspace root can be found within a reasonable depth
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
const WORKSPACE_FOLDER_PATH = findWorkspaceRoot(path.resolve(__dirname, '..'))

/**
 * Spawn a child process and collect stdout/stderr until it exits.
 *
 * The environment and working directory can be provided explicitly to avoid
 * reliance on the parent process state. This function ensures proper encoding
 * for the child streams and forwards spawn errors as rejections to surface
 * failures promptly in tests (preventing hangs).
 *
 * @param cmd - Executable to launch
 * @param args - Command-line arguments
 * @param opts - Optional environment and working directory overrides
 * @returns A promise resolving with exit code and captured stdout/stderr
 */
function run(
  cmd: string,
  args: string[],
  opts?: { env?: NodeJS.ProcessEnv; cwd?: string },
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(cmd, args, {
        env: opts?.env,
        cwd: opts?.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (err: unknown) {
      if (err instanceof Error) {
        return reject(new Error(`Failed to spawn ${cmd}`, { cause: err }))
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return reject(new Error(`Failed to spawn ${cmd}: ${err as any}`))
    }
    let stdout = ''
    let stderr = ''
    if (!child.stdout) {
      throw new Error('stdout is null')
    }
    if (!child.stderr) {
      throw new Error('stderr is null')
    }
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', d => (stdout += String(d)))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', d => (stderr += String(d)))
    child.on('error', err => reject(err))
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
}

describe('KV example plugin', () => {
  it('should put and get via Go host', async () => {
    const repoRoot = WORKSPACE_FOLDER_PATH
    const goHostDir = path.join(repoRoot, 'go-plugin/examples/grpc')
    const kvBinary = path.join(goHostDir, 'kv')

    // Build the Go host binary if not present
    const build = await run('go', ['build', '-o', kvBinary], {
      env: process.env,
      cwd: goHostDir,
    })
    expect(build.code).toBe(0)

    const cliBin = path.join(repoRoot, 'ts-cli-plugin/bin/ts-cli-plugin')
    const registerModule = path.join(repoRoot, 'examples/kv/src/register.ts')

    const envPut: NodeJS.ProcessEnv = { ...process.env }
    envPut.KV_PLUGIN = `node ${cliBin} --module ${registerModule} --address 127.0.0.1 --app-proto-version 1`
    const put = await run(kvBinary, ['put', 'hello', 'world'], { env: envPut })
    expect(put.code).toBe(0)

    const envGet = envPut
    const get = await run(kvBinary, ['get', 'hello'], { env: envGet })
    expect(get.code).toBe(0)
    expect(get.stdout.trim()).toBe('world')
  }, 60_000)
})
