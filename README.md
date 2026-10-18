# Die Königskatze

Ein kleines Pixel-Art-Story-Game im Browser, gebaut mit [Phaser 3](https://phaser.io), TypeScript und Vite.
Satire mit schwarzem Humor – nur für Erwachsene.

Du bist Wirt Horst. Deine Kneipe soll abgerissen werden, und der Anwalt Dr. von Glanz feiert schon.
Die Pennerkatze in der Gasse hat einen Vorschlag …

## Steuerung

- **PC:** WASD / Pfeiltasten laufen, E benutzen, Maus für Shop und Tresen, P Pause, M Ton
- **Handy:** Joystick links, E-Knopf rechts, alles andere antippen (quer halten)

## Entwickeln

```bash
npm install
npm run dev      # Dev-Server auf http://localhost:5173
npm run build    # fertige Website im Ordner dist/
```

Eigene Sounds lassen sich im Dev-Server unter `/recorder.html` aufnehmen und ersetzen dann die erzeugten Sounds.

## Veröffentlichen

Jeder Push auf `main` baut das Spiel per GitHub Actions und veröffentlicht es auf GitHub Pages
(Settings → Pages → Source: **GitHub Actions**).

## Lizenzen

- Phaser – MIT
- Schrift „Press Start 2P“ – SIL Open Font License 1.1
