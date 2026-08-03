#!/bin/bash
cd /Users/pang/project/sleep-audio
mkdir -p imports/reference-youtube

echo "Downloading 15 videos from SoundCloud fallback..."
yt-dlp "scsearch1:Relaxing Music & Rain Sounds You & Me" -x --audio-format mp3 -o "imports/reference-youtube/sleep_piano_rain_you_me.%(ext)s"
yt-dlp "scsearch1:8 Hours of Beautiful Piano Music Soothing Relaxation" -x --audio-format mp3 -o "imports/reference-youtube/sleep_eight_hour_piano.%(ext)s"
yt-dlp "scsearch1:An Ending Ascent Brian Eno" -x --audio-format mp3 -o "imports/reference-youtube/sleep_ending_ascent.%(ext)s"
yt-dlp "scsearch1:saman Olafur Arnalds" -x --audio-format mp3 -o "imports/reference-youtube/sleep_saman.%(ext)s"
yt-dlp "scsearch1:Rhubarb Aphex Twin" -x --audio-format mp3 -o "imports/reference-youtube/sleep_rhubarb.%(ext)s"
yt-dlp "scsearch1:Dream 1 Max Richter" -x --audio-format mp3 -o "imports/reference-youtube/sleep_dream_1.%(ext)s"
yt-dlp "scsearch1:First Light Harold Budd" -x --audio-format mp3 -o "imports/reference-youtube/sleep_first_light.%(ext)s"
yt-dlp "scsearch1:10 Hours of Relaxing Piano & Guitar Soothing Relaxation" -x --audio-format mp3 -o "imports/reference-youtube/calm_piano_guitar_10h.%(ext)s"
yt-dlp "scsearch1:3 Hour Relaxing Guitar Music" -x --audio-format mp3 -o "imports/reference-youtube/calm_relaxing_guitar_3h.%(ext)s"
yt-dlp "scsearch1:Meditation MONOMAN" -x --audio-format mp3 -o "imports/reference-youtube/calm_meditation_monoman.%(ext)s"
yt-dlp "scsearch1:Raga Yaman Hariprasad Chaurasia" -x --audio-format mp3 -o "imports/reference-youtube/calm_raga_yaman_flute.%(ext)s"
yt-dlp "scsearch1:Silk Road Legend, Volume 1 Kitaro" -x --audio-format mp3 -o "imports/reference-youtube/calm_silk_road.%(ext)s"
yt-dlp "scsearch1:Meditation No 1 Laraaji" -x --audio-format mp3 -o "imports/reference-youtube/calm_meditation_no_1.%(ext)s"
yt-dlp "scsearch1:Focus Music for Work and Studying Greenred" -x --audio-format mp3 -o "imports/reference-youtube/focus_work_study.%(ext)s"
yt-dlp "scsearch1:Deep Focus Music 12 Hours Ambient Study Music" -x --audio-format mp3 -o "imports/reference-youtube/focus_deep_ambient_12h.%(ext)s"

echo "Downloads completed, running tasks..."
pnpm analyze:reference-imports
pnpm merge:reference-audio-analysis
pnpm validate:reference-audio-analysis-format

echo "All tasks finished."
