import { spawn, type ChildProcess } from 'child_process'

/** 强制结束子进程（Windows 用 taskkill 杀进程树） */
export function killChildProcess(proc: ChildProcess): void {
  try {
    proc.kill('SIGTERM')
    if (process.platform === 'win32' && proc.pid) {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], {
        windowsHide: true,
        stdio: 'ignore'
      })
    }
  } catch {
    // ignore
  }
}
