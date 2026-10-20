import AVFoundation
import AppKit
import SwiftUI
import UniformTypeIdentifiers
import WebKit

@main
struct MuzicSwiftUIApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = MuzicModel()

    var body: some Scene {
        WindowGroup("Muzic") {
            RootView()
                .environmentObject(model)
                .frame(minWidth: 1120, minHeight: 760)
                .task { await model.loadSession() }
        }
        .windowStyle(.hiddenTitleBar)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }
}

struct User: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let email: String
    let createdAt: String
}

struct Track: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let artist: String
    let album: String?
    let kind: String
    let sourceType: String
    let sourceUrl: String?
    let playableUrl: String?
    let createdBy: String
    let createdAt: String

    var subtitle: String {
        [artist, album, kind.capitalized]
            .compactMap { value in
                let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                return trimmed.isEmpty ? nil : trimmed
            }
            .joined(separator: " • ")
    }

    var isEmbeddedExternal: Bool {
        kind == "external" && !isDirectAudioUrl
    }

    var isDirectAudioUrl: Bool {
        guard let playableUrl else { return false }
        return playableUrl.range(of: #"\.(mp3|wav|ogg|m4a|flac)(\?.*)?$"#, options: .regularExpression) != nil
    }
}

struct ArtistStat: Codable, Identifiable {
    var id: String { artist }
    let artist: String
    let secondsPlayed: Int
    let plays: Int
}

struct SimilarUser: Codable, Identifiable {
    var id: String { user.id }
    let user: User
    let score: Double
}

struct StatsPayload: Codable {
    let totalSeconds: Int
    let totalFormatted: String
    let mostListenedArtists: [ArtistStat]
    let similarUsers: [SimilarUser]
}

struct Recommendation: Codable, Identifiable {
    var id: String { track.id }
    let track: Track
    let score: Double
    let reason: String
}

struct ApiError: Codable {
    let error: String
}

struct UploadedAudio {
    let fileName: String
    let mimeType: String
    let dataBase64: String
}

struct LocalizedMessage: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

struct EmptyResponse: Codable {}
struct SessionResponse: Codable { let user: User? }
struct AuthResponse: Codable { let user: User }
struct TracksResponse: Codable { let tracks: [Track] }
struct RecommendationsResponse: Codable { let recommendations: [Recommendation] }
struct OkResponse: Codable { let ok: Bool }
struct TracksCreatedResponse: Codable { let track: Track }
struct SpotifyImportResponse: Codable {
    let imported: [Track]
    let skippedCount: Int
}

struct AuthRequest: Codable {
    let name: String?
    let email: String
    let password: String
}

struct TrackRequest: Codable {
    let kind: String
    let title: String
    let artist: String
    let album: String
    let sourceType: String?
    let sourceUrl: String?
    let fileName: String?
    let mimeType: String?
    let dataBase64: String?
}

struct ListenRequest: Codable {
    let trackId: String
    let secondsPlayed: Int
}

actor MuzicAPI {
    private let baseURL = URL(string: "http://localhost:3000")!
    private let session: URLSession
    static let shared = MuzicAPI()
    private var backendProcess: Process?

    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.httpCookieStorage = .shared
        session = URLSession(configuration: config)
    }

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await ensureBackendReady()
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await send(request)
    }

    func post<T: Decodable, Body: Encodable>(_ path: String, body: Body) async throws -> T {
        try await ensureBackendReady()
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await send(request)
    }

    func delete<T: Decodable>(_ path: String) async throws -> T {
        try await ensureBackendReady()
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await send(request)
    }

    private func ensureBackendReady() async throws {
        if await canReachBackend() { return }
        try startBackendIfPossible()

        for _ in 0..<16 {
            try? await Task.sleep(for: .milliseconds(250))
            if await canReachBackend() { return }
        }

        throw LocalizedMessage("Muzic backend is not running. Start it with `npm start` from the project folder, then try again.")
    }

    private func canReachBackend() async -> Bool {
        var request = URLRequest(url: baseURL.appending(path: "/api/me"))
        request.httpMethod = "GET"
        request.timeoutInterval = 1.2
        do {
            let (_, response) = try await session.data(for: request)
            return (response as? HTTPURLResponse) != nil
        } catch {
            return false
        }
    }

    private func startBackendIfPossible() throws {
        if backendProcess?.isRunning == true { return }
        guard let repoRoot = findRepoRoot() else { return }

        let process = Process()
        process.currentDirectoryURL = repoRoot
        if let npm = findExecutable(named: "npm") {
            process.executableURL = npm
            process.arguments = ["start"]
        } else {
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = ["npm", "start"]
        }
        process.standardOutput = Pipe()
        process.standardError = Pipe()
        try process.run()
        backendProcess = process
    }

    private func findExecutable(named name: String) -> URL? {
        let paths = [
            "/opt/homebrew/bin/\(name)",
            "/usr/local/bin/\(name)",
            "/usr/bin/\(name)",
            "/bin/\(name)"
        ]
        return paths.map { URL(fileURLWithPath: $0) }.first { FileManager.default.isExecutableFile(atPath: $0.path) }
    }

    private func findRepoRoot() -> URL? {
        var candidates: [URL] = []
        candidates.append(URL(fileURLWithPath: FileManager.default.currentDirectoryPath))
        if let executable = Bundle.main.executableURL {
            var cursor = executable.deletingLastPathComponent()
            for _ in 0..<8 {
                candidates.append(cursor)
                cursor.deleteLastPathComponent()
            }
        }

        for candidate in candidates {
            var cursor = candidate
            for _ in 0..<8 {
                if FileManager.default.fileExists(atPath: cursor.appending(path: "server.js").path) {
                    return cursor
                }
                cursor.deleteLastPathComponent()
            }
        }
        return nil
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        if !(200..<300).contains(http.statusCode) {
            if let apiError = try? JSONDecoder().decode(ApiError.self, from: data) {
                throw LocalizedMessage(apiError.error)
            }
            throw LocalizedMessage("Server returned \(http.statusCode).")
        }

        if data.isEmpty, T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

@MainActor
final class MuzicModel: ObservableObject {
    @Published var user: User?
    @Published var tracks: [Track] = []
    @Published var stats = StatsPayload(totalSeconds: 0, totalFormatted: "0s", mostListenedArtists: [], similarUsers: [])
    @Published var recommendations: [Recommendation] = []
    @Published var selectedTrack: Track?
    @Published var nowPlaying: Track?
    @Published var isLoading = false
    @Published var isPlaying = false
    @Published var statusMessage = "Start the Node server, then sign in to Muzic."
    @Published var errorMessage: String?
    @Published var externalTracking = false

    private let api = MuzicAPI.shared
    private var player = AVPlayer()
    private var listenTask: Task<Void, Never>?
    private var externalTask: Task<Void, Never>?
    private var lastLoggedSecond = 0
    private var endObserver: NSObjectProtocol?
    private var listensSinceDashboardRefresh = 0

    var isAuthenticated: Bool { user != nil }

    func loadSession() async {
        await runLoading {
            let response: SessionResponse = try await self.api.get("/api/me")
            self.user = response.user
            self.statusMessage = response.user == nil ? "Sign in to reach your music graph." : "Connected to Muzic backend."
            if response.user != nil {
                try await self.refreshDashboard()
            }
        }
    }

    func signIn(email: String, password: String) async {
        await authenticate(path: "/api/auth/login", request: AuthRequest(name: nil, email: email, password: password))
    }

    func signUp(name: String, email: String, password: String) async {
        await authenticate(path: "/api/auth/signup", request: AuthRequest(name: name, email: email, password: password))
    }

    func logout() async {
        stopPlayback()
        await runLoading {
            let _: OkResponse = try await self.api.post("/api/auth/logout", body: [String: String]())
            self.user = nil
            self.tracks = []
            self.recommendations = []
            self.selectedTrack = nil
            self.stats = StatsPayload(totalSeconds: 0, totalFormatted: "0s", mostListenedArtists: [], similarUsers: [])
            self.statusMessage = "Signed out."
        }
    }

    func refresh() async {
        await runLoading {
            try await self.refreshDashboard()
        }
    }

    func addLocal(title: String, artist: String, album: String, audio: UploadedAudio) async {
        let request = TrackRequest(kind: "local", title: title, artist: artist, album: album, sourceType: nil, sourceUrl: nil, fileName: audio.fileName, mimeType: audio.mimeType, dataBase64: audio.dataBase64)
        await runLoading {
            let _: TracksCreatedResponse = try await self.api.post("/api/tracks", body: request)
            self.statusMessage = "Saved \(title)."
            try await self.refreshDashboard()
        }
    }

    func addExternal(title: String, artist: String, album: String, sourceType: String, sourceUrl: String) async {
        await runLoading {
            let request = TrackRequest(kind: "external", title: title, artist: artist, album: album, sourceType: sourceType, sourceUrl: sourceUrl, fileName: nil, mimeType: nil, dataBase64: nil)
            if sourceType == "spotify" {
                let response: SpotifyImportResponse = try await self.api.post("/api/spotify/import", body: request)
                self.statusMessage = "Imported \(response.imported.count) Spotify item(s); \(response.skippedCount) duplicate(s) skipped."
            } else {
                let _: TracksCreatedResponse = try await self.api.post("/api/tracks", body: request)
                self.statusMessage = "Saved \(title)."
            }
            try await self.refreshDashboard()
        }
    }

    func remove(_ track: Track) async {
        await runLoading {
            let _: OkResponse = try await self.api.delete("/api/tracks/\(track.id)")
            if self.nowPlaying?.id == track.id {
                self.stopPlayback()
            }
            self.statusMessage = "Removed \(track.title)."
            try await self.refreshDashboard()
        }
    }

    func play(_ track: Track) {
        stopPlayback()
        selectedTrack = track
        nowPlaying = track
        statusMessage = track.isEmbeddedExternal ? "Embedded source ready. Use Track listening while it plays." : "Playing inside native Muzic."

        guard !track.isEmbeddedExternal, let playable = track.playableUrl else { return }
        let url = URL(string: playable, relativeTo: URL(string: "http://localhost:3000")!)?.absoluteURL
        guard let url else {
            errorMessage = "Cannot build playback URL."
            return
        }

        player = AVPlayer(url: url)
        observeTrackEnd()
        player.play()
        isPlaying = true
        startNativeListenLoop()
    }

    func togglePlayback() {
        guard let nowPlaying else {
            if let first = tracks.first { play(first) }
            return
        }

        if nowPlaying.isEmbeddedExternal {
            if let source = nowPlaying.sourceUrl, let url = URL(string: source) {
                NSWorkspace.shared.open(url)
            }
            return
        }

        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            player.play()
            isPlaying = true
        }
    }

    func startExternalTracking() {
        guard let nowPlaying, nowPlaying.isEmbeddedExternal, externalTask == nil else { return }
        externalTracking = true
        statusMessage = "Tracking external listening for \(nowPlaying.title)."
        externalTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(10))
                await self?.logListen(seconds: 10)
            }
        }
    }

    func stopExternalTracking() {
        externalTask?.cancel()
        externalTask = nil
        externalTracking = false
    }

    func stopPlayback() {
        player.pause()
        isPlaying = false
        lastLoggedSecond = 0
        listenTask?.cancel()
        listenTask = nil
        stopExternalTracking()
        removeTrackEndObserver()
    }

    private func removeTrackEndObserver() {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
    }

    private func observeTrackEnd() {
        removeTrackEndObserver()
        guard let item = player.currentItem else { return }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.handleTrackEnded()
            }
        }
    }

    private func handleTrackEnded() {
        // Without this the play button kept showing "Pause" while the player
        // was already silent at the end of a track.
        isPlaying = false
        listenTask?.cancel()
        listenTask = nil
        lastLoggedSecond = 0
        statusMessage = "\(nowPlaying?.title ?? "Track") finished. Choose another song."
    }

    private func authenticate(path: String, request: AuthRequest) async {
        await runLoading {
            let response: AuthResponse = try await self.api.post(path, body: request)
            self.user = response.user
            self.statusMessage = "Welcome, \(response.user.name)."
            try await self.refreshDashboard()
        }
    }

    private func refreshDashboard() async throws {
        async let tracksResponse: TracksResponse = api.get("/api/tracks")
        async let statsResponse: StatsPayload = api.get("/api/stats")
        async let recommendationsResponse: RecommendationsResponse = api.get("/api/recommendations")

        tracks = try await tracksResponse.tracks
        stats = try await statsResponse
        recommendations = try await recommendationsResponse.recommendations

        if selectedTrack == nil {
            selectedTrack = tracks.first
        }
    }

    private func startNativeListenLoop() {
        listenTask?.cancel()
        lastLoggedSecond = 0
        listenTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                guard let self else { return }
                let seconds = Int(self.player.currentTime().seconds)
                if seconds - self.lastLoggedSecond >= 10 {
                    let delta = seconds - self.lastLoggedSecond
                    self.lastLoggedSecond = seconds
                    await self.logListen(seconds: delta)
                }
            }
        }
    }

    private func logListen(seconds: Int) async {
        guard let nowPlaying, seconds > 0 else { return }
        do {
            let _: OkResponse = try await api.post("/api/listens", body: ListenRequest(trackId: nowPlaying.id, secondsPlayed: seconds))
            // Debounced sync: the stats panel (what ticks up while listening)
            // refreshes on every listen tick, but the full
            // tracks+stats+recommendations triple only every 4th tick instead
            // of every 10 seconds.
            listensSinceDashboardRefresh += 1
            if listensSinceDashboardRefresh >= 4 {
                listensSinceDashboardRefresh = 0
                try await refreshDashboard()
            } else {
                stats = try await api.get("/api/stats")
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func runLoading(_ operation: @escaping () async throws -> Void) async {
        isLoading = true
        errorMessage = nil
        do {
            try await operation()
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = error.localizedDescription
        }
        isLoading = false
    }
}

struct RootView: View {
    @EnvironmentObject private var model: MuzicModel

    var body: some View {
        ZStack {
            AppBackground()
            if model.isAuthenticated {
                DashboardView()
            } else {
                AuthView()
            }
        }
        .alert("Muzic", isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
    }
}

struct AppBackground: View {
    var body: some View {
        LinearGradient(colors: [Color(red: 0.03, green: 0.03, blue: 0.03), Color(red: 0.03, green: 0.08, blue: 0.07), Color(red: 0.11, green: 0.07, blue: 0.05)], startPoint: .topLeading, endPoint: .bottomTrailing)
            .overlay {
                Canvas { context, size in
                    let spacing: CGFloat = 34
                    for x in stride(from: CGFloat(0), through: size.width, by: spacing) {
                        for y in stride(from: CGFloat(0), through: size.height, by: spacing) {
                            let alpha = 0.05 + (y / max(size.height, 1)) * 0.04
                            context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 2, height: 2)), with: .color(.white.opacity(alpha)))
                        }
                    }
                }
            }
            .ignoresSafeArea()
    }
}

struct AuthView: View {
    @EnvironmentObject private var model: MuzicModel
    @State private var mode = AuthMode.login
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var formMessage = ""
    @FocusState private var focusedField: Field?

    enum Field {
        case name
        case email
        case password
    }

    enum AuthMode: String, CaseIterable, Identifiable {
        case login = "Login"
        case signup = "Signup"
        var id: String { rawValue }
    }

    var body: some View {
        HStack(spacing: 48) {
            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 8) {
                    ForEach(0..<4) { index in
                        RoundedRectangle(cornerRadius: 3)
                            .fill(index.isMultiple(of: 2) ? Color.teal : Color.orange)
                            .frame(width: 8, height: CGFloat(20 + index * 9))
                    }
                }

                Text("Muzic")
                    .font(.system(size: 72, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)

                Text("A native music workspace for your local songs, external links, listening stats, and taste graph.")
                    .font(.title2)
                    .foregroundStyle(.white.opacity(0.72))
                    .fixedSize(horizontal: false, vertical: true)

                StatusPill(text: model.statusMessage, systemImage: "dot.radiowaves.left.and.right")
            }
            .frame(maxWidth: 460, alignment: .leading)

            VStack(spacing: 20) {
                Picker("Mode", selection: $mode) {
                    ForEach(AuthMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                if mode == .signup {
                    LabeledInput(label: "Name") {
                        TextField("Your name", text: $name)
                            .textFieldStyle(.plain)
                            .focused($focusedField, equals: .name)
                            .submitLabel(.next)
                            .onSubmit { focusedField = .email }
                    }
                }
                LabeledInput(label: "Email") {
                    TextField("you@example.com", text: $email)
                        .textFieldStyle(.plain)
                        .focused($focusedField, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .password }
                }
                LabeledInput(label: "Password") {
                    SecureField("At least 8 characters", text: $password)
                        .textFieldStyle(.plain)
                        .focused($focusedField, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { submit() }
                }

                if !formMessage.isEmpty {
                    Text(formMessage)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.orange)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    submit()
                } label: {
                    Label(mode == .login ? "Enter Muzic" : "Create Account", systemImage: "arrow.right.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(model.isLoading)
            }
            .padding(28)
            .frame(width: 390)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.12)))
        }
        .padding(60)
        .onAppear {
            focusedField = mode == .signup ? .name : .email
        }
        .onChange(of: mode) {
            formMessage = ""
            focusedField = mode == .signup ? .name : .email
        }
    }

    private func submit() {
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanPassword = password

        if mode == .signup, cleanName.isEmpty {
            formMessage = "Enter your name."
            focusedField = .name
            return
        }
        if cleanEmail.isEmpty {
            formMessage = "Enter your email."
            focusedField = .email
            return
        }
        if cleanPassword.count < 8 {
            formMessage = "Password must be at least 8 characters."
            focusedField = .password
            return
        }

        formMessage = ""
        Task {
            if mode == .login {
                await model.signIn(email: cleanEmail, password: cleanPassword)
            } else {
                await model.signUp(name: cleanName, email: cleanEmail, password: cleanPassword)
            }
        }
    }
}

struct DashboardView: View {
    var body: some View {
        VStack(spacing: 18) {
            TopBar()
            HStack(alignment: .top, spacing: 18) {
                LibraryColumn()
                    .frame(width: 360)

                VStack(spacing: 18) {
                    PlayerPanel()
                    HStack(alignment: .top, spacing: 18) {
                        StatsPanel()
                        RecommendationsPanel()
                    }
                    TasteOrbitPanel()
                }
            }
        }
        .padding(22)
    }
}

struct TopBar: View {
    @EnvironmentObject private var model: MuzicModel

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("Muzic")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.teal)
                Text("\(model.user?.name ?? "Your")'s library")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)
            }
            Spacer()
            StatusPill(text: model.statusMessage, systemImage: model.isLoading ? "arrow.triangle.2.circlepath" : "checkmark.seal")
            Button { Task { await model.refresh() } } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .buttonStyle(SecondaryButtonStyle())

            Button { Task { await model.logout() } } label: {
                Label("Logout", systemImage: "rectangle.portrait.and.arrow.right")
            }
            .buttonStyle(SecondaryButtonStyle())
        }
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.12)))
    }
}

struct LibraryColumn: View {
    @EnvironmentObject private var model: MuzicModel

    var body: some View {
        VStack(spacing: 18) {
            AddMusicPanel()
            GlassPanel(title: "Library", systemImage: "music.note.list") {
                if model.tracks.isEmpty {
                    EmptyState(text: "No songs yet.", systemImage: "music.quarternote.3")
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(model.tracks) { track in
                                TrackRow(track: track, isSelected: model.selectedTrack?.id == track.id)
                            }
                        }
                    }
                    .frame(maxHeight: 390)
                }
            }
        }
    }
}

struct TrackRow: View {
    @EnvironmentObject private var model: MuzicModel
    let track: Track
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 12) {
            Button { model.play(track) } label: {
                Image(systemName: model.nowPlaying?.id == track.id && model.isPlaying ? "pause.fill" : "play.fill")
                    .frame(width: 26, height: 26)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 3) {
                Text(track.title)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(track.subtitle)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.58))
                    .lineLimit(1)
            }
            Spacer()
            Menu {
                Button("Play") { model.play(track) }
                Button("Remove", role: .destructive) {
                    Task { await model.remove(track) }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(.white.opacity(0.7))
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(isSelected ? Color.teal.opacity(0.18) : Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(isSelected ? Color.teal.opacity(0.5) : Color.white.opacity(0.08)))
    }
}

struct AddMusicPanel: View {
    @EnvironmentObject private var model: MuzicModel
    @State private var kind = "local"
    @State private var title = ""
    @State private var artist = ""
    @State private var album = ""
    @State private var sourceType = "youtube"
    @State private var sourceUrl = ""
    @State private var audio: UploadedAudio?
    @State private var importing = false

    var body: some View {
        GlassPanel(title: "Add Music", systemImage: "plus.circle") {
            Picker("Kind", selection: $kind) {
                Text("Local").tag("local")
                Text("External").tag("external")
            }
            .pickerStyle(.segmented)

            TextField("Title", text: $title)
                .textFieldStyle(.plain)
                .modifier(InputStyle())
            TextField("Artist", text: $artist)
                .textFieldStyle(.plain)
                .modifier(InputStyle())
            TextField("Album", text: $album)
                .textFieldStyle(.plain)
                .modifier(InputStyle())

            if kind == "local" {
                Button { importing = true } label: {
                    Label(audio?.fileName ?? "Choose audio file", systemImage: "waveform")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryButtonStyle())
            } else {
                Picker("Source", selection: $sourceType) {
                    Text("YouTube").tag("youtube")
                    Text("SoundCloud").tag("soundcloud")
                    Text("Spotify").tag("spotify")
                    Text("Web Audio").tag("web")
                }
                .pickerStyle(.menu)
                TextField("https://...", text: $sourceUrl)
                    .textFieldStyle(.plain)
                    .modifier(InputStyle())
            }

            Button { Task { await save() } } label: {
                Label(kind == "external" && sourceType == "spotify" ? "Import" : "Save Song", systemImage: "tray.and.arrow.down.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.audio], allowsMultipleSelection: false) { result in
            if case let .success(urls) = result, let url = urls.first {
                audio = makeUploadedAudio(from: url)
            }
        }
    }

    private func save() async {
        if kind == "local", let audio {
            await model.addLocal(title: title, artist: artist, album: album, audio: audio)
        } else {
            await model.addExternal(title: title, artist: artist, album: album, sourceType: sourceType, sourceUrl: sourceUrl)
        }
        title = ""
        artist = ""
        album = ""
        sourceUrl = ""
        audio = nil
    }

    private func makeUploadedAudio(from url: URL) -> UploadedAudio? {
        let didAccess = url.startAccessingSecurityScopedResource()
        defer {
            if didAccess { url.stopAccessingSecurityScopedResource() }
        }
        guard let data = try? Data(contentsOf: url) else { return nil }
        let ext = url.pathExtension.lowercased()
        let mime = ["mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg", "m4a": "audio/mp4", "flac": "audio/flac"][ext] ?? "audio/\(ext)"
        return UploadedAudio(fileName: url.lastPathComponent, mimeType: mime, dataBase64: data.base64EncodedString())
    }
}

struct PlayerPanel: View {
    @EnvironmentObject private var model: MuzicModel

    var body: some View {
        GlassPanel(title: "Now Playing", systemImage: "hifispeaker.2") {
            HStack(spacing: 18) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(AngularGradient(colors: [.teal, .orange, .pink, .teal], center: .center))
                    Image(systemName: "music.note")
                        .font(.system(size: 46, weight: .bold))
                        .foregroundStyle(.black.opacity(0.72))
                }
                .frame(width: 130, height: 130)

                VStack(alignment: .leading, spacing: 12) {
                    Text(model.nowPlaying?.title ?? "Choose a song")
                        .font(.title.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(model.nowPlaying?.subtitle ?? "No listening session is active.")
                        .foregroundStyle(.white.opacity(0.62))

                    HStack {
                        Button { model.togglePlayback() } label: {
                            Label(model.isPlaying ? "Pause" : "Play", systemImage: model.isPlaying ? "pause.fill" : "play.fill")
                        }
                        .buttonStyle(PrimaryButtonStyle())

                        if model.nowPlaying?.isEmbeddedExternal == true {
                            Button {
                                model.externalTracking ? model.stopExternalTracking() : model.startExternalTracking()
                            } label: {
                                Label(model.externalTracking ? "Stop Tracking" : "Track Listening", systemImage: "timer")
                            }
                            .buttonStyle(SecondaryButtonStyle())
                        }

                        Button { model.stopPlayback() } label: {
                            Label("Stop", systemImage: "stop.fill")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                    }
                }
                Spacer()
            }

            if let track = model.nowPlaying, track.isEmbeddedExternal, let url = embeddedURL(for: track) {
                WebPreview(url: url)
                    .frame(height: 160)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private func embeddedURL(for track: Track) -> URL? {
        guard let playable = track.playableUrl ?? track.sourceUrl else { return nil }
        return URL(string: playable)
    }
}

struct WebPreview: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        let view = WKWebView()
        view.allowsBackForwardNavigationGestures = false
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        if view.url != url {
            view.load(URLRequest(url: url))
        }
    }
}

struct StatsPanel: View {
    @EnvironmentObject private var model: MuzicModel

    var body: some View {
        GlassPanel(title: "Stats", systemImage: "chart.bar.xaxis") {
            HStack {
                MetricCard(label: "Playing Time", value: model.stats.totalFormatted, systemImage: "clock")
                MetricCard(label: "Artists", value: "\(model.stats.mostListenedArtists.count)", systemImage: "person.wave.2")
            }

            VStack(spacing: 8) {
                ForEach(model.stats.mostListenedArtists.prefix(5)) { stat in
                    HStack {
                        Text(stat.artist)
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Spacer()
                        Text("\(stat.plays) plays")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.55))
                    }
                    .padding(.vertical, 4)
                }
                if model.stats.mostListenedArtists.isEmpty {
                    EmptyState(text: "No listening data yet.", systemImage: "chart.line.uptrend.xyaxis")
                }
            }
        }
    }
}

struct RecommendationsPanel: View {
    @EnvironmentObject private var model: MuzicModel

    var body: some View {
        GlassPanel(title: "For You", systemImage: "sparkles") {
            if model.recommendations.isEmpty {
                EmptyState(text: "Listen to a few songs to unlock recommendations.", systemImage: "wand.and.stars")
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(model.recommendations.prefix(8)) { recommendation in
                            Button { model.play(recommendation.track) } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(recommendation.track.title)
                                            .font(.headline)
                                            .foregroundStyle(.white)
                                            .lineLimit(1)
                                        Text(recommendation.reason)
                                            .font(.caption)
                                            .foregroundStyle(.white.opacity(0.55))
                                            .lineLimit(2)
                                    }
                                    Spacer()
                                    Image(systemName: "play.circle.fill")
                                        .font(.title3)
                                        .foregroundStyle(.teal)
                                }
                                .padding(12)
                                .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxHeight: 255)
            }
        }
    }
}

struct TasteOrbitPanel: View {
    @EnvironmentObject private var model: MuzicModel

    var body: some View {
        GlassPanel(title: "Taste Orbit", systemImage: "point.3.connected.trianglepath.dotted") {
            GeometryReader { proxy in
                ZStack {
                    Circle()
                        .stroke(.white.opacity(0.08), lineWidth: 1)
                        .frame(width: min(proxy.size.width, 430), height: min(proxy.size.width, 430))
                    Circle()
                        .stroke(.teal.opacity(0.18), lineWidth: 1)
                        .frame(width: min(proxy.size.width, 300), height: min(proxy.size.width, 300))

                    VStack {
                        Text("M")
                            .font(.largeTitle.weight(.black))
                        Text("Taste Signal")
                            .font(.caption.weight(.semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(22)
                    .background(.black.opacity(0.42), in: Circle())

                    let items = Array((model.recommendations.map(\.track).isEmpty ? model.tracks : model.recommendations.map(\.track)).prefix(8).enumerated())
                    ForEach(items, id: \.element.id) { index, track in
                        let angle = Angle.degrees(Double(index) / Double(max(items.count, 1)) * 360)
                        let radius = min(proxy.size.width, 430) / 2
                        Button { model.play(track) } label: {
                            VStack(spacing: 4) {
                                Text(String(track.title.prefix(1)).uppercased())
                                    .font(.headline.weight(.bold))
                                Text(track.title)
                                    .font(.caption2)
                                    .lineLimit(1)
                                    .frame(width: 90)
                            }
                            .foregroundStyle(.white)
                            .padding(9)
                            .background(Color.teal.opacity(0.22), in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(.teal.opacity(0.45)))
                        }
                        .buttonStyle(.plain)
                        .position(x: proxy.size.width / 2 + cos(angle.radians) * radius * 0.78, y: proxy.size.height / 2 + sin(angle.radians) * min(radius * 0.58, 145))
                    }
                }
            }
            .frame(height: 270)
        }
    }
}

struct GlassPanel<Content: View>: View {
    let title: String
    let systemImage: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label(title, systemImage: systemImage)
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.12)))
    }
}

struct MetricCard: View {
    let label: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: systemImage)
                .foregroundStyle(.teal)
            Text(value)
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)
            Text(label)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.55))
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct EmptyState: View {
    let text: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.title2)
            Text(text)
                .font(.callout)
        }
        .foregroundStyle(.white.opacity(0.55))
        .frame(maxWidth: .infinity, minHeight: 86)
    }
}

struct StatusPill: View {
    let text: String
    let systemImage: String

    var body: some View {
        Label(text, systemImage: systemImage)
            .font(.caption.weight(.medium))
            .foregroundStyle(.white.opacity(0.78))
            .lineLimit(1)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.white.opacity(0.07), in: Capsule())
    }
}

struct LabeledInput<Content: View>: View {
    let label: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.7))
            content
                .modifier(InputStyle())
        }
    }
}

struct InputStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .foregroundStyle(.white)
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.12)))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .foregroundStyle(.black)
            .background(configuration.isPressed ? Color.teal.opacity(0.78) : Color.teal, in: RoundedRectangle(cornerRadius: 8))
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .foregroundStyle(.white)
            .background(configuration.isPressed ? Color.white.opacity(0.13) : Color.white.opacity(0.075), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.12)))
    }
}
