
const CONFIG = window.STORE_CONFIG || {};
const PHONE = CONFIG.WHATSAPP_NUMBER || "6283148451522";

let songs = [];
let currentAudio = null;
let currentButton = null;
let currentCard = null;
let currentSong = null;

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
        <img src="${cover}"
          alt="${title}"
          onerror="this.src='https://placehold.co/500x500/191919/c6ff55?text=STORE+IS'">

        <div class="song-info">
          <h3>${title}</h3>
          <p>${artist}</p>
          <div class="song-price">${price}</div>

          <div class="music-controls" style="
            margin:14px 0;
            padding:12px;
            background:#171717;
            border:1px solid #333;
            border-radius:12px;
            color:#fff;
          ">
            <input
              type="range"
              class="seek-bar"
              min="0"
              max="100"
              value="0"
              step="0.1"
              oninput="seekSong(this)"
              style="
                width:100%;
                accent-color:#c6ff55;
                cursor:pointer;
              ">

            <div style="
              display:flex;
              justify-content:space-between;
              color:#aaa;
              font-size:12px;
              margin-top:5px;
            ">
              <span class="current-time">0:00</span>
              <span class="duration-time">0:00</span>
            </div>

            <div style="margin-top:10px;">
              <label style="font-size:12px;color:#aaa;">
                Kecepatan musik
              </label>

              <select
                class="speed-control"
                onchange="changePlaybackRate(this)"
                style="
                  display:block;
                  width:100%;
                  margin-top:5px;
                  padding:8px;
                  background:#242424;
                  color:#c6ff55;
                  border:1px solid #444;
                  border-radius:7px;
                ">
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1" selected>1x Normal</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>
          </div>

          <div class="song-actions">
            <button class="play-button"
              onclick="playSong('${escapeJS(audio)}', this)">
              ▶ Preview
            </button>

            <a class="buy-button"
              href="${buyLink(song)}"
              target="_blank"
              rel="noopener">
              BELI ↗
            </a>
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

  const audio = new Audio(url);
  audio.preload = "metadata";

  currentAudio = audio;
  currentButton = button;
  currentCard = button.closest(".song-card");
  currentSong = songs.find(song => (song.preview_url || song.audio_url || "") === url) || null;

  audio.addEventListener("loadedmetadata", updateMusicControls);
  audio.addEventListener("durationchange", updateMusicControls);
  audio.addEventListener("timeupdate", updateMusicControls);

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
  if (!currentAudio || !currentCard) return;
  const mini = document.getElementById("isMiniPlayer");
  if (!mini) return;
  mini.hidden = false;
  const cover = currentCard.querySelector("img");
  const title = currentCard.querySelector("h3");
  const artist = currentCard.querySelector(".song-info p");
  document.getElementById("isMiniCover").src = cover ? cover.src : "";
  document.getElementById("isFullCover").src = cover ? cover.src : "";
  document.getElementById("isMiniTitle").textContent = title ? title.textContent : "Unknown";
  document.getElementById("isFullTitle").textContent = title ? title.textContent : "Unknown";
  document.getElementById("isMiniArtist").textContent = artist ? artist.textContent : "";
  document.getElementById("isFullArtist").textContent = artist ? artist.textContent : "";
  document.getElementById("isFullPlayer").hidden = false;
  document.body.classList.add("is-player-open");
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
  if (!currentSong || !songs.length) return;
  const index = songs.indexOf(currentSong);
  const next = (index + direction + songs.length) % songs.length;
  const card = document.querySelector('.song-card[data-song-index="' + next + '"]');
  const button = card && card.querySelector(".play-button");
  if (button) playSong(songs[next].preview_url || songs[next].audio_url || "", button);
}

// JALANKAN KATALOG
setupPersistentPlayer();
loadSongs();
