// app.js
const $ = (sel) => document.querySelector(sel);
const resultsEl = $("#results");
const qEl = $("#q");
const mediaEl = $("#media");
const countryEl = $("#country");
const sizeEl = $("#size");
const limitEl = $("#limit");
const tokenEl = $("#token");
const searchBtn = $("#searchBtn");
const clearBtn = $("#clearBtn");
const installBtn = $("#installBtn");

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt = null;
  installBtn.hidden = true;
});

function entityForMedia(media){
  switch(media){
    case 'music': return 'album';
    case 'song': return 'song';
    case 'movie': return 'movie';
    case 'tvShow': return 'tvSeason';
    case 'software': return 'software';
    case 'ebook': return 'ebook';
    case 'podcast': return 'podcast';
    default: return 'album';
  }
}

function upscaleItunesUrl(url, size){
  // Replace like ".../100x100bb..." -> "/{size}x{size}bb..."
  return url.replace(/\/(\d+)x(\d+)([^\/]*?)\./, `/${size}x${size}$3.`);
}

function imgEl(url, alt){
  const img = document.createElement('img');
  img.src = url;
  img.alt = alt || '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  return img;
}

function badge(text){ const s=document.createElement('span'); s.className='badge'; s.textContent=text; return s; }

async function downloadImage(url, filename){
  try{
    const res = await fetch(url, {mode:'cors'});
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = filename || 'artwork';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(objectUrl);
    a.remove();
  }catch(err){
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

function cardTemplate({imgUrl, title, subtitle, badges=[], linkUrl}){
  const card = document.createElement('div');
  card.className = 'card';
  const cover = document.createElement('div'); cover.className='cover';
  cover.appendChild(imgEl(imgUrl, title));
  const meta = document.createElement('div'); meta.className='meta';
  const t = document.createElement('div'); t.className='title'; t.textContent = title;
  const s = document.createElement('div'); s.className='sub'; s.textContent = subtitle;
  const b = document.createElement('div'); b.className='badges';
  badges.forEach(x=>b.appendChild(badge(x)));
  const actions = document.createElement('div'); actions.className='actions';
  const openBtn = document.createElement('a'); openBtn.className='ghost'; openBtn.textContent='画像を開く'; openBtn.href=imgUrl; openBtn.target='_blank'; openBtn.rel='noopener';
  const dlBtn = document.createElement('button'); dlBtn.textContent='ダウンロード'; dlBtn.addEventListener('click', ()=>downloadImage(imgUrl, (title || 'artwork') + '.jpg'));
  const copyBtn = document.createElement('button'); copyBtn.className='ghost'; copyBtn.textContent='URLをコピー'; copyBtn.addEventListener('click', async ()=>{
    try{ await navigator.clipboard.writeText(imgUrl); copyBtn.textContent='コピーしました'; setTimeout(()=>copyBtn.textContent='URLをコピー',1500);}catch(e){ window.prompt('URL をコピーしてください', imgUrl); }
  });
  actions.append(openBtn, dlBtn, copyBtn);
  if (linkUrl){
    const itunesBtn = document.createElement('a'); itunesBtn.className='ghost'; itunesBtn.textContent='ストアで開く'; itunesBtn.href=linkUrl; itunesBtn.target='_blank'; itunesBtn.rel='noopener';
    actions.appendChild(itunesBtn);
  }
  meta.append(t,s,b,actions);
  card.append(cover, meta);
  return card;
}

async function searchItunes(term, media, country, limit, size){
  const entity = entityForMedia(media);
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', term);
  url.searchParams.set('entity', entity);
  url.searchParams.set('country', country);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  const items = data.results || [];
  return items.map(item => {
    const base = item.artworkUrl100 || item.artworkUrl60;
    if (!base) return null;
    const img = upscaleItunesUrl(base, size);
    const title = item.collectionName || item.trackName || item.trackCensoredName || '（名称不明）';
    const subtitle = item.artistName || item.sellerName || item.collectionArtistName || '';
    const linkUrl = item.collectionViewUrl || item.trackViewUrl;
    const kind = item.kind || item.wrapperType || entity;
    return {imgUrl: img, title, subtitle, linkUrl, badges:[kind, `${size}x${size}`.replace('x','×'), country.toUpperCase()]};
  }).filter(Boolean);
}

function resolveStorefront(country){
  // Map country to Apple Music storefront (lowercase)
  return (country || 'jp').toLowerCase();
}

function buildArtworkUrlFromTemplate(tmpl, size){
  // tmpl includes {w}x{h}bb
  return tmpl.replace('{w}', size).replace('{h}', size);
}

async function searchAppleMusic(term, media, country, limit, size, devToken){
  const storefront = resolveStorefront(country);
  const types = (media === 'song') ? 'songs,albums' : (media === 'software' ? 'apps' : 'albums,songs,playlists,music-videos,artists');
  const url = new URL(`https://api.music.apple.com/v1/catalog/${storefront}/search`);
  url.searchParams.set('term', term);
  url.searchParams.set('types', types);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + devToken }});
  if (!res.ok) throw new Error('Apple Music API failed');
  const data = await res.json();
  const albums = (data.results.albums?.data || []);
  const songs = (data.results.songs?.data || []);
  const videos = (data.results['music-videos']?.data || []);
  const items = [...albums, ...songs, ...videos];
  return items.map(x => {
    const art = x.attributes?.artwork;
    if (!art?.url) return null;
    const max = Math.min(size, Math.max(art.width || size, art.height || size));
    const img = buildArtworkUrlFromTemplate(art.url, max);
    const title = x.attributes?.name || '（名称不明）';
    const subtitle = x.attributes?.artistName || x.attributes?.curatorName || '';
    const linkUrl = x.attributes?.url;
    const kind = x.type;
    return {imgUrl: img, title, subtitle, linkUrl, badges:[kind, `${max}×${max}`, country.toUpperCase()]};
  }).filter(Boolean);
}

function spinner(){
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = '<div class="cover" style="display:grid;place-items:center"><div class="loader"></div></div><div class="meta"><div class="title">検索中…</div><div class="sub">少々お待ちください</div></div>';
  return d;
}

function ensureTerm(){
  const t = qEl.value.trim();
  if (!t){ qEl.focus(); qEl.placeholder = '検索ワードを入力してください'; return null; }
  return t;
}

searchBtn.addEventListener('click', doSearch);
qEl.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') doSearch(); });
clearBtn.addEventListener('click', ()=>{ qEl.value=''; resultsEl.innerHTML=''; });

async function doSearch(){
  const term = ensureTerm(); if (!term) return;
  const media = mediaEl.value;
  const country = countryEl.value || 'jp';
  const limit = parseInt(limitEl.value, 10) || 25;
  const size = parseInt(sizeEl.value, 10) || 600;
  const token = tokenEl.value.trim();

  resultsEl.innerHTML = '';
  resultsEl.appendChild(spinner());
  try{
    const items = token ? 
      await searchAppleMusic(term, media, country, limit, size, token) :
      await searchItunes(term, media, country, limit, size);
    resultsEl.innerHTML = '';
    if (!items.length){
      const empty = document.createElement('div'); empty.className='hint'; empty.textContent = '該当する結果が見つかりませんでした。';
      resultsEl.appendChild(empty);
      return;
    }
    items.forEach(item => resultsEl.appendChild(cardTemplate(item)));
  }catch(err){
    resultsEl.innerHTML='';
    const e = document.createElement('div'); e.className='hint'; e.textContent = 'エラーが発生しました：' + err.message;
    resultsEl.appendChild(e);
  }
}

// simple loader
const style = document.createElement('style'); style.textContent = '.loader{width:32px;height:32px;border-radius:50%;border:3px solid rgba(255,255,255,.35);border-top-color:#fff;animation:spin 1s linear infinite;}@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(style);

