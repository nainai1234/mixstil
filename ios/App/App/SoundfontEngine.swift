import Foundation
import AVFoundation

public class SoundfontEngine {
    private let engine = AVAudioEngine()
    private let sampler = AVAudioUnitSampler()
    private var isLoaded = false
    
    public init() {
        engine.attach(sampler)
        engine.connect(sampler, to: engine.mainMixerNode, format: nil)
    }
    
    public func load(fontPath: String) throws {
        // Find the absolute path in the main bundle (app bundle)
        // Capacitor puts public assets in the `public` folder of the App bundle
        var fileURL: URL? = nil
        
        if let bundleURL = Bundle.main.url(forResource: "public/" + fontPath, withExtension: nil) {
            fileURL = bundleURL
        } else if let bundleURL = Bundle.main.url(forResource: fontPath, withExtension: nil) {
            fileURL = bundleURL
        } else {
            // Also check absolute file path just in case
            let url = URL(fileURLWithPath: fontPath)
            if FileManager.default.fileExists(atPath: url.path) {
                fileURL = url
            }
        }
        
        guard let url = fileURL else {
            throw NSError(domain: "SoundfontEngine", code: 404, userInfo: [NSLocalizedDescriptionKey: "Soundfont file not found at path: \(fontPath)"])
        }
        
        try sampler.loadInstrument(at: url)
        
        if !engine.isRunning {
            try engine.start()
        }
        
        isLoaded = true
    }
    
    public func noteOn(note: UInt8, velocity: UInt8) {
        guard isLoaded else { return }
        sampler.startNote(note, withVelocity: velocity, onChannel: 0)
    }
    
    public func noteOff(note: UInt8) {
        guard isLoaded else { return }
        sampler.stopNote(note, onChannel: 0)
    }
}
