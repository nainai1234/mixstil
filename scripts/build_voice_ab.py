from pathlib import Path
import subprocess

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import Pedalboard, Reverb

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/audio/voice/ab-v2-2026-07-12"
OUT.mkdir(parents=True, exist_ok=True)
RATE = 48000
VOICE = "zh-CN-XiaoxiaoNeural"
PAUSE_SECONDS = 7.0
FADE_SECONDS = 0.05
SENTENCES = [
    "让自己慢慢安顿下来。",
    "不需要改变呼吸，只要注意它正在发生。",
    "感受双脚与下方支撑接触的地方。",
    "让脚踝不必再用力。",
    "感受小腿和大腿逐渐变得安静。",
    "接下来不需要继续跟随指令。让背景声陪你休息。",
]


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def decode_to_wav(source, target):
    run("ffmpeg", "-y", "-i", str(source), "-ar", str(RATE), "-ac", "1", "-c:a", "pcm_f32le", str(target))


def encode_mp3(source, target):
    run("ffmpeg", "-y", "-i", str(source), "-codec:a", "libmp3lame", "-b:a", "256k", str(target))


def target_loudness(audio, target_lufs):
    meter = pyln.Meter(RATE)
    measured = meter.integrated_loudness(audio)
    return pyln.normalize.loudness(audio, measured, target_lufs)


def fade_edges(audio):
    samples = min(int(FADE_SECONDS * RATE), len(audio) // 2)
    if samples:
        audio[:samples] *= np.linspace(0.0, 1.0, samples, dtype=np.float32)
        audio[-samples:] *= np.linspace(1.0, 0.0, samples, dtype=np.float32)
    return audio


raw_full = OUT / "v1_raw_edge.mp3"
run("python3", "-m", "edge_tts", "-t", " ".join(SENTENCES), "-v", VOICE, "--rate=-45%", "--pitch=+0Hz", "--write-media", str(raw_full))

pieces = []
speech_windows = []
cursor = 0
silence = np.zeros(int(PAUSE_SECONDS * RATE), dtype=np.float32)
for index, sentence in enumerate(SENTENCES):
    raw = OUT / f"raw_sentence_{index + 1}.mp3"
    wav = OUT / f"raw_sentence_{index + 1}.wav"
    run("python3", "-m", "edge_tts", "-t", sentence, "-v", VOICE, "--rate=-45%", "--pitch=+0Hz", "--write-media", str(raw))
    decode_to_wav(raw, wav)
    audio, sample_rate = sf.read(wav, dtype="float32")
    if sample_rate != RATE:
        raise RuntimeError(f"unexpected sample rate {sample_rate}")
    audio = fade_edges(np.asarray(audio, dtype=np.float32))
    speech_windows.append((cursor, cursor + len(audio)))
    pieces.append(audio)
    cursor += len(audio)
    if index < len(SENTENCES) - 1:
        pieces.append(silence.copy())
        cursor += len(silence)

voice = target_loudness(np.concatenate(pieces), -26.0).astype(np.float32)
clean_wav = OUT / "v2_clean_pcm.wav"
sf.write(clean_wav, voice, RATE, subtype="FLOAT")
encode_mp3(clean_wav, OUT / "v2_clean_pcm.mp3")

background_source = ROOT / "public/audio/noise/internal/pink_soft.mp3"
background_wav = OUT / "background_source.wav"
decode_to_wav(background_source, background_wav)
background, _ = sf.read(background_wav, dtype="float32")
background = np.resize(np.asarray(background, dtype=np.float32), len(voice))
background = target_loudness(background, -32.0).astype(np.float32)

gain = np.ones(len(background), dtype=np.float32)
duck_gain = 10 ** (-3.0 / 20.0)
attack = int(0.3 * RATE)
release = int(1.2 * RATE)
for start, end in speech_windows:
    attack_start = max(0, start - attack)
    gain[attack_start:start] = np.minimum(gain[attack_start:start], np.linspace(1.0, duck_gain, start - attack_start, dtype=np.float32))
    gain[start:end] = np.minimum(gain[start:end], duck_gain)
    release_end = min(len(gain), end + release)
    gain[end:release_end] = np.minimum(gain[end:release_end], np.linspace(duck_gain, 1.0, release_end - end, dtype=np.float32))

duck_mix = np.clip(voice + background * gain, -1.0, 1.0)
duck_wav = OUT / "v3_ducking.wav"
sf.write(duck_wav, duck_mix, RATE, subtype="FLOAT")
encode_mp3(duck_wav, OUT / "v3_ducking.mp3")

board = Pedalboard([Reverb(room_size=0.2, damping=0.85, wet_level=0.03, dry_level=0.97, width=0.3)])
space_voice = board(voice, RATE)
space_mix = np.clip(space_voice + background * gain, -1.0, 1.0)
space_wav = OUT / "v4_space.wav"
sf.write(space_wav, space_mix, RATE, subtype="FLOAT")
encode_mp3(space_wav, OUT / "v4_space.mp3")

print("created", OUT)
