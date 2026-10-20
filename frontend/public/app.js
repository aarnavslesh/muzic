const state = {
  authMode: "login",
  user: null,
  tracks: [],
  recommendations: [],
  activeRecommendationId: null,
  engineRotation: 0,
  engineAutoRotate: true,
  engineTimer: null,
  currentTrack: null,
  currentTrackTemporary: false,
  lastAudioSeconds: 0,
  externalTimer: null,
  externalSeconds: 0,
  isShuffle: false,
  isRepeat: false,
  authStep: "email",
  tempYouTubeEmbeds: new Map()
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
const saveSongButton = document.querySelector("#saveSongButton");
const trackMessage = document.querySelector("#trackMessage");
const trackList = document.querySelector("#trackList");
const recommendationList = document.querySelector("#recommendationList");
const engineOrbit = document.querySelector("#engineOrbit");
const engineNodes = document.querySelector("#engineNodes");
const engineConnections = document.querySelector("#engineConnections");
const engineEmpty = document.querySelector("#engineEmpty");
const engineRotateButton = document.querySelector("#engineRotateButton");
const engineResetButton = document.querySelector("#engineResetButton");
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

  const contentType = response.headers.get("content-type") || "";
  const bodyText = await response.text();
  let payload = {};

  if (bodyText && contentType.includes("application/json")) {
    try {
      payload = JSON.parse(bodyText);
    } catch {
      throw new Error("The server returned broken JSON. Restart Muzic and try again.");
    }
  } else if (bodyText) {
    const looksLikeHtml = bodyText.trim().startsWith("<!doctype") || bodyText.trim().startsWith("<html");
    if (looksLikeHtml) {
      throw new Error("The backend API is not responding. Stop the current server and restart from the Muzic folder.");
    }
    throw new Error(bodyText.slice(0, 160));
  }

  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

async function searchLocalMachine(title, artist) {
  try {
    const result = await api(`/api/search-local?${new URLSearchParams({ title, artist })}`);
    return result;
  } catch (error) {
    console.error("Local search failed:", error);
    return { found: false, inLibrary: false };
  }
}

function constructYouTubeSearchUrl(title, artist) {
  const query = `${title} ${artist}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function getYouTubeCachedEmbed(title, artist) {
  const key = `${title}|${artist}`;
  return state.tempYouTubeEmbeds.get(key);
}

function cacheYouTubeEmbed(title, artist, embedUrl) {
  const key = `${title}|${artist}`;
  state.tempYouTubeEmbeds.set(key, {
    url: embedUrl,
    searchQuery: `${title} ${artist}`,
    cachedAt: Date.now()
  });
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
  const [tracksResult, statsResult, recommendationsResult] = await Promise.all([
    api("/api/tracks"),
    api("/api/stats"),
    api("/api/recommendations")
  ]);
  state.tracks = tracksResult.tracks;
  state.recommendations = recommendationsResult.recommendations || [];
  renderTracks();
  renderStats(statsResult);
  renderRecommendations();
  renderRecommendationEngine();
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

function getRecommendationEnergy(recommendation) {
  const score = Math.max(0, Number(recommendation.score) || 0);
  if (!score) return 28;
  return Math.max(18, Math.min(100, Math.round(30 + Math.log10(score + 1) * 32)));
}

function getRecommendationStatus(recommendation) {
  const energy = getRecommendationEnergy(recommendation);
  if (energy >= 72) return "locked-in";
  if (energy >= 45) return "learning";
  return "exploring";
}

function getRelatedRecommendationIds(recommendation) {
  const track = recommendation.track;
  return state.recommendations
    .filter((candidate) => candidate.track.id !== track.id)
    .filter((candidate) => candidate.track.artist === track.artist || candidate.track.kind === track.kind)
    .slice(0, 3)
    .map((candidate) => candidate.track.id);
}

function renderRecommendations() {
  if (!recommendationList) return;

  if (!state.recommendations.length) {
    recommendationList.innerHTML = `<p class="message">No recommendations yet. Listen to a few songs or add more music so Muzic can learn your taste.</p>`;
    return;
  }

  recommendationList.innerHTML = "";
  for (const recommendation of state.recommendations) {
    const track = recommendation.track;
    const item = document.createElement("article");
    item.className = "track-item recommendation-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(track.title)}</strong>
        <span>${escapeHtml(track.artist)}${track.album ? ` · ${escapeHtml(track.album)}` : ""} · ${track.kind}</span>
        <p class="recommendation-reason">${escapeHtml(recommendation.reason || "Recommended from your listening data")}</p>
      </div>
      <div class="track-actions">
        <button class="primary play-recommendation-button" type="button">Play</button>
      </div>
    `;
    item.querySelector(".play-recommendation-button").addEventListener("click", () => playRecommendation(recommendation));
    recommendationList.appendChild(item);
  }
}

function renderRecommendationEngine() {
  if (!engineOrbit || !engineNodes || !engineConnections || !engineEmpty) return;

  const recommendations = state.recommendations.length
    ? state.recommendations.slice(0, 8)
    : state.tracks.slice(0, 8).map((track, index) => ({
        track,
        score: Math.max(1, state.tracks.length - index),
        reason: "Seed signal from your library. Listen more to unlock stronger recommendations."
      }));
  const hasEngineData = recommendations.length > 0;
  engineOrbit.classList.toggle("has-engine-data", hasEngineData);
  engineOrbit.classList.toggle("is-seeding", !state.recommendations.length && hasEngineData);
  engineEmpty.classList.toggle("hidden", hasEngineData);
  engineNodes.innerHTML = "";
  engineConnections.innerHTML = "";

  if (!hasEngineData) return;

  const activeId = state.activeRecommendationId || recommendations[0].track.id;
  const activeRecommendation = recommendations.find((recommendation) => recommendation.track.id === activeId) || recommendations[0];
  const relatedIds = getRelatedRecommendationIds(activeRecommendation);
  const total = recommendations.length;
  const radius = engineOrbit.offsetWidth < 620 ? 135 : 205;

  recommendations.forEach((recommendation, index) => {
    const track = recommendation.track;
    const angle = ((index / total) * 360 + state.engineRotation) % 360;
    const radians = (angle * Math.PI) / 180;
    const x = Math.cos(radians) * radius;
    const y = Math.sin(radians) * radius;
    const energy = getRecommendationEnergy(recommendation);
    const isActive = track.id === activeRecommendation.track.id;
    const isRelated = relatedIds.includes(track.id);

    const connection = document.createElement("span");
    connection.className = isActive || isRelated ? "engine-connection active" : "engine-connection";
    connection.style.width = Math.max(60, radius + x / 2) + "px";
    connection.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    engineConnections.appendChild(connection);

    const node = document.createElement("button");
    node.type = "button";
    node.className = `engine-node${isActive ? " active" : ""}${isRelated ? " related" : ""}`;
    node.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    node.style.setProperty("--energy", String(energy));
    node.innerHTML = `
      <span class="engine-node-glow"></span>
      <span class="engine-node-icon">${escapeHtml(track.title.slice(0, 1).toUpperCase() || "M")}</span>
      <span class="engine-node-label">${escapeHtml(track.title)}</span>
    `;
    node.addEventListener("click", () => {
      state.activeRecommendationId = track.id;
      state.engineAutoRotate = false;
      updateEngineRotationControl();
      renderRecommendationEngine();
    });
    engineNodes.appendChild(node);
  });

  const detail = document.createElement("article");
  detail.className = "engine-detail";
  detail.innerHTML = `
    <div class="engine-detail-topline">
      <span class="engine-badge">${escapeHtml(getRecommendationStatus(activeRecommendation))}</span>
      <span class="engine-score">${getRecommendationEnergy(activeRecommendation)}% signal</span>
    </div>
    <h4>${escapeHtml(activeRecommendation.track.title)}</h4>
    <p>${escapeHtml(activeRecommendation.track.artist)} · ${escapeHtml(activeRecommendation.track.kind)}</p>
    <p class="engine-detail-reason">${escapeHtml(activeRecommendation.reason || "Recommended from your listening data")}</p>
    <div class="engine-energy-bar"><span style="width: ${getRecommendationEnergy(activeRecommendation)}%"></span></div>
    <div class="engine-detail-actions">
      <button class="primary engine-play-button" type="button">Play</button>
      <button class="ghost engine-focus-button" type="button">Focus links</button>
    </div>
  `;
  detail.querySelector(".engine-play-button").addEventListener("click", () => playRecommendation(activeRecommendation));
  detail.querySelector(".engine-focus-button").addEventListener("click", () => {
    state.engineRotation = 270 - (recommendations.findIndex((item) => item.track.id === activeRecommendation.track.id) / total) * 360;
    renderRecommendationEngine();
  });
  engineNodes.appendChild(detail);
}

function updateEngineRotationControl() {
  if (!engineRotateButton) return;
  engineRotateButton.textContent = state.engineAutoRotate ? "Pause orbit" : "Resume orbit";
}

function startRecommendationEngine() {
  if (state.engineTimer) return;
  state.engineTimer = window.setInterval(() => {
    if (!state.engineAutoRotate || (!state.recommendations.length && !state.tracks.length)) return;
    state.engineRotation = (state.engineRotation + 0.6) % 360;
    renderRecommendationEngine();
  }, 90);
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

async function playRecommendation(recommendation) {
  const track = recommendation.track;

  // Try to search locally first
  const searchResult = await searchLocalMachine(track.title, track.artist);

  if (searchResult.found && searchResult.inLibrary) {
    // Found in library, play it as a normal track
    const libraryTrack = state.tracks.find(t => t.id === searchResult.track.id);
    if (libraryTrack) {
      state.currentTrackTemporary = false;
      playTrack(libraryTrack);
      return;
    }
  }

  if (searchResult.found && !searchResult.inLibrary) {
    // Found on system, but we can't play it directly from file system
    // Fall through to YouTube search
  }

  // Not found locally, create temporary YouTube embed
  const cacheKey = `${track.title}|${track.artist}`;
  let cachedEmbed = getYouTubeCachedEmbed(track.title, track.artist);

  if (!cachedEmbed) {
    const youtubeSearchUrl = constructYouTubeSearchUrl(track.title, track.artist);
    const embedId = "temp_yt_" + Math.random().toString(36).slice(2, 9);
    const embedUrl = youtubeSearchUrl;
    cachedEmbed = { url: embedUrl, searchQuery: `${track.title} ${track.artist}` };
    cacheYouTubeEmbed(track.title, track.artist, embedUrl);
  }

  // Create temporary track object
  const tempTrack = {
    ...track,
    kind: "external",
    sourceType: "youtube",
    sourceUrl: cachedEmbed.url,
    playableUrl: cachedEmbed.url,
    isTemporary: true
  };

  state.currentTrack = tempTrack;
  state.currentTrackTemporary = true;
  state.lastAudioSeconds = 0;

  stopExternalTracking();
  nowPlayingTitle.textContent = track.title;
  nowPlayingArtist.textContent = `${track.artist} · youtube (temporary)`;
  setAlbumArtForTrack(track);
  updateProgressUi();

  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  updateProgressUi();
  updatePlayerUi();
  externalPlayer.classList.remove("hidden");
  externalFrame.src = cachedEmbed.url;
  openExternalButton.href = cachedEmbed.url;
  playerStatus.textContent = "This is a temporary YouTube embed. Click 'Add to Library' to import this song permanently.";
  updatePlayerUi();
}

function playTrack(track) {
  stopExternalTracking();
  state.currentTrack = track;
  state.currentTrackTemporary = false;
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
    if (url.hostname.includes("spotify.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const typeIndex = parts.findIndex((part) => ["track", "playlist"].includes(part));
      if (typeIndex !== -1 && parts[typeIndex + 1]) {
        return `https://open.spotify.com/embed/${parts[typeIndex]}/${parts[typeIndex + 1]}`;
      }
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
  state.recommendations = [];
  state.activeRecommendationId = null;
  renderRecommendations();
  renderRecommendationEngine();
  state.currentTrack = null;
  albumArt.src = DEFAULT_ALBUM_ART;
  nowPlayingTitle.textContent = "Choose a song";
  nowPlayingArtist.textContent = "No listening session is active.";
  playerStatus.textContent = "Upload a local audio file or use a direct audio URL for in-app playback.";
  updateProgressUi();
  updatePlayerUi();
  renderApp();
});

function updateTrackFormMode() {
  const kind = trackForm.kind.value;
  const sourceType = trackForm.sourceType?.value;
  const isLocal = kind === "local";
  const isSpotify = kind === "external" && sourceType === "spotify";

  document.querySelector("#fileField").classList.toggle("hidden", !isLocal);
  document.querySelector("#externalFields").classList.toggle("hidden", kind !== "external");
  trackForm.title.required = isLocal || (kind === "external" && !isSpotify);
  trackForm.artist.required = isLocal || (kind === "external" && !isSpotify);
  if (saveSongButton) saveSongButton.textContent = isSpotify ? "Import from Spotify" : "Save song";
}

trackForm.kind.forEach((input) => {
  input.addEventListener("change", updateTrackFormMode);
});

trackForm.sourceType?.addEventListener("change", updateTrackFormMode);

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
      if (!payload.title || !payload.artist) throw new Error("Title and artist are required.");
      const file = formData.get("audioFile");
      if (!file || !file.size) throw new Error("Choose an audio file.");
      payload.fileName = file.name;
      payload.mimeType = file.type;
      payload.dataBase64 = await fileToBase64(file);
      await api("/api/tracks", { method: "POST", body: JSON.stringify(payload) });
      showMessage(trackMessage, "Song saved.");
    } else {
      payload.sourceType = formData.get("sourceType");
      payload.sourceUrl = formData.get("sourceUrl");
      if (payload.sourceType === "spotify") {
        const result = await api("/api/spotify/import", { method: "POST", body: JSON.stringify(payload) });
        const skipped = result.skippedCount ? ` ${result.skippedCount} duplicate(s) skipped.` : "";
        const label = result.source?.type === "playlist" ? "playlist" : "track";
        showMessage(trackMessage, `Imported ${result.imported.length} Spotify ${label} item(s).${skipped}`);
      } else {
        if (!payload.title || !payload.artist) throw new Error("Title and artist are required.");
        await api("/api/tracks", { method: "POST", body: JSON.stringify(payload) });
        showMessage(trackMessage, "Song saved.");
      }
    }
    trackForm.reset();
    document.querySelector("#fileField").classList.remove("hidden");
    document.querySelector("#externalFields").classList.add("hidden");
    updateTrackFormMode();
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
document.querySelector("#refreshRecommendationsButton").addEventListener("click", refreshDashboard);
engineRotateButton?.addEventListener("click", () => {
  state.engineAutoRotate = !state.engineAutoRotate;
  updateEngineRotationControl();
});
engineResetButton?.addEventListener("click", () => {
  state.activeRecommendationId = null;
  state.engineRotation = 0;
  state.engineAutoRotate = true;
  updateEngineRotationControl();
  renderRecommendationEngine();
});
window.addEventListener("resize", renderRecommendationEngine);

setAuthStep("email");
updateTrackFormMode();
initDottedSurface();
startRecommendationEngine();
updateEngineRotationControl();
updateProgressUi();
updatePlayerUi();
loadInitialState().catch((error) => showMessage(authMessage, error.message));
