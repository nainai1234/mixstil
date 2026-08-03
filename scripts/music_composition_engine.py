"""Small reusable symbolic composition layer for SNOOZE music profiles."""
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Tuple


@dataclass(frozen=True)
class ProductionBrief:
    goal: str
    profile_id: str
    duration_seconds: float
    seed: int
    environment: str = "off"


@dataclass(frozen=True)
class Motif:
    name: str
    notes: Tuple[str, ...]
    beats: Tuple[float, ...]
    contour: str

    def signature(self):
        intervals = []
        for left, right in zip(self.notes, self.notes[1:]):
            intervals.append(note_to_midi(right) - note_to_midi(left))
        return {"intervals": intervals, "beats": list(self.beats), "contour": self.contour}


@dataclass(frozen=True)
class PhrasePlan:
    start: float
    motif: Motif
    variant: str
    level: float
    register_shift: int = 0


@dataclass(frozen=True)
class FormPlan:
    name: str
    sections: Tuple[str, ...]
    starts: Tuple[float, ...]
    release_at: float


NOTE_MIDI = {
    "C2": 36, "D2": 38, "E2": 40, "F2": 41, "G2": 43, "A2": 45, "B2": 47,
    "C3": 48, "D3": 50, "E3": 52, "F3": 53, "G3": 55, "A3": 57, "B3": 59,
    "C4": 60, "D4": 62, "E4": 64, "F4": 65, "G4": 67, "A4": 69, "B4": 71,
    "C5": 72, "D5": 74, "E5": 76,
}
MIDI_NOTE = {value: key for key, value in NOTE_MIDI.items()}


def note_to_midi(note):
    if note in NOTE_MIDI:
        return NOTE_MIDI[note]
    raise ValueError(f"Unsupported note: {note}")


def shift_note(note, semitones):
    return MIDI_NOTE.get(note_to_midi(note) + semitones, note)


def motif_events(phrase: PhrasePlan, velocity=0.06, pan=0.0):
    events = []
    cursor = phrase.start
    for index, (note, beats) in enumerate(zip(phrase.motif.notes, phrase.motif.beats)):
        duration = max(0.35, beats * 0.72)
        if phrase.variant == "reduce" and index % 2 == 1:
            continue
        if phrase.variant == "answer" and index == len(phrase.motif.notes) - 1:
            note = shift_note(note, -2)
        if phrase.variant == "register":
            note = shift_note(note, phrase.register_shift)
        events.append({
            "start": cursor, "note": note, "duration": duration,
            "velocity": velocity * phrase.level,
            "pan": pan if index % 2 == 0 else -pan,
            "softAttack": True, "role": "motif",
        })
        cursor += beats
    return events


def serialize_plan(brief, motif, phrases, form):
    return {"brief": asdict(brief), "motif": asdict(motif),
            "phrases": [asdict(item) for item in phrases], "form": asdict(form)}

