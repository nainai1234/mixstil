import numpy as np
from scipy.io import wavfile
import os

os.makedirs('public/audio', exist_ok=True)
sr = 22050
duration = 10 # 10 seconds loop
t = np.linspace(0, duration, sr * duration)

def save_wav(name, data):
    # Normalize and convert to 16-bit PCM
    data = data / np.max(np.abs(data)) * 0.8
    wavfile.write(f'public/audio/{name}.wav', sr, (data * 32767).astype(np.int16))

# 1. Rain (Pink-ish noise)
rain = np.random.randn(sr * duration)
for i in range(1, len(rain)):
    rain[i] = 0.9 * rain[i-1] + 0.1 * rain[i]
save_wav('rain', rain)

# 2. Wind (Brown-ish noise with modulation)
wind = np.random.randn(sr * duration)
for i in range(1, len(wind)):
    wind[i] = 0.99 * wind[i-1] + 0.05 * wind[i]
wind_env = (np.sin(2 * np.pi * 0.2 * t) + 1) / 2 + 0.2
save_wav('wind', wind * wind_env)

# 3. Crickets (High pitch bursts)
crickets = np.sin(2 * np.pi * 4500 * t) * (np.sin(2 * np.pi * 15 * t) > 0.8) * 0.2
save_wav('crickets', crickets)

# 4. Meditation Bowl (Sine waves with slow decay, repeated)
bowl = np.zeros_like(t)
for start in [0, 5]:
    t_local = t[start*sr:]
    envelope = np.exp(-t_local / 2)
    bowl[start*sr:] += (np.sin(2 * np.pi * 432 * t_local) + 0.5 * np.sin(2 * np.pi * 864 * t_local)) * envelope
save_wav('bowl', bowl)

# 5. Ocean (Filtered noise with slow LFO)
ocean = rain.copy()
ocean_env = (np.sin(2 * np.pi * 0.1 * t) + 1) / 2
save_wav('ocean', ocean * ocean_env)

# 6. River (Constant mid-frequency noise)
river = np.random.randn(sr * duration)
for i in range(1, len(river)):
    river[i] = 0.5 * river[i-1] + 0.5 * river[i]
save_wav('river', river)

# 7. Campfire (Low frequency rumble + crackles)
crackles = (np.random.rand(sr * duration) > 0.999).astype(float) * np.random.randn(sr * duration)
rumble = wind.copy() * 0.3
save_wav('campfire', rumble + crackles)

print("Generated all audio files in public/audio/")
