#!/usr/bin/env swift
import Foundation
import AVFoundation

struct NoteEvent: Codable {
    let note: UInt8
    let start: Double
    let duration: Double
    let velocity: UInt8
}

struct RenderSpec: Codable {
    let outputWav: String
    let durationSeconds: Double
    let sampleRate: Double
    let program: UInt8
    let masterGain: Float
    let notes: [NoteEvent]
}

struct ScheduledEvent {
    let frame: AVAudioFramePosition
    let isOn: Bool
    let note: UInt8
    let velocity: UInt8
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

guard CommandLine.arguments.count == 2 else {
    fail("Usage: render-dls-notes.swift spec.json")
}

let specURL = URL(fileURLWithPath: CommandLine.arguments[1])
let specData = try Data(contentsOf: specURL)
let spec = try JSONDecoder().decode(RenderSpec.self, from: specData)

let dlsURL = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
let outputURL = URL(fileURLWithPath: spec.outputWav)

let engine = AVAudioEngine()
let sampler = AVAudioUnitSampler()
engine.attach(sampler)

let format = AVAudioFormat(standardFormatWithSampleRate: spec.sampleRate, channels: 2)!
engine.connect(sampler, to: engine.mainMixerNode, format: format)
engine.mainMixerNode.outputVolume = spec.masterGain

// 0x79 is the standard melodic bank used by Apple's DLS sampler.
try sampler.loadSoundBankInstrument(
    at: dlsURL,
    program: spec.program,
    bankMSB: UInt8(0x79),
    bankLSB: UInt8(0)
)

try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
try engine.start()

var events: [ScheduledEvent] = []
for note in spec.notes {
    let onFrame = AVAudioFramePosition(note.start * spec.sampleRate)
    let offFrame = AVAudioFramePosition((note.start + note.duration) * spec.sampleRate)
    events.append(ScheduledEvent(frame: onFrame, isOn: true, note: note.note, velocity: note.velocity))
    events.append(ScheduledEvent(frame: offFrame, isOn: false, note: note.note, velocity: 0))
}
events.sort {
    if $0.frame == $1.frame { return $0.isOn && !$1.isOn }
    return $0.frame < $1.frame
}

let outputFile = try AVAudioFile(forWriting: outputURL, settings: format.settings)
let buffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: engine.manualRenderingMaximumFrameCount)!
let totalFrames = AVAudioFramePosition(spec.durationSeconds * spec.sampleRate)
var eventIndex = 0

while engine.manualRenderingSampleTime < totalFrames {
    while eventIndex < events.count && events[eventIndex].frame <= engine.manualRenderingSampleTime {
        let event = events[eventIndex]
        if event.isOn {
            sampler.startNote(event.note, withVelocity: event.velocity, onChannel: 0)
        } else {
            sampler.stopNote(event.note, onChannel: 0)
        }
        eventIndex += 1
    }

    let framesLeft = totalFrames - engine.manualRenderingSampleTime
    let framesToRender = min(AVAudioFrameCount(framesLeft), engine.manualRenderingMaximumFrameCount)
    let status = try engine.renderOffline(framesToRender, to: buffer)
    switch status {
    case .success:
        try outputFile.write(from: buffer)
    case .insufficientDataFromInputNode:
        continue
    case .cannotDoInCurrentContext:
        continue
    case .error:
        fail("Manual rendering failed")
    @unknown default:
        fail("Unknown manual rendering status")
    }
}

engine.stop()
