
const CONFIG = window.STORE_CONFIG || {};
const PHONE = CONFIG.WHATSAPP_NUMBER || "6283148451522";

let songs = [];
let currentAudio = null;
let currentButton = null;
let currentCard = null;
let audioContext = null;
let analyser = null;
let animationFrame = null;

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

function buyLink(song) {
  const message =
    `Halo Store Ikbal Sopan, saya ingin membeli musik:\n` +
    `Judul: ${song.title}\n` +
    `Artis: ${song.artist}\n` +
    `Harga: ${rupiah(song.price)}`;

  return `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;
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
      <div class="empty">Belum ada musik ditemukan.</div>`;
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

          <div class="visualizer-wrap">
            <div class="visualizer-label">
              <span class="visualizer-dot"></span>
              <span>LIVE AUDIO VISUALIZER</span>
            </div>
            <canvas class="audio-visualizer"></canvas>
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

// BERHENTIKAN VISUALIZER
function stopVisualizer() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (currentCard) {
    currentCard.classList.remove("is-playing");

    const canvas = currentCard.querySelector(".audio-visualizer");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}

// GAMBAR VISUALIZER SESUAI FREKUENSI AUDIO
function drawVisualizer() {
  if (!analyser || !currentCard) return;

  const canvas = currentCard.querySelector(".audio-visualizer");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  if (!rect.width || !rect.height) return;

  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  ctx.clearRect(0, 0, width, height);

  const barCount = 48;
  const gap = 3 * dpr;
  const barWidth = (width - gap * (barCount - 1)) / barCount;

  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, "#79c92f");
  gradient.addColorStop(0.6, "#b6ff5c");
  gradient.addColorStop(1, "#e2ffb5");

  ctx.fillStyle = gradient;

  for (let i = 0; i < barCount; i++) {
    const index = Math.floor(
      Math.pow(i / barCount, 1.5) * data.length * 0.75
    );

    const value = data[index] || 0;
    const barHeight = Math.max(
      3 * dpr,
      (value / 255) * height * 0.95
    );

    const x = i * (barWidth + gap);
    const y = height - barHeight;

    ctx.beginPath();
    ctx.roundRect(
      x,
      y,
      barWidth,
      barHeight,
      3 * dpr
    );
    ctx.fill();
  }

  animationFrame = requestAnimationFrame(drawVisualizer);
}

// PUTAR / PAUSE PREVIEW
async function playSong(url, button) {
  if (!url) {
    alert("Preview musik belum tersedia.");
    return;
  }

  // Jika tombol yang sama ditekan, pause atau lanjutkan
  if (currentAudio && currentButton === button) {
    if (currentAudio.paused) {
      try {
        if (audioContext) await audioContext.resume();
        await currentAudio.play();
        button.textContent = "❚❚ Pause";
        currentCard.classList.add("is-playing");
        drawVisualizer();
      } catch (error) {
        alert("Musik tidak dapat dilanjutkan.");
      }
    } else {
      currentAudio.pause();
      button.textContent = "▶ Preview";
      stopVisualizer();
    }
    return;
  }

  // Hentikan lagu sebelumnya
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
  }

  stopVisualizer();

  document.querySelectorAll(".play-button").forEach(btn => {
    btn.textContent = "▶ Preview";
  });

  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";
  audio.src = url;

  currentAudio = audio;
  currentButton = button;
  currentCard = button.closest(".song-card");

  try {
    // Buat AudioContext saat pengguna menekan tombol
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (AudioContextClass) {
      if (!audioContext) {
        audioContext = new AudioContextClass();
      }

      await audioContext.resume();

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;

      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    }

    await audio.play();

    button.textContent = "❚❚ Pause";
    currentCard.classList.add("is-playing");

    if (analyser) {
      drawVisualizer();
    }

  } catch (error) {
    console.error("Audio error:", error);

    button.textContent = "▶ Preview";
    stopVisualizer();

    alert("Preview tidak dapat diputar. Periksa file audio dan koneksi.");
    currentAudio = null;
    currentButton = null;
    currentCard = null;
    return;
  }

  audio.onended = () => {
    button.textContent = "▶ Preview";
    stopVisualizer();

    currentAudio = null;
    currentButton = null;
    currentCard = null;
    analyser = null;
  };

  audio.onerror = () => {
    button.textContent = "▶ Preview";
    stopVisualizer();

    currentAudio = null;
    currentButton = null;
    currentCard = null;
    analyser = null;
  };
}

// MEMUAT KATALOG
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

searchInput.addEventListener("input", event => {
  renderSongs(event.target.value);
});

loadSongs();
