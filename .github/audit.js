// 表白墙云端全字段巡检（GitHub Actions 定时触发）
// 扫三处：① 所有 status=ok 帖子（昵称/对象/正文/礼物）② card_gifts 非法礼物 ③ 未处理举报
const SUPA = process.env.SUPA_URL;
const KEY = process.env.SUPA_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=minimal" };
const AD_RE = [/https?:\/\/|www\.|[a-z0-9-]+\.com\b|[a-z0-9-]+\.cn\b|[a-z0-9-]+\.xyz\b|[a-z0-9-]+\.top\b|[a-z0-9-]+\.cc\b|[a-z0-9-]+\.dev\b|[a-z0-9-]+\.me\b|[a-z0-9-]+\.club\b/i, /加微信|加v|vx|薇信|威信|淘宝|闲鱼|拼多多|代写|兼职|刷单|贷款|套现|转账|扫码付|身份证|链接/i, /(^|[^0-9])1[3-9]\d{9}([^0-9]|$)/];
const INV=String.fromCodePoint(173,8203,8204,8205,8206,8207,8234,8235,8236,8237,8238,8288,8289,8290,8291,8292,65279,160,12288);
function norm(t){let s=String(t||'').toLowerCase();s=s.replace(/\s/g,'');for(const c of INV){s=s.split(c).join('')}return s.normalize('NFKC');}
function hitAd(t){ return AD_RE.some(re=>re.test(norm(t))); }
function hide(wallId){ return fetch(SUPA+"/rest/v1/wall?id=eq."+wallId,{method:"PATCH",headers:H,body:JSON.stringify({status:"hidden"})}).then(r=>r.ok?true:fetch(SUPA+"/rest/v1/wall?id=eq."+wallId,{method:"PATCH",headers:{...H,Prefer:"return=minimal"},body:JSON.stringify({status:"hidden"})}).then(r2=>r2.ok||r2.status===200)); }
function markHandled(repId){ return fetch(SUPA+"/rest/v1/reports?id=eq."+repId,{method:"PATCH",headers:H,body:JSON.stringify({handled:true})}).catch(()=>{}); }

(async () => {
  let hiddenN=0, giftDelN=0, repN=0;
  // ① 全墙 ok 帖子：读敏感词表（数据库唯一词源）+ 广告/电话
  const words = await (await fetch(SUPA+"/rest/v1/sensitive_words?select=word",{headers:H})).json();
  const wl = (Array.isArray(words)?words:[]).map(w=>w.word.toLowerCase());
  const badWords = wl.length ? wl : ["草拟","拟吗","傻逼","垃圾","人渣","fuck","shit"];
  const posts = await (await fetch(SUPA+"/rest/v1/wall?select=id,nickname,target_name,love_msg,gift,status&status=eq.ok",{headers:H})).json();
  for(const p of (Array.isArray(posts)?posts:[])){
    const text=norm((p.nickname||"")+" "+(p.target_name||"")+" "+(p.love_msg||""));
    const hitW = badWords.find(w=>w&&text.includes(norm(w)));
    if(hitW||hitAd((p.love_msg||"")+" "+(p.target_name||""))){
      const ok=await hide(p.id); if(ok){hiddenN++;console.log("HIDDEN wall#"+p.id+" ("+(hitW?("词:"+hitW):"广告/隐私")+")");}
    }
  }
  // ② 非法礼物（不在白名单）
  const gifts = await (await fetch(SUPA+"/rest/v1/card_gifts?select=id,gift&limit=500",{headers:H})).json();
  const ALLOWED=["🌹","❤️","❤","🧸","🎂","⭐","🎈","🍫","🍀"];
  for(const g of (Array.isArray(gifts)?gifts:[])){
    if(!ALLOWED.includes(g.gift)){
      const r=await fetch(SUPA+"/rest/v1/card_gifts?id=eq."+g.id,{method:"DELETE",headers:H});
      if(r.ok){giftDelN++;console.log("DEL gift#"+g.id+" 非法:"+JSON.stringify(g.gift));}
    }
  }
  // ③ 未处理举报：逐条按被举报帖重新判定
  const reps = await (await fetch(SUPA+"/rest/v1/reports?select=*&handled=eq.false",{headers:H})).json();
  for(const rep of (Array.isArray(reps)?reps:[])){
    const posts2 = await (await fetch(SUPA+"/rest/v1/wall?id=eq."+rep.wall_id+"&select=id,nickname,target_name,love_msg,status",{headers:H})).json();
    const p = Array.isArray(posts2)?posts2[0]:null;
    let del=false;
    if(p&&p.status==="ok"){
      const text=norm((p.nickname||"")+" "+(p.target_name||"")+" "+(p.love_msg||""));
      del = badWords.some(w=>w&&text.includes(norm(w)))||hitAd((p.love_msg||"")+" "+(p.target_name||""));
      if(del){ const ok=await hide(p.id); repN++; console.log("REPORT#"+rep.id+" wall#"+p.id+" -> "+(ok?"hidden":"kept")+" ("+(rep.reason||"")+")"); }
    } else { repN++; console.log("REPORT#"+rep.id+" 帖子已不存在/已隐藏，仅标记"); }
    await markHandled(rep.id);
  }
  console.log("scan done: hidden="+hiddenN+" giftsDeleted="+giftDelN+" reports="+repN);
  if(!Array.isArray(posts)){console.log("WARN: wall read failed");process.exit(1);}
})().catch(e=>{console.error("audit error: "+e.message);process.exit(1);});
