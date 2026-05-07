import { useEffect, useState, useCallback, useRef } from 'react'
import { basename } from '../lib/path'

interface GitFile {
  status: string
  path: string
}

interface GitStatus {
  files: GitFile[]
  ahead: number
  behind: number
}

interface GitInfo {
  branch: string | null
  remoteUrl: string | null
  githubUrl: string | null
  isDirty: boolean
}

type DiffStats = Record<string, { added: number; deleted: number }>

interface Props {
  localPath: string
  repoFullName?: string
  onClose: () => void
  /** Auto-refresh interval in ms while the panel is open. 0 disables. Default 5000. */
  refreshInterval?: number
}

function statusColor(s: string): string {
  if (s === 'M' || s === 'MM') return '#f59e0b'
  if (s === 'A') return '#22c55e'
  if (s === 'D') return '#ef4444'
  if (s === '??' || s === '?') return '#888'
  if (s === 'R') return '#a78bfa'
  return '#e8e8e8'
}

function statusLabel(s: string): string {
  if (s.startsWith('M')) return 'M'
  if (s.startsWith('A')) return 'A'
  if (s.startsWith('D')) return 'D'
  if (s === '??') return '?'
  if (s.startsWith('R')) return 'R'
  return s.charAt(0)
}

export default function RepoStatusPanel({ localPath, repoFullName, onClose, refreshInterval = 5000 }: Props) {
  const [info, setInfo] = useState<GitInfo | null>(null)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [diff, setDiff] = useState<DiffStats>({})
  const [loading, setLoading] = useState(true)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const [i, s, d] = await Promise.all([
        window.git.info(localPath),
        window.git.status(localPath),
        window.git.diffStats(localPath),
      ])
      setInfo(i)
      setStatus(s)
      setDiff(d)
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }, [localPath])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!refreshInterval) return
    const id = setInterval(load, refreshInterval)
    return () => clearInterval(id)
  }, [load, refreshInterval])

  const isDirty = info?.isDirty ?? false
  const title = repoFullName ?? basename(localPath)

  return (
    <div className="repo-status-panel">
      <div className="rsp-header">
        <span className="rsp-title">{title}</span>
        <button className="rsp-close" onClick={onClose} title="Close">✕</button>
      </div>

      {loading && <div className="rsp-loading">Loading…</div>}

      {!loading && info && (
        <>
          <div className="rsp-meta">
            <span className="rsp-branch">
              <span
                className="rsp-dot"
                style={{ background: isDirty ? '#f59e0b' : '#22c55e' }}
              />
              {info.branch ?? '(detached)'}
            </span>
            {status && (
              <span className="rsp-sync">
                <span className="rsp-ahead" title="Ahead">↑{status.ahead}</span>
                {' '}
                <span className="rsp-behind" title="Behind">↓{status.behind}</span>
              </span>
            )}
          </div>

          {status && status.files.length > 0 ? (
            <ul className="rsp-file-list">
              {status.files.map((f, i) => {
                const stats = diff[f.path]
                const isUntracked = f.status === '??'
                return (
                  <li key={i} className="rsp-file-item">
                    <span
                      className="rsp-file-status"
                      style={{ color: statusColor(f.status) }}
                    >
                      {statusLabel(f.status)}
                    </span>
                    <span className="rsp-file-path" title={f.path}>{f.path}</span>
                    {stats ? (
                      <span className="rsp-file-stats">
                        {stats.added > 0 && <span className="rsp-stat-added">+{stats.added}</span>}
                        {stats.deleted > 0 && <span className="rsp-stat-deleted">−{stats.deleted}</span>}
                      </span>
                    ) : isUntracked ? (
                      <span className="rsp-file-stats rsp-stat-new">new</span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            !loading && <div className="rsp-clean">Working tree clean</div>
          )}
        </>
      )}

      <div className="rsp-footer">
        <button className="rsp-refresh" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
