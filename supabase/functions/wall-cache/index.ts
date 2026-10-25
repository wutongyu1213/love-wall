// Supabase Edge Function: wall-cache
// 作用：读表白墙 + 60 秒缓存 + 隐藏 service key
// 调用：GET https://<SUPA_URL>/functions/v1/wall-cache?limit=30
// 返回：{ ok:true, wall:[...], visitCount:number, fromCache:boolean }

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ---- 60 秒内存缓存（Deno 边缘运行时间隔<60s 的调用可复用）----
let cache = { data: null, ts: 0, wall: [] };
const TTL = 60000;

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // CORS 预检
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { ...cors(), "Access-Control-Max-Age": "86400" } });
  }

  // 取 limit 参数（默认 30，最大 500）
  const lim = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 500);

  // 命中缓存？
  const now = Date.now();
  if (cache.data && now - cache.ts < TTL) {
    return new Response(
      JSON.stringify({ ok: true, wall: cache.wall, visitCount: cache.data.visitCount, fromCache: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors() } }
    );
  }

  // 未命中：调 Supabase REST（用 service role key，藏在服务端）
  try {
    const base = `${SUPA_URL}/rest/v1`;
    const hdr = {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // 1) 拉 ok 状态的 wall（倒序）
    const wallResp = await fetch(`${base}/wall?select=*&status=eq.ok&order=created_ts.desc&limit=${lim}`, { headers: hdr });
    if (!wallResp.ok) throw new Error("wall fetch " + wallResp.status);
    const wall = await wallResp.json();

    // 2) 访问数（count=exact, head=true）
    const visitResp = await fetch(`${base}/visits?select=id&limit=1`, {
      headers: { ...hdr, "Prefer": "count=exact", "Range": "0-0" },
    });
    let visitCount = 0;
    if (visitResp.ok) {
      // content-range 形如 "0-0/1234"
      const cr = visitResp.headers.get("content-range") || "";
      const m = cr.split("/");
      visitCount = m.length > 1 ? parseInt(m[1], 10) || 0 : 0;
    }

    // 3) 敏感词表（前端用，也顺手带出来，省一次前端请求）
    let badWords = [];
    try {
      const swResp = await fetch(`${base}/sensitive_words?select=word`, { headers: hdr });
      if (swResp.ok) badWords = await swResp.json();
    } catch (_) {}

    cache = { data: { visitCount }, ts: now, wall };
    return new Response(
      JSON.stringify({ ok: true, wall, visitCount, badWords, fromCache: false }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors() } }
    );
  } catch (e) {
    // 兜底：失败时返回上次缓存（哪怕过期），否则空墙
    if (cache.wall && cache.wall.length) {
      return new Response(
        JSON.stringify({ ok: true, wall: cache.wall, visitCount: cache.data?.visitCount ?? 0, fromCache: true, stale: true, err: String(e) }),
        { status: 200, headers: { "Content-Type": "application/json", ...cors() } }
      );
    }
    return new Response(
      JSON.stringify({ ok: false, wall: [], visitCount: 0, badWords: [], err: String(e) }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors() } }
    );
  }
});
