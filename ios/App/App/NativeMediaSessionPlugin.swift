import AVFoundation
import Capacitor
import MediaPlayer

@objc(NativeMediaSessionPlugin)
public class NativeMediaSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeMediaSessionPlugin"
    public let jsName = "NativeMediaSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private var commandTargets: [Any] = []
    private var player: AVPlayer?
    private var timeObserver: Any?
    private var notificationObservers: [NSObjectProtocol] = []
    private var playerNotificationObservers: [NSObjectProtocol] = []
    private var playerItemStatusObserver: NSKeyValueObservation?
    private var prepareTimeoutWorkItem: DispatchWorkItem?
    private var prepareGeneration = 0
    private var audioSessionConfigured = false
    private var audioSessionActive = false
    private var currentAudioURL = ""
    private var currentTitle = "Personal sound"
    private var configuredDuration = 0.0
    private var prepared = false
    private var wasPlayingBeforeInterruption = false

    @objc override public func load() {
        configureAudioSessionIfNeeded()
        installRemoteCommands()
        installAudioNotifications()
    }

    @objc func prepare(_ call: CAPPluginCall) {
        guard let audioURLString = call.getString("audioUrl"),
              !audioURLString.isEmpty,
              let audioURL = URL(string: audioURLString) else {
            call.reject("A valid audioUrl is required")
            return
        }

        currentAudioURL = audioURLString
        currentTitle = call.getString("title") ?? "Personal sound"
        configuredDuration = max(0, call.getDouble("durationSeconds") ?? 0)
        let position = clampedPosition(call.getDouble("positionSeconds") ?? 0)
        let shouldPlay = call.getBool("playing") ?? false

        do {
            try activateAudioSession()
            removePlayerObservers()
            cancelPendingPrepare()
            prepareGeneration += 1
            let generation = prepareGeneration
            let item = AVPlayerItem(url: audioURL)
            player = AVPlayer(playerItem: item)
            prepared = false
            installPlayerObservers()

            playerItemStatusObserver = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
                DispatchQueue.main.async {
                    guard let self, generation == self.prepareGeneration else { return }
                    switch item.status {
                    case .readyToPlay:
                        self.finishPrepare(call, position: position, shouldPlay: shouldPlay)
                    case .failed:
                        self.failPrepare(call, error: item.error ?? NSError(
                            domain: "MixStilPlayback",
                            code: -2,
                            userInfo: [NSLocalizedDescriptionKey: "The audio resource could not be loaded"]
                        ))
                    case .unknown:
                        break
                    @unknown default:
                        break
                    }
                }
            }

            let timeout = DispatchWorkItem { [weak self] in
                guard let self, generation == self.prepareGeneration, !self.prepared else { return }
                self.failPrepare(call, error: NSError(
                    domain: "MixStilPlayback",
                    code: -3,
                    userInfo: [NSLocalizedDescriptionKey: "Audio took too long to become ready"]
                ))
            }
            prepareTimeoutWorkItem = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: timeout)
        } catch {
            prepared = false
            call.rejectPlayback(error)
        }
    }

    private func finishPrepare(_ call: CAPPluginCall, position: Double, shouldPlay: Bool) {
        guard !prepared else { return }
        prepared = true
        cancelPendingPrepare()
        seekPlayer(to: position) { [weak self] in
            guard let self else { return }
            if shouldPlay {
                self.player?.play()
            }
            self.publishState(action: shouldPlay ? "play" : "state")
        }
        updateNowPlaying(position: position, playing: shouldPlay)
        call.resolve()
    }

    private func failPrepare(_ call: CAPPluginCall, error: Error) {
        guard !prepared else { return }
        cancelPendingPrepare()
        player?.pause()
        player = nil
        currentAudioURL = ""
        call.rejectPlayback(error)
        publishError(error)
    }

    private func cancelPendingPrepare() {
        playerItemStatusObserver?.invalidate()
        playerItemStatusObserver = nil
        prepareTimeoutWorkItem?.cancel()
        prepareTimeoutWorkItem = nil
    }

    @objc func play(_ call: CAPPluginCall) {
        guard prepared, player != nil else {
            call.reject("Native audio is not prepared")
            return
        }
        do {
            try resumeOrRestartPlayback()
            call.resolve()
        } catch {
            call.rejectPlayback(error)
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        player?.pause()
        publishState(action: "pause")
        call.resolve()
    }

    @objc func seek(_ call: CAPPluginCall) {
        let position = clampedPosition(call.getDouble("positionSeconds") ?? 0)
        seekPlayer(to: position) { [weak self] in
            self?.publishState(action: "seek")
        }
        call.resolve()
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve(statePayload(action: "state"))
    }

    @objc func update(_ call: CAPPluginCall) {
        currentTitle = call.getString("title") ?? currentTitle
        configuredDuration = max(0, call.getDouble("durationSeconds") ?? configuredDuration)
        updateNowPlaying(position: currentPosition(), playing: isPlaying())
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        stopAndClearPlayer()
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            audioSessionActive = false
            call.resolve()
        } catch {
            call.reject("Could not clear iOS background playback", nil, error)
        }
    }

    private func configureAudioSessionIfNeeded() {
        guard !audioSessionConfigured else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
            audioSessionConfigured = true
        } catch {
            // prepare() retries and returns the full error to JavaScript.
        }
    }

    private func activateAudioSession() throws {
        let audioSession = AVAudioSession.sharedInstance()
        if !audioSessionConfigured {
            try audioSession.setCategory(.playback, mode: .default, options: [])
            audioSessionConfigured = true
        }
        if !audioSessionActive {
            try audioSession.setActive(true)
            audioSessionActive = true
        }
    }

    private func installRemoteCommands() {
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.isEnabled = true
        commands.pauseCommand.isEnabled = true
        commands.stopCommand.isEnabled = true
        commands.changePlaybackPositionCommand.isEnabled = true
        commands.skipForwardCommand.isEnabled = true
        commands.skipForwardCommand.preferredIntervals = [15]
        commands.skipBackwardCommand.isEnabled = true
        commands.skipBackwardCommand.preferredIntervals = [15]

        commandTargets.append(commands.playCommand.addTarget { [weak self] _ in
            guard let self, self.prepared else { return .noSuchContent }
            do {
                try self.resumeOrRestartPlayback()
                return .success
            } catch {
                self.publishError(error)
                return .commandFailed
            }
        })
        commandTargets.append(commands.pauseCommand.addTarget { [weak self] _ in
            self?.player?.pause()
            self?.publishState(action: "pause")
            return .success
        })
        commandTargets.append(commands.stopCommand.addTarget { [weak self] _ in
            self?.player?.pause()
            self?.seekPlayer(to: 0)
            self?.publishState(action: "stop")
            return .success
        })
        commandTargets.append(commands.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let self,
                  let positionEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            self.seekPlayer(to: positionEvent.positionTime) {
                self.publishState(action: "seek")
            }
            return .success
        })
        commandTargets.append(commands.skipForwardCommand.addTarget { [weak self] event in
            guard let self, self.prepared else { return .noSuchContent }
            let interval = (event as? MPSkipIntervalCommandEvent)?.interval ?? 15
            self.seekPlayer(to: self.currentPosition() + interval) {
                self.publishState(action: "seek")
            }
            return .success
        })
        commandTargets.append(commands.skipBackwardCommand.addTarget { [weak self] event in
            guard let self, self.prepared else { return .noSuchContent }
            let interval = (event as? MPSkipIntervalCommandEvent)?.interval ?? 15
            self.seekPlayer(to: self.currentPosition() - interval) {
                self.publishState(action: "seek")
            }
            return .success
        })
    }

    private func installAudioNotifications() {
        let center = NotificationCenter.default
        notificationObservers.append(center.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            self?.handleInterruption(notification)
        })
        notificationObservers.append(center.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            self?.handleRouteChange(notification)
        })
    }

    private func installPlayerObservers() {
        guard let player else { return }
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 1, preferredTimescale: 600),
            queue: .main
        ) { [weak self] _ in
            self?.publishState(action: "state")
        }
        if let item = player.currentItem {
            playerNotificationObservers.append(NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] _ in
                self?.publishState(action: "ended", positionOverride: self?.configuredDuration)
            })
            playerNotificationObservers.append(NotificationCenter.default.addObserver(
                forName: .AVPlayerItemFailedToPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] notification in
                let error = notification.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
                self?.publishError(error ?? NSError(domain: "MixStilPlayback", code: -1, userInfo: [NSLocalizedDescriptionKey: "Audio playback failed"]))
            })
        }
    }

    private func removePlayerObservers() {
        if let timeObserver, let player {
            player.removeTimeObserver(timeObserver)
        }
        timeObserver = nil
        playerNotificationObservers.forEach(NotificationCenter.default.removeObserver)
        playerNotificationObservers.removeAll()
    }

    private func handleInterruption(_ notification: Notification) {
        guard let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }
        if type == .began {
            wasPlayingBeforeInterruption = isPlaying()
            publishState(action: "pause")
            return
        }
        let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
        if wasPlayingBeforeInterruption && options.contains(.shouldResume) {
            do {
                try activateAudioSession()
                player?.play()
                publishState(action: "play")
            } catch {
                publishError(error)
            }
        } else {
            publishState(action: "pause")
        }
        wasPlayingBeforeInterruption = false
    }

    private func handleRouteChange(_ notification: Notification) {
        guard let rawReason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
              AVAudioSession.RouteChangeReason(rawValue: rawReason) == .oldDeviceUnavailable else { return }
        player?.pause()
        publishState(action: "pause")
    }

    private func seekPlayer(to position: Double, completion: (() -> Void)? = nil) {
        let target = CMTime(seconds: clampedPosition(position), preferredTimescale: 600)
        player?.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { _ in
            DispatchQueue.main.async { completion?() }
        }
    }

    private func resumeOrRestartPlayback() throws {
        try activateAudioSession()
        if configuredDuration > 0 && currentPosition() >= configuredDuration - 0.5 {
            seekPlayer(to: 0) { [weak self] in
                self?.player?.play()
                self?.publishState(action: "play")
            }
            return
        }
        player?.play()
        publishState(action: "play")
    }

    private func currentPosition() -> Double {
        guard let seconds = player?.currentTime().seconds, seconds.isFinite else { return 0 }
        return clampedPosition(seconds)
    }

    private func clampedPosition(_ position: Double) -> Double {
        let nonnegativePosition = max(0, position.isFinite ? position : 0)
        return min(nonnegativePosition, configuredDuration > 0 ? configuredDuration : nonnegativePosition)
    }

    private func isPlaying() -> Bool {
        player?.timeControlStatus == .playing
    }

    private func statePayload(action: String, positionOverride: Double? = nil) -> [String: Any] {
        [
            "action": action,
            "audioUrl": currentAudioURL,
            "positionSeconds": positionOverride ?? currentPosition(),
            "durationSeconds": configuredDuration,
            "playing": isPlaying(),
            "prepared": prepared
        ]
    }

    private func publishState(action: String, positionOverride: Double? = nil) {
        let payload = statePayload(action: action, positionOverride: positionOverride)
        updateNowPlaying(
            position: payload["positionSeconds"] as? Double ?? currentPosition(),
            playing: payload["playing"] as? Bool ?? false
        )
        notifyListeners("action", data: payload, retainUntilConsumed: false)
    }

    private func publishError(_ error: Error) {
        let nsError = error as NSError
        var payload = statePayload(action: "error")
        payload["error"] = "\(nsError.domain) \(nsError.code): \(nsError.localizedDescription)"
        notifyListeners("action", data: payload, retainUntilConsumed: true)
    }

    private func updateNowPlaying(position: Double, playing: Bool) {
        guard prepared else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: currentTitle,
            MPMediaItemPropertyArtist: "MixStil",
            MPMediaItemPropertyAlbumTitle: "My Sounds",
            MPMediaItemPropertyPlaybackDuration: configuredDuration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
            MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0
        ]
        MPNowPlayingInfoCenter.default().playbackState = playing ? .playing : .paused
    }

    private func stopAndClearPlayer() {
        player?.pause()
        cancelPendingPrepare()
        removePlayerObservers()
        player = nil
        prepared = false
        currentAudioURL = ""
        configuredDuration = 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        MPNowPlayingInfoCenter.default().playbackState = .stopped
    }

    deinit {
        stopAndClearPlayer()
        notificationObservers.forEach(NotificationCenter.default.removeObserver)
        playerNotificationObservers.forEach(NotificationCenter.default.removeObserver)
    }
}

private extension CAPPluginCall {
    func rejectPlayback(_ error: Error) {
        let nsError = error as NSError
        reject(
            "Could not activate iOS background playback (\(nsError.domain) \(nsError.code)): \(nsError.localizedDescription)",
            nil,
            error
        )
    }
}

@objc(MixStilBridgeViewController)
public class MixStilBridgeViewController: CAPBridgeViewController {
    public override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeMediaSessionPlugin())
    }
}
