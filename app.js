
const CONFIG = window.STORE_CONFIG || {};
const PHONE = CONFIG.WHATSAPP_NUMBER || "6283148451522";

let songs = [];
let currentAudio = null;

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

function renderSongs(keyword = "") {
  const filtered = songs.filter(song =>
    `${song.title} ${song.artist}`
      .toLowerCase()
      .includes(keyword.toLowerCase())
  );

  musicCount.textContent = `${filtered.length} MUSIK`;

  if (!filtered.length) {
    songList.innerHTML = `
      <div class="empty">
        Belum ada musik ditemukan.
      </div>`;
    return;
  }

  songList.innerHTML = filtered.map(song => {
    const title = escapeHTML(song.title || "Tanpa Judul");
    const artist = escapeHTML(song.artist || "Unknown Artist");
    const cover = song.cover_url || "";
    const price = rupiah(song.price);
    const audio = song.preview_url || song.audio_url || "";

    return `
      <article class="song-card">
        <img src="${escapeHTML(cover)}"
             alt="${title}"
             onerror="this.src='https://placehold.co/500x500/191919/c6ff55?text=STORE+IS'">

        <div class="song-info">
          <h3>${title}</h3>
          <p>${artist}</p>
          <div class="song-price">${price}</div>

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
  return String(value).replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "");
}

function buyLink(song) {
  const message =
    `Halo Store Ikbal Sopan, saya ingin membeli musik:\n` +
    `Judul: ${song.title}\n` +
    `Artis: ${song.artist}\n` +
    `Harga: ${rupiah(song.price)}`;

  return `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;
}

function playSong(url, button) {
  if (!url) {
    alert("Preview musik belum tersedia.");
    return;
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  document.querySelectorAll(".play-button").forEach(btn => {
    btn.textContent = "▶ Preview";
  });

  const audio = new Audio(url);
  currentAudio = audio;

  audio.play().then(() => {
    button.textContent = "❚❚ Pause";
  }).catch(() => {
    alert("Musik tidak dapat diputar.");
  });

  audio.onended = () => {
    button.textContent = "▶ Preview";
    currentAudio = null;
  };

  button.onclick = () => {
    if (audio.paused) {
      audio.play();
      button.textContent = "❚❚ Pause";
    } else {
      audio.pause();
      button.textContent = "▶ Preview";
    }
  };
}

async function loadSongs() {
  if (!window.supabase || !CONFIG.SUPABASE_URL ||
      !CONFIG.SUPABASE_ANON_KEY ||
      CONFIG.SUPABASE_URL.includes("ISI_")) {
    songList.innerHTML = `
      <div class="empty">
        Katalog sedang menunggu koneksi database.
      </div>`;
    musicCount.textContent = "0 MUSIK";
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

searchInput.addEventListener("input", event => {
  renderSongs(event.target.value);
});

loadSongs();
