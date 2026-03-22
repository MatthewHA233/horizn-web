export const dynamic = 'force-dynamic'

const DUCKDB_URL = process.env.NEXT_PUBLIC_DUCKDB_URL || ''

export async function POST(request) {
  if (!DUCKDB_URL) {
    return Response.json({ error: 'DUCKDB_URL 未配置' }, { status: 500 })
  }

  const { lastTimestamp, yearMonth } = await request.json()

  if (!lastTimestamp || !yearMonth) {
    return Response.json({ error: '缺少 lastTimestamp 或 yearMonth' }, { status: 400 })
  }

  const sql = `
    SELECT player_id, session_time, weekly_activity, season_activity
    FROM horizn_activity_records
    WHERE session_time > ?::timestamp
      AND strftime(session_time, '%Y%m') = ?
    ORDER BY session_time, player_id
  `

  try {
    const res = await fetch(`${DUCKDB_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql, args: [lastTimestamp, yearMonth] }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const text = await res.text()
      return Response.json({ error: `DuckDB ${res.status}: ${text}` }, { status: 502 })
    }

    const data = await res.json()
    return Response.json(data)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 })
  }
}
