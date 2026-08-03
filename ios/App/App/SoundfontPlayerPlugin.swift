import Foundation
import Capacitor

@objc(SoundfontPlayerPlugin)
public class SoundfontPlayerPlugin: CAPPlugin {
    
    private var engine: SoundfontEngine?
    
    override public func load() {
        engine = SoundfontEngine()
    }
    
    @objc func load(_ call: CAPPluginCall) {
        guard let fontPath = call.getString("fontPath") else {
            call.reject("Must provide fontPath")
            return
        }
        
        do {
            try engine?.load(fontPath: fontPath)
            call.resolve()
        } catch {
            call.reject("Failed to load soundfont: \(error.localizedDescription)")
        }
    }
    
    @objc func noteOn(_ call: CAPPluginCall) {
        guard let note = call.getInt("note"),
              let velocity = call.getInt("velocity") else {
            call.reject("Must provide note and velocity")
            return
        }
        
        engine?.noteOn(note: UInt8(note), velocity: UInt8(velocity))
        call.resolve()
    }
    
    @objc func noteOff(_ call: CAPPluginCall) {
        guard let note = call.getInt("note") else {
            call.reject("Must provide note")
            return
        }
        
        engine?.noteOff(note: UInt8(note))
        call.resolve()
    }
}
