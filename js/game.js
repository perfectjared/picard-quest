// Game state
const gameState = {
    player: {
        x: 8, y: 8, z: 1, angle: 0,
        velocityX: 0, velocityY: 0,
        maxSpeed: 0.15, acceleration: 0.1, friction: 0.85, rotSpeed: 0.05
    },
    
    // Single room map with elevator at end
    map: [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    mapWidth: 16, mapHeight: 16,
    
    // Game systems
    enemies: [], tunnelOpen: false,
    
    // Intro sequence
    introState: 'intro', // 'intro', 'waiting', 'fading', 'game'
    introTimer: 0, fadeAlpha: 1.0, starLines: [],
    textAlpha: 0.0, textTimer: 0,
    
    // Elevator system
    elevatorFlashTimer: 0, elevatorFlashState: false,
    
    // Ending sequence
    endingState: 'none', // 'none', 'fading', 'video'
    endingFadeAlpha: 0.0, endingVideo: null,
    
    // Q sound system
    qSoundTimer: 0, qSoundInterval: 180 // 3 seconds at 60fps
};

// Global keyboard state
const keyboardState = {
    W: false, A: false, S: false, D: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
};

// Three.js globals
let scene, camera, renderer, walls = [], projectiles = [], enemies = [], elevator = null;

function initThreeJS() {
    console.log('Initializing Three.js...');
    
    // Show UI elements
    ['crosshair', 'weapon-sprite', 'picard-portrait'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = id === 'crosshair' ? 'block' : 'flex';
    });
    
    // Create scene and camera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(gameState.player.x, gameState.player.z, gameState.player.y);
    
    // Set initial camera direction
    const lookX = gameState.player.x + Math.cos(gameState.player.angle);
    const lookY = gameState.player.y + Math.sin(gameState.player.angle);
    camera.lookAt(lookX, gameState.player.z, lookY);
    
    // Create renderer with retro settings
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('three-canvas'),
        antialias: false, powerPreference: "high-performance"
    });
    
    renderer.setPixelRatio(0.5); // Half resolution for retro look
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    renderer.sortObjects = false;
    renderer.domElement.id = 'three-canvas';
    
    // Add retro CSS styling
    renderer.domElement.style.imageRendering = 'pixelated';
    
    // Add lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(8, 10, 8);
    scene.add(directionalLight);
    
    // Create world
    createWorld();
    
    console.log('Three.js initialized');
}

function createWorld() {
    // Clear existing walls
    walls.forEach(wall => scene.remove(wall));
    walls = [];
    
    // Create floor and ceiling
    const floorGeometry = new THREE.PlaneGeometry(gameState.mapWidth, gameState.mapHeight);
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x1e3a8a }); // Dark blue
    const ceilingMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
    
    applyRetroEffect(floorMaterial);
    applyRetroEffect(ceilingMaterial);
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(gameState.mapWidth / 2, 0, gameState.mapHeight / 2);
    scene.add(floor);
    
    const ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(gameState.mapWidth / 2, 3, gameState.mapHeight / 2);
    scene.add(ceiling);
    
    // Create walls based on map
    const wallGeometry = new THREE.BoxGeometry(1, 3, 1);
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xf5f5dc }); // Beige
    applyRetroEffect(wallMaterial);
    
    for (let y = 0; y < gameState.mapHeight; y++) {
        for (let x = 0; x < gameState.mapWidth; x++) {
            if (gameState.map[y][x] === 1) {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(x + 0.5, 1.5, y + 0.5);
                scene.add(wall);
                walls.push(wall);
            }
        }
    }
    
    console.log('World created with', walls.length, 'walls');
    
    // Create game objects
    createEnemies();
    createElevator();
}

function playSound(soundFile) {
    const audio = new Audio(soundFile);
    audio.volume = 0.02; // 2% volume (much quieter)
    audio.play().catch(e => console.log('Audio play failed:', e));
}

function quantizeColor(color, levels = 8) {
    const r = Math.floor(color.r * levels) / levels;
    const g = Math.floor(color.g * levels) / levels;
    const b = Math.floor(color.b * levels) / levels;
    return new THREE.Color(r, g, b);
}

function applyRetroEffect(material) {
    if (material.color) {
        material.color = quantizeColor(material.color, 6);
    }
}

function canMoveTo(x, y) {
    const playerRadius = 1.0;
    const checkPoints = [
        { x, y }, // Center
        { x: x + playerRadius, y }, // Right
        { x: x - playerRadius, y }, // Left
        { x, y: y + playerRadius }, // Forward
        { x, y: y - playerRadius }, // Backward
        { x: x + playerRadius * 0.7, y: y + playerRadius * 0.7 }, // Diagonals
        { x: x - playerRadius * 0.7, y: y + playerRadius * 0.7 },
        { x: x + playerRadius * 0.7, y: y - playerRadius * 0.7 },
        { x: x - playerRadius * 0.7, y: y - playerRadius * 0.7 }
    ];
    
    for (const point of checkPoints) {
        const mapX = Math.floor(point.x);
        const mapY = Math.floor(point.y);
        
        if (mapX < 0 || mapX >= gameState.mapWidth || mapY < 0 || mapY >= gameState.mapHeight) {
            return false;
        }
        
        if (gameState.map[mapY][mapX] === 1) {
            return false;
        }
    }
    
    return true;
}

function createProjectile() {
    playSound('assets/tng_phaser3_clean.mp3');
    
    // Calculate direction from player's angle
    const directionX = Math.cos(gameState.player.angle);
    const directionY = Math.sin(gameState.player.angle);
    
    // Create projectile
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.8);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0xffff00, transparent: false, opacity: 1.0
    });
    applyRetroEffect(material);
    
    const projectile = new THREE.Mesh(geometry, material);
    projectile.position.set(gameState.player.x, gameState.player.z, gameState.player.y);
    projectile.rotation.y = gameState.player.angle;
    
    // Set velocity (30% speed)
    projectile.velocityX = directionX * 0.5 * 0.3;
    projectile.velocityY = directionY * 0.5 * 0.3;
    projectile.velocityZ = 0;
    
    // Physics properties
    projectile.hasPhysics = false;
    projectile.physicsTimer = 0;
    projectile.gravity = 0.01;
    projectile.physicsVelocityY = 0;
    
    scene.add(projectile);
    projectiles.push(projectile);
}

function createEnemies() {
    // Clear existing enemies
    enemies.forEach(enemy => scene.remove(enemy));
    enemies = [];
    gameState.enemies = [];
    
    const qClipAssets = ['assets/q-clip-1.mp4', 'assets/q-clip-2.mp4', 'assets/q-clip-3.mp4'];
    
    // Create 5 enemies
    for (let i = 0; i < 5; i++) {
        let x, y, attempts = 0;
        
        // Find valid spawn position
        do {
            x = Math.random() * 16;
            y = Math.random() * 16;
            attempts++;
        } while ((!canMoveTo(x, y) || 
                 Math.abs(x - gameState.player.x) < 2 || 
                 Math.abs(y - gameState.player.y) < 2) && attempts < 50);
        
        if (attempts < 50) {
            // Create video texture
            const video = document.createElement('video');
            video.src = qClipAssets[Math.floor(Math.random() * qClipAssets.length)];
            video.loop = video.muted = video.autoplay = true;
            video.crossOrigin = 'anonymous';
            video.playsInline = true;
            
            const enemyTexture = new THREE.VideoTexture(video);
            enemyTexture.minFilter = enemyTexture.magFilter = THREE.LinearFilter;
            
            // Create enemy mesh
            const geometry = new THREE.PlaneGeometry(1.5, 1.65);
            const material = new THREE.MeshBasicMaterial({ 
                map: enemyTexture, transparent: true, side: THREE.DoubleSide
            });
            
            const enemy = new THREE.Mesh(geometry, material);
            enemy.position.set(x, 0.825, y);
            
            // Add enemy properties
            enemy.velocityX = enemy.velocityY = 0;
            enemy.moveTimer = Math.random() * 60;
            enemy.moveSpeed = 0.01 + Math.random() * 0.015;
            enemy.health = 2;
            enemy.hitTimer = 0;
            
            scene.add(enemy);
            enemies.push(enemy);
            gameState.enemies.push({
                mesh: enemy, x, y,
                velocityX: 0, velocityY: 0,
                moveTimer: enemy.moveTimer,
                moveSpeed: enemy.moveSpeed,
                health: 2, hitTimer: 0
            });
        }
    }
    
    console.log('Created', enemies.length, 'enemies');
}

function createElevator() {
    const elevatorGeometry = new THREE.BoxGeometry(1, 3, 1);
    const elevatorMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x888888, transparent: false, opacity: 1.0
    });
    applyRetroEffect(elevatorMaterial);
    
    elevator = new THREE.Mesh(elevatorGeometry, elevatorMaterial);
    elevator.position.set(8, 1.5, 14); // At the end of the room
    scene.add(elevator);
}

function openTunnel() {
    if (gameState.tunnelOpen) return;
    
    playSound('assets/tng_door_open.mp3');
    gameState.map[8][15] = 0; // Open tunnel entrance
    gameState.tunnelOpen = true;
}

function updateEnemies() {
    // Update Q sound timer
    if (gameState.enemies.length > 0) {
        gameState.qSoundTimer++;
        if (gameState.qSoundTimer >= gameState.qSoundInterval) {
            gameState.qSoundTimer = 0;
            
            const qSounds = [
                'assets/Q _I suggest you change attitude_.WAV',
                'assets/Q _Savage life forms_.WAV',
                'assets/Q _So be it fools_.WAV',
                'assets/Q _Your time is up captain_.WAV'
            ];
            
            const randomSound = qSounds[Math.floor(Math.random() * qSounds.length)];
            playSound(randomSound);
        }
    } else {
        gameState.qSoundTimer = 0;
    }
    
    // Update each enemy
    gameState.enemies.forEach((enemyData, index) => {
        const enemy = enemyData.mesh;
        
        // Update hit effect timer
        if (enemyData.hitTimer > 0) {
            enemyData.hitTimer--;
            if (enemyData.hitTimer === 0) {
                enemy.material.color.setHex(0xffffff);
            }
        }
        
        // Update movement
        enemyData.moveTimer--;
        
        if (enemyData.moveTimer <= 0) {
            const distanceToPlayer = Math.sqrt(
                Math.pow(enemyData.x - gameState.player.x, 2) + 
                Math.pow(enemyData.y - gameState.player.y, 2)
            );
            
            let angle;
            if (distanceToPlayer < 3) {
                // Move away from player
                const awayFromPlayerX = enemyData.x - gameState.player.x;
                const awayFromPlayerY = enemyData.y - gameState.player.y;
                angle = Math.atan2(awayFromPlayerY, awayFromPlayerX);
            } else {
                // Random movement with player avoidance
                angle = Math.random() * Math.PI * 2;
                
                const testX = enemyData.x + Math.cos(angle) * enemyData.moveSpeed * 10;
                const testY = enemyData.y + Math.sin(angle) * enemyData.moveSpeed * 10;
                const testDistance = Math.sqrt(
                    Math.pow(testX - gameState.player.x, 2) + 
                    Math.pow(testY - gameState.player.y, 2)
                );
                
                if (testDistance < 2) {
                    const awayFromPlayerX = enemyData.x - gameState.player.x;
                    const awayFromPlayerY = enemyData.y - gameState.player.y;
                    angle = Math.atan2(awayFromPlayerY, awayFromPlayerX);
                }
            }
            
            enemyData.velocityX = Math.cos(angle) * enemyData.moveSpeed;
            enemyData.velocityY = Math.sin(angle) * enemyData.moveSpeed;
            enemyData.moveTimer = 60 + Math.random() * 120;
        }
        
        // Move enemy with collision detection
        const newX = enemyData.x + enemyData.velocityX;
        const newY = enemyData.y + enemyData.velocityY;
        
        if (canMoveTo(newX, enemyData.y)) {
            enemyData.x = newX;
        } else {
            enemyData.velocityX = -enemyData.velocityX;
        }
        
        if (canMoveTo(enemyData.x, newY)) {
            enemyData.y = newY;
        } else {
            enemyData.velocityY = -enemyData.velocityY;
        }
        
        enemy.position.set(enemyData.x, 0.825, enemyData.y);
        enemy.lookAt(camera.position);
    });
    
    // Check if all enemies defeated
    if (gameState.enemies.length === 0 && !gameState.tunnelOpen) {
        openTunnel();
        gameState.elevatorFlashTimer = 0;
        gameState.elevatorFlashState = false;
    }
    
    // Update elevator flashing
    if (gameState.enemies.length === 0 && elevator) {
        gameState.elevatorFlashTimer++;
        
        if (gameState.elevatorFlashTimer >= 15) {
            gameState.elevatorFlashTimer = 0;
            gameState.elevatorFlashState = !gameState.elevatorFlashState;
            
            elevator.material.color.setHex(
                gameState.elevatorFlashState ? 0xffd700 : 0x888888
            );
        }
    }
}

// Input handling with Phaser
class InputScene extends Phaser.Scene {
    constructor() {
        super({ key: 'InputScene' });
    }
    
    create() {
        // Create invisible canvas for input
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
        
        // Set up keyboard input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Debug: Check if keys were created properly
        console.log('Cursors created:', this.cursors);
        console.log('WASD keys created:', this.wasd);
        console.log('W key object:', this.wasd.W);
        console.log('A key object:', this.wasd.A);
        console.log('S key object:', this.wasd.S);
        console.log('D key object:', this.wasd.D);
        
        // Set up global input handlers for pointer lock
        this.setupPointerLock();
        
        console.log('Input system initialized');
    }
    
    setupPointerLock() {
        // Handle mouse movement for looking around
        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement) {
                gameState.player.angle += event.movementX * 0.002;
                console.log('Mouse look - angle:', gameState.player.angle.toFixed(2));
            }
        });
        
        // Click anywhere to lock mouse
        document.addEventListener('click', () => {
            if (!document.pointerLockElement) {
                const threeCanvas = document.getElementById('three-canvas');
                if (threeCanvas) {
                    threeCanvas.requestPointerLock();
                    console.log('Requesting pointer lock on Three.js canvas');
                }
            }
        });
        
        // Handle pointer lock state changes
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement) {
                console.log('Pointer locked successfully');
            } else {
                console.log('Pointer unlocked');
            }
        });
    }
    
    update() {
        // Debug: Check if scene is active and receiving input
        if (this.input.keyboard.addKey('W').isDown) {
            console.log('W key detected in update loop');
        }
        if (this.input.keyboard.addKey('A').isDown) {
            console.log('A key detected in update loop');
        }
        if (this.input.keyboard.addKey('S').isDown) {
            console.log('S key detected in update loop');
        }
        if (this.input.keyboard.addKey('D').isDown) {
            console.log('D key detected in update loop');
        }
        // handleInput() is now called from the animation loop
    }
}

function handleInput() {
    // Handle rotation
    if (keyboardState.ARROWLEFT) gameState.player.angle -= gameState.player.rotSpeed;
    if (keyboardState.ARROWRIGHT) gameState.player.angle += gameState.player.rotSpeed;
    
    // Calculate desired movement direction
    let desiredVelocityX = 0, desiredVelocityY = 0;
    
    if (keyboardState.ARROWUP || keyboardState.W) {
        desiredVelocityX += Math.cos(gameState.player.angle) * gameState.player.maxSpeed;
        desiredVelocityY += Math.sin(gameState.player.angle) * gameState.player.maxSpeed;
    }
    if (keyboardState.ARROWDOWN || keyboardState.S) {
        desiredVelocityX -= Math.cos(gameState.player.angle) * gameState.player.maxSpeed;
        desiredVelocityY -= Math.sin(gameState.player.angle) * gameState.player.maxSpeed;
    }
    if (keyboardState.A) {
        desiredVelocityX += Math.cos(gameState.player.angle - Math.PI / 2) * gameState.player.maxSpeed;
        desiredVelocityY += Math.sin(gameState.player.angle - Math.PI / 2) * gameState.player.maxSpeed;
    }
    if (keyboardState.D) {
        desiredVelocityX += Math.cos(gameState.player.angle + Math.PI / 2) * gameState.player.maxSpeed;
        desiredVelocityY += Math.sin(gameState.player.angle + Math.PI / 2) * gameState.player.maxSpeed;
    }
    
    // Apply acceleration or friction
    if (desiredVelocityX !== 0 || desiredVelocityY !== 0) {
        gameState.player.velocityX += (desiredVelocityX - gameState.player.velocityX) * gameState.player.acceleration;
        gameState.player.velocityY += (desiredVelocityY - gameState.player.velocityY) * gameState.player.acceleration;
    } else {
        gameState.player.velocityX *= gameState.player.friction;
        gameState.player.velocityY *= gameState.player.friction;
    }
    
    // Apply velocity with collision detection
    if (Math.abs(gameState.player.velocityX) > 0.0001 || Math.abs(gameState.player.velocityY) > 0.0001) {
        const newX = gameState.player.x + gameState.player.velocityX;
        const newY = gameState.player.y + gameState.player.velocityY;
        
        if (canMoveTo(newX, newY)) {
            gameState.player.x = newX;
            gameState.player.y = newY;
        } else {
            // Try sliding along walls
            if (canMoveTo(newX, gameState.player.y)) {
                gameState.player.x = newX;
                gameState.player.velocityY = 0;
            } else if (canMoveTo(gameState.player.x, newY)) {
                gameState.player.y = newY;
                gameState.player.velocityX = 0;
            } else {
                gameState.player.velocityX = gameState.player.velocityY = 0;
            }
        }
    }
}

function updateCamera() {
    camera.position.set(gameState.player.x, gameState.player.z, gameState.player.y);
    
    const lookX = gameState.player.x + Math.cos(gameState.player.angle);
    const lookY = gameState.player.y + Math.sin(gameState.player.angle);
    camera.lookAt(lookX, gameState.player.z, lookY);
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        if (projectile.hasPhysics) {
            // Apply physics
            projectile.physicsVelocityY -= 0.01;
            projectile.position.y += projectile.physicsVelocityY;
            
            projectile.velocityX *= 0.98;
            projectile.velocityZ *= 0.98;
            
            // Floor collision
            if (projectile.position.y <= 0.1) {
                projectile.position.y = 0.1;
                projectile.physicsVelocityY = 0;
                
                // Random rotation
                projectile.rotation.x += (Math.random() - 0.5) * 0.5;
                projectile.rotation.y += (Math.random() - 0.5) * 0.5;
                projectile.rotation.z += (Math.random() - 0.5) * 0.5;
            }
            
            // Wall collisions
            const wallCheckRadius = 0.5;
            const projectileX = Math.floor(projectile.position.x);
            const projectileZ = Math.floor(projectile.position.z);
            
            if (projectileX >= 0 && projectileX < gameState.mapWidth && 
                projectileZ >= 0 && projectileZ < gameState.mapHeight) {
                
                if (gameState.map[projectileZ][projectileX] === 1) {
                    if (Math.abs(projectile.position.x - projectileX) < wallCheckRadius) {
                        projectile.velocityX = -projectile.velocityX * 0.5;
                    }
                    if (Math.abs(projectile.position.z - projectileZ) < wallCheckRadius) {
                        projectile.velocityZ = -projectile.velocityZ * 0.5;
                    }
                    
                    // Random rotation
                    projectile.rotation.x += (Math.random() - 0.5) * 0.5;
                    projectile.rotation.y += (Math.random() - 0.5) * 0.5;
                    projectile.rotation.z += (Math.random() - 0.5) * 0.5;
                }
            }
        } else {
            // Normal projectile movement
            projectile.position.x += projectile.velocityX;
            projectile.position.z += projectile.velocityY;
            
            // Enemy collision
            for (let j = gameState.enemies.length - 1; j >= 0; j--) {
                const enemyData = gameState.enemies[j];
                const enemy = enemyData.mesh;
                
                const distance = Math.sqrt(
                    Math.pow(projectile.position.x - enemy.position.x, 2) + 
                    Math.pow(projectile.position.z - enemy.position.z, 2)
                );
                
                if (distance < 1.0) {
                    // Hit enemy
                    enemyData.health--;
                    enemyData.hitTimer = 30;
                    
                    enemy.material.color.setHex(0xff0000);
                    enemy.position.x += (Math.random() - 0.5) * 0.2;
                    enemy.position.z += (Math.random() - 0.5) * 0.2;
                    
                    const borgSounds = ['assets/borg_struck_phaser.mp3', 'assets/borg_struck_phaser_2.mp3'];
                    const randomSound = borgSounds[Math.floor(Math.random() * borgSounds.length)];
                    playSound(randomSound);
                    
                    if (enemyData.health <= 0) {
                        scene.remove(enemy);
                        gameState.enemies.splice(j, 1);
                    }
                    
                    projectile.hasPhysics = true;
                    projectile.physicsVelocityY = 0;
                    projectile.physicsTimer = 0;
                    break;
                }
            }
            
            // Wall collision
            const wallCheckRadius = 0.5;
            const projectileX = Math.floor(projectile.position.x);
            const projectileZ = Math.floor(projectile.position.z);
            
            if (projectileX >= 0 && projectileX < gameState.mapWidth && 
                projectileZ >= 0 && projectileZ < gameState.mapHeight) {
                
                if (gameState.map[projectileZ][projectileX] === 1) {
                    projectile.hasPhysics = true;
                    projectile.physicsVelocityY = 0;
                    projectile.physicsTimer = 0;
                    
                    projectile.rotation.x += (Math.random() - 0.5) * 0.5;
                    projectile.rotation.y += (Math.random() - 0.5) * 0.5;
                    projectile.rotation.z += (Math.random() - 0.5) * 0.5;
                }
            }
        }
    }
}

// Color quantization for retro effect
function quantizeColor(color, levels = 8) {
    // Reduce color depth to create retro palette effect
    const r = Math.floor(color.r * levels) / levels;
    const g = Math.floor(color.g * levels) / levels;
    const b = Math.floor(color.b * levels) / levels;
    return new THREE.Color(r, g, b);
}

// Apply retro color effect to materials
function applyRetroEffect(material) {
    if (material.color) {
        material.color = quantizeColor(material.color, 6); // 6 levels for more retro look
    }
}

// 2. Add logic to create two 'door' meshes (rectangles) that block each hallway entrance
// In updateEnemies, after checking if all enemies in a room are dead, remove the door for that room
// (You may need to track which enemies are in which room and which room the player is in)


// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Handle intro sequence
    if (gameState.introState !== 'game') {
        updateIntroSequence();
        renderIntroSequence();
        return;
    }
    
    // Update game systems
    handleInput();
    updateCamera();
    updateProjectiles();
    updateEnemies();
    
    // Check for elevator collision
    if (gameState.endingState === 'none' && gameState.enemies.length === 0 && elevator) {
        const distanceToElevator = Math.sqrt(
            Math.pow(gameState.player.x - 8, 2) + 
            Math.pow(gameState.player.y - 14, 2)
        );
        
        if (distanceToElevator < 1.5) {
            gameState.endingState = 'fading';
            gameState.endingFadeAlpha = 0.0;
            playSound('assets/tng_door_close.mp3');
        }
    }
    
    // Handle ending sequence
    if (gameState.endingState !== 'none') {
        updateEndingSequence();
    }
    
    // Render appropriate scene
    if (gameState.endingState === 'video' && gameState.endingVideo) {
        renderer.render(gameState.endingVideo.scene, gameState.endingVideo.camera);
    } else {
        renderer.render(scene, camera);
    }
    
    // Render fade overlay if active
    if (gameState.endingState === 'fading' && gameState.endingFadeAlpha > 0) {
        renderFadeOverlay();
    }
}

// Intro sequence functions
function updateIntroSequence() {
    gameState.introTimer++;
    
    // Hide/show UI elements
    ['crosshair', 'weapon-sprite', 'picard-portrait'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = gameState.introState === 'game' ? 
                (id === 'crosshair' ? 'block' : 'flex') : 'none';
        }
    });
    
    switch (gameState.introState) {
        case 'intro':
            // Fade in from black
            gameState.fadeAlpha = Math.max(0, gameState.fadeAlpha - 0.02);
            
            // Update star lines
            gameState.starLines.forEach(star => {
                star.x -= star.speed;
                if (star.x < -star.length) {
                    star.x = window.innerWidth + star.length;
                    star.y = Math.random() * window.innerHeight;
                }
            });
            
            // Show text after 2 seconds
            if (gameState.introTimer > 120) {
                gameState.textAlpha = Math.min(1.0, gameState.textAlpha + 0.02);
            }
            
            // Wait for input after text is visible
            if (gameState.textAlpha >= 1.0 && gameState.introTimer > 180) {
                gameState.introState = 'waiting';
            }
            break;
            
        case 'waiting':
            // Wait for any input
            if (keyboardState.w || keyboardState.a || keyboardState.s || keyboardState.d || 
                keyboardState.ArrowUp || keyboardState.ArrowDown || keyboardState.ArrowLeft || keyboardState.ArrowRight) {
                gameState.introState = 'fading';
            }
            break;
            
        case 'fading':
            // Fade out to game
            gameState.fadeAlpha = Math.min(1.0, gameState.fadeAlpha + 0.03);
            if (gameState.fadeAlpha >= 1.0) {
                gameState.introState = 'game';
                
                const introCanvas = document.getElementById('intro-canvas');
                if (introCanvas) introCanvas.style.display = 'none';
                
                initThreeJS();
                
                // Show UI elements
                ['crosshair', 'weapon-sprite', 'picard-portrait'].forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.style.display = id === 'crosshair' ? 'block' : 'flex';
                    }
                });
            }
            break;
    }
}

function renderIntroSequence() {
    // Get or create canvas
    let canvas = document.getElementById('intro-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'intro-canvas';
        
        Object.assign(canvas.style, {
            position: 'absolute', top: '0px', left: '0px', zIndex: '5',
            imageRendering: 'pixelated', pointerEvents: 'none', display: 'block',
            width: window.innerWidth + 'px', height: window.innerHeight + 'px'
        });
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const gameContainer = document.getElementById('game-container');
        (gameContainer || document.body).appendChild(canvas);
    }
    
    if (gameState.introState === 'game') return;
    
    // Ensure canvas is visible and sized
    canvas.style.display = 'block';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2D context for intro sequence');
        return;
    }
    
    // Draw black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw star lines
    ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
    ctx.lineWidth = 1;
    gameState.starLines.forEach(star => {
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(star.x + star.length, star.y);
        ctx.stroke();
    });
    ctx.globalAlpha = 1.0;
    
    // Draw text
    if (gameState.textAlpha > 0) {
        ctx.fillStyle = `rgba(0, 150, 255, ${gameState.textAlpha})`;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const text = "i fuckin hate q. im gonna blast him";
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        
        // Text shadow
        ctx.fillStyle = `rgba(0, 0, 0, ${gameState.textAlpha * 0.5})`;
        ctx.fillText(text, x + 2, y + 2);
        
        // Main text
        ctx.fillStyle = `rgba(0, 150, 255, ${gameState.textAlpha})`;
        ctx.fillText(text, x, y);
    }
    
    // Draw fade overlay
    if (gameState.fadeAlpha > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${gameState.fadeAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Ending sequence functions
function updateEndingSequence() {
    // Hide UI elements during ending
    ['crosshair', 'weapon-sprite', 'picard-portrait'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    
    switch (gameState.endingState) {
        case 'fading':
            gameState.endingFadeAlpha = Math.min(1.0, gameState.endingFadeAlpha + 0.02);
            
            if (gameState.endingFadeAlpha >= 1.0) {
                gameState.endingState = 'video';
                
                const fadeOverlay = document.getElementById('fade-overlay');
                if (fadeOverlay) fadeOverlay.remove();
                
                createEndingVideo();
            }
            break;
            
        case 'video':
            if (gameState.endingVideo && gameState.endingVideo.video) {
                if (gameState.endingVideo.video.ended) {
                    cleanupEndingVideo();
                }
            }
            break;
    }
}

function cleanupEndingVideo() {
    if (gameState.endingVideo) {
        if (gameState.endingVideo.timeUpdateInterval) {
            clearInterval(gameState.endingVideo.timeUpdateInterval);
        }
        
        if (gameState.endingVideo.subtitleDisplay) {
            gameState.endingVideo.subtitleDisplay.remove();
        }
        
        const picardQCanvas = document.getElementById('picard-q-canvas');
        if (picardQCanvas) picardQCanvas.remove();
        
        if (gameState.finalOverlay) {
            if (gameState.finalOverlay.container) {
                gameState.finalOverlay.container.remove();
            }
            gameState.finalOverlay = null;
        }
        
        gameState.endingState = 'none';
        gameState.endingVideo = null;
    }
}

function renderFadeOverlay() {
    let fadeOverlay = document.getElementById('fade-overlay');
    if (!fadeOverlay) {
        fadeOverlay = document.createElement('div');
        fadeOverlay.id = 'fade-overlay';
        
        Object.assign(fadeOverlay.style, {
            position: 'absolute', top: '0', left: '0',
            width: '100%', height: '100%', backgroundColor: 'black',
            zIndex: '1000', pointerEvents: 'none', transition: 'opacity 0.1s ease-out'
        });
        
        const gameContainer = document.getElementById('game-container');
        (gameContainer || document.body).appendChild(fadeOverlay);
    }
    
    fadeOverlay.style.opacity = gameState.endingFadeAlpha;
}

function createEndingVideo() {
    console.log('Creating ending video...');
    
    // Create a separate ending scene
    const endingScene = new THREE.Scene();
    endingScene.background = new THREE.Color(0x000000); // Black background
    
    // Create video element
    const video = document.createElement('video');
    video.src = 'assets/ending-video.mp4';
    video.loop = false; // Don't loop - just stop at the end
    video.muted = true; // Mute the ending video
    video.autoplay = true;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    
    // Create Underwater BGM audio for ending video
    const underwaterAudio = new Audio('assets/1-16 Underwater (BGM 2).mp3');
    underwaterAudio.volume = 0.24; // Set volume to 24% (20% louder than 20%)
    underwaterAudio.loop = true; // Loop the audio
    underwaterAudio.play().catch(e => console.log('Underwater audio play failed:', e));
    
    console.log('Video element created with src:', video.src);
    
    // Add event listeners to debug video loading
    video.addEventListener('loadstart', () => console.log('Video loadstart event'));
    video.addEventListener('loadeddata', () => console.log('Video loadeddata event'));
    video.addEventListener('canplay', () => console.log('Video canplay event'));
    video.addEventListener('play', () => console.log('Video play event'));
    video.addEventListener('error', (e) => console.error('Video error:', e));
    
    // Add event listener to prevent replay
    video.addEventListener('ended', () => {
        console.log('Video ended, preventing replay');
        video.currentTime = 106; // Set to 1:46
        video.pause();
    });
    
    // Add timeupdate listener to force stop at 1:46
    video.addEventListener('timeupdate', () => {
        if (video.currentTime >= 106) {
            video.pause();
            video.currentTime = 106;
        }
    });
    
    // Create video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    
    console.log('Video texture created');
    
    // Calculate video dimensions to fit viewport
    const aspectRatio = 16 / 9; // Video aspect ratio
    const viewportAspect = window.innerWidth / window.innerHeight;
    
    let videoWidth, videoHeight;
    if (viewportAspect > aspectRatio) {
        // Viewport is wider than video - fit to height
        videoHeight = 10;
        videoWidth = videoHeight * aspectRatio;
    } else {
        // Viewport is taller than video - fit to width
        videoWidth = 10;
        videoHeight = videoWidth / aspectRatio;
    }
    
    // Create a full-screen plane for the video
    const videoGeometry = new THREE.PlaneGeometry(videoWidth, videoHeight);
    const videoMaterial = new THREE.MeshBasicMaterial({ 
        map: videoTexture,
        transparent: true,
        side: THREE.DoubleSide
    });
    
    const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
    videoMesh.position.set(0, 0, -2); // Closer to camera
    
    console.log('Video mesh created at position:', videoMesh.position);
    console.log('Video mesh visible:', videoMesh.visible);
    console.log('Video material:', videoMaterial);
    console.log('Video dimensions:', videoWidth, 'x', videoHeight);
    
    // Add to ending scene
    endingScene.add(videoMesh);
    
    // Create a simple camera for the ending scene
    const endingCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    endingCamera.position.set(0, 0, 0);
    endingCamera.lookAt(0, 0, -2);
    
    // Create subtitle display
    const subtitleDisplay = document.createElement('div');
    subtitleDisplay.id = 'video-subtitle-display';
    subtitleDisplay.style.position = 'absolute';
    subtitleDisplay.style.bottom = '20%'; // Lowered from 30% to 20% (10% lower)
    subtitleDisplay.style.left = '5%'; // 5% from left (90% width)
    subtitleDisplay.style.width = '90%';
    subtitleDisplay.style.color = 'yellow';
    subtitleDisplay.style.fontFamily = 'Arial, sans-serif';
    subtitleDisplay.style.fontSize = '58px'; // Increased from 35px to 58px (1.66x larger)
    subtitleDisplay.style.fontWeight = 'bold';
    subtitleDisplay.style.textAlign = 'center';
    subtitleDisplay.style.textShadow = '4px 4px 0px black, -4px -4px 0px black, 4px -4px 0px black, -4px 4px 0px black, 0px 4px 0px black, 0px -4px 0px black, 4px 0px 0px black, -4px 0px 0px black'; // More comprehensive stroke
    subtitleDisplay.style.zIndex = '1002';
    subtitleDisplay.style.pointerEvents = 'none';
    subtitleDisplay.style.imageRendering = 'pixelated';
    subtitleDisplay.style.imageRendering = '-moz-crisp-edges';
    subtitleDisplay.style.imageRendering = 'crisp-edges';
    subtitleDisplay.style.fontSmooth = 'never';
    subtitleDisplay.style.webkitFontSmoothing = 'none';
    subtitleDisplay.style.whiteSpace = 'normal'; // Allow text wrapping
    subtitleDisplay.style.wordWrap = 'break-word'; // Break long words if needed
    subtitleDisplay.style.lineHeight = '1.2'; // Tighter line spacing for wrapped text
    subtitleDisplay.textContent = '';
    
    // Subtitle data
    const subtitles = [
        { start: 4, end: 8, text: "finall. no more q. damn im horny" },
        { start: 9, end: 17, text: "computer. take me back to my house. gona crank my hog ;-)" },
        { start: 31, end: 38, text: "what the fuck. what the hell. how am i supposed to jack off here. what the hell" },
        { start: 41, end: 45, text: "if you think about it gaming is the same as jacking off" },
        { start: 47, end: 51, text: "you seemed to have a good time blasting me back there picard" },
        { start: 52, end: 57, text: "are you as fuckingn horny as i am?? i know you are i am god" },
        { start: 60, end: 69, text: "lets do this picard. your gonna blast me. penisally that is. sex style" },
        { start: 83, end: 89, text: "listen dude imagine how good sex with me would be. i can do whatever. i can become a mariachi man" },
        { start: 91, end: 95, text: "i can become a robin hood, or like whatever. any fictional or cultural thing." },
        { start: 101, end: 108, text: "i can tell your horny dude come on. you were yelling about jacking off a second ago" }
    ];
    
    // Function to update subtitles
    const updateSubtitles = () => {
        const currentTime = video.currentTime || 0;
        let currentSubtitle = '';
        
        // Check if video should end at 1:46 (106 seconds)
        if (currentTime >= 106) {
            video.pause();
            video.currentTime = 106; // Force it to stay at 1:46
            
            // Create final overlay with making-out video and "THE END" text
            if (!gameState.finalOverlay) {
                createFinalOverlay();
            }
            return;
        }
        
        for (const subtitle of subtitles) {
            if (currentTime >= subtitle.start && currentTime <= subtitle.end) {
                currentSubtitle = subtitle.text;
                break;
            }
        }
        
        subtitleDisplay.textContent = currentSubtitle;
    };
    
    // Function to create the final overlay
    const createFinalOverlay = () => {
        console.log('Creating final overlay with making-out video...');
        
        // Create overlay container
        const overlayContainer = document.createElement('div');
        overlayContainer.id = 'final-overlay';
        overlayContainer.style.position = 'absolute';
        overlayContainer.style.top = '0';
        overlayContainer.style.left = '0';
        overlayContainer.style.width = '100%';
        overlayContainer.style.height = '100%';
        overlayContainer.style.zIndex = '1003';
        overlayContainer.style.pointerEvents = 'none';
        
        // Create making-out video
        const makingOutVideo = document.createElement('video');
        makingOutVideo.src = 'assets/making-out.mp4';
        makingOutVideo.loop = true; // This video should replay
        makingOutVideo.muted = true; // Mute the making-out video
        makingOutVideo.autoplay = true;
        makingOutVideo.crossOrigin = 'anonymous';
        makingOutVideo.playsInline = true;
        makingOutVideo.style.width = '100%';
        makingOutVideo.style.height = '100%';
        makingOutVideo.style.objectFit = 'cover';
        
        // Create Gnat Attack audio for making-out video
        const gnatAudio = new Audio('assets/1-16 Underwater (BGM 2).mp3');
        gnatAudio.volume = 0.24; // Set volume to 24% (20% louder than 20%)
        gnatAudio.loop = true; // Loop the audio
        gnatAudio.play().catch(e => console.log('Underwater audio play failed:', e));
        
        // Create "THE END" text
        const endText = document.createElement('div');
        endText.textContent = 'THE END';
        endText.style.position = 'absolute';
        endText.style.top = '50%';
        endText.style.left = '50%';
        endText.style.transform = 'translate(-50%, -50%)';
        endText.style.color = 'white';
        endText.style.fontFamily = 'Arial, sans-serif';
        endText.style.fontSize = '72px';
        endText.style.fontWeight = 'bold';
        endText.style.textAlign = 'center';
        endText.style.textShadow = '4px 4px 0px black, -4px -4px 0px black, 4px -4px 0px black, -4px 4px 0px black, 0px 4px 0px black, 0px -4px 0px black, 4px 0px 0px black, -4px 0px 0px black';
        endText.style.zIndex = '1004';
        endText.style.pointerEvents = 'none';
        endText.style.imageRendering = 'pixelated';
        endText.style.imageRendering = '-moz-crisp-edges';
        endText.style.imageRendering = 'crisp-edges';
        endText.style.fontSmooth = 'never';
        endText.style.webkitFontSmoothing = 'none';
        
        // Add elements to overlay
        overlayContainer.appendChild(makingOutVideo);
        overlayContainer.appendChild(endText);
        
        // Create flying Picard-Q GIF for making-out video
        const picardQCanvas = document.createElement('canvas');
        picardQCanvas.id = 'picard-q-canvas';
        picardQCanvas.style.position = 'absolute';
        picardQCanvas.style.top = '0';
        picardQCanvas.style.left = '0';
        picardQCanvas.style.width = '100%';
        picardQCanvas.style.height = '100%';
        picardQCanvas.style.zIndex = '1005';
        picardQCanvas.style.pointerEvents = 'none';
        picardQCanvas.style.imageRendering = 'pixelated';
        picardQCanvas.style.imageRendering = '-moz-crisp-edges';
        picardQCanvas.style.imageRendering = 'crisp-edges';
        
        // Add canvas to overlay
        overlayContainer.appendChild(picardQCanvas);
        
        // Set up canvas
        const ctx = picardQCanvas.getContext('2d');
        picardQCanvas.width = window.innerWidth;
        picardQCanvas.height = window.innerHeight;
        
        // Load Picard-Q GIF
        const picardQImg = new Image();
        picardQImg.src = 'assets/picard-q.gif';
        
        // Flying Picard-Q state (even bigger, faster, with rotation)
        const picardQ = {
            x: Math.random() * (window.innerWidth - 300),
            y: Math.random() * (window.innerHeight - 300),
            vx: (Math.random() - 0.5) * 8, // Faster velocity (doubled)
            vy: (Math.random() - 0.5) * 8,
            size: 300, // Even bigger (208 -> 300)
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.2 // Random rotation speed
        };
        
        // Animation function for flying Picard-Q
        const animatePicardQ = () => {
            // Clear canvas
            ctx.clearRect(0, 0, picardQCanvas.width, picardQCanvas.height);
            
            // Update position
            picardQ.x += picardQ.vx;
            picardQ.y += picardQ.vy;
            
            // Update rotation
            picardQ.rotation += picardQ.rotationSpeed;
            
            // Bounce off edges
            if (picardQ.x <= 0 || picardQ.x >= picardQCanvas.width - picardQ.size) {
                picardQ.vx = -picardQ.vx;
            }
            if (picardQ.y <= 0 || picardQ.y >= picardQCanvas.height - picardQ.size) {
                picardQ.vy = -picardQ.vy;
            }
            
            // Keep within bounds
            picardQ.x = Math.max(0, Math.min(picardQCanvas.width - picardQ.size, picardQ.x));
            picardQ.y = Math.max(0, Math.min(picardQCanvas.height - picardQ.size, picardQ.y));
            
            // Draw Picard-Q GIF with rotation
            if (picardQImg.complete) {
                ctx.save();
                ctx.translate(picardQ.x + picardQ.size/2, picardQ.y + picardQ.size/2);
                ctx.rotate(picardQ.rotation);
                ctx.drawImage(picardQImg, -picardQ.size/2, -picardQ.size/2, picardQ.size, picardQ.size);
                ctx.restore();
            }
            
            // Continue animation
            requestAnimationFrame(animatePicardQ);
        };
        
        // Start animation when image loads
        picardQImg.onload = () => {
            animatePicardQ();
        };
        
        // Handle window resize
        window.addEventListener('resize', () => {
            picardQCanvas.width = window.innerWidth;
            picardQCanvas.height = window.innerHeight;
        });
        
        // Add overlay to page
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.appendChild(overlayContainer);
        } else {
            document.body.appendChild(overlayContainer);
        }
        
        // Store reference
        gameState.finalOverlay = {
            container: overlayContainer,
            video: makingOutVideo,
            text: endText
        };
        
        console.log('Final overlay created with making-out video and THE END text');
    };
    
    // Add elements to page
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.appendChild(subtitleDisplay);
    } else {
        document.body.appendChild(subtitleDisplay);
    }
    
    // Update subtitles every 100ms
    const timeUpdateInterval = setInterval(() => {
        updateSubtitles();
    }, 100);
    
    // Force video to play
    video.play().then(() => {
        console.log('Video play() promise resolved');
    }).catch((error) => {
        console.error('Video play() failed:', error);
    });
    
    // Store reference
    gameState.endingVideo = {
        scene: endingScene,
        camera: endingCamera,
        mesh: videoMesh,
        video: video,
        texture: videoTexture,
        timeDisplay: null, // Removed timeDisplay
        pauseButton: null, // Removed pauseButton
        subtitleDisplay: subtitleDisplay,
        timeUpdateInterval: timeUpdateInterval
    };
    
    console.log('Ending video created with separate scene');
    console.log('Video element:', video);
    console.log('Video readyState:', video.readyState);
    console.log('Video currentSrc:', video.currentSrc);
    console.log('Video paused:', video.paused);
    console.log('Video currentTime:', video.currentTime);
    console.log('Video duration:', video.duration);
}

// Phaser config
const config = {
    type: Phaser.WEBGL,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: 'rgba(0,0,0,0)',
    scene: InputScene,
    transparent: true,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: {
        keyboard: { target: window },
        mouse: true,
        touch: false
    }
};

// Initialize everything
let game;

// Initialize Three.js and Phaser
if (typeof THREE === 'undefined') {
    console.error('THREE.js not loaded!');
} else {
    console.log('THREE.js loaded successfully');
    initThreeJS();
}

if (typeof Phaser === 'undefined') {
    console.error('Phaser not loaded!');
} else {
    console.log('Phaser loaded successfully');
    game = new Phaser.Game(config);
}

// Initialize intro sequence
function initIntroSequence() {
    gameState.starLines = [];
    for (let i = 0; i < 50; i++) {
        gameState.starLines.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            speed: 2 + Math.random() * 8,
            length: 20 + Math.random() * 60,
            alpha: 0.3 + Math.random() * 0.7
        });
    }
}

// Start game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initIntroSequence();
        animate();
    });
} else {
    initIntroSequence();
    animate();
}

// Event listeners
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    if (game) {
        game.scale.resize(window.innerWidth, window.innerHeight);
    }
});

window.addEventListener('keydown', (event) => {
    const key = event.key.toUpperCase();
    if (keyboardState.hasOwnProperty(key)) {
        keyboardState[key] = true;
    }
});

window.addEventListener('keyup', (event) => {
    const key = event.key.toUpperCase();
    if (keyboardState.hasOwnProperty(key)) {
        keyboardState[key] = false;
    }
});

window.addEventListener('click', () => {
    createProjectile();
});

document.addEventListener('click', (event) => {
    if (gameState.introState === 'waiting') {
        gameState.introState = 'fading';
    }
});
