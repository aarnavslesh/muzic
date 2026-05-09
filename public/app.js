const state = {
  authMode: "login",
  user: null,
  tracks: [],
  currentTrack: null,
  lastAudioSeconds: 0,
  externalTimer: null,
  externalSeconds: 0,
  isShuffle: false,
  isRepeat: false,
  authStep: "email"
};

const authView = document.querySelector("#authView");
const dashboard = document.querySelector("#dashboard");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const authEmailStep = document.querySelector("#authEmailStep");
const authDetailsStep = document.querySelector("#authDetailsStep");
const emailContinueButton = document.querySelector("#emailContinueButton");
const authBackButton = document.querySelector("#authBackButton");
const authHeadline = document.querySelector("#authHeadline");
const trackForm = document.querySelector("#trackForm");
const trackMessage = document.querySelector("#trackMessage");
const trackList = document.querySelector("#trackList");
const audioPlayer = document.querySelector("#audioPlayer");
const externalPlayer = document.querySelector("#externalPlayer");
const externalFrame = document.querySelector("#externalFrame");
const nowPlayingTitle = document.querySelector("#nowPlayingTitle");
const nowPlayingArtist = document.querySelector("#nowPlayingArtist");
const playerStatus = document.querySelector("#playerStatus");
const openExternalButton = document.querySelector("#openExternalButton");
const albumArt = document.querySelector("#albumArt");
const albumArtWrap = document.querySelector("#albumArtWrap");
const progressBar = document.querySelector("#progressBar");
const currentTimeLabel = document.querySelector("#currentTimeLabel");
const durationLabel = document.querySelector("#durationLabel");
const playPauseButton = document.querySelector("#playPauseButton");
const playIcon = document.querySelector("#playIcon");
const pauseIcon = document.querySelector("#pauseIcon");
const shuffleButton = document.querySelector("#shuffleButton");
const repeatButton = document.querySelector("#repeatButton");
const previousButton = document.querySelector("#previousButton");
const nextButton = document.querySelector("#nextButton");

const DEFAULT_ALBUM_ART = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&auto=format&fit=crop&q=80";

function initDottedSurface() {
  const canvas = document.querySelector("#dottedSurface");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const config = {
    spacing: 42,
    amplitude: 18,
    radius: 1.7,
    drift: 0.018,
    alpha: 0.18
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let points = [];
  let frame = 0;
  let animationId = 0;

  function buildGrid() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    points = [];
    const columns = Math.ceil(width / config.spacing) + 4;
    const rows = Math.ceil(height / config.spacing) + 4;
    const offsetX = ((columns - 1) * config.spacing - width) / 2;
    const offsetY = ((rows - 1) * config.spacing - height) / 2;

    for (let ix = 0; ix < columns; ix += 1) {
      for (let iy = 0; iy < rows; iy += 1) {
        points.push({
          x: ix * config.spacing - offsetX,
          y: iy * config.spacing - offsetY,
          ix,
          iy
        });
      }
    }
  }

  function draw() {
    context.clearRect(0, 0, width, height);

    const glow = context.createRadialGradient(width / 2, height * 0.1, 0, width / 2, height * 0.1, Math.max(width, height) * 0.75);
    glow.addColorStop(0, "rgba(11, 107, 95, 0.09)");
    glow.addColorStop(0.48, "rgba(200, 79, 49, 0.045)");
    glow.addColorStop(1, "rgba(247, 245, 239, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    for (const point of points) {
      const wave = Math.sin(point.ix * 0.34 + frame) * config.amplitude + Math.sin(point.iy * 0.22 + frame * 1.35) * config.amplitude;
      const perspective = 0.65 + ((point.y + wave) / Math.max(height, 1)) * 0.45;
      const radius = config.radius * perspective;
      const alpha = config.alpha * perspective;

      context.beginPath();
      const dotColor = "255, 255, 255";
      const dotAlpha = document.body.classList.contains("auth-active") ? alpha * 1.9 : alpha * 1.25;
      context.fillStyle = "rgba(" + dotColor + ", " + dotAlpha + ")";
      context.arc(point.x, point.y + wave, radius, 0, Math.PI * 2);
      context.fill();
    }

    frame += config.drift;
    animationId = window.requestAnimationFrame(draw);
  }

  buildGrid();
  draw();
  window.addEventListener("resize", buildGrid);

  return () => {
    window.cancelAnimationFrame(animationId);
    window.removeEventListener("resize", buildGrid);
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function showMessage(element, message) {
  element.textContent = message || "";
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll(".tab, .mini-auth-actions button").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  document.querySelectorAll(".signup-only").forEach((item) => {
    item.classList.toggle("hidden", mode !== "signup");
  });
  authForm.password.autocomplete = mode === "login" ? "current-password" : "new-password";
  authHeadline.textContent = mode === "login" ? "Welcome, to the future of music." : "Welcome, to the future of music.";
  setAuthStep("email");
  showMessage(authMessage, "");
}

function setAuthStep(step) {
  state.authStep = step;
  authEmailStep.classList.toggle("hidden", step !== "email");
  authDetailsStep.classList.toggle("hidden", step !== "details");
  if (step === "details") {
    window.setTimeout(() => {
      const target = state.authMode === "signup" ? authForm.name : authForm.password;
      target?.focus();
    }, 80);
  }
}

function continueFromEmail() {
  showMessage(authMessage, "");
  if (!authForm.email.checkValidity()) {
    authForm.email.reportValidity();
    return;
  }
  setAuthStep("details");
}

function renderApp() {
  const isAuthenticated = Boolean(state.user);
  authView.classList.toggle("hidden", isAuthenticated);
  dashboard.classList.toggle("hidden", !state.user);
  document.body.classList.toggle("auth-active", !isAuthenticated);
  if (state.user) {
    document.querySelector("#welcomeTitle").textContent = `${state.user.name}'s library`;
  }
}

async function loadInitialState() {
  const { user } = await api("/api/me");
  state.user = user;
  renderApp();
  if (state.user) await refreshDashboard();
}

async function refreshDashboard() {
  const [tracksResult, statsResult] = await Promise.all([api("/api/tracks"), api("/api/stats")]);
  state.tracks = tracksResult.tracks;
  renderTracks();
  renderStats(statsResult);
}

function renderTracks() {
  if (!state.tracks.length) {
    trackList.innerHTML = `<p class="message">No songs yet. Add a local audio file or an external music link.</p>`;
    return;
  }

  trackList.innerHTML = "";
  for (const track of state.tracks) {
    const item = document.createElement("article");
    item.className = "track-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(track.title)}</strong>
        <span>${escapeHtml(track.artist)}${track.album ? ` · ${escapeHtml(track.album)}` : ""} · ${track.kind}</span>
      </div>
      <div class="track-actions">
        <button class="primary play-track-button" type="button">Play</button>
        <button class="ghost remove-track-button" type="button">Remove</button>
      </div>
    `;
    item.querySelector(".play-track-button").addEventListener("click", () => playTrack(track));
    item.querySelector(".remove-track-button").addEventListener("click", () => removeTrack(track));
    trackList.appendChild(item);
  }
}

async function removeTrack(track) {
  const shouldRemove = window.confirm(`Remove "${track.title}" from your library?`);
  if (!shouldRemove) return;
  try {
    await api(`/api/tracks/${encodeURIComponent(track.id)}`, { method: "DELETE" });
    if (state.currentTrack?.id === track.id) {
      stopExternalTracking();
      audioPlayer.pause();
      audioPlayer.removeAttribute("src");
      externalFrame.removeAttribute("src");
      externalPlayer.classList.add("hidden");
      state.currentTrack = null;
      state.lastAudioSeconds = 0;
      nowPlayingTitle.textContent = "Choose a song";
      nowPlayingArtist.textContent = "No listening session is active.";
      playerStatus.textContent = "Upload a local audio file or use a direct audio URL for in-app playback.";
      albumArt.src = DEFAULT_ALBUM_ART;
      updateProgressUi();
      updatePlayerUi();
    }
    await refreshDashboard();
  } catch (error) {
    showMessage(trackMessage, error.message);
  }
}
function updatePlayerUi() {
  const isEmbeddedExternal = state.currentTrack?.kind === "external" && !isDirectAudioUrl(state.currentTrack.playableUrl);
  const externalPlaying = Boolean(state.externalTimer);
  const audioPlaying = !audioPlayer.paused && !audioPlayer.ended;
  const isPlaying = externalPlaying || audioPlaying;
  albumArtWrap.classList.toggle("playing", isPlaying);
  playIcon.classList.toggle("hidden", isPlaying);
  pauseIcon.classList.toggle("hidden", !isPlaying);
  playPauseButton.title = isEmbeddedExternal ? "Open source" : isPlaying ? "Pause" : "Play";
  playPauseButton.setAttribute("aria-label", playPauseButton.title);
  playPauseButton.classList.toggle("external-mode", isEmbeddedExternal);
  repeatButton.classList.toggle("active", state.isRepeat);
  shuffleButton.classList.toggle("active", state.isShuffle);
}

function updateProgressUi() {
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  const current = Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0;
  progressBar.max = String(duration || 100);
  progressBar.value = String(current);
  progressBar.style.setProperty("--progress", `${duration > 0 ? (current / duration) * 100 : 0}%`);
  currentTimeLabel.textContent = formatClock(current);
  durationLabel.textContent = formatClock(duration);
}

function setAlbumArtForTrack(track) {
  const seed = encodeURIComponent(`${track.artist || "music"} ${track.title || "song"}`);
  albumArt.src = `https://source.unsplash.com/600x600/?album,music,${seed}`;
  albumArt.alt = `${track.title} album art`;
}

function renderStats(stats) {
  document.querySelector("#totalTime").textContent = stats.totalFormatted;
  document.querySelector("#artistStats").innerHTML = stats.mostListenedArtists.length
    ? stats.mostListenedArtists
        .map((artist) => `<li><strong>${escapeHtml(artist.artist)}</strong> <span>${artist.plays} plays · ${formatDuration(artist.secondsPlayed)}</span></li>`)
        .join("")
    : `<li><span>No listening data yet.</span></li>`;
  document.querySelector("#similarUsers").innerHTML = stats.similarUsers.length
    ? stats.similarUsers
        .map((match) => `<li><strong>${escapeHtml(match.user.name)}</strong> <span>${Math.round(match.score * 100)}% taste match</span></li>`)
        .join("")
    : `<li><span>No similar users yet.</span></li>`;
}

function playTrack(track) {
  stopExternalTracking();
  state.currentTrack = track;
  state.lastAudioSeconds = 0;
  nowPlayingTitle.textContent = track.title;
  nowPlayingArtist.textContent = `${track.artist} · ${track.kind === "local" ? "local audio" : track.sourceType}`;
  setAlbumArtForTrack(track);
  updateProgressUi();

  if (track.kind === "local" || isDirectAudioUrl(track.playableUrl)) {
    externalPlayer.classList.add("hidden");
    externalFrame.removeAttribute("src");
    playerStatus.textContent = "Playing inside Muzic.";
    audioPlayer.src = track.playableUrl;
    audioPlayer.loop = state.isRepeat;
    audioPlayer.play().catch(() => {
      playerStatus.textContent = "Press the play button to start audio. Browsers sometimes block autoplay.";
      updatePlayerUi();
    });
    updatePlayerUi();
    return;
  }

  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  updateProgressUi();
  updatePlayerUi();
  externalPlayer.classList.remove("hidden");
  externalFrame.src = buildEmbedUrl(track) || track.sourceUrl;
  openExternalButton.href = track.sourceUrl;
  playerStatus.textContent = "This source is hosted externally. If the embed says unavailable, open the source to play it and use Track listening for stats.";
}

function buildEmbedUrl(track) {
  try {
    const url = new URL(track.sourceUrl);
    if (url.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    }
    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v") || url.pathname.split("/").pop();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : track.sourceUrl;
    }
    if (url.hostname.includes("soundcloud.com")) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.sourceUrl)}`;
    }
  } catch {
    return track.sourceUrl;
  }
  return track.sourceUrl;
}

function isDirectAudioUrl(url) {
  return /\.(mp3|wav|ogg|m4a|flac)(\?.*)?$/i.test(url || "");
}

async function logListening(secondsPlayed) {
  if (!state.currentTrack || secondsPlayed <= 0) return;
  await api("/api/listens", {
    method: "POST",
    body: JSON.stringify({ trackId: state.currentTrack.id, secondsPlayed })
  });
  await refreshDashboard();
}

function startExternalTracking() {
  if (!state.currentTrack || state.currentTrack.kind !== "external" || state.externalTimer) return;
  state.externalSeconds = 0;
  state.externalTimer = setInterval(async () => {
    state.externalSeconds += 10;
    await logListening(10);
  }, 10000);
  updatePlayerUi();
}

function stopExternalTracking() {
  if (state.externalTimer) {
    clearInterval(state.externalTimer);
    state.externalTimer = null;
  }
  updatePlayerUi();
}

function playRelativeTrack(direction) {
  if (!state.tracks.length) return;
  if (!state.currentTrack) {
    playTrack(state.tracks[0]);
    return;
  }
  const currentIndex = state.tracks.findIndex((track) => track.id === state.currentTrack.id);
  if (state.isShuffle && direction > 0 && state.tracks.length > 1) {
    let nextIndex = currentIndex;
    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * state.tracks.length);
    }
    playTrack(state.tracks[nextIndex]);
    return;
  }
  const nextIndex = (currentIndex + direction + state.tracks.length) % state.tracks.length;
  playTrack(state.tracks[nextIndex]);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatClock(timeInSeconds) {
  if (!Number.isFinite(timeInSeconds)) return "00:00";
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll(".tab, .mini-auth-actions button").forEach((tab) => {
  tab.addEventListener("click", () => setAuthMode(tab.dataset.mode));
});

emailContinueButton.addEventListener("click", continueFromEmail);
authBackButton.addEventListener("click", () => setAuthStep("email"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage(authMessage, "");
  if (state.authStep === "email") {
    continueFromEmail();
    return;
  }
  const formData = new FormData(authForm);
  const payload = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password")
  };
  try {
    const endpoint = state.authMode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const result = await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
    state.user = result.user;
    authForm.reset();
    setAuthStep("email");
    renderApp();
    await refreshDashboard();
  } catch (error) {
    showMessage(authMessage, error.message);
  }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST", body: "{}" });
  stopExternalTracking();
  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  state.user = null;
  state.tracks = [];
  state.currentTrack = null;
  albumArt.src = DEFAULT_ALBUM_ART;
  nowPlayingTitle.textContent = "Choose a song";
  nowPlayingArtist.textContent = "No listening session is active.";
  playerStatus.textContent = "Upload a local audio file or use a direct audio URL for in-app playback.";
  updateProgressUi();
  updatePlayerUi();
  renderApp();
});

trackForm.kind.forEach((input) => {
  input.addEventListener("change", () => {
    const kind = trackForm.kind.value;
    document.querySelector("#fileField").classList.toggle("hidden", kind !== "local");
    document.querySelector("#externalFields").classList.toggle("hidden", kind !== "external");
  });
});

trackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage(trackMessage, "");
  const formData = new FormData(trackForm);
  const kind = formData.get("kind");
  const payload = {
    kind,
    title: formData.get("title"),
    artist: formData.get("artist"),
    album: formData.get("album")
  };

  try {
    if (kind === "local") {
      const file = formData.get("audioFile");
      if (!file || !file.size) throw new Error("Choose an audio file.");
      payload.fileName = file.name;
      payload.mimeType = file.type;
      payload.dataBase64 = await fileToBase64(file);
    } else {
      payload.sourceType = formData.get("sourceType");
      payload.sourceUrl = formData.get("sourceUrl");
    }
    await api("/api/tracks", { method: "POST", body: JSON.stringify(payload) });
    trackForm.reset();
    document.querySelector("#fileField").classList.remove("hidden");
    document.querySelector("#externalFields").classList.add("hidden");
    showMessage(trackMessage, "Song saved.");
    await refreshDashboard();
  } catch (error) {
    showMessage(trackMessage, error.message);
  }
});

audioPlayer.addEventListener("timeupdate", async () => {
  updateProgressUi();
  const current = Math.floor(audioPlayer.currentTime || 0);
  const delta = current - state.lastAudioSeconds;
  if (delta >= 10) {
    state.lastAudioSeconds = current;
    await logListening(delta);
  }
});

audioPlayer.addEventListener("loadedmetadata", updateProgressUi);
audioPlayer.addEventListener("play", updatePlayerUi);
audioPlayer.addEventListener("pause", updatePlayerUi);

audioPlayer.addEventListener("ended", async () => {
  const current = Math.floor(audioPlayer.currentTime || 0);
  const delta = current - state.lastAudioSeconds;
  state.lastAudioSeconds = current;
  if (delta > 0) await logListening(delta);
  updatePlayerUi();
  if (!state.isRepeat) playRelativeTrack(1);
});

progressBar.addEventListener("input", () => {
  audioPlayer.currentTime = Number(progressBar.value || 0);
  updateProgressUi();
});

playPauseButton.addEventListener("click", () => {
  if (state.currentTrack?.kind === "external" && !isDirectAudioUrl(state.currentTrack.playableUrl)) {
    window.open(state.currentTrack.sourceUrl, "_blank", "noopener,noreferrer");
    playerStatus.textContent = "Opened the source in a new tab. Use Track listening if you want this session counted.";
    return;
  }
  if (!audioPlayer.src && state.tracks.length) {
    playTrack(state.tracks[0]);
    return;
  }
  if (audioPlayer.paused) {
    audioPlayer.play().catch(() => {});
  } else {
    audioPlayer.pause();
  }
});

shuffleButton.addEventListener("click", () => {
  state.isShuffle = !state.isShuffle;
  updatePlayerUi();
});

repeatButton.addEventListener("click", () => {
  state.isRepeat = !state.isRepeat;
  audioPlayer.loop = state.isRepeat;
  updatePlayerUi();
});

previousButton.addEventListener("click", () => playRelativeTrack(-1));
nextButton.addEventListener("click", () => playRelativeTrack(1));

albumArt.addEventListener("error", () => {
  albumArt.src = DEFAULT_ALBUM_ART;
});

document.querySelector("#startExternalButton").addEventListener("click", startExternalTracking);
document.querySelector("#stopExternalButton").addEventListener("click", stopExternalTracking);
document.querySelector("#refreshButton").addEventListener("click", refreshDashboard);

setAuthStep("email");
initDottedSurface();
updateProgressUi();
updatePlayerUi();
loadInitialState().catch((error) => showMessage(authMessage, error.message));
