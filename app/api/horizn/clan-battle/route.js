export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getAdminSession, hasRequiredRole } from '@/lib/horiznAdminAuth'

const DUCKDB_URL = process.env.DUCKDB_URL || process.env.NEXT_PUBLIC_DUCKDB_URL || ''

async function queryDuckDB(query, args = []) {
  if (!DUCKDB_URL) throw new Error('DUCKDB_URL 未配置')

  const response = await fetch(`${DUCKDB_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, args }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) throw new Error(`DuckDB 查询失败 (${response.status})`)
  return response.json()
}

function parseYearMonth(value) {
  if (!/^\d{6}$/.test(value || '')) return null
  const month = Number(value.slice(4, 6))
  return month >= 1 && month <= 12 ? `${value.slice(0, 4)}-${value.slice(4, 6)}` : null
}

function parseSessionId(value) {
  return /^[a-zA-Z0-9-]{1,80}$/.test(value || '') ? value : null
}

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams
  const month = parseYearMonth(searchParams.get('yearMonth'))
  const sessionIdRaw = searchParams.get('sessionId')
  const sessionId = sessionIdRaw ? parseSessionId(sessionIdRaw) : null
  const mode = searchParams.get('mode')

  if (!month) return Response.json({ error: '月份格式无效' }, { status: 400 })
  if (sessionIdRaw && !sessionId) return Response.json({ error: '场次参数无效' }, { status: 400 })

  try {
    if (mode === 'summary') {
      if (!hasRequiredRole(getAdminSession(request))) {
        return Response.json({ error: '需要管理员权限' }, { status: 401 })
      }

      const [sessionResult, rankingResult] = await Promise.all([
        queryDuckDB(`
          SELECT
            prime_time_id,
            strftime(start_time, '%Y-%m-%dT%H:%M:%S') AS start_time,
            strftime(end_time, '%Y-%m-%dT%H:%M:%S') AS end_time,
            map_id
          FROM clan_prime_times
          WHERE strftime(start_time + INTERVAL 8 HOUR, '%Y-%m') = ?
          ORDER BY start_time
        `, [month]),
        queryDuckDB(`
          WITH month_sessions AS (
            SELECT prime_time_id, start_time, end_time
            FROM clan_prime_times
            WHERE strftime(start_time + INTERVAL 8 HOUR, '%Y-%m') = ?
          ), player_sessions AS (
            SELECT
              sessions.prime_time_id,
              samples.player_id,
              arg_max(samples.player_name, samples.sample_time) AS player_name,
              arg_min(samples.points, samples.sample_time) AS first_points,
              arg_max(samples.points, samples.sample_time) AS final_points,
              arg_max(samples.place_in_rating, samples.sample_time) AS place_in_rating
            FROM month_sessions sessions
            JOIN clan_bt_leaderboard_samples samples
              ON samples.sample_time >= sessions.start_time - INTERVAL 5 MINUTE
             AND samples.sample_time <= sessions.end_time + INTERVAL 5 MINUTE
            GROUP BY sessions.prime_time_id, samples.player_id
          ), ranked AS (
            SELECT
              prime_time_id,
              player_id,
              player_name,
              final_points - first_points AS gain,
              place_in_rating,
              ROW_NUMBER() OVER (
                PARTITION BY prime_time_id
                ORDER BY final_points - first_points DESC, place_in_rating
              ) AS session_rank
            FROM player_sessions
          )
          SELECT prime_time_id, player_id, player_name, gain, place_in_rating, session_rank
          FROM ranked
          WHERE session_rank <= 100
          ORDER BY prime_time_id, session_rank
        `, [month]),
      ])

      const rankings = {}
      for (const row of rankingResult.rows || []) {
        const sessionKey = row[0]
        if (!rankings[sessionKey]) rankings[sessionKey] = []
        rankings[sessionKey].push({
          playerId: row[1],
          name: row[2] || row[1],
          gain: Number(row[3] || 0),
          globalPlace: Number(row[4] || 0),
          rank: Number(row[5] || 0),
        })
      }

      const sessions = (sessionResult.rows || []).map((row, index) => ({
        id: row[0],
        number: index + 1,
        startTime: row[1],
        endTime: row[2],
        mapId: row[3],
        playerCount: rankings[row[0]]?.length || 0,
      }))

      return Response.json({ sessions, rankings }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (!sessionId) {
      const result = await queryDuckDB(`
        SELECT
          prime_time_id,
          strftime(start_time, '%Y-%m-%dT%H:%M:%S') AS start_time,
          strftime(end_time, '%Y-%m-%dT%H:%M:%S') AS end_time,
          map_id,
          leader_name,
          leader_points,
          clan_points,
          points
        FROM clan_prime_times
        WHERE strftime(start_time + INTERVAL 8 HOUR, '%Y-%m') = ?
        ORDER BY start_time
      `, [month])

      const sessions = (result.rows || []).map(row => ({
        id: row[0],
        startTime: row[1],
        endTime: row[2],
        mapId: row[3],
        leaderName: row[4] || null,
        leaderPoints: Number(row[5] || 0),
        clanPoints: Number(row[6] || 0),
        points: Number(row[7] || 0),
      }))

      return Response.json({ sessions }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const top = Math.min(100, Math.max(1, Number(searchParams.get('top')) || 100))
    const result = await queryDuckDB(`
      WITH target AS (
        SELECT start_time, end_time
        FROM clan_prime_times
        WHERE prime_time_id = ?
          AND strftime(start_time + INTERVAL 8 HOUR, '%Y-%m') = ?
      ), ranked AS (
        SELECT
          samples.player_id,
          arg_max(samples.player_name, samples.sample_time) AS player_name,
          arg_min(samples.points, samples.sample_time) AS first_points,
          arg_max(samples.points, samples.sample_time) AS final_points,
          arg_max(samples.place_in_rating, samples.sample_time) AS place_in_rating
        FROM clan_bt_leaderboard_samples samples
        CROSS JOIN target
        WHERE samples.sample_time >= target.start_time - INTERVAL 5 MINUTE
          AND samples.sample_time <= target.end_time + INTERVAL 5 MINUTE
        GROUP BY samples.player_id
      )
      SELECT
        player_id,
        player_name,
        first_points,
        final_points,
        final_points - first_points AS gain,
        place_in_rating
      FROM ranked
      ORDER BY gain DESC, place_in_rating
      LIMIT ${top}
    `, [sessionId, month])

    const ranking = (result.rows || []).map((row, index) => ({
      rank: index + 1,
      playerId: row[0],
      name: row[1] || row[0],
      firstPoints: Number(row[2] || 0),
      finalPoints: Number(row[3] || 0),
      gain: Number(row[4] || 0),
      globalPlace: Number(row[5] || 0),
    }))

    return Response.json({ ranking }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[clan-battle]', error.message)
    return Response.json({ error: '联队战数据读取失败' }, { status: 502 })
  }
}
