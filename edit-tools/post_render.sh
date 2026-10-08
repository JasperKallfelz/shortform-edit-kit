#!/bin/zsh
# Fertigen Export eines Remotion-Videos für TikTok/Reels bauen. Läuft auf dem Rechner mit ffmpeg; das Remotion-Projekt liegt im
# Home-Ordner des Rechners EDIT_HOST (SSH-Name; kann derselbe Rechner sein, wenn dort die Fernanmeldung an ist).
#
#   EDIT_HOST=<ssh-name> post_render.sh <projektordner im Home von EDIT_HOST> <Komposition> <Name> [Cover-Frames, z. B. 60,150,240]
#   Beispiel: EDIT_HOST=schnitt-mac post_render.sh mein-video Demo Mein-Video 60,150,240
#
# Ergebnis in <projekt>/out/post-<Datum>/ auf EDIT_HOST:
#   <Name>_1080x1920_mit-Musik.mp4, <Name>_1080x1920_ohne-Musik.mp4 (Prop "music" leer; für Musik aus der Plattform-Bibliothek),
#   cover-bild-<frame>.png, dazu Rohbild (bild.mp4) und beide Tonspuren als WAV.
# Bild: H.264 High, CRF 14, preset slow, Zwischenbilder als PNG, bt709, yuv420p. Ton: AAC 320 kbit/s.
# Lautheit: rein linear so abgesenkt, dass höchstens -14 LUFS und höchstens -1,2 dBTP herauskommen (kein Limiter, lauter gemacht wird nicht).
set -euo pipefail
if [[ $# -lt 3 || "$1" == "-h" || "$1" == "--help" ]]; then sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1; fi
PROJ=$1; COMP=$2; NAME=$3; COVERS=${4:-}
HOST=${EDIT_HOST:?Bitte EDIT_HOST setzen: SSH-Name des Rechners, auf dem das Remotion-Projekt liegt}
DAY=$(date +%F)
REMOTE="$PROJ/out/post-$DAY"
WORK=$(mktemp -d)
R='export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH'

ssh $HOST "$R; cd ~/$PROJ && mkdir -p out/post-$DAY && npx tsc --noEmit \
  && npx remotion render $COMP out/post-$DAY/bild.mp4 --codec=h264 --image-format=png --crf=14 --x264-preset=slow --pixel-format=yuv420p --color-space=bt709 --audio-codec=aac --audio-bitrate=320k --log=error \
  && npx remotion render $COMP out/post-$DAY/ton-mit-musik.wav --codec=wav --log=error \
  && npx remotion render $COMP out/post-$DAY/ton-ohne-musik.wav --codec=wav --props='{\"music\":\"\"}' --log=error"
for fr in ${(s:,:)COVERS}; do
  ssh $HOST "$R; cd ~/$PROJ && npx remotion still $COMP out/post-$DAY/cover-bild-$fr.png --frame=$fr --log=error"
done
rsync -a "$HOST:$REMOTE/bild.mp4" "$HOST:$REMOTE/ton-mit-musik.wav" "$HOST:$REMOTE/ton-ohne-musik.wav" "$WORK/"

# Wert aus der Zusammenfassung des ebur128-Filters: lufs <datei> I  → Lautheit über alles, lufs <datei> Peak → höchste Spitze
lufs() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk -v k="$2:" '$1==k{v=$2} END{print v}'; }

for v in mit-Musik ohne-Musik; do
  wav="$WORK/ton-${v:l}.wav"
  I=$(lufs "$wav" I); TP=$(lufs "$wav" Peak)
  G=$(python3 -c "print(round(min(0, -14 - ($I), -1.2 - ($TP)), 2))")
  out="$WORK/${NAME}_1080x1920_$v.mp4"
  ffmpeg -v error -y -i "$WORK/bild.mp4" -i "$wav" -map 0:v:0 -map 1:a:0 -c:v copy -af "volume=${G}dB" -c:a aac -b:a 320k -ar 48000 -movflags +faststart "$out"
  echo "$v: Mix $I LUFS / $TP dBTP, Pegel ${G} dB -> fertig $(lufs "$out" I) LUFS / $(lufs "$out" Peak) dBTP, $(du -h "$out" | cut -f1 | tr -d ' ')"
  rsync -a "$out" "$HOST:$REMOTE/"
done
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,color_space -of csv=p=0 "$WORK/bild.mp4"
echo "Fertig: $HOST:~/$REMOTE/"
rm -rf "$WORK"
