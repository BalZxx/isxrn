
const CONFIG = window.STORE_CONFIG || {};
const client = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginForm = document.getElementById("loginForm");
const songForm = document.getElementById("songForm");
const loginMessage = document.getElementById("loginMessage");
const uploadMessage = document.getElementById("uploadMessage");
const adminSongList = document.getElementById("adminSongList");

let editingId = null;

function message(element, text) {
  element.textContent = text;
}

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function showDashboard(loggedIn) {
  loginSection.hidden = loggedIn;
  dashboardSection.hidden = !loggedIn;
}

async function checkLogin() {
  const { data } = await client.auth.getSession();

  if (data.session) {
    showDashboard(true);
    loadAdminSongs();
  } else {
    showDashboard(false);
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  message(loginMessage, "Sedang login...");

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message(loginMessage, "Login gagal: " + error.message);
    return;
  }

  message(loginMessage, "Login berhasil!");
  showDashboard(true);
  loadAdminSongs();
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  await client.auth.signOut();
  showDashboard(false);
});

async function loadAdminSongs() {
  adminSongList.textContent = "Memuat musik...";

  const { data, error } = await client
    .from("songs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    adminSongList.textContent = "Gagal memuat: " + error.message;
    return;
  }

  if (!data.length) {
    adminSongList.textContent = "Belum ada musik.";
    return;
  }

  adminSongList.innerHTML = data.map(song => `
    <div class="admin-song-item">
      <div>
        <strong>${escapeHTML(song.title)}</strong>
        <small>${escapeHTML(song.artist)} · ${rupiah(song.price)}</small>
        <small>${song.is_active ? "Aktif" : "Nonaktif"}</small>
      </div>
      <div>
        <button class="delete-song"
          onclick="deleteSong('${song.id}')">Hapus</button>
      </div>
    </div>
  `).join("");
}

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function uploadFile(file, bucket) {
  if (!file) throw new Error("File belum dipilih.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${safeName}`;

  const { error } = await client.storage
    .from(bucket)
    .upload(path, file);

  if (error) throw error;

  const { data } = client.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

songForm.addEventListener("submit", async event => {
  event.preventDefault();

  const submitButton = songForm.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    message(uploadMessage, "Mengunggah cover dan audio...");

    const title = document.getElementById("songTitle").value.trim();
    const artist = document.getElementById("songArtist").value.trim();
    const price = Number(document.getElementById("songPrice").value);
    const coverFile = document.getElementById("songCover").files[0];
    const audioFile = document.getElementById("songAudio").files[0];

    if (!title || !artist || !Number.isFinite(price) || price < 0) {
      throw new Error("Periksa judul, artis, dan harga.");
    }

    const coverUrl = await uploadFile(coverFile, "covers");
    const audioUrl = await uploadFile(audioFile, "music");

    const { error } = await client.from("songs").insert({
      title,
      artist,
      price,
      cover_url: coverUrl,
      audio_url: audioUrl,
      preview_url: audioUrl,
      is_active: true
    });

    if (error) throw error;

    songForm.reset();
    message(uploadMessage, "Musik berhasil ditambahkan!");
    await loadAdminSongs();

  } catch (error) {
    message(uploadMessage, "Gagal: " + error.message);
  } finally {
    submitButton.disabled = false;
  }
});

async function deleteSong(id) {
  if (!confirm("Yakin ingin menghapus musik ini?")) return;

  const { error } = await client
    .from("songs")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Gagal menghapus: " + error.message);
    return;
  }

  alert("Musik berhasil dihapus.");
  loadAdminSongs();
}

checkLogin();
