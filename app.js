
const CONFIG = window.STORE_CONFIG || {};
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
  const message =
    `Halo Store Ikbal Sopan, saya ingin membeli musik:\n` +
    `Judul: ${song.title}\n` +
    `Artis: ${song.artist}\n` +
    `Harga: ${rupiah(song.price)}`;

  return `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;
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
          <button class="card-preview" type="button"
            onclick="playSong('${escapeJS(audio)}', this)">▶ Preview</button>
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
  if (!currentAudio || !currentCard) return;

  const slider = currentCard.querySelector(".seek-bar");
  const now = currentCard.querySelector(".current-time");
  const total = currentCard.querySelector(".duration-time");

  if (!slider || !now || !total) return;

  const duration = currentAudio.duration || 0;
  const position = currentAudio.currentTime || 0;

  slider.value = duration
    ? (position / duration) * 100
    : 0;

  now.textContent = formatMusicTime(position);
  total.textContent = formatMusicTime(duration);
  updatePersistentPlayer();
}

// MENGHENTIKAN PEMUTAR
function resetPlayer() {
  stopAudioVisualizer();
  if (currentButton) {
    currentButton.textContent = "▶ Preview";
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
        button.textContent = "❚❚ Pause";
        showPersistentPlayer();
        startAudioVisualizer(currentAudio);
        syncPersistentButtons();
      } catch (error) {
        console.error(error);
        alert("Musik tidak dapat dilanjutkan.");
      }
    } else {
      currentAudio.pause();
      button.textContent = "▶ Preview";
      syncPersistentButtons();
    }
    return;
  }

  // Hentikan lagu sebelumnya
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    resetPlayer();
  }

  document.querySelectorAll(".play-button").forEach(btn => {
    btn.textContent = "▶ Preview";
  });

  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.preload = "metadata";
  audio.src = url;

  currentAudio = audio;
  currentButton = button;
  currentCard = button.closest(".song-card");
  currentSong = songs.find(song => (song.preview_url || song.audio_url || "") === url) || null;

  audio.addEventListener("loadedmetadata", updateMusicControls);
  audio.addEventListener("durationchange", updateMusicControls);
  audio.addEventListener("timeupdate", updateMusicControls);

  audio.addEventListener("play", () => {
    showPersistentPlayer();
    syncPersistentButtons();
  });
  audio.addEventListener("pause", syncPersistentButtons);
  audio.addEventListener("ended", resetPlayer);

  audio.addEventListener("error", () => {
    console.error("Audio gagal dimuat:", url);
    alert("Preview tidak dapat diputar. Periksa file audio.");
    resetPlayer();
  });

  try {
    await audio.play();
    button.textContent = "❚❚ Pause";
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

    songs = data || [];
    renderSongs(searchInput.value);

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
      if (currentButton) currentButton.textContent = "❚❚ Pause";
    } catch (error) { console.error(error); }
  } else {
    currentAudio.pause();
    if (currentButton) currentButton.textContent = "▶ Preview";
  }
  syncPersistentButtons();
}
function changeTrack(direction) {
  if (!songs.length) return;
  const index = currentSong ? songs.indexOf(currentSong) : -1;
  const next = (index + direction + songs.length) % songs.length;
  const song = songs[next];
  const url = song && (song.preview_url || song.audio_url || '');
  if (!url) return;
  const card = document.querySelector('.song-card[data-song-index="' + songs.indexOf(song) + '"]');
  const button = (card && card.querySelector('.play-button')) || document.createElement('button');
  playSong(url, button);
}

// JALANKAN KATALOG
setupPersistentPlayer();
loadSongs();

// AUDIO VISUALIZER REAL-TIME
function startAudioVisualizer(audio) {
  stopAudioVisualizer();
  const bars = Array.from(document.querySelectorAll('#isWave i'));
  if (!bars.length) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio API tidak tersedia');
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.68;
    visualizerSource = audio.__storeVisualizerSource || audioContext.createMediaElementSource(audio);
    audio.__storeVisualizerSource = visualizerSource;
    visualizerSource.connect(analyser);
    analyser.connect(audioContext.destination);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      if (!analyser || audio !== currentAudio) return;
      analyser.getByteFrequencyData(data);
      bars.forEach((bar, index) => {
        const position = index / Math.max(1, bars.length - 1);
        const perceptual = Math.pow(position, 1.65);
        const bin = Math.min(data.length - 1, Math.max(1, Math.floor(1 + perceptual * (data.length - 2))));
        const level = data[bin] / 255;
        const neighbor = data[Math.min(data.length - 1, bin + 1)] / 255;
        const energy = Math.min(1, level * 0.72 + neighbor * 0.28);
        bar.style.height = Math.max(3, 3 + energy * 62) + 'px';
        bar.style.transform = 'scaleY(1)';
        bar.style.opacity = String(0.45 + level * 0.55);
      });
      visualizerFrame = requestAnimationFrame(draw);
    };
    draw();
  } catch (error) {
    console.warn('Visualizer real-time tidak tersedia; memakai animasi cadangan.', error);
    document.getElementById('isWave')?.classList.add('is-fallback');
  }
}
function stopAudioVisualizer() {
  if (visualizerFrame) cancelAnimationFrame(visualizerFrame);
  visualizerFrame = null;
  if (visualizerSource) { try { visualizerSource.disconnect(); } catch (_) {} }
  if (analyser) { try { analyser.disconnect(); } catch (_) {} }
  visualizerSource = null;
  analyser = null;
  document.querySelectorAll('#isWave i').forEach(bar => {
    bar.style.height = ''; bar.style.transform = ''; bar.style.opacity = '';
  });
}
