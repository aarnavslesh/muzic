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
const addToLibraryButton = document.querySelector("#addToLibraryButton");
const tempTrackBadge = document.querySelector("#tempTrackBadge");
const albumHero = document.querySelector("#albumHero");
const albumHeroFrames = document.querySelector("#albumHeroFrames");
const albumHeroHint = document.querySelector("#albumHeroHint");
const albumHeroProgress = document.querySelector("#albumHeroProgress");
const albumHeroTitle = document.querySelector("#authHeadline");
const authContent = document.querySelector("#authContent");

const DEFAULT_ALBUM_ART = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&auto=format&fit=crop&q=80";

// ── Album hero: scroll-scrubbed intro on the login/signup page ─────────────
// Port of the "scroll-locked video hero" component by Guglielmo Giannattasio
// (guglielmogiannattasio.it) to plain JS: the scrubbed video is replaced by a
// sequence of album photos. Wheel/touch/arrow input drives progress; the title
// blur-fades out early and the auth card is revealed at the tagline payoff.
const HERO_ALBUM_PHOTOS = [
  "photo-1470225620780-dba8ba36b745",
  "photo-1493225457124-a3eb161ffa5f",
  "photo-1445985543470-41fba5c3144a",
  "photo-1459749411175-04bf5292ceea",
  "photo-1483412033650-1015ddeb83d1",
  "photo-1487180144351-b8472da7d491",
  "photo-1511671782779-c97d3d27a1d4",
  "photo-1458560871784-56d23406c091",
  "photo-1507838153414-b4b713384a76",
  "photo-1514320291840-2e0a9bf2a9ae",
  "photo-1499415479124-43c32433a620",
  "photo-1524368535928-5b5e00ddc76b"
];
const HERO_SCRUB_DISTANCE = 2800; // px of scroll input for the full sequence

const hero = {
  target: 0,
  current: 0,
  rafId: 0,
  locked: false,
  lockedScrollY: 0,
  touchStartY: 0,
  active: false,
  reducedMotion: false,
  revealed: false
};

function buildAlbumHero() {
  if (!albumHeroFrames) return;
  const fragment = document.createDocumentFragment();
  HERO_ALBUM_PHOTOS.forEach((photoId, index) => {
    const img = document.createElement("img");
    img.src = `https://images.unsplash.com/${photoId}?w=1600&q=70&auto=format&fit=crop`;
    img.alt = "";
    img.decoding = "async";
    if (index > 2) img.loading = "lazy";
    fragment.appendChild(img);
  });
  albumHeroFrames.appendChild(fragment);
}

function engageHeroLock() {
  if (!hero.active || hero.locked) return;
  hero.locked = true;
  hero.lockedScrollY = window.scrollY;
  const bodyStyle = document.body.style;
  bodyStyle.position = "fixed";
  bodyStyle.top = `-${hero.lockedScrollY}px`;
  bodyStyle.left = "0";
  bodyStyle.right = "0";
  bodyStyle.width = "100%";
  bodyStyle.height = "100%";
  bodyStyle.overscrollBehavior = "none";
}

function releaseHeroLock() {
  if (!hero.locked) return;
  const restoreY = hero.lockedScrollY;
  hero.locked = false;
  const bodyStyle = document.body.style;
  bodyStyle.position = "";
  bodyStyle.top = "";
  bodyStyle.left = "";
  bodyStyle.right = "";
  bodyStyle.width = "";
  bodyStyle.height = "";
  bodyStyle.overscrollBehavior = "";
  window.scrollTo(0, restoreY);
}

function setHeroProgress(value) {
  hero.target = Math.min(1, Math.max(0, value));
}

function addHeroDelta(deltaY) {
  setHeroProgress(hero.target + deltaY / HERO_SCRUB_DISTANCE);
}

function jumpHeroToEnd() {
  // After logout, land straight on the revealed form instead of replaying intro.
  hero.target = 1;
  hero.current = 1;
}

function heroFrame() {
  hero.rafId = window.requestAnimationFrame(heroFrame);
  if (!hero.active || authView.classList.contains("hidden")) return;

  hero.current += (hero.target - hero.current) * 0.18;
  if (Math.abs(hero.target - hero.current) < 0.0004) hero.current = hero.target;
  const progress = hero.current;

  // Photo sequence crossfade + slow zoom
  const frames = albumHeroFrames ? albumHeroFrames.children : [];
  const position = progress * Math.max(1, frames.length - 1);
  for (let index = 0; index < frames.length; index += 1) {
    frames[index].style.opacity = String(Math.max(0, 1 - Math.abs(position - index)));
  }
  if (albumHeroFrames) albumHeroFrames.style.transform = `scale(${1 + progress * 0.06})`;

  // Title: blur-fades away over the first third of the scrub
  const titleT = 1 - Math.min(1, Math.max(0, progress / 0.35));
  if (albumHeroTitle) {
    albumHeroTitle.style.opacity = String(titleT);
    albumHeroTitle.style.transform = `translateY(${(1 - titleT) * -24}px) scale(${0.96 + titleT * 0.04})`;
    albumHeroTitle.style.filter = `blur(${(1 - titleT) * 10}px)`;
  }

  if (albumHeroHint) albumHeroHint.style.opacity = progress > 0.001 ? "0" : "1";
  if (albumHeroProgress) albumHeroProgress.style.transform = `scaleX(${progress})`;

  // Payoff: the auth card is revealed once the sequence is nearly complete
  const revealT = Math.min(1, Math.max(0, (progress - 0.82) / 0.18));
  if (authContent) {
    authContent.style.opacity = String(revealT);
    authContent.style.transform = `translateY(${(1 - revealT) * 20}px) scale(${0.97 + revealT * 0.03})`;
    authContent.style.filter = `blur(${(1 - revealT) * 8}px)`;
    const revealed = revealT > 0.5;
    if (revealed !== hero.revealed) {
      hero.revealed = revealed;
      authContent.toggleAttribute("inert", !revealed);
      authContent.classList.toggle("hero-revealed", revealed);
    }
  }
}

function heroInputAllowed() {
  return hero.active && !authView.classList.contains("hidden");
}

function initAlbumHero() {
  if (!albumHero || !albumHeroFrames || !authContent) return;
  hero.reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  buildAlbumHero();

  if (hero.reducedMotion) {
    // Static first photo + the form immediately, no lock, no scrub.
    return;
  }

  hero.active = true;
  authView.classList.add("hero-driven");
  // Initial state: form hidden AND unfocusable until the reveal.
  hero.revealed = false;
  authContent.setAttribute("inert", "");
  authContent.classList.remove("hero-revealed");

  window.addEventListener("wheel", (event) => {
    if (!heroInputAllowed()) return;
    event.preventDefault();
    addHeroDelta(event.deltaY);
  }, { passive: false });

  window.addEventListener("touchstart", (event) => {
    hero.touchStartY = event.touches[0]?.clientY ?? 0;
  }, { passive: true });

  window.addEventListener("touchmove", (event) => {
    if (!heroInputAllowed()) return;
    const y = event.touches[0]?.clientY ?? hero.touchStartY;
    addHeroDelta(hero.touchStartY - y);
    hero.touchStartY = y;
    event.preventDefault();
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    if (!heroInputAllowed()) return;
    const tagName = event.target?.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tagName)) return;
    if (["ArrowDown", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      addHeroDelta(180);
    } else if (["ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      addHeroDelta(-180);
    }
  });

  hero.rafId = window.requestAnimationFrame(heroFrame);
}

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
  const entry = state.tempYouTubeEmbeds.get(`${title}|${artist}`);
  return entry && entry.embedUrl ? entry : null;
}

function cacheYouTubeEmbed(title, artist, watchUrl, embedUrl) {
  state.tempYouTubeEmbeds.set(`${title}|${artist}`, {
    url: watchUrl,
    embedUrl,
    searchQuery: `${title} ${artist}`,
    cachedAt: Date.now()
  });
}

function isFrameableUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    if (parsed.hostname.endsWith("youtube.com") || parsed.hostname.endsWith("youtu.be")) {
      // YouTube only allows its own /embed/<id> player to be framed;
      // results, watch, channel and home pages all send x-frame-options.
      const parts = parsed.pathname.split("/").filter(Boolean);
      return parts[0] === "embed" && /^[A-Za-z0-9_-]{11}$/.test(parts[1] || "");
    }
    return true;
  } catch {
    return false;
  }
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
  if (isAuthenticated) {
    releaseHeroLock();
  } else {
    engageHeroLock();
  }
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

let engineGeometry = null;

// Cheap rotation pass: updates transforms only. The full rebuild in
// renderRecommendationEngine() used to run on every 90ms tick, replacing
// every node/connection element (and its listeners) ~11x per second.
function positionEngineNodes() {
  if (!engineGeometry) return;
  const { total, radius, items } = engineGeometry;
  for (const item of items) {
    const angle = ((item.index / total) * 360 + state.engineRotation) % 360;
    const radians = (angle * Math.PI) / 180;
    const x = Math.cos(radians) * radius;
    const y = Math.sin(radians) * radius;
    item.node.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    item.connection.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    item.connection.style.width = Math.max(60, radius + x / 2) + "px";
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
  engineGeometry = null;

  if (!hasEngineData) return;

  const activeId = state.activeRecommendationId || recommendations[0].track.id;
  const activeRecommendation = recommendations.find((recommendation) => recommendation.track.id === activeId) || recommendations[0];
  const relatedIds = getRelatedRecommendationIds(activeRecommendation);
  const total = recommendations.length;
  const radius = engineOrbit.offsetWidth < 620 ? 135 : 205;
  const items = [];

  recommendations.forEach((recommendation, index) => {
    const track = recommendation.track;
    const energy = getRecommendationEnergy(recommendation);
    const isActive = track.id === activeRecommendation.track.id;
    const isRelated = relatedIds.includes(track.id);

    const connection = document.createElement("span");
    connection.className = isActive || isRelated ? "engine-connection active" : "engine-connection";
    engineConnections.appendChild(connection);

    const node = document.createElement("button");
    node.type = "button";
    node.className = `engine-node${isActive ? " active" : ""}${isRelated ? " related" : ""}`;
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
    items.push({ node, connection, index });
  });

  engineGeometry = { total, radius, items };
  positionEngineNodes();

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
    positionEngineNodes();
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
  const isTemporary = Boolean(state.currentTrackTemporary && state.currentTrack);
  const canImportTemp = Boolean(isTemporary && state.currentTrack.sourceUrl && state.currentTrack.playableUrl);
  tempTrackBadge?.classList.toggle("hidden", !isTemporary);
  addToLibraryButton?.classList.toggle("hidden", !canImportTemp);
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

function buildTrackArtDataUri(track) {
  const label = `${track?.artist || ""} ${track?.title || ""}`.trim() || "Muzic";
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) | 0;
  }
  const seedValue = Math.abs(hash);
  const hueA = seedValue % 360;
  const hueB = (hueA + 35 + ((seedValue >> 3) % 70)) % 360;
  const initials = escapeHtml(String(track?.title || "M").trim().slice(0, 2).toUpperCase() || "M");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    `<stop offset="0" stop-color="hsl(${hueA}, 62%, 46%)"/>` +
    `<stop offset="1" stop-color="hsl(${hueB}, 68%, 28%)"/>` +
    '</linearGradient></defs>' +
    '<rect width="600" height="600" fill="url(#g)"/>' +
    '<circle cx="300" cy="300" r="205" fill="rgba(0,0,0,0.20)"/>' +
    '<circle cx="300" cy="300" r="54" fill="rgba(255,255,255,0.10)"/>' +
    '<circle cx="300" cy="300" r="15" fill="rgba(255,255,255,0.35)"/>' +
    `<text x="300" y="360" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="170" font-weight="700" fill="rgba(255,255,255,0.92)">${initials}</text>` +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function setAlbumArtForTrack(track) {
  // Derived per-track art: always renders, no third-party image service,
  // deterministic for the same title/artist. (source.unsplash.com was retired.)
  albumArt.src = buildTrackArtDataUri(track);
  albumArt.alt = `${track.title || "Track"} album art`;
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

  // Not found locally: resolve an actual playable YouTube video for this track.
  // A YouTube results/search page cannot be framed (x-frame-options: SAMEORIGIN),
  // so we never put one in the iframe.
  let resolved = getYouTubeCachedEmbed(track.title, track.artist);
  if (!resolved) {
    try {
      const searchResult = await api(`/api/youtube/search?${new URLSearchParams({ q: `${track.title} ${track.artist}` })}`);
      if (searchResult?.found && searchResult.watchUrl && searchResult.embedUrl) {
        resolved = { url: searchResult.watchUrl, embedUrl: searchResult.embedUrl };
        cacheYouTubeEmbed(track.title, track.artist, resolved.url, resolved.embedUrl);
      }
    } catch (error) {
      console.error("YouTube lookup failed:", error);
    }
  }

  const searchUrl = constructYouTubeSearchUrl(track.title, track.artist);

  // Create temporary track object
  const tempTrack = {
    ...track,
    kind: "external",
    sourceType: "youtube",
    sourceUrl: resolved ? resolved.url : searchUrl,
    playableUrl: resolved ? resolved.embedUrl : "",
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
  openExternalButton.href = resolved ? resolved.url : searchUrl;

  if (resolved) {
    externalFrame.classList.remove("hidden");
    externalFrame.src = resolved.embedUrl;
    playerStatus.textContent = "Temporary YouTube preview. Click 'Add to Library' to save this song permanently.";
  } else {
    // No playable video found: show a working path instead of a dead iframe.
    externalFrame.removeAttribute("src");
    externalFrame.classList.add("hidden");
    playerStatus.textContent = "Could not find a playable video for this song inside Muzic. Use 'Open source' to listen on YouTube, then add the song from Add music.";
  }
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
  openExternalButton.href = track.sourceUrl;
  const embedUrl = buildEmbedUrl(track);
  if (embedUrl && isFrameableUrl(embedUrl)) {
    externalFrame.classList.remove("hidden");
    externalFrame.src = embedUrl;
    playerStatus.textContent = "This source is hosted externally. If the embed says unavailable, open the source to play it and use Track listening for stats.";
  } else {
    // The link is a search/browse page that refuses to be framed.
    externalFrame.removeAttribute("src");
    externalFrame.classList.add("hidden");
    playerStatus.textContent = "This link cannot play inside Muzic. Use 'Open source' to listen in a new tab and 'Track listening' to count the session.";
  }
}

function buildEmbedUrl(track) {
  try {
    const url = new URL(track.sourceUrl);
    const isVideoId = (value) => /^[A-Za-z0-9_-]{11}$/.test(value || "");
    if (url.hostname.includes("youtu.be")) {
      const videoId = url.pathname.slice(1);
      return isVideoId(videoId) ? `https://www.youtube.com/embed/${videoId}` : track.sourceUrl;
    }
    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v");
      if (isVideoId(videoId)) return `https://www.youtube.com/embed/${videoId}`;
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0]) && isVideoId(parts[1])) {
        return `https://www.youtube.com/embed/${parts[1]}`;
      }
      // Not a video link (search page, channel, playlist...): keep the original
      // URL so isFrameableUrl() can send the user down the 'Open source' path.
      return track.sourceUrl;
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

document.querySelector(".provider-button")?.addEventListener("click", () => {
  showMessage(authMessage, "Google sign-in is not configured for Muzic yet. Continue with your email instead.");
});

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
  state.currentTrackTemporary = false;
  externalFrame.removeAttribute("src");
  externalFrame.classList.remove("hidden");
  albumArt.src = DEFAULT_ALBUM_ART;
  nowPlayingTitle.textContent = "Choose a song";
  nowPlayingArtist.textContent = "No listening session is active.";
  playerStatus.textContent = "Upload a local audio file or use a direct audio URL for in-app playback.";
  updateProgressUi();
  updatePlayerUi();
  jumpHeroToEnd();
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

addToLibraryButton?.addEventListener("click", async () => {
  if (!state.currentTrackTemporary || !state.currentTrack) return;
  const temp = state.currentTrack;
  addToLibraryButton.disabled = true;
  addToLibraryButton.textContent = "Adding...";
  try {
    const result = await api("/api/tracks", {
      method: "POST",
      body: JSON.stringify({
        kind: "external",
        sourceType: temp.sourceType || "youtube",
        title: temp.title,
        artist: temp.artist,
        album: temp.album,
        sourceUrl: temp.sourceUrl
      })
    });
    state.currentTrack = { ...result.track, isTemporary: false };
    state.currentTrackTemporary = false;
    openExternalButton.href = result.track.sourceUrl;
    playerStatus.textContent = "Added to your library. This song is saved permanently now.";
    await refreshDashboard();
    updatePlayerUi();
  } catch (error) {
    playerStatus.textContent = `Could not add this song: ${error.message}`;
  } finally {
    addToLibraryButton.disabled = false;
    addToLibraryButton.textContent = "Add to Library";
  }
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
initAlbumHero();
initDottedSurface();
startRecommendationEngine();
updateEngineRotationControl();
updateProgressUi();
updatePlayerUi();
loadInitialState().catch((error) => showMessage(authMessage, error.message));
