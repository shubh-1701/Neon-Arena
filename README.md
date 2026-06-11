# 🕹️ Neon Survival

An action-packed, web-based "Arena Survival" game inspired by the mechanics of *Vampire Survivors* and *Brotato*. Built entirely with native web technologies (HTML5 Canvas, Vanilla JavaScript, and CSS), **Neon Survival** drops you into an endless arena where you must survive hordes of relentless enemies, collect experience, and build your arsenal of glowing weapons.

## ✨ Features

- **Custom Game Engine:** Built from scratch using standard `requestAnimationFrame` for a smooth, high-performance web experience.
- **Auto-Combat Mechanics:** Focus entirely on positioning and dodging. Your weapons automatically track and fire at the nearest threats.
- **Dynamic Leveling System:** Collect green experience gems from fallen enemies to level up. Choose from randomized upgrades to create a unique build every run.
- **Persistent Progression:** The game tracks your total kills and achievements across runs using `localStorage`. 
- **Unlockable Arsenal:** Complete achievements to permanently unlock devastating new weapons in your upgrade pool:
  - 💥 **Shotgun Spread:** Annihilate close-range swarms.
  - 🚀 **Missile Strike:** Launch slow-moving rockets that erupt into massive area-of-effect explosions.
  - 🟣 **Orbit Shield:** Surround yourself with rotating orbs that crush enemies on contact.
  - 🟢 **Piercing Laser:** Slice through entire lines of enemies with a high-damage beam.
  - ⚡ **Plasma Gun:** Overwhelm targets with an incredibly fast rate of fire.
- **Boss Encounters:** Survive until the final 30 seconds of a level to trigger a high-stakes Boss battle!
- **Premium UI:** Features a sleek dark mode aesthetic with glowing neon accents, custom animations, and a satisfying user interface.

## 🚀 How to Play

Because the game is built with vanilla web technologies, no heavy game engine or installation is required!

1. Clone this repository.
2. Open the directory in your terminal and start a local HTTP server. For example, using Python:
   ```bash
   python3 -m http.server 8000
   ```
3. Open your browser and navigate to `http://localhost:8000`.
4. Select an unlocked level and use **WASD** or **Arrow Keys** to survive!

## 🛠️ Technology Stack

- **HTML5 Canvas:** For high-performance 2D rendering and game loops.
- **Vanilla JavaScript (ES6+):** Object-oriented game architecture (Player, Projectiles, Enemies, Collisions).
- **Vanilla CSS3:** For the UI overlays, flexbox layouts, and glowing neon effects.

## 📝 Developer

Created by a solo developer focusing on systems-driven design, emergent gameplay, and polished "game feel."
