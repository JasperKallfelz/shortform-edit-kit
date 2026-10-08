#!/bin/zsh
# Build the final export of a Remotion video for TikTok/Reels. Runs on the machine with ffmpeg; the Remotion project lives in the
# home folder of the machine EDIT_HOST (SSH name; can be the same machine if Remote Login is turned on there).
#
#   EDIT_HOST=<ssh-name> post_render.sh <project folder in the home of EDIT_HOST> <composition> <name> [cover frames, e.g. 60,150,240]
#   Example: EDIT_HOST=edit-mac post_render.sh my-video Demo My-Video 60,150,240
#
# Result in <project>/out/post-<date>/ on EDIT_HOST:
#   <name>_1080x1920_with-music.mp4, <name>_1080x1920_without-music.mp4 (prop "music" empty; for music from the platform library),
#   cover-frame-<frame>.png, plus the raw picture (picture.mp4) and both audio tracks as WAV.
# Picture: H.264 High, CRF 14, preset slow, intermediate frames as PNG, bt709, yuv420p. Audio: AAC 320 kbit/s.
# Loudness: lowered purely linearly so that at most -14 LUFS and at most -1.2 dBTP come out (no limiter, it is never made louder).
set -euo pipefail
if [[ $# -lt 3 || "$1" == "-h" || "$1" == "--help" ]]; then sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1; fi
PROJ=$1; COMP=$2; NAME=$3; COVERS=${4:-}
HOST=${EDIT_HOST:?Please set EDIT_HOST: SSH name of the machine that holds the Remotion project}
DAY=$(date +%F)
REMOTE="$PROJ/out/post-$DAY"
WORK=$(mktemp -d)
R='export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH'

ssh $HOST "$R; cd ~/$PROJ && mkdir -p out/post-$DAY && npx tsc --noEmit \
  && npx remotion render $COMP out/post-$DAY/picture.mp4 --codec=h264 --image-format=png --crf=14 --x264-preset=slow --pixel-format=yuv420p --color-space=bt709 --audio-codec=aac --audio-bitrate=320k --log=error \
  && npx remotion render $COMP out/post-$DAY/audio-with-music.wav --codec=wav --log=error \
  && npx remotion render $COMP out/post-$DAY/audio-without-music.wav --codec=wav --props='{\"music\":\"\"}' --log=error"
for fr in ${(s:,:)COVERS}; do
  ssh $HOST "$R; cd ~/$PROJ && npx remotion still $COMP out/post-$DAY/cover-frame-$fr.png --frame=$fr --log=error"
done
rsync -a "$HOST:$REMOTE/picture.mp4" "$HOST:$REMOTE/audio-with-music.wav" "$HOST:$REMOTE/audio-without-music.wav" "$WORK/"

# Value from the summary of the ebur128 filter: lufs <file> I  → loudness overall, lufs <file> Peak → highest peak
lufs() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk -v k="$2:" '$1==k{v=$2} END{print v}'; }

for v in with-music without-music; do
  wav="$WORK/audio-$v.wav"
  I=$(lufs "$wav" I); TP=$(lufs "$wav" Peak)
  G=$(python3 -c "print(round(min(0, -14 - ($I), -1.2 - ($TP)), 2))")
  out="$WORK/${NAME}_1080x1920_$v.mp4"
  ffmpeg -v error -y -i "$WORK/picture.mp4" -i "$wav" -map 0:v:0 -map 1:a:0 -c:v copy -af "volume=${G}dB" -c:a aac -b:a 320k -ar 48000 -movflags +faststart "$out"
  echo "$v: mix $I LUFS / $TP dBTP, gain ${G} dB -> final $(lufs "$out" I) LUFS / $(lufs "$out" Peak) dBTP, $(du -h "$out" | cut -f1 | tr -d ' ')"
  rsync -a "$out" "$HOST:$REMOTE/"
done
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,color_space -of csv=p=0 "$WORK/picture.mp4"
echo "Done: $HOST:~/$REMOTE/"
rm -rf "$WORK"
