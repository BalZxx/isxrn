
const CONFIG = window.STORE_CONFIG || {};

/* PILIHAN TEMA TOKO */
function setupThemePicker(){
  const picker=document.getElementById("themePicker");
  const toggle=document.getElementById("themeToggle");
  const menu=document.getElementById("themeMenu");
  if(!picker||!toggle||!menu)return;
  const allowed=["midnight","ocean","purple","sunset","light"];
  let saved="midnight";
  try{saved=localStorage.getItem("store-ikbal-theme")||"midnight"}catch(_){}
  function applyTheme(theme){
    if(!allowed.includes(theme))theme="midnight";
    document.body.dataset.theme=theme==="midnight"?"":theme;
    if(theme==="midnight")document.body.removeAttribute("data-theme");
    picker.querySelectorAll("[data-theme-choice]").forEach(button=>{
      const active=button.dataset.themeChoice===theme;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    const themeMeta=document.querySelector('meta[name="theme-color"]');
    if(themeMeta)themeMeta.content=getComputedStyle(document.body).getPropertyValue("--bg").trim()||"#080909";
    const dot=toggle.querySelector(".theme-toggle-dot");
    if(dot)dot.style.background=getComputedStyle(document.body).getPropertyValue("--green").trim();
    try{localStorage.setItem("store-ikbal-theme",theme)}catch(_){}
  }
  applyTheme(saved);
  toggle.addEventListener("click",()=>{
    const open=menu.hidden;
    menu.hidden=!open;
    toggle.setAttribute("aria-expanded",String(open));
  });
  menu.querySelectorAll("[data-theme-choice]").forEach(button=>button.addEventListener("click",()=>{
    applyTheme(button.dataset.themeChoice);
    menu.hidden=true;
    toggle.setAttribute("aria-expanded","false");
  }));
  document.addEventListener("click",event=>{
    if(!picker.contains(event.target)){menu.hidden=true;toggle.setAttribute("aria-expanded","false")}
  });
}

const PHONE = CONFIG.WHATSAPP_NUMBER || "6283148451522";

let songs = [];
let currentAudio = null;
let currentButton = null;
let currentCard = null;
let currentSong = null;
let audioContext = null;
let analyser = null;
let visualizerFrame = null;
let visualizerSource = null;
const audioPreloadCache = new Map();
function preloadTrack(url){if(!url||audioPreloadCache.has(url))return audioPreloadCache.get(url);const audio=new Audio();audio.crossOrigin='anonymous';audio.preload='auto';audio.src=url;audio.load();audioPreloadCache.set(url,audio);return audio;}
function preloadAdjacentTracks(song){const index=songs.indexOf(song);if(index<0||!songs.length)return;[1,2].forEach(step=>{const next=songs[(index+step)%songs.length];if(next)preloadTrack(next.preview_url||next.audio_url||'');});}

const songList = document.getElementById("songList");
const searchInput = document.getElementById("searchInput");
const musicCount = document.getElementById("musicCount");

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeJS(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "");
}

function formatMusicTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function buyLink(song) {
  const artistPhones = {
    "ikbal sopan": "6283148451522",
    "kikuk neverdie": "6283805979397"
  };
  const artistKey = String(song.artist || "").trim().toLowerCase();
  const recipient = String(song.whatsapp_number || artistPhones[artistKey] || PHONE).replace(/\\D/g, "");
  const message =
    `Halo, saya ingin membeli musik:\\n` +
    `Judul: ${song.title}\\n` +
    `Artis: ${song.artist}\\n` +
    `Harga: ${rupiah(song.price)}`;
  return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
}

// MENAMPILKAN KATALOG MUSIK
function renderSongs(keyword = "") {
  const filtered = songs.filter(song =>
    `${song.title} ${song.artist}`
      .toLowerCase()
      .includes(keyword.toLowerCase())
  );

  musicCount.textContent = `${filtered.length}`;

  if (!filtered.length) {
    songList.innerHTML =
      `<div class="empty">Belum ada musik ditemukan.</div>`;
    return;
  }

  songList.innerHTML = filtered.map(song => {
    const title = escapeHTML(song.title || "Tanpa Judul");
    const artist = escapeHTML(song.artist || "Unknown Artist");
    const cover = escapeHTML(song.cover_url || "");
    const price = rupiah(song.price);
    const audio = song.preview_url || song.audio_url || "";

    return `
      <article class="song-card" data-song-index="${songs.indexOf(song)}">
        <div class="song-cover-wrap">
          <img src="${cover}" alt="${title}"
            loading="lazy"
            onerror="this.src='https://placehold.co/500x500/171a17/c9ff62?text=STORE+MUSIC'">
          <button class="card-preview" type="button" aria-label="Putar preview ${title}" title="Putar preview"
            onclick="playSong('${escapeJS(audio)}', this)"><span class="card-play-icon">▶</span></button>
        </div>
        <div class="song-info">
          <div class="song-meta">
            <h3>${title}</h3>
            <p>${artist}</p>
          </div>
          <div class="song-bottom">
            <strong class="song-price">${price}</strong>
            <a class="buy-button" href="${buyLink(song)}" target="_blank" rel="noopener">Beli lagu ↗</a>
          </div>
        </div>
      </article>`;
  }).join("");
}

// MENGGESER POSISI LAGU
function seekSong(slider) {
  if (!currentAudio || !currentCard) return;
  if (slider.closest(".song-card") !== currentCard) return;
  if (!Number.isFinite(currentAudio.duration)) return;

  currentAudio.currentTime =
    (Number(slider.value) / 100) * currentAudio.duration;

  updateMusicControls();
}

// MENGATUR KECEPATAN MUSIK
function changePlaybackRate(select) {
  if (!currentAudio || !currentCard) return;
  if (select.closest(".song-card") !== currentCard) return;

  currentAudio.playbackRate = Number(select.value);
}

// MEMPERBARUI WAKTU MUSIK
function updateMusicControls() {
  if (!currentAudio) return;
  if (currentCard) {
    const slider = currentCard.querySelector(".seek-bar");
    const now = currentCard.querySelector(".current-time");
    const total = currentCard.querySelector(".duration-time");
    const duration = currentAudio.duration || 0;
    const position = currentAudio.currentTime || 0;
    if (slider) slider.value = duration ? (position / duration) * 100 : 0;
    if (now) now.textContent = formatMusicTime(position);
    if (total) total.textContent = formatMusicTime(duration);
  }
  updatePersistentPlayer();
}

// MENGHENTIKAN PEMUTAR
function resetPlayer() {
  stopAudioVisualizer();
  if (currentButton) {
    currentButton.innerHTML = '<span class="card-play-icon">▶</span>';
  }

  if (currentCard) {
    const slider = currentCard.querySelector(".seek-bar");
    const now = currentCard.querySelector(".current-time");

    if (slider) slider.value = 0;
    if (now) now.textContent = "0:00";
  }

  currentAudio = null;
  currentButton = null;
  currentCard = null;
  currentSong = null;
  const mini = document.getElementById("isMiniPlayer");
  const full = document.getElementById("isFullPlayer");
  if (mini) mini.hidden = true;
  if (full) full.hidden = true;
  document.body.classList.remove("is-player-open");
}

// PUTAR / PAUSE MUSIK
async function playSong(url, button) {
  if (!url) {
    alert("Preview musik belum tersedia.");
    return;
  }

  // Jika tombol lagu yang sama ditekan
  if (currentAudio && currentButton === button) {
    if (currentAudio.paused) {
      try {
        await currentAudio.play();
        button.innerHTML = '<span class="card-play-icon">Ⅱ</span>';
        showPersistentPlayer();
        startAudioVisualizer(currentAudio);
        syncPersistentButtons();
      } catch (error) {
        console.error(error);
        alert("Musik tidak dapat dilanjutkan.");
      }
    } else {
      currentAudio.pause();
      button.innerHTML = '<span class="card-play-icon">▶</span>';
      syncPersistentButtons();
    }
    return;
  }

  // Hentikan lagu sebelumnya
  if (currentAudio) {
    currentAudio.pause();
    resetPlayer();
  }

  document.querySelectorAll(".card-preview").forEach(btn => {
    btn.innerHTML = '<span class="card-play-icon">▶</span>';
  });

  const audio = preloadTrack(url) || new Audio();
  audioPreloadCache.delete(url);
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";
  if (audio.src !== url) audio.src = url;

  currentAudio = audio;
  currentButton = button;
  currentCard = button.closest(".song-card");
  currentSong = songs.find(song => (song.preview_url || song.audio_url || "") === url) || null;
  if (currentSong) preloadAdjacentTracks(currentSong);

  audio.addEventListener("loadedmetadata", updateMusicControls);
  audio.addEventListener("durationchange", updateMusicControls);
  audio.addEventListener("timeupdate", updateMusicControls);

  audio.addEventListener("play", () => {
    showPersistentPlayer();
    syncPersistentButtons();
  });
  audio.addEventListener("pause", () => { pauseAudioVisualizer(); syncPersistentButtons(); });
  audio.addEventListener("ended", () => { if (audio === currentAudio) resetPlayer(); });

  audio.addEventListener("error", () => {
    if (audio !== currentAudio) return;
    console.error("Audio gagal dimuat:", url);
    alert("Preview tidak dapat diputar. Periksa file audio.");
    resetPlayer();
  });

  try {
    await audio.play();
    button.innerHTML = '<span class="card-play-icon">Ⅱ</span>';
    showPersistentPlayer();
    startAudioVisualizer(audio);
  } catch (error) {
    console.error("Audio error:", error);
    alert("Preview tidak dapat diputar. Periksa file audio dan koneksi.");
    resetPlayer();
  }
}

// MEMUAT KATALOG DARI SUPABASE
async function loadSongs() {
  if (
    !window.supabase ||
    !CONFIG.SUPABASE_URL ||
    !CONFIG.SUPABASE_ANON_KEY ||
    CONFIG.SUPABASE_URL.includes("ISI_")
  ) {
    songList.innerHTML = `
      <div class="empty">
        Katalog sedang menunggu koneksi database.
      </div>`;
    musicCount.textContent = "0";
    return;
  }

  try {
    const db = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    );

    const { data, error } = await db
      .from("songs")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Katalog hanya menampilkan lagu yang benar-benar memiliki URL audio.
    songs = (data || []).filter(song => {
      const url = song.preview_url || song.audio_url || "";
      return typeof url === "string" && (url.trim().startsWith("https://") || url.trim().startsWith("http://"));
    });
    renderSongs(searchInput.value);
    songs.slice(0, 3).forEach(song => preloadTrack(song.preview_url || song.audio_url || ""));

  } catch (error) {
    console.error(error);

    songList.innerHTML = `
      <div class="empty">
        Gagal memuat musik. Silakan coba lagi nanti.
      </div>`;
  }
}

// PENCARIAN MUSIK
searchInput.addEventListener("input", event => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    resetPlayer();
  }

  renderSongs(event.target.value);
});


function setupPersistentPlayer() {
  const mini = document.getElementById("isMiniPlayer");
  if (!mini || mini.dataset.ready) return;
  mini.dataset.ready = "1";
  document.getElementById("isExpandPlayer").addEventListener("click", () => {
    if (!currentAudio) return;
    document.getElementById("isFullPlayer").hidden = false;
    document.body.classList.add("is-player-open");
  });
  document.getElementById("isClosePlayer").addEventListener("click", () => {
    document.getElementById("isFullPlayer").hidden = true;
    document.body.classList.remove("is-player-open");
  });
  document.getElementById("isMiniPlay").addEventListener("click", togglePersistentPlayback);
  document.getElementById("isFullPlay").addEventListener("click", togglePersistentPlayback);
  document.getElementById("isMiniNext").addEventListener("click", () => changeTrack(1));
  document.getElementById("isNext").addEventListener("click", () => changeTrack(1));
  document.getElementById("isPrev").addEventListener("click", () => changeTrack(-1));
  document.getElementById("isFullSeek").addEventListener("input", e => {
    if (currentAudio && Number.isFinite(currentAudio.duration)) {
      currentAudio.currentTime = Number(e.target.value) / 100 * currentAudio.duration;
      updatePersistentPlayer();
    }
  });
  document.getElementById("isFullSpeed").addEventListener("change", e => {
    if (currentAudio) currentAudio.playbackRate = Number(e.target.value);
    if (currentCard) {
      const select = currentCard.querySelector(".speed-control");
      if (select) select.value = e.target.value;
    }
  });
  document.getElementById("isFullVolume").addEventListener("input", e => {
    if (currentAudio) currentAudio.volume = Number(e.target.value);
  });

  // Swipe kiri/kanan pada area pemutar untuk ganti lagu.
  const full = document.getElementById("isFullPlayer");
  let swipeStart = null;
  full.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest("button,input,select,label")) return;
    swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  full.addEventListener("pointerup", event => {
    if (!swipeStart || swipeStart.id !== event.pointerId) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      changeTrack(dx < 0 ? 1 : -1);
    }
  });
  full.addEventListener("pointercancel", () => { swipeStart = null; });
}
function showPersistentPlayer() {
  if (!currentAudio) return;
  const mini = document.getElementById("isMiniPlayer");
  if (!mini) {
    console.error("Mini-player tidak ditemukan di index.html");
    return;
  }

  const song = currentSong || {};
  const cover = currentCard && currentCard.querySelector("img");
  const title = song.title || (currentCard && currentCard.querySelector("h3")?.textContent) || "Now Playing";
  const artist = song.artist || (currentCard && currentCard.querySelector(".song-info p")?.textContent) || "Store Ikbal Sopan";
  const image = song.cover_url || (cover && cover.src) || "";

  const fullPlayer = document.getElementById("isFullPlayer");
  if (fullPlayer) fullPlayer.style.setProperty("--player-art", image ? 'url("' + image.replace(/"/g, '\\"') + '")' : "none");

  mini.hidden = false;
  mini.style.display = "flex";
  document.getElementById("isMiniCover").src = image;
  document.getElementById("isFullCover").src = image;
  document.getElementById("isMiniTitle").textContent = title;
  document.getElementById("isFullTitle").textContent = title;
  document.getElementById("isMiniArtist").textContent = artist;
  document.getElementById("isFullArtist").textContent = artist;
  document.getElementById("isFullPlayer").hidden = true;
  document.body.classList.remove("is-player-open");
  updatePersistentPlayer();
}
function updatePersistentPlayer() {
  if (!currentAudio) return;
  const duration = currentAudio.duration || 0;
  const current = currentAudio.currentTime || 0;
  const percent = duration ? current / duration * 100 : 0;
  document.getElementById("isMiniProgress").style.width = percent + "%";
  document.getElementById("isFullSeek").value = percent;
  document.getElementById("isFullCurrent").textContent = formatMusicTime(current);
  document.getElementById("isFullDuration").textContent = formatMusicTime(duration);
  document.getElementById("isFullSpeed").value = String(currentAudio.playbackRate || 1);
  syncPersistentButtons();
}
function syncPersistentButtons() {
  if (!currentAudio) return;
  const paused = currentAudio.paused;
  document.getElementById("isMiniPlay").textContent = paused ? "▶" : "Ⅱ";
  document.getElementById("isFullPlay").textContent = paused ? "▶" : "Ⅱ";
  document.getElementById("isWave").classList.toggle("is-playing", !paused);
}
async function togglePersistentPlayback() {
  if (!currentAudio) return;
  if (currentAudio.paused) {
    try {
      await currentAudio.play();
      if (currentButton) currentButton.innerHTML = '<span class="card-play-icon">Ⅱ</span>';
      startAudioVisualizer(currentAudio);
    } catch (error) { console.error(error); }
  } else {
    currentAudio.pause();
    if (currentButton) currentButton.innerHTML = '<span class="card-play-icon">▶</span>';
    pauseAudioVisualizer();
  }
  syncPersistentButtons();
}
function changeTrack(direction) {
  if (!songs.length || !currentSong) return;
  const currentIndex = songs.indexOf(currentSong);
  if (currentIndex < 0) return;
  // Lewati lagu yang belum memiliki file preview/audio.
  for (let step = 1; step <= songs.length; step++) {
    const nextIndex = (currentIndex + direction * step + songs.length) % songs.length;
    const song = songs[nextIndex];
    const url = song && (song.preview_url || song.audio_url || "");
    if (!url) continue;
    const card = document.querySelector('.song-card[data-song-index="' + nextIndex + '"]');
    const button = (card && card.querySelector(".card-preview")) || document.createElement("button");
    playSong(url, button);
    return;
  }
}

// MEMUAT LOGO TOKO DARI PENGATURAN SUPABASE
async function loadStoreLogo() {
  if (!window.supabase || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) return;
  try {
    const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const { data, error } = await db.from("store_branding_settings").select("logo_url").eq("id", "main").maybeSingle();
    if (error) throw error;
    if (!data?.logo_url) return;
    document.querySelectorAll("[data-store-logo]").forEach(img => {
      img.src = data.logo_url + (data.logo_url.includes("?") ? "&" : "?") + "v=" + Date.now();
      img.hidden = false;
    });
    document.querySelectorAll("[data-logo-fallback]").forEach(node => node.hidden = true);
  } catch (error) {
    console.info("Logo toko memakai logo bawaan.", error.message);
  }
}

// JALANKAN KATALOG
setupThemePicker();
setupPersistentPlayer();
loadStoreLogo();
loadSongs();

// AUDIO VISUALIZER REAL-TIME — spectrum halus ala Apple Music
function startAudioVisualizer(audio) {
  stopAudioVisualizer();
  const wave = document.getElementById("isWave");
  const bars = Array.from(document.querySelectorAll("#isWave i"));
  if (!wave || !bars.length) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio API tidak tersedia");
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.minDecibels = -92;
    analyser.maxDecibels = -38;
    analyser.smoothingTimeConstant = 0.62;
    visualizerSource = audio.__storeVisualizerSource || audioContext.createMediaElementSource(audio);
    audio.__storeVisualizerSource = visualizerSource;
    visualizerSource.connect(analyser);
    analyser.connect(audioContext.destination);
    const spectrum = new Uint8Array(analyser.frequencyBinCount);
    const levels = bars.map(() => 0);
    const half = Math.ceil(bars.length / 2);
    wave.classList.remove("is-fallback");
    wave.classList.add("is-live", "is-playing");
    const draw = () => {
      if (!analyser || audio !== currentAudio || audio.paused) return;
      analyser.getByteFrequencyData(spectrum);
      for (let index = 0; index < half; index++) {
        const distance = Math.abs((bars.length - 1) / 2 - index) / Math.max(1, (bars.length - 1) / 2);
        const bin = Math.min(spectrum.length - 1, 2 + Math.floor(distance * distance * 38));
        const raw = spectrum[bin] / 255;
        const envelope = 0.22 + 0.78 * Math.pow(1 - distance, 0.8);
        const target = Math.pow(raw, 0.9) * envelope;
        levels[index] += (target - levels[index]) * (target > levels[index] ? 0.62 : 0.28);
        const mirrored = bars.length - 1 - index;
        const height = 4 + levels[index] * 76;
        [index, mirrored].forEach(pos => {
          bars[pos].style.height = height.toFixed(1) + "px";
          bars[pos].style.opacity = String(0.28 + levels[index] * 0.62);
        });
      }
      visualizerFrame = requestAnimationFrame(draw);
    };
    draw();
  } catch (error) {
    console.warn("Visualizer real-time tidak tersedia; memakai animasi cadangan.", error);
    wave.classList.remove("is-live");
    wave.classList.add("is-fallback");
  }
}
function pauseAudioVisualizer() {
  if (visualizerFrame) cancelAnimationFrame(visualizerFrame);
  visualizerFrame = null;
  const wave = document.getElementById("isWave");
  if (wave) wave.classList.remove("is-playing");
  document.querySelectorAll("#isWave i").forEach(bar => {
    bar.style.height = "";
    bar.style.opacity = "";
    bar.style.removeProperty("--level");
  });
}

function stopAudioVisualizer() {
  pauseAudioVisualizer();
  if (visualizerSource) { try { visualizerSource.disconnect(); } catch (_) {} }
  if (analyser) { try { analyser.disconnect(); } catch (_) {} }
  visualizerSource = null;
  analyser = null;
  const wave = document.getElementById("isWave");
  if (wave) wave.classList.remove("is-live", "is-fallback", "is-playing");
  document.querySelectorAll("#isWave i").forEach(bar => {
    bar.style.transform = "";
  });
}

async function loadRemixSamples(){
  const target=document.getElementById("remixSampleList");
  if(!target||!window.supabase||!CONFIG.SUPABASE_URL||!CONFIG.SUPABASE_ANON_KEY){if(target)target.innerHTML="<p>Contoh audio belum tersedia.</p>";return;}
  try{
    const db=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
    const {data,error}=await db.from("remix_audio_samples").select("id,title,audio_url").order("created_at",{ascending:false});
    if(error)throw error;
    if(!data||!data.length){target.innerHTML="<p>Contoh audio akan ditampilkan di sini.</p>";return;}
    target.innerHTML=data.map(item=>'<div class="remix-sample"><span>'+escapeHTML(item.title||"Contoh Inisial Remix")+'</span><audio controls preload="none" src="'+escapeHTML(item.audio_url)+'"></audio></div>').join("");
  }catch(error){console.warn("Contoh audio remix:",error);target.innerHTML="<p>Contoh audio belum dapat dimuat.</p>";}
}
loadRemixSamples();
const musicRequestForm=document.getElementById("musicRequestForm");
if(musicRequestForm)musicRequestForm.addEventListener("submit",event=>{
  event.preventDefault();
  const initial=document.getElementById("requestInitial").value.trim();
  const detail=document.getElementById("requestDetail").value.trim();
  if(!initial)return;
  const message="Halo Store Ikbal Sopan, saya ingin memesan jasa inisial remix.\nInisial/nama remix: "+initial+"\nHarga: Rp25.000"+(detail?"\nDetail pesanan: "+detail:"");
  window.open("https://wa.me/"+PHONE+"?text="+encodeURIComponent(message),"_blank","noopener");
});
