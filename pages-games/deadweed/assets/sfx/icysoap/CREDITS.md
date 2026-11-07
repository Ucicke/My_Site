# Organic foley — IcySoap

Author: Stephen / IcySoap.
Source: https://icysoap.itch.io/free-gore-foley-sound-pack
Downloaded: 25 October 2026 (Moscow).

The author describes the collection as 57 gore/bone-breaking WAV recordings made by breaking cardboard. The source page permits free use with author credit. Attribution is included in the game's About screen. No separate license file was supplied in the archive; this notice records the stated permission, rather than assigning a new license.

Only six recordings are included:

| Game file | Original archive file | Role |
|---|---|---|
| crack-a.ogg | gore foley/gore-008.wav | light impact |
| crack-b.ogg | gore foley/gore-040.wav | impact variation |
| crack-c.ogg | gore foley/gore-045.wav | heavy impact |
| tear-a.ogg | gore foley/gore-003.wav | small plant rupture |
| tear-b.ogg | gore foley/gore-019.wav | rupture variation |
| graft.ogg | gore foley/gore-027.wav | fusion and large rupture |

Processing: leading/trailing silence removed at -45 dB; FFmpeg loudnorm target -20 LUFS / -3 dBTP / LRA 7; mono, 32 kHz, Ogg Vorbis quality 4. Runtime uses conservative gain, short fade-outs, event cooldowns and the existing 24-source cap. Samples are decoded once after user interaction; failed/missing audio falls back to procedural presets. Variation uses counters, not gameplay RNG.

Additional wet foley from Flesh and Fracture Lite is documented separately in ../flesh-fracture/CREDITS.md.
