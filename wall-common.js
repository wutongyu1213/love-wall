// 鏍¤姳/鏍¤崏涔嬪鍏变韩閫昏緫锛氭墜鏈哄彿鐧诲綍 + 鍥剧墖涓婁紶 + 鎶曠エ + 姣廔P涓€绁ㄩ檺鍒?(function(){
const CFG=window.WALL_CFG;
const WALL_KEY='wall_'+CFG.key;
const DATA_KEY='wall_data_'+CFG.key;
const USER_KEY='wall_user_'+CFG.key;
const VOTE_KEY='wall_vote_'+CFG.key;

// ---- 鎵嬫満鐧诲綍锛堟紨绀虹骇锛氶獙璇佺爜鏄剧ず鍦ㄩ〉闈笂锛?----
let phoneState={phone:'',code:'',timer:null};
function maskPhone(p){return p.slice(0,3)+'****'+p.slice(7);}
function sendCode(){
  const p=document.getElementById('loginPhone').value.trim();
  if(!/^1\d{10}$/.test(p)){toast('璇疯緭鍏?1浣嶆墜鏈哄彿');return;}
  const code=String(Math.floor(100000+Math.random()*900000));
  phoneState.phone=p;phoneState.code=code;
  document.getElementById('loginCode').value='';
  document.getElementById('codeTip').textContent='楠岃瘉鐮侊細'+code+'锛堟紨绀烘ā寮忥紝姝ｅ紡鐜璧扮煭淇★級';
  document.getElementById('codeTip').classList.add('show');
  let s=60;const btn=document.getElementById('sendCodeBtn');btn.disabled=true;
  clearInterval(phoneState.timer);
  phoneState.timer=setInterval(()=>{s--;btn.textContent=s+'s';if(s<=0){btn.disabled=false;btn.textContent='閲嶆柊鍙戦€?;clearInterval(phoneState.timer);}},1000);
  btn.textContent='60s';
}
function doLogin(){
  const p=phoneState.phone,c=phoneState.code,inp=document.getElementById('loginCode').value.trim();
  if(!p){toast('鍏堢偣"鑾峰彇楠岃瘉鐮?');return;}
  if(inp!==c){toast('楠岃瘉鐮侀敊璇?);return;}
  const u={phone:p,name:maskPhone(p)};
  localStorage.setItem(USER_KEY,JSON.stringify(u));
  window._wallUser=u;closeModal();render();toast('鐧诲綍鎴愬姛锛屾杩?'+u.name);
}
function doLogout(){localStorage.removeItem(USER_KEY);window._wallUser=null;closeModal();render();toast('宸查€€鍑?);}

// ---- 鍥剧墖涓婁紶锛堟祻瑙堝櫒鍘嬬缉 + 瀛樻湰鏈猴級 ----
function compressImage(file,max=900){
  return new Promise((res,rej)=>{const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(url);let w=img.width,h=img.height;
      if(w>h){if(w>max){h=h*max/w;w=max;}}else{if(h>max){w=w*max/h;h=max;}}
      const cv=document.createElement('canvas');cv.width=Math.round(w);cv.height=Math.round(h);
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      const out=cv.toDataURL('image/jpeg',0.82);if(out.length>4*1024*1024)out=cv.toDataURL('image/jpeg',0.6);
      res(out);};img.onerror=rej;img.src=url;});
}
function onUpload(e){
  const f=e.target.files[0];if(!f)return;
  if(!/^image\//.test(f.type)){toast('璇烽€夋嫨鍥剧墖鏂囦欢');return;}
  toast('姝ｅ湪鍘嬬缉鈥?);
  compressImage(f).then(function(data){if(data.length>5*1024*1024){toast('鍥剧墖杩囧ぇ锛岃鎹㈡洿灏忕殑');return;}
    saveEntry(document.getElementById('upName').value.trim()||'鏈讲鍚?,document.getElementById('upMsg').value.trim(),data,Date.now());
    e.target.value='';document.getElementById('upMsg').value='';toast('宸蹭笂浼狅紝鐜板湪鍙偣"鎶曠エ"鏀寔TA');
  }).catch(function(){toast('鍘嬬缉澶辫触');});
}

// ---- 鏁版嵁瀛樺彇锛堟湰鍦帮級 ----
function loadEntries(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'[]');}catch(e){return[];}}
function saveEntries(a){try{localStorage.setItem(DATA_KEY,JSON.stringify(a));}catch(e){toast('瀛樺偍绌洪棿涓嶈冻');}}
function saveEntry(name,msg,src,ts){const a=loadEntries();a.unshift({id:'e_'+ts+'_'+Math.random().toString(36).slice(2,7),name:msg?name:(name||'TA'),msg:msg,src:src,ts:ts,likes:0,votes:0});saveEntries(a);render();}
function like(id){const a=loadEntries();const e=a.find(function(x){return x.id===id;});if(!e)return;
  const lk=JSON.parse(localStorage.getItem('wall_like_'+CFG.key)||'{}');if(lk[id])return;
  e.likes=(e.likes||0)+1;lk[id]=1;localStorage.setItem('wall_like_'+CFG.key,JSON.stringify(lk));saveEntries(a);render();burst(id);}
function burst(id){const el=document.getElementById('likeBtn_'+id);if(!el)return;
  for(let i=0;i<8;i++){const s=document.createElement('span');s.textContent='鈾?;s.className='burst-heart';
    s.style.animationDelay=(i*0.04)+'s';el.appendChild(s);setTimeout(function(){s.remove();},1300);}}

// ---- 鎶曠エ + 姣廔P涓€绁?----
function getFingerprint(){
  return fetch('https://api.ipify.org?format=json',{cache:'no-store'}).then(function(r){return r.json();})
    .then(function(j){return 'ip-'+j.ip;}).catch(fallback);
}
function fallback(){
  let seed='';
  try{seed=localStorage.getItem(DATA_KEY+'_fp')||('fp-'+Math.random().toString(36).slice(2));localStorage.setItem(DATA_KEY+'_fp',seed);}catch(e){seed='fp-anon';}
  let h=0;const s=navigator.userAgent+'|'+screen.width+'x'+screen.height+'|'+Intl.DateTimeFormat().resolvedOptions().timeZone+'|'+seed;
  for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  return 'dev-'+h.toString(16);
}
function doVote(id){
  const v=loadEntries().find(function(x){return x.id===id;});if(!v)return;
  getFingerprint().then(function(fp){
    const rec=JSON.parse(localStorage.getItem(VOTE_KEY)||'null');
    if(rec&&rec.voted&&rec.fp===fp){toast('浣狅紙鏈琁P锛夊凡鎶曡繃涓€绁紝涓嶈兘閲嶅');return;}
    const a=loadEntries();a.forEach(function(x){if(x.id===id)x.votes=(x.votes||0)+1;});saveEntries(a);
    localStorage.setItem(VOTE_KEY,JSON.stringify({fp:fp,voted:true,at:Date.now(),target:id}));
    render();toast('鎶曠エ鎴愬姛锛乀A 鐜板湪 +1');
  });
}

// ---- 鎺掑悕 ----
function ranked(){return loadEntries().slice().sort(function(a,b){return (b.votes||0)-(a.votes||0);});}
function rankBadge(i,v){const r=i+1;if(v===1)return'<span class="badge b1">馃 绗?+r+'鍚?/span>';
  if(v===2)return'<span class="badge b2">馃 绗?+r+'鍚?/span>';if(v===3)return'<span class="badge b3">馃 绗?+r+'鍚?/span>';
  if(v>0)return'<span class="badge">绗?+r+'鍚?/span>';return'';}

// ---- 娓叉煋 ----
function render(){
  const list=ranked();
  const grid=document.getElementById('grid');
  const statV=document.getElementById('statV');const statP=document.getElementById('statP');
  statP.textContent=list.filter(function(e){return e.src;}).length;
  statV.textContent=list.reduce(function(s,e){return s+(e.votes||0);},0);
  if(!list.length){grid.innerHTML='<div class="empty">杩樻病鏈夊€欓€夌収鐗囷紝鐧诲綍鍚庝笂浼犵涓€寮犲惂 鈫?/div>';return;}
  grid.innerHTML=list.map(function(e,i){
    const voted=JSON.parse(localStorage.getItem(VOTE_KEY)||'null');
    const myVoted=voted&&voted.voted;
    return '<div class="card" id="card_'+e.id+'">'+rankBadge(i,e.votes||0)
      +'<div class="ph">'+(e.src?'<img src="'+e.src+'" alt="">':'<div class="noimg">馃柤锔?/div>')
      +'<span class="medal">'+(e.votes>=20?'馃憫 浜烘皵'+(CFG.key==='wall_xiaohua'?'鏍¤姳':'鏍¤崏'):e.votes>0?'馃敟':'')+'</span></div>'
      +'<div class="nm">'+esc(e.name)+'</div>'
      +'<div class="ms">'+esc(e.msg||'')+'</div>'
      +'<div class="vf"><button class="vote '+(myVoted?'dis':'')+'" id="vote_'+e.id+'" onclick="voteOne(\''+e.id+'\')">'
      +(myVoted?'鉁?宸叉姇绁?:'鎶昑A涓€绁?)+'</button><span class="ct">'+(e.votes||0)+' 绁?/span></div></div>';
  }).join('');
}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
window.voteOne=function(id){doVote(id);};
window.sendCode=sendCode;window.doLogin=doLogin;window.doLogout=doLogout;window.onUpload=onUpload;

// ---- 妯℃€佹 / toast ----
function openModal(){document.getElementById('modal').classList.add('show');}
function closeModal(){document.getElementById('modal').classList.remove('show');}
window.openModal=openModal;window.closeModal=closeModal;
let toastTimer=null;
window.toast=function(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('show');},2200);};

// ---- 鍒濆鍖?----
document.addEventListener('DOMContentLoaded',function(){
  const u=JSON.parse(localStorage.getItem(USER_KEY)||'null');window._wallUser=u;render();
  document.getElementById('loginBtn').addEventListener('click',function(){u?doLogout():openModal();});
  document.getElementById('sendCodeBtn').addEventListener('click',sendCode);
  document.getElementById('loginBtnModal').addEventListener('click',doLogin);
  document.getElementById('modal').addEventListener('click',function(e){if(e.target.id==='modal')closeModal();});
});
})();
