// game.js - Terminal Protocol Core Engine

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const uiElements = {
    startScreen: document.getElementById('start-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    levelUpScreen: document.getElementById('level-up-screen'),
    victoryScreen: document.getElementById('victory-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    achievementsScreen: document.getElementById('achievements-screen'),
    levelSelectGrid: document.getElementById('level-select-grid'),
    achievementsList: document.getElementById('achievements-list'),
    hud: document.getElementById('hud'),
    restartBtn: document.getElementById('restart-btn'),
    nextLevelBtn: document.getElementById('next-level-btn'),
    victoryMenuBtn: document.getElementById('victory-menu-btn'),
    showAchievementsBtn: document.getElementById('show-achievements-btn'),
    closeAchievementsBtn: document.getElementById('close-achievements-btn'),
    resumeBtn: document.getElementById('resume-btn'),
    quitBtn: document.getElementById('quit-btn'),
    toggleSoundBtn: document.getElementById('toggle-sound-btn'),
    xpBar: document.getElementById('xp-bar'),
    healthBar: document.getElementById('health-bar'),
    levelDisplay: document.getElementById('level-display'),
    scoreDisplay: document.getElementById('score-display'),
    timeDisplay: document.getElementById('time-display'),
    upgradesContainer: document.getElementById('upgrades-container'),
    finalTime: document.getElementById('final-time'),
    finalScore: document.getElementById('final-score'),
    victoryScore: document.getElementById('victory-score'),
};

let gameState = 'START'; 
let lastTime = 0; let gameTime = 0; let animationFrameId;
let bossSpawned = false; let screenShakeAmount = 0;

// Hacker Audio Controller (Glitchy synth sounds)
class AudioController {
    constructor() { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.enabled = true; }
    playTone(freq, type, duration, vol) {
        if (!this.enabled || this.ctx.state === 'suspended') return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + duration);
    }
    playShoot() { this.playTone(1200, 'square', 0.05, 0.05); }
    playHit() { this.playTone(100, 'sawtooth', 0.2, 0.1); }
    playExplosion() { this.playTone(40, 'sawtooth', 0.5, 0.3); }
    playLevelUp() {
        if (!this.enabled) return;
        setTimeout(() => this.playTone(500, 'square', 0.1, 0.1), 0);
        setTimeout(() => this.playTone(700, 'square', 0.1, 0.1), 100);
        setTimeout(() => this.playTone(900, 'square', 0.3, 0.1), 200);
    }
}
const audio = new AudioController();

// Stats
let stats = JSON.parse(localStorage.getItem('terminalStats')) || { totalKills: 0, bossesDefeated: 0, highestLevelReached: 1 };
function saveStats() { localStorage.setItem('terminalStats', JSON.stringify(stats)); }

const LEVELS = [
    { id: 1, name: "Node: Localhost", duration: 120, enemySpeedMult: 1, enemyHealthMult: 1, baseSpawnRate: 1.0 },
    { id: 2, name: "Node: Proxy Net", duration: 180, enemySpeedMult: 1.3, enemyHealthMult: 1.5, baseSpawnRate: 0.8 },
    { id: 3, name: "Node: The Mainframe", duration: 240, enemySpeedMult: 1.5, enemyHealthMult: 2.0, baseSpawnRate: 0.5 }
];
let currentLevelIndex = 0;
let highestLevelUnlocked = parseInt(localStorage.getItem('terminalHighestNode') || '1');

const achievementsConfig = [
    { id: 'first_blood', name: 'Initialization', desc: 'Purge 50 corrupted files total.', reward: 'UDP Flood', isComplete: () => stats.totalKills >= 50 },
    { id: 'survivor', name: 'Uplink Established', desc: 'Reach Node 2.', reward: 'Logic Bomb', isComplete: () => highestLevelUnlocked >= 2 },
    { id: 'boss_slayer', name: 'Root Access', desc: 'Defeat a System Admin.', reward: 'Plasma Stream', isComplete: () => stats.bossesDefeated >= 1 }
];

function resizeCanvas() { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
window.addEventListener('keydown', (e) => { 
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true; 
    if (e.key === 'Escape') togglePause();
});
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

let player, enemies = [], projectiles = [], gems = [], floatingTexts = [], explosions = [], particles = [];

class Player {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 15; this.color = '#00ff41'; this.speed = 200;
        this.maxHealth = 100; this.health = this.maxHealth; this.level = 1; this.xp = 0; this.xpToNext = 100;
        this.score = 0; this.pickupRadius = 100;
        
        this.fireRate = 0.5; this.fireTimer = 0; this.damage = 10; this.projSpeed = 400;
        this.hasOrbitShield = false; this.orbitOrbs = 0; this.orbitRadius = 60; this.orbitAngle = 0; this.shieldDamage = 20;
        this.hasLaser = false; this.laserRate = 2.0; this.laserTimer = 0; this.laserDamage = 30;
        this.hasShotgun = false; this.shotgunRate = 1.0; this.shotgunTimer = 0; this.shotgunDamage = 15;
        this.hasMissile = false; this.missileRate = 3.0; this.missileTimer = 0; this.missileDamage = 50;
        this.hasPlasma = false; this.plasmaRate = 0.1; this.plasmaTimer = 0; this.plasmaDamage = 3;
    }
    update(dt) {
        let dx = 0; let dy = 0;
        if (keys.w || keys.ArrowUp) dy -= 1; if (keys.s || keys.ArrowDown) dy += 1;
        if (keys.a || keys.ArrowLeft) dx -= 1; if (keys.d || keys.ArrowRight) dx += 1;
        if (dx !== 0 && dy !== 0) { const length = Math.sqrt(dx * dx + dy * dy); dx /= length; dy /= length; }
        this.x += dx * this.speed * dt; this.y += dy * this.speed * dt;
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        const target = this.getClosestEnemy();
        this.fireTimer -= dt; if (this.fireTimer <= 0 && target) { this.fireTimer = this.fireRate; this.shootNormal(target); }
        if (this.hasPlasma) { this.plasmaTimer -= dt; if (this.plasmaTimer <= 0 && target) { this.plasmaTimer = this.plasmaRate; this.shootPlasma(target); } }
        if (this.hasShotgun) { this.shotgunTimer -= dt; if (this.shotgunTimer <= 0 && target) { this.shotgunTimer = this.shotgunRate; this.shootShotgun(target); } }
        if (this.hasLaser) { this.laserTimer -= dt; if (this.laserTimer <= 0 && target) { this.laserTimer = this.laserRate; this.shootLaser(target); } }
        if (this.hasMissile) { this.missileTimer -= dt; if (this.missileTimer <= 0 && target) { this.missileTimer = this.missileRate; this.shootMissile(target); } }
        if (this.hasOrbitShield) this.orbitAngle += dt * 3;

        gems.forEach(gem => { if (Math.hypot(gem.x - this.x, gem.y - this.y) < this.pickupRadius) gem.pullToPlayer = true; });
    }
    draw(ctx) {
        ctx.fillStyle = this.color; ctx.font = 'bold 24px "Courier Prime"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillText('@', this.x, this.y);
        
        if (this.hasOrbitShield && this.orbitOrbs > 0) {
            ctx.shadowBlur = 10; ctx.shadowColor = '#00ff41'; ctx.fillStyle = '#00ff41'; ctx.font = 'bold 16px "Courier Prime"';
            const angleStep = (Math.PI * 2) / this.orbitOrbs;
            for (let i = 0; i < this.orbitOrbs; i++) {
                const angle = this.orbitAngle + i * angleStep;
                ctx.fillText('[X]', this.x + Math.cos(angle) * this.orbitRadius, this.y + Math.sin(angle) * this.orbitRadius);
            }
        }
        ctx.shadowBlur = 0;
    }
    getClosestEnemy() {
        if (enemies.length === 0) return null; let closest = null; let minDist = Infinity;
        enemies.forEach(e => { const dist = Math.hypot(e.x - this.x, e.y - this.y); if (dist < minDist) { minDist = dist; closest = e; } });
        return closest;
    }
    shootNormal(target) { const angle = Math.atan2(target.y - this.y, target.x - this.x); projectiles.push(new Projectile(this.x, this.y, angle, this.projSpeed, this.damage, 'normal')); audio.playShoot(); }
    shootPlasma(target) { const angle = Math.atan2(target.y - this.y, target.x - this.x) + (Math.random() - 0.5) * 0.2; projectiles.push(new Projectile(this.x, this.y, angle, this.projSpeed * 2, this.plasmaDamage, 'plasma')); audio.playShoot(); }
    shootShotgun(target) {
        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        projectiles.push(new Projectile(this.x, this.y, angle, this.projSpeed * 1.2, this.shotgunDamage, 'shotgun'));
        projectiles.push(new Projectile(this.x, this.y, angle - 0.2, this.projSpeed * 1.2, this.shotgunDamage, 'shotgun'));
        projectiles.push(new Projectile(this.x, this.y, angle + 0.2, this.projSpeed * 1.2, this.shotgunDamage, 'shotgun'));
        audio.playShoot();
    }
    shootLaser(target) { const angle = Math.atan2(target.y - this.y, target.x - this.x); projectiles.push(new Projectile(this.x, this.y, angle, this.projSpeed * 1.5, this.laserDamage, 'laser')); audio.playShoot(); }
    shootMissile(target) { const angle = Math.atan2(target.y - this.y, target.x - this.x); projectiles.push(new Projectile(this.x, this.y, angle, this.projSpeed * 0.5, this.missileDamage, 'missile')); audio.playShoot(); }
    takeDamage(amount) {
        this.health -= amount; updateHUD(); screenShakeAmount = 15; audio.playHit();
        if (this.health <= 0) endGame();
    }
    addXp(amount) {
        this.xp += amount; this.score += amount * 10;
        if (this.xp >= this.xpToNext) { this.xp -= this.xpToNext; this.level++; this.xpToNext = Math.floor(this.xpToNext * 1.5); triggerLevelUp(); }
        updateHUD();
    }
}

class Enemy {
    constructor(x, y, type = 1) {
        this.x = x; this.y = y; this.type = type; this.shieldDamageTimer = 0;
        const currentLevel = LEVELS[currentLevelIndex]; const scale = 1 + (gameTime / 60) * 0.5; 
        this.radius = 12; this.speed = (50 + Math.random() * 30) * currentLevel.enemySpeedMult;
        this.maxHealth = 20 * scale * currentLevel.enemyHealthMult; this.damage = 10 * scale; this.xpValue = 10;
        
        const glitchChars = ['%','&','#','?','!','§','£','¥'];
        this.char = glitchChars[Math.floor(Math.random() * glitchChars.length)];
        this.color = '#ff003c';

        if (type === 2) { 
            this.radius = 18; this.char = 'T'; this.color = '#ff9900'; 
            this.speed *= 1.2; this.maxHealth *= 3; this.xpValue = 30; 
        } 
        else if (type === 3) { 
            this.radius = 50; this.char = 'ADMIN'; this.color = '#ff0000'; 
            this.speed = 40 * currentLevel.enemySpeedMult; this.maxHealth = 1500 * currentLevel.enemyHealthMult; 
            this.damage = 30 * scale; this.xpValue = 500; 
        }
        this.health = this.maxHealth;
    }
    update(dt) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed * dt; this.y += Math.sin(angle) * this.speed * dt;
        if (Math.hypot(this.x - player.x, this.y - player.y) < this.radius + player.radius) {
            player.takeDamage(this.damage);
            if (this.type !== 3) this.health = 0; else { player.x -= Math.cos(angle) * 30; player.y -= Math.sin(angle) * 30; }
        }
        if (this.shieldDamageTimer > 0) this.shieldDamageTimer -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = this.color; ctx.font = `bold ${this.type === 3 ? '40px' : (this.type === 2 ? '28px' : '20px')} "Courier Prime"`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = this.type === 3 ? 20 : 10; ctx.shadowColor = this.color;
        
        if (Math.random() > 0.9 && this.type !== 3) ctx.fillText(Math.random() > 0.5 ? '0' : '1', this.x, this.y);
        else ctx.fillText(this.char, this.x, this.y);
        
        ctx.shadowBlur = 0;
        if (this.type === 3) {
            ctx.fillStyle = '#000'; ctx.fillRect(this.x - 40, this.y - 65, 80, 8);
            ctx.fillStyle = this.color; ctx.fillRect(this.x - 40, this.y - 65, 80 * (this.health/this.maxHealth), 8);
        }
    }
}

class Projectile {
    constructor(x, y, angle, speed, damage, type) {
        this.x = x; this.y = y; this.angle = angle; this.speed = speed; this.damage = damage; this.type = type;
        this.radius = type === 'laser' ? 8 : (type === 'missile' ? 6 : 4);
        
        const map = {
            'normal': { char: '-', color: '#00ff41' },
            'laser': { char: '===>', color: '#00ff41' },
            'shotgun': { char: '~', color: '#00ff41' },
            'missile': { char: '[X]', color: '#ff003c' },
            'plasma': { char: '.', color: '#00ff41' }
        };
        this.char = map[type].char; this.color = map[type].color; this.hitSet = new Set();
    }
    update(dt) { this.x += Math.cos(this.angle) * this.speed * dt; this.y += Math.sin(this.angle) * this.speed * dt; }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.fillStyle = this.color; ctx.font = 'bold 16px "Courier Prime"';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 5; ctx.shadowColor = this.color;
        ctx.fillText(this.char, 0, 0);
        ctx.restore();
    }
}

class Explosion {
    constructor(x, y, radius, damage) {
        this.x = x; this.y = y; this.maxRadius = radius; this.radius = 0; this.damage = damage;
        this.life = 0.3; this.maxLife = 0.3; this.color = '#ff003c';
        audio.playExplosion(); screenShakeAmount = 10;
        enemies.forEach((e, index) => {
            if (Math.hypot(this.x - e.x, this.y - e.y) <= this.maxRadius + e.radius) {
                if (damageEnemy(e, this.damage, this.color)) enemies.splice(index, 1);
            }
        });
    }
    update(dt) { this.life -= dt; this.radius = this.maxRadius * (1 - this.life / this.maxLife); }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.strokeStyle = this.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.stroke();
        
        ctx.fillStyle = this.color; ctx.font = '12px "Courier Prime"';
        for(let i=0; i<5; i++) {
            ctx.fillText(Math.random()>0.5?'0':'1', this.x + (Math.random()-0.5)*this.radius, this.y + (Math.random()-0.5)*this.radius);
        }
        ctx.globalAlpha = 1.0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2; const speed = 50 + Math.random() * 150;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.life = 0.5 + Math.random() * 0.5; this.maxLife = this.life;
        this.char = Math.random() > 0.5 ? '0' : '1';
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color; ctx.font = '10px "Courier Prime"'; ctx.fillText(this.char, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class Gem {
    constructor(x, y, value) {
        this.x = x; this.y = y; this.value = value;
        this.radius = value > 10 ? 6 : 4; 
        this.color = '#008f11'; this.char = value > 10 ? '{10}' : '01';
        this.pullToPlayer = false; this.pullSpeed = 300;
    }
    update(dt) {
        if (this.pullToPlayer) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(angle) * this.pullSpeed * dt; this.y += Math.sin(angle) * this.pullSpeed * dt;
            this.pullSpeed += 500 * dt;
            if (Math.hypot(this.x - player.x, this.y - player.y) < player.radius + this.radius) { player.addXp(this.value); this.value = 0; }
        }
    }
    draw(ctx) {
        ctx.shadowBlur = 5; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
        ctx.font = 'bold 12px "Courier Prime"'; ctx.textAlign = 'center';
        ctx.fillText(this.char, this.x, this.y); ctx.shadowBlur = 0;
    }
}

class FloatingText {
    constructor(x, y, text, color) { this.x = x; this.y = y; this.text = text; this.color = color; this.life = 0.8; this.maxLife = 0.8; }
    update(dt) { this.y -= 30 * dt; this.life -= dt; }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color; ctx.font = 'bold 16px "Courier Prime"'; ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y); ctx.globalAlpha = 1.0;
    }
}

// Systems
let spawnTimer = 0;
function spawnEnemies(dt) {
    const currentLevel = LEVELS[currentLevelIndex];
    const timeLeft = Math.max(0, currentLevel.duration - gameTime);
    if (timeLeft <= 30 && !bossSpawned) {
        enemies.push(new Enemy(canvas.width / 2, -100, 3));
        floatingTexts.push(new FloatingText(canvas.width/2, canvas.height/2, "FATAL ERROR: ROOTKIT DETECTED", "#ff003c"));
        bossSpawned = true;
    }
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnTimer = Math.max(0.1, currentLevel.baseSpawnRate - (gameTime / 120)); 
        let x, y;
        if (Math.random() > 0.5) { x = Math.random() > 0.5 ? -30 : canvas.width + 30; y = Math.random() * canvas.height; } 
        else { x = Math.random() * canvas.width; y = Math.random() > 0.5 ? -30 : canvas.height + 30; }
        enemies.push(new Enemy(x, y, Math.random() > 0.85 ? 2 : 1));
    }
}

function damageEnemy(enemy, damageAmount, color) {
    enemy.health -= damageAmount;
    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 10, `-${Math.floor(damageAmount)}`, color));
    if (enemy.health <= 0) {
        gems.push(new Gem(enemy.x, enemy.y, enemy.xpValue));
        for(let i=0; i<8; i++) particles.push(new Particle(enemy.x, enemy.y, enemy.color));
        stats.totalKills++; if (enemy.type === 3) stats.bossesDefeated++;
        saveStats(); return true; 
    }
    return false;
}

function handleCollisions() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i]; let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (p.type === 'laser' && p.hitSet.has(e)) continue;
            if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
                if (p.type === 'missile') { explosions.push(new Explosion(p.x, p.y, 80, p.damage)); hit = true; break; }
                if (damageEnemy(e, p.damage, p.color)) enemies.splice(j, 1);
                if (p.type === 'laser') p.hitSet.add(e); else { hit = true; break; }
            }
        }
        if (hit || p.x < -100 || p.x > canvas.width+100 || p.y < -100 || p.y > canvas.height+100) projectiles.splice(i, 1);
    }

    if (player.hasOrbitShield && player.orbitOrbs > 0) {
        const angleStep = (Math.PI * 2) / player.orbitOrbs;
        for (let i = 0; i < player.orbitOrbs; i++) {
            const angle = player.orbitAngle + i * angleStep;
            const orbX = player.x + Math.cos(angle) * player.orbitRadius; const orbY = player.y + Math.sin(angle) * player.orbitRadius;
            for (let j = enemies.length - 1; j >= 0; j--) {
                let e = enemies[j];
                if (e.shieldDamageTimer > 0) continue;
                if (Math.hypot(orbX - e.x, orbY - e.y) < 15 + e.radius) {
                    e.shieldDamageTimer = 0.5;
                    if (damageEnemy(e, player.shieldDamage, '#00ff41')) enemies.splice(j, 1);
                }
            }
        }
    }
}

const upgradePool = [
    { title: 'Overclock CPU', desc: 'Increase Fire Rate', weight: 10, condition: () => true, apply: () => player.fireRate *= 0.8 },
    { title: 'Inject Payload', desc: 'Increase Damage', weight: 10, condition: () => true, apply: () => player.damage += 5 },
    { title: 'Bandwidth++', desc: 'Increase Speed', weight: 10, condition: () => true, apply: () => player.speed += 30 },
    { title: 'Data Scrape', desc: 'Increase Pickup Radius', weight: 10, condition: () => true, apply: () => player.pickupRadius += 50 },
    { title: 'Run Diagnostics', desc: 'Restore 50% HP', weight: 5, condition: () => true, apply: () => { player.health = Math.min(player.maxHealth, player.health + player.maxHealth/2); updateHUD(); } },
    { title: 'Active Firewall', desc: 'Deploy rotating defense node', weight: 10, condition: () => !player.hasOrbitShield, apply: () => { player.hasOrbitShield = true; player.orbitOrbs = 1; } },
    { title: 'Expand Firewall', desc: 'Add extra defense node', weight: 8, condition: () => player.hasOrbitShield, apply: () => player.orbitOrbs++ },
    { title: 'Rootkit Beam', desc: 'Deploy piercing logic beam', weight: 10, condition: () => !player.hasLaser, apply: () => player.hasLaser = true },
    { title: 'Optimize Rootkit', desc: 'Execute beam faster', weight: 8, condition: () => player.hasLaser, apply: () => player.laserRate *= 0.8 },
    { title: 'UDP Flood', desc: 'Deploy spread packet attack', weight: 10, condition: () => !player.hasShotgun && achievementsConfig[0].isComplete(), apply: () => player.hasShotgun = true },
    { title: 'Amplify Flood', desc: 'Increase UDP damage', weight: 8, condition: () => player.hasShotgun, apply: () => player.shotgunDamage += 10 },
    { title: 'Logic Bomb', desc: 'Deploy explosive payloads', weight: 10, condition: () => !player.hasMissile && achievementsConfig[1].isComplete(), apply: () => player.hasMissile = true },
    { title: 'Rapid Bombing', desc: 'Deploy Logic Bombs faster', weight: 8, condition: () => player.hasMissile, apply: () => player.missileRate *= 0.8 },
    { title: 'Plasma Stream', desc: 'Deploy high-velocity stream', weight: 10, condition: () => !player.hasPlasma && achievementsConfig[2].isComplete(), apply: () => player.hasPlasma = true },
    { title: 'Stream Overflow', desc: 'Insane stream fire rate', weight: 8, condition: () => player.hasPlasma, apply: () => player.plasmaRate *= 0.7 }
];

function triggerLevelUp() {
    gameState = 'LEVEL_UP'; audio.playLevelUp();
    uiElements.levelUpScreen.classList.remove('hidden'); uiElements.upgradesContainer.innerHTML = '';
    let available = upgradePool.filter(u => u.condition()); available.sort(() => 0.5 - Math.random());
    available.slice(0, 3).forEach(upgrade => {
        const card = document.createElement('div'); card.className = 'upgrade-card';
        card.innerHTML = `<h3>> ${upgrade.title}</h3><p>${upgrade.desc}</p>`;
        card.onclick = () => { upgrade.apply(); resumeGame(); };
        uiElements.upgradesContainer.appendChild(card);
    });
}

function resumeGame() { gameState = 'PLAYING'; uiElements.levelUpScreen.classList.add('hidden'); lastTime = performance.now(); requestAnimationFrame(gameLoop); }

function togglePause() {
    if (gameState === 'PLAYING') { gameState = 'PAUSED'; uiElements.pauseScreen.classList.remove('hidden'); } 
    else if (gameState === 'PAUSED') { gameState = 'PLAYING'; uiElements.pauseScreen.classList.add('hidden'); lastTime = performance.now(); requestAnimationFrame(gameLoop); }
}

function updateHUD() {
    uiElements.xpBar.style.width = `${(player.xp / player.xpToNext) * 100}%`;
    uiElements.healthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
    uiElements.levelDisplay.innerText = player.level; uiElements.scoreDisplay.innerText = player.score;
}

function updateTimeDisplay() {
    const timeLeft = Math.max(0, LEVELS[currentLevelIndex].duration - gameTime);
    uiElements.timeDisplay.innerText = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${Math.floor(timeLeft % 60).toString().padStart(2, '0')}`;
}

function startGame(levelIndex) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    currentLevelIndex = levelIndex; player = new Player(canvas.width / 2, canvas.height / 2);
    enemies = []; projectiles = []; gems = []; floatingTexts = []; explosions = []; particles = [];
    gameTime = 0; bossSpawned = false; screenShakeAmount = 0;
    
    updateHUD(); updateTimeDisplay();
    uiElements.startScreen.classList.add('hidden'); uiElements.gameOverScreen.classList.add('hidden'); uiElements.victoryScreen.classList.add('hidden'); uiElements.achievementsScreen.classList.add('hidden'); uiElements.pauseScreen.classList.add('hidden');
    uiElements.hud.classList.remove('hidden');
    
    gameState = 'PLAYING'; lastTime = performance.now(); requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState = 'GAME_OVER'; uiElements.hud.classList.add('hidden'); uiElements.gameOverScreen.classList.remove('hidden');
    uiElements.finalTime.innerText = uiElements.timeDisplay.innerText; uiElements.finalScore.innerText = player.score;
}

function triggerVictory() {
    gameState = 'VICTORY'; uiElements.hud.classList.add('hidden'); uiElements.victoryScreen.classList.remove('hidden'); uiElements.victoryScore.innerText = player.score;
    if (currentLevelIndex + 1 >= highestLevelUnlocked && currentLevelIndex + 1 < LEVELS.length) {
        highestLevelUnlocked = currentLevelIndex + 2; localStorage.setItem('terminalHighestNode', highestLevelUnlocked);
    }
    uiElements.nextLevelBtn.classList.toggle('hidden', currentLevelIndex + 1 >= LEVELS.length);
}

// Background Hex Grid
function drawBackground() {
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 255, 65, 0.05)'; ctx.font = '14px "Courier Prime"';
    const cols = Math.floor(canvas.width / 40); const rows = Math.floor(canvas.height / 40);
    for (let x = 0; x <= cols; x++) {
        for (let y = 0; y <= rows; y++) {
            if (Math.random() > 0.98) ctx.fillText(Math.floor(Math.random()*16).toString(16).toUpperCase(), x*40, (y*40 + gameTime*20) % canvas.height);
        }
    }
}

function gameLoop(timestamp) {
    if (gameState !== 'PLAYING') return;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); lastTime = timestamp; gameTime += dt;

    ctx.save();
    if (screenShakeAmount > 0) {
        ctx.translate((Math.random() - 0.5) * screenShakeAmount, (Math.random() - 0.5) * screenShakeAmount);
        screenShakeAmount -= dt * 30; if (screenShakeAmount < 0) screenShakeAmount = 0;
    }

    drawBackground();

    player.update(dt); spawnEnemies(dt);
    
    enemies.forEach(e => e.update(dt)); projectiles.forEach(p => p.update(dt)); gems.forEach(g => g.update(dt));
    floatingTexts.forEach(f => f.update(dt)); explosions.forEach(ex => ex.update(dt)); particles.forEach(p => p.update(dt));
    
    handleCollisions();
    
    gems = gems.filter(g => g.value > 0); floatingTexts = floatingTexts.filter(f => f.life > 0); explosions = explosions.filter(ex => ex.life > 0); particles = particles.filter(p => p.life > 0);

    particles.forEach(p => p.draw(ctx)); explosions.forEach(ex => ex.draw(ctx)); gems.forEach(g => g.draw(ctx)); projectiles.forEach(p => p.draw(ctx));
    enemies.forEach(e => e.draw(ctx)); player.draw(ctx); floatingTexts.forEach(f => f.draw(ctx));

    ctx.restore();
    updateTimeDisplay();
    if (gameTime >= LEVELS[currentLevelIndex].duration) { triggerVictory(); return; }
    if (gameState === 'PLAYING') animationFrameId = requestAnimationFrame(gameLoop);
}

function showMainMenu() {
    gameState = 'START';
    uiElements.gameOverScreen.classList.add('hidden'); uiElements.victoryScreen.classList.add('hidden');
    uiElements.hud.classList.add('hidden'); uiElements.achievementsScreen.classList.add('hidden'); uiElements.pauseScreen.classList.add('hidden');
    uiElements.startScreen.classList.remove('hidden'); renderLevelSelect();
}

function renderLevelSelect() {
    uiElements.levelSelectGrid.innerHTML = '';
    LEVELS.forEach((level, index) => {
        const isUnlocked = (index + 1) <= highestLevelUnlocked;
        const card = document.createElement('div'); card.className = `upgrade-card ${isUnlocked ? '' : 'locked'}`;
        card.innerHTML = `<h3>${level.id}. ${level.name}</h3><p>Est. Time: ${level.duration / 60}m</p>`;
        if (isUnlocked) card.onclick = () => startGame(index); else card.innerHTML += `<p style="color:red; margin-top:10px;">LOCKED</p>`;
        uiElements.levelSelectGrid.appendChild(card);
    });
}

function renderAchievements() {
    uiElements.startScreen.classList.add('hidden'); uiElements.achievementsScreen.classList.remove('hidden'); uiElements.achievementsList.innerHTML = '';
    achievementsConfig.forEach(ach => {
        const isDone = ach.isComplete(); const item = document.createElement('div'); item.className = `achievement-item ${isDone ? 'completed' : ''}`;
        item.innerHTML = `<div><h3>${ach.name}</h3><p>${ach.desc}</p></div><div class="achievement-reward">${isDone ? 'UNLOCKED' : 'LOCKED'}<br><span style="font-size:0.8rem; font-weight:normal; color:#fff;">Payload: ${ach.reward}</span></div>`;
        uiElements.achievementsList.appendChild(item);
    });
}

// Events
uiElements.restartBtn.addEventListener('click', () => startGame(currentLevelIndex));
uiElements.nextLevelBtn.addEventListener('click', () => startGame(currentLevelIndex + 1));
uiElements.victoryMenuBtn.addEventListener('click', showMainMenu);
uiElements.showAchievementsBtn.addEventListener('click', renderAchievements);
uiElements.closeAchievementsBtn.addEventListener('click', showMainMenu);
uiElements.resumeBtn.addEventListener('click', togglePause);
uiElements.quitBtn.addEventListener('click', showMainMenu);
uiElements.toggleSoundBtn.addEventListener('click', () => { audio.enabled = !audio.enabled; uiElements.toggleSoundBtn.innerText = audio.enabled ? "🔊 ON" : "🔇 OFF"; if (audio.enabled && audio.ctx.state === 'suspended') audio.ctx.resume(); });

// Init
renderLevelSelect();
drawBackground();
