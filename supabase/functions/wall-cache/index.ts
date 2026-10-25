// Supabase Edge Function: wall-cache
// 作用：读表白墙 + 60 秒缓存 + 隐藏 service key（前端不再直连数据库拉读）
// 调用：GET https://<SUPA_URL>/functions/v1/wall-cache?limit=30
// 返回：{ ok:true, wall:[...], visitCount:number, badWords:[], gifts:[], fromCache:bool }

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ---- 60 秒内存缓存（同一实例内 <60s 的调用复用，同学多时秒开）----
let cache = { ts: 0, wall: [], visitCount: 0, badWords: [], gifts: [] };
const TTL = 60000;

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { ...cors() } });
  }

  const lim = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 500);
  const now = Date.now();

  // 命中缓存
  if (cache.wall && now - cache.ts < TTL) {
    return new Response(
      JSON.stringify({ ok: true, wall: cache.wall, visitCount: cache.visitCount, badWords: cache.badWords, gifts: cache.gifts, fromCache: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors() } }
    );
  }

  // 未命中：调 Supabase REST（service key 藏服务端）
  try {
    const base = `${SUPA_URL}/rest/v1`;
    const hdr = {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // 1) ok 状态的 wall（倒序）
    const wallResp = await fetch(`${base}/wall?select=*&status=eq.ok&order=created_ts.desc&limit=${lim}`, { headers: hdr });
    if (!wallResp.ok) throw new Error("wall fetch " + wallResp.status);
    const wall = await wallResp.json();

    // 2) 访问数
    let visitCount = 0;
    try {
      const visitResp = await fetch(`${base}/visits?select=id&limit=1`, {
        headers: { ...hdr, "Prefer": "count=exact", "Range": "0-0" },
      });
      if (visitResp.ok) {
        const cr = visitResp.headers.get("content-range") || "";
        const m = cr.split("/");
        visitCount = m.length > 1 ? (parseInt(m[1], 10) || 0) : 0;
      }
    } catch (_) {}

    // 3) 敏感词表
    let badWords = [];
    try {
      const swResp = await fetch(`${base}/sensitive_words?select=word`, { headers: hdr });
      if (swResp.ok) badWords = await swResp.json();
    } catch (_) {}

    // 4) card_gifts（礼物区，省一次前端请求）
    let gifts = [];
    try {
      const gResp = await fetch(`${base}/card_gifts?select=wall_id,gift`, { headers: hdr });
      if (gResp.ok) gifts = await gResp.json();
    } catch (_) {}

    cache = { ts: now, wall, visitCount, badWords, gifts };
    return new Response(
      JSON.stringify({ ok: true, wall, visitCount, badWords, gifts, fromCache: false }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors() } }
    );
  } catch (e) {
    // 兜底：失败时返回上次缓存（哪怕过期），否则空墙
    if (cache.wall && cache.wall.length) {
      return new Response(
        JSON.stringify({ ok: true, wall: cache.wall, visitCount: cache.visitCount, badWords: cache.badWords, gifts: cache.gifts, fromCache: true, stale: true, err: String(e) }),
        { status: 200, headers: { "Content-Type": "application/json", ...cors() } }
      );
    }
    return new Response(
      JSON.stringify({ ok: false, wall: [], visitCount: 0, badWords: [], gifts: [], err: String(e) }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors() } }
    );
  }
});
