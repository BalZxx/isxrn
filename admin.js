const supabaseClient = window.supabase.createClient(
  window.STORE_CONFIG.SUPABASE_URL,
  window.STORE_CONFIG.SUPABASE_ANON_KEY
);

const $ = (id) => document.getElementById(id);

const loginSection = $("loginSection");
const dashboardSection = $("dashboardSection");
const recoverySection = $("recoverySection");

let currentSession = null;

function showMessage(id, message) {
  $(id).textContent = message;
}

function showLogin() {
  loginSection.hidden = false;
  dashboardSection.hidden = true;
  recoverySection.hidden = true;
}

function showDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  recoverySection.hidden = true;
  loadSongs();
}

// LOGIN
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  showMessage("loginMessage", "Sedang masuk...");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("loginMessage", "Gagal masuk: " + error.message);
    return;
  }

  currentSession = data.session;
  showDashboard();
});

// LUPA PASSWORD
$("forgotPasswordBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();

  if (!email) {
    showMessage("loginMessage", "Masukkan email admin terlebih dahulu.");
    $("email").focus();
    return;
  }

  showMessage("loginMessage", "Mengirim email pemulihan...");

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);

  if (error) {
    showMessage("loginMessage", "Gagal: " + error.message);
    return;
  }

  showMessage(
    "loginMessage",
    "Email pemulihan sudah diminta. Periksa kotak masuk atau folder spam."
  );
});

// DETEKSI RESET PASSWORD
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    loginSection.hidden = true;
    dashboardSection.hidden = true;
    recoverySection.hidden = false;
  }
});

// SIMPAN PASSWORD BARU
$("recoveryForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = $("newPassword").value;
  const confirmation = $("confirmPassword").value;

  if (password.length < 6) {
    showMessage("recoveryMessage", "Password minimal 6 karakter.");
    return;
  }

  if (password !== confirmation) {
    showMessage("recoveryMessage", "Konfirmasi password tidak cocok.");
    return;
  }

  showMessage("recoveryMessage", "Menyimpan password...");

  const { error } = await supabaseClient.auth.updateUser({
    password
  });

  if (error) {
    showMessage("recoveryMessage", "Gagal: " + error.message);
    return;
  }

  await supabaseClient.auth.signOut();
  showMessage("recoveryMessage", "Password berhasil diubah. Silakan login kembali.");
  $("recoveryForm").reset();
});

// UPLOAD FILE
async function uploadFile(file, bucket) {
  if (!file) return null;

  const extension = file.name.split(".").pop().toLowerCase();
  const fileName =
    Date.now() + "-" + Math.random().toString(36).slice(2) + "." + extension;

  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return data.publicUrl;
}


// PENGATURAN LOGO TOKO
async function loadStoreLogoSettings() {
  const preview = $("currentLogoPreview");
  const fallback = $("logoPreviewFallback");
  const { data, error } = await supabaseClient
    .from("store_settings")
    .select("logo_url")
    .eq("id", "main")
    .maybeSingle();

  if (error) {
    showMessage("logoMessage", "Pengaturan logo belum siap. Pastikan SQL pengaturan logo sudah dijalankan di Supabase.");
    return;
  }
  if (data?.logo_url) {
    preview.src = data.logo_url + (data.logo_url.includes("?") ? "&" : "?") + "v=" + Date.now();
    preview.hidden = false;
    fallback.hidden = true;
  } else {
    preview.hidden = true;
    fallback.hidden = false;
  }
}

$("saveStoreLogoBtn").addEventListener("click", async () => {
  const file = $("storeLogoFile").files[0];
  if (!file) {
    showMessage("logoMessage", "Pilih file logo terlebih dahulu.");
    return;
  }
  if (!/^image\\/(png|jpeg|webp|svg\\+xml)$/.test(file.type)) {
    showMessage("logoMessage", "Format harus PNG, JPG, WEBP, atau SVG.");
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    showMessage("logoMessage", "Ukuran logo maksimal 3 MB.");
    return;
  }

  const button = $("saveStoreLogoBtn");
  button.disabled = true;
  button.textContent = "Mengunggah...";
  showMessage("logoMessage", "Sedang mengunggah logo...");
  try {
    const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = "branding/store-logo-" + Date.now() + "." + extension;
    const { error: uploadError } = await supabaseClient.storage
      .from("covers")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabaseClient.storage.from("covers").getPublicUrl(path);
    const { error: saveError } = await supabaseClient
      .from("store_settings")
      .upsert({ id: "main", logo_url: publicData.publicUrl, updated_at: new Date().toISOString() });
    if (saveError) throw saveError;

    $("currentLogoPreview").src = publicData.publicUrl;
    $("currentLogoPreview").hidden = false;
    $("logoPreviewFallback").hidden = true;
    $("storeLogoFile").value = "";
    showMessage("logoMessage", "Logo berhasil diganti! Muat ulang halaman toko untuk melihat hasilnya.");
  } catch (error) {
    showMessage("logoMessage", "Gagal mengganti logo: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Simpan Logo";
  }
});

// TAMBAH / EDIT LAGU
$("songForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = $("songId").value;
  const title = $("songTitle").value.trim();
  const artist = $("songArtist").value.trim();
  const price = Number($("songPrice").value);
  const coverFile = $("coverFile").files[0];
  const audioFile = $("audioFile").files[0];

  if (!Number.isFinite(price) || price < 0) {
    showMessage("adminMessage", "Harga tidak valid.");
    return;
  }

  const saveButton = $("saveSongBtn");
  saveButton.disabled = true;
  saveButton.textContent = "Menyimpan...";

  try {
    const songData = {
      title,
      artist,
      price,
      is_active: true
    };

    if (coverFile) {
      songData.cover_url = await uploadFile(coverFile, "covers");
    }

    if (audioFile) {
      // Hanya untuk audio preview, jangan unggah master lagu berbayar.
      songData.preview_url = await uploadFile(audioFile, "music");
      songData.audio_url = songData.preview_url;
    }

    let result;

    if (id) {
      result = await supabaseClient
        .from("songs")
        .update(songData)
        .eq("id", id);
    } else {
      result = await supabaseClient
        .from("songs")
        .insert(songData);
    }

    if (result.error) throw result.error;

    showMessage("adminMessage", id
      ? "Musik berhasil diperbarui!"
      : "Musik berhasil ditambahkan!"
    );

    resetSongForm();
    await loadSongs();

  } catch (error) {
    showMessage("adminMessage", "Gagal menyimpan: " + error.message);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Simpan Musik";
  }
});

// TAMPILKAN DAFTAR LAGU
async function loadSongs() {
  $("songsList").innerHTML = '<p class="loading">Memuat katalog musik...</p>';

  const { data, error } = await supabaseClient
    .from("songs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("songsList").innerHTML =
      '<p class="empty">Gagal memuat: ' + error.message + '</p>';
    return;
  }

  if (!data || data.length === 0) {
    $("songsList").innerHTML =
      '<p class="empty">Belum ada musik. Tambahkan lagu pertamamu!</p>';
    return;
  }

  $("songsList").innerHTML = "";

  data.forEach((song) => {
    const item = document.createElement("div");
    item.className = "admin-song-item";

    const cover = document.createElement("img");
    cover.src = song.cover_url || "";
    cover.alt = "Cover " + song.title;

    const info = document.createElement("div");
    info.className = "admin-song-info";

    const title = document.createElement("strong");
    title.textContent = song.title;

    const details = document.createElement("span");
    details.textContent =
      song.artist + " • Rp" + Number(song.price).toLocaleString("id-ID");

    info.append(title, details);

    const actions = document.createElement("div");
    actions.className = "admin-song-actions";

    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editSong(song));

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Hapus";
    deleteButton.className = "delete-song";
    deleteButton.addEventListener("click", () => deleteSong(song.id));

    actions.append(editButton, deleteButton);
    item.append(cover, info, actions);

    $("songsList").appendChild(item);
  });
}

// EDIT LAGU
function editSong(song) {
  $("songId").value = song.id;
  $("songTitle").value = song.title;
  $("songArtist").value = song.artist;
  $("songPrice").value = song.price;

  $("formTitle").textContent = "Edit Musik";
  $("saveSongBtn").textContent = "Simpan Perubahan";
  $("cancelEditBtn").hidden = false;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// HAPUS LAGU
async function deleteSong(id) {
  if (!confirm("Yakin ingin menghapus musik ini?")) return;

  const { error } = await supabaseClient
    .from("songs")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Gagal menghapus: " + error.message);
    return;
  }

  alert("Musik berhasil dihapus.");
  loadSongs();
}

// RESET FORM
function resetSongForm() {
  $("songForm").reset();
  $("songId").value = "";
  $("formTitle").textContent = "Tambah Musik Baru";
  $("saveSongBtn").textContent = "Simpan Musik";
  $("cancelEditBtn").hidden = true;
}

$("cancelEditBtn").addEventListener("click", resetSongForm);
$("refreshSongsBtn").addEventListener("click", loadSongs);

// LOGOUT
$("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  currentSession = null;
  showLogin();
});

// CEK LOGIN SAAT HALAMAN DIBUKA
async function initializeAdmin() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    currentSession = data.session;
    showDashboard();
  } else {
    showLogin();
  }
}

initializeAdmin();
