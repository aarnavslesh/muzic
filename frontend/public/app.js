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
  loopMode: "off",
  playerOrder: [],
  playerDirection: null,
  authStep: "email",
  tempYouTubeEmbeds: new Map(),
  view: "home",
  playlists: [],
  favourites: [],
  searchQuery: ""
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
const playerCard = document.querySelector("#musicPlayerCard");
const playerDisc = document.querySelector("#playerDisc");
const playerDiscMask = document.querySelector("#albumArtWrap");
const playerScalesGrid = document.querySelector("#playerScalesGrid");
const playerTrackInfo = document.querySelector("#playerTrackInfo");
const playerBarFill = document.querySelector("#playerBarFill");
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
const albumHeroBackdrop = document.querySelector("#albumHeroBackdrop");
const albumHeroOverlay = document.querySelector("#albumHeroOverlay");
const albumHeroStreaks = document.querySelector("#albumHeroStreaks");
const subwayScene = document.querySelector(".subway-scene");
const albumHeroHint = document.querySelector("#albumHeroHint");
const albumHeroProgress = document.querySelector("#albumHeroProgress");
const albumHeroTitle = document.querySelector("#authHeadline");
const subwayDoorLeft = document.querySelector("#subwayDoorLeft");
const subwayDoorRight = document.querySelector("#subwayDoorRight");
const subwayGlow = document.querySelector("#subwayGlow");
const authContent = document.querySelector("#authContent");
const dock = document.querySelector("#appDock");
const topbarSearch = document.querySelector("#topbarSearch");
const librarySearch = document.querySelector("#librarySearch");
const playlistForm = document.querySelector("#playlistForm");
const playlistList = document.querySelector("#playlistList");
const playlistMessage = document.querySelector("#playlistMessage");
const refreshPlaylistsButton = document.querySelector("#refreshPlaylistsButton");
const favouritesList = document.querySelector("#favouritesList");
const profileFacts = document.querySelector("#profileFacts");
const profileLogoutButton = document.querySelector("#profileLogoutButton");

const DEFAULT_ALBUM_ART = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&auto=format&fit=crop&q=80";

// ── Hero: scroll-scrubbed intro on the login/signup page ───────────────────
// Inspired by the "scroll-locked video hero" component by Guglielmo
// Giannattasio (guglielmogiannattasio.it), adapted to plain JS: the hero opens
// on closed subway doors carrying the Welcome to Muzic headline, wheel/touch/
// arrow input drives one timeline that slides the doors apart and then flies
// the camera forward through the doorway onto the poster-collage wall, with
// the auth card revealed at the payoff.
const HERO_SCRUB_DISTANCE = 2800; // px of scroll input for the full sequence

function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
}

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

  // Camera flight: the doors part first, then the viewpoint pushes forward
  // through the doorway — the car scales up past the lens while the collage
  // wall behind it grows more slowly, because it is further from the camera.
  const doorT = clampUnit((progress - 0.05) / 0.42);
  const pushT = clampUnit((progress - 0.22) / 0.58);
  const flight = pushT * pushT * (3 - 2 * pushT);

  if (subwayDoorLeft) subwayDoorLeft.style.transform = `translate3d(${-doorT * 102}%, 0, 0)`;
  if (subwayDoorRight) subwayDoorRight.style.transform = `translate3d(${doorT * 102}%, 0, 0)`;
  if (subwayScene) subwayScene.style.transform = `scale(${1 + flight * 2.4})`;

  // Light from the platform ahead: flares while the doors part, flares again
  // as we near the wall, then clears once we are through the doorway.
  if (subwayGlow) {
    const glow = Math.min(1, Math.sin(Math.PI * doorT) * 0.8 + Math.sin(Math.PI * flight) * 0.5);
    subwayGlow.style.opacity = String(glow);
  }

  // The wall ahead stays soft while it is far away and sharpens as we arrive.
  if (albumHeroBackdrop) {
    albumHeroBackdrop.style.transform = `scale(${1 + flight * 0.3})`;
    const blur = (1 - flight) * 5;
    albumHeroBackdrop.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
  }
  if (albumHeroOverlay) albumHeroOverlay.style.opacity = String(1 - flight * 0.45);
  if (albumHeroStreaks) {
    albumHeroStreaks.style.opacity = String(Math.sin(Math.PI * flight) * 0.14);
    albumHeroStreaks.style.transform = `rotate(${flight * 120}deg) scale(${1 + flight * 0.5})`;
  }

  // Title: sits on the closed doors, blur-fades away as they part
  const titleT = 1 - Math.min(1, Math.max(0, (progress - 0.05) / 0.33));
  if (albumHeroTitle) {
    albumHeroTitle.style.opacity = String(titleT);
    albumHeroTitle.style.transform = `translateY(${(1 - titleT) * -24}px) scale(${0.96 + titleT * 0.04})`;
    albumHeroTitle.style.filter = `blur(${(1 - titleT) * 10}px)`;
  }

  if (albumHeroHint) albumHeroHint.style.opacity = progress > 0.001 ? "0" : "1";
  if (albumHeroProgress) albumHeroProgress.style.transform = `scaleX(${progress})`;

  // Payoff: the doors are clear by ~0.47 and the camera is through the
  // doorway by ~0.95, so the login/signup card rides in on the last stretch.
  const revealT = Math.min(1, Math.max(0, (progress - 0.7) / 0.24));
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
  if (!albumHero || !albumHeroBackdrop || !authContent) return;
  hero.reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  if (hero.reducedMotion) {
    // Static collage wall + the form immediately, no lock, no scrub.
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
    startPlayerLoop();
  } else {
    engageHeroLock();
    stopPlayerLoop();
  }
  if (state.user) {
    document.querySelector("#welcomeTitle").textContent = `${state.user.name}'s library`;
  }
}

async function loadInitialState() {
  const { user } = await api("/api/me");
  state.user = user;
  renderApp();
  if (state.user) {
    loadFavourites();
    await refreshDashboard();
  }
}

async function refreshDashboard() {
  const [tracksResult, statsResult, recommendationsResult] = await Promise.all([
    api("/api/tracks"),
    api("/api/stats"),
    api("/api/recommendations")
  ]);
  state.tracks = tracksResult.tracks;
  state.playerOrder = state.isShuffle ? playerShuffledIds() : state.tracks.map((track) => track.id);
  state.recommendations = recommendationsResult.recommendations || [];
  renderTracks();
  renderStats(statsResult);
  renderRecommendations();
  renderRecommendationEngine();
}

// ── Dock navigation ─────────────────────────────────────────────────────────
// The floating dock drives the signed-in app: four views (home, playlists,
// favourites, profile) plus two actions (search the library, add music).
const DOCK_VIEWS = {
  home: ["playerBand", "libraryGrid", "statsGrid", "enginePanel", "recommendationsPanel"],
  playlists: ["playlistsView"],
  favourites: ["favouritesView"],
  profile: ["profileView"]
};

const HEART_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;

function favouritesStorageKey() {
  return `muzic:favourites:${state.user ? state.user.id : "guest"}`;
}

function loadFavourites() {
  try {
    const raw = window.localStorage.getItem(favouritesStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    state.favourites = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    state.favourites = [];
  }
}

function saveFavourites() {
  try {
    window.localStorage.setItem(favouritesStorageKey(), JSON.stringify(state.favourites));
  } catch {
    // Storage can be blocked (private mode); favourites still work in memory.
  }
}

function isFavourite(trackId) {
  return state.favourites.includes(trackId);
}

function toggleFavourite(trackId) {
  if (isFavourite(trackId)) {
    state.favourites = state.favourites.filter((id) => id !== trackId);
  } else {
    state.favourites = [...state.favourites, trackId];
  }
  saveFavourites();
  renderTracks();
  renderFavourites();
}

function getVisibleTracks() {
  const query = state.searchQuery.trim().toLowerCase();
  if (!query) return state.tracks;
  return state.tracks.filter((track) => [track.title, track.artist, track.album]
    .some((value) => String(value || "").toLowerCase().includes(query)));
}

function buildTrackRow(track, { showRemove = true } = {}) {
  const item = document.createElement("article");
  item.className = "track-item";
  const favourite = isFavourite(track.id);
  item.innerHTML = `
    <div>
      <strong>${escapeHtml(track.title)}</strong>
      <span>${escapeHtml(track.artist)}${track.album ? ` · ${escapeHtml(track.album)}` : ""} · ${track.kind}</span>
    </div>
    <div class="track-actions">
      <button class="primary play-track-button" type="button">Play</button>
      <button class="ghost favourite-button ${favourite ? "is-favourite" : ""}" type="button" aria-pressed="${favourite}" aria-label="${favourite ? "Remove from favourites" : "Add to favourites"}">${HEART_ICON}</button>
      ${showRemove ? `<button class="ghost remove-track-button" type="button">Remove</button>` : ""}
    </div>
  `;
  item.querySelector(".play-track-button").addEventListener("click", () => playTrack(track));
  item.querySelector(".favourite-button").addEventListener("click", () => toggleFavourite(track.id));
  if (showRemove) {
    item.querySelector(".remove-track-button").addEventListener("click", () => removeTrack(track));
  }
  return item;
}

function renderTracks() {
  if (!state.tracks.length) {
    trackList.innerHTML = `<p class="message">No songs yet. Add a local audio file or an external music link.</p>`;
    return;
  }

  const visible = getVisibleTracks();
  if (!visible.length) {
    trackList.innerHTML = `<p class="message">Nothing matches “${escapeHtml(state.searchQuery.trim())}”.</p>`;
    return;
  }

  trackList.innerHTML = "";
  for (const track of visible) {
    trackList.appendChild(buildTrackRow(track));
  }
}

function renderFavourites() {
  if (!favouritesList) return;
  const tracks = state.tracks.filter((track) => isFavourite(track.id));
  if (!tracks.length) {
    favouritesList.innerHTML = `<p class="message">No favourites yet — tap the heart on any song in your library.</p>`;
    return;
  }
  favouritesList.innerHTML = "";
  for (const track of tracks) {
    favouritesList.appendChild(buildTrackRow(track, { showRemove: false }));
  }
}

function setDockActive(key) {
  if (!dock) return;
  dock.querySelectorAll(".dock-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.dock === key);
  });
}

function setDashboardView(view) {
  const target = DOCK_VIEWS[view] ? view : "home";
  state.view = target;
  const visible = new Set(DOCK_VIEWS[target]);
  for (const ids of Object.values(DOCK_VIEWS)) {
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) element.classList.toggle("hidden", !visible.has(id));
    }
  }
  setDockActive(target);

  if (target === "home") renderTracks();
  if (target === "favourites") renderFavourites();
  if (target === "profile") renderProfile();
  if (target === "playlists") loadPlaylists();
  if (state.user) window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderProfile() {
  if (!profileFacts || !state.user) return;
  const user = state.user;
  const joined = user.createdAt ? new Date(user.createdAt) : null;
  const joinedLabel = joined && !Number.isNaN(joined.getTime())
    ? joined.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "—";
  profileFacts.innerHTML = `
    <div><dt>Name</dt><dd>${escapeHtml(user.name)}</dd></div>
    <div><dt>Email</dt><dd>${escapeHtml(user.email)}</dd></div>
    <div><dt>Member since</dt><dd>${escapeHtml(joinedLabel)}</dd></div>
    <div><dt>Library</dt><dd>${state.tracks.length} song${state.tracks.length === 1 ? "" : "s"} · ${state.playlists.length} playlist${state.playlists.length === 1 ? "" : "s"}</dd></div>
  `;
}

async function loadPlaylists() {
  if (!playlistList) return;
  try {
    const { playlists } = await api("/api/playlists");
    state.playlists = playlists || [];
    renderPlaylists();
  } catch (error) {
    showMessage(playlistMessage, error.message);
  }
}

function renderPlaylists() {
  if (!playlistList) return;
  if (!state.playlists.length) {
    playlistList.innerHTML = `<p class="message">No playlists yet. Create one above, then add songs to it.</p>`;
    return;
  }

  playlistList.innerHTML = "";
  for (const playlist of state.playlists) {
    const card = document.createElement("article");
    card.className = "playlist-card";
    const available = state.tracks.filter((track) => !(playlist.trackIds || []).includes(track.id));
    const options = available
      .map((track) => `<option value="${escapeHtml(track.id)}">${escapeHtml(track.title)} — ${escapeHtml(track.artist)}</option>`)
      .join("");

    card.innerHTML = `
      <div class="playlist-card-head">
        <h4>${escapeHtml(playlist.name)}</h4>
        <div class="track-actions">
          <button class="ghost remove-playlist-button" type="button">Delete</button>
        </div>
      </div>
      <ul class="playlist-tracks">
        ${(playlist.tracks || []).map((track) => `
          <li class="playlist-track">
            <span>${escapeHtml(track.title)} — ${escapeHtml(track.artist)}</span>
            <button class="ghost remove-playlist-track-button" type="button" data-track-id="${escapeHtml(track.id)}">Remove</button>
          </li>
        `).join("") || `<li class="playlist-track"><span>No songs in this playlist yet.</span></li>`}
      </ul>
      ${available.length ? `
        <div class="playlist-add">
          <label class="hidden">Add a song</label>
          <select class="playlist-track-picker">${options}</select>
          <button class="primary add-to-playlist-button" type="button">Add</button>
        </div>
      ` : ""}
    `;

    card.querySelector(".remove-playlist-button").addEventListener("click", async () => {
      try {
        await api(`/api/playlists/${encodeURIComponent(playlist.id)}`, { method: "DELETE" });
        showMessage(playlistMessage, `Deleted “${playlist.name}”.`);
        await loadPlaylists();
      } catch (error) {
        showMessage(playlistMessage, error.message);
      }
    });

    const removeTrackButton = card.querySelector(".remove-playlist-track-button");
    if (removeTrackButton) {
      removeTrackButton.addEventListener("click", async () => {
        try {
          await api(`/api/playlists/${encodeURIComponent(playlist.id)}/tracks/${encodeURIComponent(removeTrackButton.dataset.trackId)}`, { method: "DELETE" });
          await loadPlaylists();
        } catch (error) {
          showMessage(playlistMessage, error.message);
        }
      });
    }

    const addButton = card.querySelector(".add-to-playlist-button");
    if (addButton) {
      addButton.addEventListener("click", async () => {
        const picker = card.querySelector(".playlist-track-picker");
        const trackId = picker ? picker.value : "";
        if (!trackId) return;
        try {
          await api(`/api/playlists/${encodeURIComponent(playlist.id)}/tracks`, {
            method: "POST",
            body: JSON.stringify({ trackId })
          });
          showMessage(playlistMessage, "Song added to the playlist.");
          await loadPlaylists();
        } catch (error) {
          showMessage(playlistMessage, error.message);
        }
      });
    }

    playlistList.appendChild(card);
  }
}

function openLibrarySearch() {
  if (state.view !== "home") setDashboardView("home");
  if (topbarSearch) topbarSearch.classList.remove("hidden");
  if (librarySearch) {
    librarySearch.focus();
    librarySearch.select();
  }
  setDockActive("search");
}

function focusAddMusic() {
  if (state.view !== "home") setDashboardView("home");
  const form = document.querySelector("#trackForm");
  const titleInput = form ? form.querySelector('input[name="title"]') : null;
  if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
  if (titleInput) window.setTimeout(() => titleInput.focus(), 320);
  setDockActive("add");
}

function handleDockAction(action) {
  if (action === "home") {
    setDashboardView("home");
    return;
  }
  if (action === "search") {
    openLibrarySearch();
    return;
  }
  if (action === "add") {
    focusAddMusic();
    return;
  }
  setDashboardView(action);
}

function initDock() {
  if (!dock) return;
  dock.addEventListener("click", (event) => {
    const button = event.target.closest(".dock-item");
    if (!button || !button.dataset.dock) return;
    handleDockAction(button.dataset.dock);
  });

  if (librarySearch) {
    librarySearch.addEventListener("input", () => {
      state.searchQuery = librarySearch.value;
      renderTracks();
    });
    librarySearch.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      librarySearch.value = "";
      state.searchQuery = "";
      renderTracks();
      librarySearch.blur();
    });
  }

  if (playlistForm) {
    playlistForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nameInput = playlistForm.querySelector('input[name="name"]');
      const name = nameInput ? nameInput.value.trim() : "";
      if (!name) return;
      try {
        await api("/api/playlists", { method: "POST", body: JSON.stringify({ name }) });
        nameInput.value = "";
        showMessage(playlistMessage, `Created “${name}”.`);
        await loadPlaylists();
      } catch (error) {
        showMessage(playlistMessage, error.message);
      }
    });
  }

  if (refreshPlaylistsButton) {
    refreshPlaylistsButton.addEventListener("click", () => loadPlaylists());
  }

  if (profileLogoutButton) {
    profileLogoutButton.addEventListener("click", () => document.querySelector("#logoutButton").click());
  }

  setDashboardView("home");
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
      playerResetCover();
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
  repeatButton.classList.toggle("is-active", state.loopMode !== "off");
  repeatButton.classList.toggle("mode-one", state.loopMode === "one");
  const loopLabel = state.loopMode === "off" ? "Repeat off" : state.loopMode === "all" ? "Repeat all" : "Repeat one";
  repeatButton.title = loopLabel;
  repeatButton.setAttribute("aria-label", loopLabel);
  shuffleButton.classList.toggle("is-active", state.isShuffle);
  shuffleButton.setAttribute("aria-pressed", state.isShuffle ? "true" : "false");
  playerCard?.classList.toggle("is-playing", isPlaying);
}

function updateProgressUi() {
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  const current = Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0;
  const percent = duration > 0 ? (current / duration) * 100 : 0;
  if (playerBarFill) playerBarFill.style.width = `${percent}%`;
  progressBar?.setAttribute("aria-valuenow", String(Math.round(percent)));
  progressBar?.setAttribute("aria-valuetext", `${formatClock(current)} of ${formatClock(duration)}`);
  currentTimeLabel.textContent = formatClock(current);
  durationLabel.textContent = formatClock(duration);
  const analysis = playerWidget.analysis.element;
  if (analysis && Math.abs((analysis.currentTime || 0) - current) > 1.5) {
    analysis.currentTime = current;
  }
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

/* ── Music player widget ────────────────────────────────────────────────
   A vanilla port of the "music-player-widget" component. The dashboard keeps
   ownership of playback (local uploads, direct audio URLs, external
   iframes); this layer adds the widget's presentation and controls:
   a spinning disc with layered cover transitions, the 10x10 "scales"
   equaliser, sliding track info, a seekable bar and shuffle / loop modes. */

const PLAYER_COLS = 10;
const PLAYER_ROWS = 10;
const PLAYER_BANDS = [[0, 1], [1, 3], [3, 6], [6, 10], [10, 16], [16, 24], [24, 36], [36, 52], [52, 74], [74, 100]];
const PLAYER_SPIN_MAX = 0.4375;
const PLAYER_BURST_MS = 620;
const PLAYER_PART_A_DUR = 1.5;
const PLAYER_PART_A_TO = 11;
const PLAYER_PART_A_STEP = 3 / (PLAYER_COLS - 1);
const PLAYER_PART_B_DUR = 1;
const PLAYER_SCALE_FROM = 0.133;
const PLAYER_SCALE_TO = 0.8;
const PLAYER_LAYER_MS = 760;

const playerWidget = {
  clock: 0,
  rotation: 0,
  velocity: 0,
  burst: { from: 0, start: 0, active: false, pending: false },
  coverId: 0,
  covers: [],
  zoomed: false,
  placeholder: null,
  raf: 0,
  lastFrame: 0,
  lastMixerTime: -1,
  columns: [],
  circles: [],
  reducedMotion: false,
  analysis: { ctx: null, analyser: null, data: null, element: null, connected: false }
};

const playerSineOut = (x) => Math.sin((x * Math.PI) / 2);
const playerSineIn = (x) => 1 - Math.cos((x * Math.PI) / 2);
const playerSineInOut = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
const playerLerp = (a, b, t) => a + (b - a) * t;

function playerIsPlaying() {
  return Boolean(state.externalTimer) || (!audioPlayer.paused && !audioPlayer.ended);
}

function playerColumnY(time, col) {
  const local = time - col * PLAYER_PART_A_STEP;
  const period = PLAYER_PART_A_DUR * 2;
  const cyc = ((local % period) + period) % period;
  if (cyc < PLAYER_PART_A_DUR) return PLAYER_PART_A_TO * playerSineInOut(cyc / PLAYER_PART_A_DUR);
  return PLAYER_PART_A_TO * playerSineInOut(1 - (cyc - PLAYER_PART_A_DUR) / PLAYER_PART_A_DUR);
}

function playerCircleTransform(time, col, row) {
  const frac = row / PLAYER_ROWS;
  const yFrom = playerLerp(77, -77, frac);
  const yTo = playerLerp(col, -col, frac);
  const local = time - col / PLAYER_COLS;
  const period = PLAYER_PART_B_DUR * 2;
  const cyc = ((local % period) + period) % period;
  const e = cyc < PLAYER_PART_B_DUR
    ? playerSineOut(cyc / PLAYER_PART_B_DUR)
    : playerSineIn(1 - (cyc - PLAYER_PART_B_DUR) / PLAYER_PART_B_DUR);
  return [playerLerp(yFrom, yTo, e), playerLerp(PLAYER_SCALE_FROM, PLAYER_SCALE_TO, e)];
}

function buildPlayerScales() {
  if (!playerScalesGrid) return;
  const namespace = "http://www.w3.org/2000/svg";
  const fragment = document.createDocumentFragment();
  for (let col = 0; col < PLAYER_COLS; col += 1) {
    const column = document.createElementNS(namespace, "g");
    column.setAttribute("style", `transform: translate(${col * 10}px, 0px)`);
    for (let row = 0; row < PLAYER_ROWS; row += 1) {
      const cell = document.createElementNS(namespace, "g");
      cell.setAttribute("mask", "url(#playerScalesMask)");
      cell.setAttribute("transform", `translate(0 ${row * 10})`);
      const circle = document.createElementNS(namespace, "circle");
      circle.setAttribute("cx", "5");
      circle.setAttribute("cy", "5");
      circle.setAttribute("r", "5");
      cell.appendChild(circle);
      column.appendChild(cell);
    }
    fragment.appendChild(column);
  }
  playerScalesGrid.appendChild(fragment);
  playerWidget.columns = [...playerScalesGrid.querySelectorAll(":scope > g")];
  playerWidget.circles = playerWidget.columns.map((column) => [...column.querySelectorAll("circle")]);
}

function playerSpectrum() {
  const analysis = playerWidget.analysis;
  if (!analysis.analyser || !analysis.data) return null;
  if (analysis.ctx?.state === "suspended") analysis.ctx.resume().catch(() => {});
  analysis.analyser.getByteFrequencyData(analysis.data);
  return analysis.data;
}

function playerTick(now) {
  playerWidget.raf = requestAnimationFrame(playerTick);
  const dt = playerWidget.lastFrame ? Math.min(64, now - playerWidget.lastFrame) : 16;
  playerWidget.lastFrame = now;
  const playing = playerIsPlaying();
  if (playing) playerWidget.clock += dt / 1000;

  // Visitors who ask for reduced motion get a still disc and a still
  // equaliser; the transport controls keep working exactly the same.
  if (playerWidget.reducedMotion) {
    playerWidget.velocity = 0;
    return;
  }

  // Disc: spins up while playing, coasts to a stop when paused and snaps
  // upright while the artwork is expanded.
  if (playing) {
    playerWidget.velocity += (PLAYER_SPIN_MAX - playerWidget.velocity) * 0.2;
  } else {
    playerWidget.velocity *= 0.96;
    if (playerWidget.velocity < 0.001) playerWidget.velocity = 0;
  }
  if (playerWidget.zoomed) {
    const target = Math.round(playerWidget.rotation / 360) * 360;
    const next = playerWidget.rotation + (target - playerWidget.rotation) * 0.08;
    playerWidget.rotation = Math.abs(target - next) < 0.1 ? target : next;
  } else {
    playerWidget.rotation += playerWidget.velocity;
  }
  const burst = playerWidget.burst;
  if (burst.pending) {
    burst.start = now;
    burst.pending = false;
    burst.active = true;
  }
  let burstRotation = 0;
  if (burst.active) {
    const t = (now - burst.start) / PLAYER_BURST_MS;
    if (t >= 1) burst.active = false;
    else burstRotation = burst.from * (1 - (1 - Math.pow(1 - t, 3)));
  }
  if (playerDisc) {
    playerDisc.style.transform = `scale(1.01) rotate(${playerWidget.rotation + burstRotation}deg)`;
  }

  // Scales: each column bobs and its dots breathe with the band energy.
  const data = playerSpectrum();
  const time = playerWidget.clock;
  if (!data && time === playerWidget.lastMixerTime) return;
  playerWidget.lastMixerTime = time;
  for (let col = 0; col < PLAYER_COLS; col += 1) {
    let energy = 1;
    if (data) {
      const [from, to] = PLAYER_BANDS[col];
      let sum = 0;
      for (let bin = from; bin < to; bin += 1) sum += data[bin] ?? 0;
      energy = Math.sqrt(sum / (to - from) / 255);
    }
    const bobGain = data ? 0.4 + energy : 1;
    const scaleGain = data ? 0.5 + energy : 1;
    const column = playerWidget.columns[col];
    if (column) column.style.transform = `translate(${col * 10}px, ${playerColumnY(time, col) * bobGain}px)`;
    const circles = playerWidget.circles[col] || [];
    for (let row = 0; row < PLAYER_ROWS; row += 1) {
      const circle = circles[row];
      if (!circle) continue;
      const [offsetY, scale] = playerCircleTransform(time, col, row);
      circle.style.transform = `translateY(${offsetY}px) scale(${scale * scaleGain})`;
    }
  }
}

function startPlayerLoop() {
  if (playerWidget.raf) return;
  playerWidget.lastFrame = 0;
  playerWidget.raf = requestAnimationFrame(playerTick);
}

function stopPlayerLoop() {
  if (!playerWidget.raf) return;
  cancelAnimationFrame(playerWidget.raf);
  playerWidget.raf = 0;
}

function playerEnsureContext() {
  const analysis = playerWidget.analysis;
  if (analysis.ctx) return analysis.ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    analysis.ctx = new Ctor();
  } catch {
    analysis.ctx = null;
  }
  return analysis.ctx;
}

/* The dashboard's own <audio> element is never routed through Web Audio: a
   cross-origin source would be silenced by the CORS taint. A dedicated,
   gain-muted clone feeds the analyser instead, so the mix is untouched. */
function playerCanAnalyse(src) {
  if (!src) return false;
  if (src.startsWith("data:")) return src.length <= 12_000_000;
  if (src.startsWith("blob:")) return true;
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function playerConnectAnalyser(src) {
  const analysis = playerWidget.analysis;
  if (analysis.connected || !playerCanAnalyse(src)) return;
  const ctx = playerEnsureContext();
  if (!ctx) return;
  try {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    const mute = ctx.createGain();
    mute.gain.value = 0;
    const element = document.createElement("audio");
    element.preload = "auto";
    const source = ctx.createMediaElementSource(element);
    source.connect(analyser);
    analyser.connect(mute);
    mute.connect(ctx.destination);
    analysis.analyser = analyser;
    analysis.data = new Uint8Array(analyser.frequencyBinCount);
    analysis.element = element;
    analysis.connected = true;
  } catch {
    /* analyser unavailable in this browser */
  }
}

function playerAttachAnalyser(src) {
  const analysis = playerWidget.analysis;
  if (!analysis.connected) {
    playerConnectAnalyser(src);
    if (!analysis.connected) return;
  }
  const element = analysis.element;
  if (!element) return;
  if (element.dataset.source !== src) {
    element.dataset.source = src;
    element.src = src;
    element.currentTime = 0;
  }
  element.play().catch(() => {});
}

function playerDetachAnalyser() {
  const element = playerWidget.analysis.element;
  if (!element) return;
  element.pause();
}

function playerTransitionSound(bassEnergy = 0.5) {
  const ctx = playerEnsureContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startFreq = 440 + bassEnergy * 440;
    const endFreq = startFreq * (2 / 3);
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(startFreq, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  } catch {
    /* Web Audio unavailable */
  }
}

function playerPushCover(track, direction) {
  if (!playerDisc) return;
  const art = track ? buildTrackArtDataUri(track) : DEFAULT_ALBUM_ART;
  const id = (playerWidget.coverId += 1);
  const image = document.createElement("img");
  image.className = "player-cover cover-enter";
  image.alt = track ? `${track.title} — ${track.artist}` : "Album art";
  image.draggable = false;
  image.addEventListener("error", () => { image.src = DEFAULT_ALBUM_ART; }, { once: true });
  image.src = art;
  playerDisc.appendChild(image);

  const previous = playerWidget.covers[playerWidget.covers.length - 1];
  if (previous) {
    previous.el.classList.remove("cover-enter");
    previous.el.classList.add("cover-exit");
  }
  playerWidget.covers.push({ id, el: image });
  if (previous) {
    window.setTimeout(() => {
      previous.el.remove();
      playerWidget.covers = playerWidget.covers.filter((cover) => cover.id !== previous.id);
    }, PLAYER_LAYER_MS);
  }
  if (direction) {
    playerWidget.burst.from = direction === "prev" ? 360 : -360;
    playerWidget.burst.pending = true;
  }
}

function playerResetCover() {
  playerWidget.covers.forEach((cover) => cover.el.remove());
  playerWidget.covers = [];
  playerPushCover(null, null);
}

function playerShowTrackInfo(title, artist, direction) {
  const offset = direction === "next" ? 14 : direction === "prev" ? -14 : 0;
  if (direction && playerTrackInfo) {
    const ghost = document.createElement("div");
    ghost.className = "ti-layer ti-abs ti-exit";
    ghost.style.setProperty("--dx", `${-offset}px`);
    const oldArtist = document.createElement("p");
    oldArtist.className = "player-artist";
    oldArtist.textContent = nowPlayingArtist.textContent;
    const oldTitle = document.createElement("h3");
    oldTitle.className = "player-title";
    oldTitle.textContent = nowPlayingTitle.textContent;
    ghost.append(oldArtist, oldTitle);
    playerTrackInfo.appendChild(ghost);
    window.setTimeout(() => ghost.remove(), PLAYER_LAYER_MS);
  }
  nowPlayingTitle.textContent = title;
  nowPlayingArtist.textContent = artist;
  if (direction) {
    nowPlayingTitle.classList.remove("ti-enter");
    nowPlayingArtist.classList.remove("ti-enter");
    void nowPlayingTitle.offsetWidth;
    nowPlayingTitle.style.setProperty("--dx", `${offset}px`);
    nowPlayingArtist.style.setProperty("--dx", `${offset}px`);
    nowPlayingTitle.classList.add("ti-enter");
    nowPlayingArtist.classList.add("ti-enter");
  }
}

function playerSetZoomed(zoomed) {
  if (zoomed === playerWidget.zoomed || !playerCard) return;
  playerWidget.zoomed = zoomed;
  if (zoomed) {
    // The card is moved to <body> so the fixed overlay is not trapped by the
    // transformed / backdrop-filtered ancestors of the player band.
    playerWidget.placeholder = document.createComment("music-player-card");
    playerCard.parentNode?.insertBefore(playerWidget.placeholder, playerCard);
    document.body.appendChild(playerCard);
  } else if (playerWidget.placeholder?.parentNode) {
    playerWidget.placeholder.parentNode.insertBefore(playerCard, playerWidget.placeholder);
    playerWidget.placeholder.remove();
    playerWidget.placeholder = null;
  }
  playerCard.classList.toggle("is-zoomed", zoomed);
  document.body.classList.toggle("player-zoomed", zoomed);
}

function playerShuffledIds() {
  const ids = state.tracks.map((track) => track.id);
  const currentId = state.currentTrack?.id;
  const first = ids.includes(currentId) ? currentId : ids[0];
  if (first === undefined) return ids;
  const rest = ids.filter((id) => id !== first);
  for (let index = rest.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [rest[index], rest[swap]] = [rest[swap], rest[index]];
  }
  return [first, ...rest];
}

function playerOrder() {
  if (!state.isShuffle) return state.tracks;
  const byId = new Map(state.tracks.map((track) => [track.id, track]));
  const order = state.playerOrder.map((id) => byId.get(id)).filter(Boolean);
  return order.length === state.tracks.length ? order : state.tracks;
}

function playerToggleShuffle() {
  state.isShuffle = !state.isShuffle;
  state.playerOrder = state.isShuffle ? playerShuffledIds() : state.tracks.map((track) => track.id);
  updatePlayerUi();
}

function playerCycleLoop() {
  state.loopMode = state.loopMode === "off" ? "all" : state.loopMode === "all" ? "one" : "off";
  audioPlayer.loop = state.loopMode === "one";
  updatePlayerUi();
}

function playerSeekBy(delta) {
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  if (!duration) return;
  audioPlayer.currentTime = Math.max(0, Math.min(duration, audioPlayer.currentTime + delta));
  updateProgressUi();
}

function playerSeekFromPointer(event) {
  const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  if (!duration) return;
  const rect = progressBar.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  audioPlayer.currentTime = ratio * duration;
  updateProgressUi();
}

function playerHandleKeydown(event) {
  if (dashboard?.classList.contains("hidden")) return;
  const target = event.target;
  const tag = target instanceof HTMLElement ? target.tagName : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (target instanceof HTMLElement && target.isContentEditable) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  switch (event.key) {
    case " ":
      if (tag === "BUTTON") return;
      event.preventDefault();
      playPauseButton.click();
      break;
    case "ArrowRight":
      event.preventDefault();
      if (event.shiftKey) nextButton.click();
      else playerSeekBy(5);
      break;
    case "ArrowLeft":
      event.preventDefault();
      if (event.shiftKey) previousButton.click();
      else playerSeekBy(-5);
      break;
    case "s":
    case "S":
      shuffleButton.click();
      break;
    case "l":
    case "L":
      repeatButton.click();
      break;
    default:
      break;
  }
}

function initPlayerWidget() {
  buildPlayerScales();
  playerPushCover(null, null);
  playerShowTrackInfo("Choose a song", "No listening session is active.", null);
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const applyMotionPreference = () => {
    playerWidget.reducedMotion = motionQuery.matches;
  };
  applyMotionPreference();
  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", applyMotionPreference);
  }
  playerDiscMask?.addEventListener("click", (event) => {
    event.stopPropagation();
    playerSetZoomed(!playerWidget.zoomed);
  });
  playerDiscMask?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      playerSetZoomed(!playerWidget.zoomed);
    }
  });
  playerCard?.addEventListener("click", (event) => {
    if (!event.target.closest(".player-disc-mask")) playerSetZoomed(false);
  });
  document.addEventListener("keydown", playerHandleKeydown);
}

function setAlbumArtForTrack(track, direction = null, artistLabel = null) {
  // Derived per-track art: always renders, no third-party image service,
  // deterministic for the same title/artist. (source.unsplash.com was retired.)
  playerPushCover(track, direction);
  const label = artistLabel ?? (track ? `${track.artist} · ${track.kind === "local" ? "local audio" : track.sourceType || "external"}` : "No listening session is active.");
  playerShowTrackInfo(track ? track.title : "Choose a song", label, direction);
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
  setAlbumArtForTrack(track, null, `${track.artist} · youtube (temporary)`);
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

function playTrack(track, direction = null) {
  state.playerDirection = direction;
  stopExternalTracking();
  state.currentTrack = track;
  state.currentTrackTemporary = false;
  state.lastAudioSeconds = 0;
  setAlbumArtForTrack(track, state.playerDirection, `${track.artist} · ${track.kind === "local" ? "local audio" : track.sourceType}`);
  updateProgressUi();

  if (track.kind === "local" || isDirectAudioUrl(track.playableUrl)) {
    externalPlayer.classList.add("hidden");
    externalFrame.removeAttribute("src");
    playerStatus.textContent = "Playing inside Muzic.";
    audioPlayer.src = track.playableUrl;
    audioPlayer.loop = state.loopMode === "one";
    playerAttachAnalyser(track.playableUrl);
    playerTransitionSound(0.5);
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
  if (direction < 0 && audioPlayer.currentTime > 3) {
    // Widget behaviour: "previous" a few seconds into a track restarts it
    // instead of jumping back to the track before it.
    audioPlayer.currentTime = 0;
    updateProgressUi();
    return;
  }
  if (!state.currentTrack) {
    playTrack(state.tracks[0], direction);
    return;
  }
  const order = playerOrder();
  const position = order.findIndex((track) => track.id === state.currentTrack.id);
  if (position === -1) {
    playTrack(order[0], direction);
    return;
  }
  const target = position + direction;
  if (target < 0 || target >= order.length) {
    if (state.loopMode === "all") {
      playTrack(direction > 0 ? order[0] : order[order.length - 1], direction);
      return;
    }
    if (state.loopMode === "one") {
      if (audioPlayer.src) {
        audioPlayer.currentTime = 0;
        audioPlayer.play().catch(() => {});
      }
      return;
    }
    // Loop off: the ends of the list are hard stops.
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    updateProgressUi();
    updatePlayerUi();
    return;
  }
  playTrack(order[target], direction);
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
    loadFavourites();
    setDashboardView("home");
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
  setAuthMode("login");
  state.tracks = [];
  state.recommendations = [];
  state.activeRecommendationId = null;
  state.playlists = [];
  state.favourites = [];
  state.searchQuery = "";
  if (librarySearch) librarySearch.value = "";
  if (topbarSearch) topbarSearch.classList.add("hidden");
  renderRecommendations();
  renderRecommendationEngine();
  state.currentTrack = null;
  state.currentTrackTemporary = false;
  externalFrame.removeAttribute("src");
  externalFrame.classList.remove("hidden");
  playerResetCover();
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
  if (state.loopMode === "one") {
    audioPlayer.currentTime = 0;
    audioPlayer.play().catch(() => {});
    return;
  }
  playRelativeTrack(1);
});

progressBar.addEventListener("click", (event) => {
  playerSeekFromPointer(event);
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
    playerAttachAnalyser(audioPlayer.currentSrc || state.currentTrack?.playableUrl);
    audioPlayer.play().catch(() => {});
  } else {
    audioPlayer.pause();
    playerDetachAnalyser();
  }
});

shuffleButton.addEventListener("click", () => {
  playerToggleShuffle();
});

repeatButton.addEventListener("click", () => {
  playerCycleLoop();
});

previousButton.addEventListener("click", () => playRelativeTrack(-1));
nextButton.addEventListener("click", () => playRelativeTrack(1));

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
initDock();
initPlayerWidget();
initDottedSurface();
startRecommendationEngine();
updateEngineRotationControl();
updateProgressUi();
updatePlayerUi();
loadInitialState().catch((error) => showMessage(authMessage, error.message));
