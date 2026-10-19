# VGMPulse

English | [简体中文](README.zh-CN.md)

A VGM/VGZ music player with live waveforms for every channel.

![VGMPulse screenshot](docs/screenshot.png)

- Per-channel waveforms, level meters, and chip and channel names
- Playlists, seeking, looping, mute and solo
- Waveform and volume normalization, plus gain controls
- Mobile layouts, display density options, and English/Chinese UI

## Run locally

Requires Node.js 22.13 or later.

```sh
npm install
npm run dev
```

Build: `npm run build`.

## License

Copyright © 2017–2026 JamXi, JSG-LLC.

Licensed under [GNU GPL v3.0](LICENSE) (GPL-3.0-only).

The audio engine comes from [Chip Player JS](https://github.com/mmontag/chip-player-js) and uses [LibVGM](https://github.com/ValleyBell/libvgm). Third-party components retain their own copyrights and licenses; see [third-party notices](public/THIRD_PARTY_NOTICES.txt) and [engine sources](public/engine/NOTICE.txt).
