// Game state
const gameState = {
    player: {
        x: 8,
        y: 8,
        z: 1,
        angle: 0,
        speed: 0.1,
        rotSpeed: 0.05,
        // Add velocity for momentum
        velocityX: 0,
        velocityY: 0,
        maxSpeed: 0.15,
        acceleration: 0.1,
        friction: 0.85
    },
    
    // One big room with elevator at the end
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
    mapWidth: 16,
    mapHeight: 16,
    
    keys: {},
    
    // Enemy system
    enemies: [],
    
    // Tunnel system
    tunnelOpen: false,
    
    // Intro sequence state
    introState: 'intro', // 'intro', 'waiting', 'fading', 'game'
    introTimer: 0,
    fadeAlpha: 1.0,
    starLines: [],
    textAlpha: 0.0,
    textTimer: 0,
    
    // Elevator flashing state
    elevatorFlashTimer: 0,
    elevatorFlashState: false, // true = gold, false = grey
    
    // Ending sequence state
    endingState: 'none', // 'none', 'fading', 'video'
    endingFadeAlpha: 0.0,
    endingVideo: null,
    
    // Q sound system
    qSoundTimer: 0, // Timer for Q sound clips
    qSoundInterval: 180 // 3 seconds at 60fps
};

// Global keyboard state
const keyboardState = {
    W: false,
    A: false,
    S: false,
    D: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// Three.js setup
let scene, camera, renderer, walls = [];
let projectiles = [];
let enemies = [];
let tunnelWalls = [];
let elevator = null; // Global elevator reference

function initThreeJS() {
    console.log('Initializing Three.js...');
    
    // Ensure UI elements are visible when game starts
    const crosshair = document.getElementById('crosshair');
    const weaponSprite = document.getElementById('weapon-sprite');
    const picardPortrait = document.getElementById('picard-portrait');
    
    if (crosshair) crosshair.style.display = 'block';
    if (weaponSprite) weaponSprite.style.display = 'flex';
    if (picardPortrait) picardPortrait.style.display = 'flex';
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(gameState.player.x, gameState.player.z, gameState.player.y);
    
    // Set initial camera look direction
    const lookX = gameState.player.x + Math.cos(gameState.player.angle);
    const lookY = gameState.player.y + Math.sin(gameState.player.angle);
    camera.lookAt(lookX, gameState.player.z, lookY);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('three-canvas'),
        antialias: false, // Disable antialiasing for pixelated look
        powerPreference: "high-performance"
    });
    
    // Set lower resolution for retro look
    const pixelRatio = 0.5; // Half resolution
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Reduce color depth and add retro effects
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false; // Disable shadows for flat retro look
    
    // Additional retro settings
    renderer.autoClear = true;
    renderer.sortObjects = false; // Disable depth sorting for retro look
    
    // Set canvas ID for CSS targeting
    renderer.domElement.id = 'three-canvas';
    
    // Add retro pixelated CSS styling
    renderer.domElement.style.imageRendering = 'pixelated';
    renderer.domElement.style.imageRendering = '-moz-crisp-edges';
    renderer.domElement.style.imageRendering = 'crisp-edges';
    
    // Add bright, flat lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(8, 10, 8);
    directionalLight.castShadow = false; // Disable shadows for flatter lighting
    scene.add(directionalLight);
    
    // Create world geometry
    createWorld();
    
    console.log('Three.js initialized');
    console.log('Initial player position:', gameState.player.x, gameState.player.y, gameState.player.z);
    console.log('Initial camera position:', camera.position.x, camera.position.y, camera.position.z);
}

function createWorld() {
    // Clear existing walls
    walls.forEach(wall => scene.remove(wall));
    walls = [];
    
    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(gameState.mapWidth, gameState.mapHeight);
    const floorMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x1e3a8a // Dark blue color for floor
    });
    applyRetroEffect(floorMaterial); // Apply retro effect
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(gameState.mapWidth / 2, 0, gameState.mapHeight / 2);
    scene.add(floor);
    
    // Create ceiling
    const ceilingMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
    applyRetroEffect(ceilingMaterial); // Apply retro effect
    const ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(gameState.mapWidth / 2, 3, gameState.mapHeight / 2);
    scene.add(ceiling);
    
    // Create walls based on map
    const wallGeometry = new THREE.BoxGeometry(1, 3, 1);
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xf5f5dc }); // Beige color for walls
    applyRetroEffect(wallMaterial); // Apply retro effect
    
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
    
    // Create enemies
    createEnemies();
    
    // Create tunnel (initially closed)
    createTunnel();
    
    // Create elevator (grey wall at the end of the room)
    createElevator();
    
    // Remove door system - back to single room
}

function playSound(soundFile) {
    const audio = new Audio(soundFile);
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Audio play failed:', e));
}

function createProjectile() {
    console.log('createProjectile() called');
    
    // Play phaser sound
    playSound('assets/tng_phaser3_clean.mp3');
    
    // Calculate the direction vector from player's angle
    const directionX = Math.cos(gameState.player.angle);
    const directionY = Math.sin(gameState.player.angle);
    
    // Start position (camera position)
    const startX = gameState.player.x;
    const startY = gameState.player.y;
    const startZ = gameState.player.z;
    
    // Create projectile geometry and material
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.8); // Long, flat rectangle (rotated 90 degrees)
    const material = new THREE.MeshBasicMaterial({ 
        color: 0xffff00, // Yellow projectile
        transparent: false,
        opacity: 1.0
    });
    applyRetroEffect(material); // Apply retro effect
    
    // Create the projectile mesh
    const projectile = new THREE.Mesh(geometry, material);
    projectile.position.set(startX, startZ, startY);
    
    // Rotate projectile to face the direction it's traveling
    // The projectile geometry is long in Z direction, so we need to rotate it to face the player's angle
    projectile.rotation.y = gameState.player.angle;
    
    // Add velocity and direction properties to the projectile
    projectile.velocityX = directionX * 0.5 * 0.3; // 30% speed
    projectile.velocityY = directionY * 0.5 * 0.3;
    projectile.velocityZ = 0;
    projectile.life = 60; // Frames the projectile will live (60 frames = 1 second at 60fps)
    
    // Physics properties
    projectile.hasPhysics = false; // Start without physics
    projectile.physicsTimer = 0; // Timer for physics-based projectiles
    projectile.gravity = 0.01; // Gravity for falling
    projectile.physicsVelocityY = 0; // Vertical velocity for physics (separate from movement velocityY)
    
    // Add to scene and projectiles array
    scene.add(projectile);
    projectiles.push(projectile);
    
    console.log('Projectile created at', startX.toFixed(2), startY.toFixed(2), 'with velocity', projectile.velocityX.toFixed(2), projectile.velocityY.toFixed(2));
    console.log('Scene has', scene.children.length, 'children');
}

function createEnemies() {
    // Clear existing enemies
    enemies.forEach(enemy => scene.remove(enemy));
    enemies = [];
    gameState.enemies = [];
    
    // Create 5 enemies in the single room
    for (let i = 0; i < 5; i++) {
        let x, y;
        let attempts = 0;
        
        // Spawn enemies in the single room (0-15 x 0-15)
        do {
            x = Math.random() * 16;
            y = Math.random() * 16;
            attempts++;
        } while ((canMoveTo(x, y) === false || 
                 Math.abs(x - gameState.player.x) < 2 || 
                 Math.abs(y - gameState.player.y) < 2) && attempts < 50);
        
        if (attempts < 50) {
            // Create enemy as flat render texture using random q-clip asset
            const qClipAssets = ['assets/q-clip-1.mp4', 'assets/q-clip-2.mp4', 'assets/q-clip-3.mp4'];
            const randomAsset = qClipAssets[Math.floor(Math.random() * qClipAssets.length)];
            
            const video = document.createElement('video');
            video.src = randomAsset;
            video.loop = true;
            video.muted = true;
            video.autoplay = true;
            video.crossOrigin = 'anonymous';
            video.playsInline = true;
            
            // Create video texture
            const enemyTexture = new THREE.VideoTexture(video);
            enemyTexture.minFilter = THREE.LinearFilter;
            enemyTexture.magFilter = THREE.LinearFilter;
            
            // Create a plane geometry for the flat enemy
            const geometry = new THREE.PlaneGeometry(1.5, 1.65); // 66% of 2.5 = 1.65 units tall
            const material = new THREE.MeshBasicMaterial({ 
                map: enemyTexture,
                transparent: true,
                side: THREE.DoubleSide
            });
            
            // Create the enemy mesh
            const enemy = new THREE.Mesh(geometry, material);
            enemy.position.set(x, 0.825, y); // Position lower to ground (half of 1.65 height)
            
            // Add enemy properties
            enemy.velocityX = 0;
            enemy.velocityY = 0;
            enemy.moveTimer = Math.random() * 60; // Random initial timer
            enemy.moveSpeed = 0.01 + Math.random() * 0.015; // Reduced speed between 0.01-0.025
            enemy.health = 2; // Enemies take 2 hits to kill
            enemy.hitTimer = 0; // Timer for hit effects
            enemy.originalColor = enemyTexture; // Store original texture
            
            // Add to scene and arrays
            scene.add(enemy);
            enemies.push(enemy);
            gameState.enemies.push({
                mesh: enemy,
                x: x,
                y: y,
                velocityX: 0,
                velocityY: 0,
                moveTimer: enemy.moveTimer,
                moveSpeed: enemy.moveSpeed,
                health: 2,
                hitTimer: 0
            });
            
            console.log('Enemy created in Room 1 at', x.toFixed(2), y.toFixed(2), 'with', randomAsset);
        }
    }
    
    console.log('Created', enemies.length, 'enemies');
    console.log('Map is now a large open room - you should be able to see enemies wandering around!');
}

function createTunnel() {
    console.log('Tunnel system ready - no visual wall, just map-based opening');
}

function createElevator() {
    console.log('Creating elevator at the end of the room...');
    
    // Create grey elevator wall at the end of the room
    const elevatorGeometry = new THREE.BoxGeometry(1, 3, 1);
    const elevatorMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x888888, // Grey color for elevator
        transparent: false,
        opacity: 1.0
    });
    applyRetroEffect(elevatorMaterial); // Apply retro effect
    
    // Create the elevator mesh
    elevator = new THREE.Mesh(elevatorGeometry, elevatorMaterial);
    elevator.position.set(8, 1.5, 14); // At the end of the room
    
    // Add to scene
    scene.add(elevator);
    
    console.log('Elevator created at the end of the room at position (8, 14)');
}

function openTunnel() {
    if (gameState.tunnelOpen) return; // Already open
    
    console.log('Opening tunnel...');
    
    // Play door sound
    playSound('assets/tng_door_open.mp3');
    
    // Update the map to remove the wall at tunnel entrance (15,8)
    gameState.map[8][15] = 0; // Change from wall (1) to empty (0)
    
    gameState.tunnelOpen = true;
    console.log('Tunnel opened! Map updated at position (15,8)');
}

function updateEnemies() {
    // Update Q sound timer
    gameState.qSoundTimer++;
    if (gameState.qSoundTimer >= gameState.qSoundInterval) {
        gameState.qSoundTimer = 0;
        
        // Play random Q sound clip
        const qSounds = [
            'assets/Q _I suggest you change attitude_.WAV',
            'assets/Q _Savage life forms_.WAV',
            'assets/Q _So be it fools_.WAV',
            'assets/Q _Your time is up captain_.WAV'
        ];
        
        const randomSound = qSounds[Math.floor(Math.random() * qSounds.length)];
        playSound(randomSound);
    }
    
    console.log('Updating', gameState.enemies.length, 'enemies');
    gameState.enemies.forEach((enemyData, index) => {
        const enemy = enemyData.mesh;
        
        // Update hit effect timer
        if (enemyData.hitTimer > 0) {
            enemyData.hitTimer--;
            if (enemyData.hitTimer === 0) {
                // Restore normal appearance
                enemy.material.color.setHex(0xffffff); // Back to white (video texture)
            }
        }
        
        // Update move timer
        enemyData.moveTimer--;
        
        // Change direction randomly or to avoid player
        if (enemyData.moveTimer <= 0) {
            // Calculate distance to player
            const distanceToPlayer = Math.sqrt(
                Math.pow(enemyData.x - gameState.player.x, 2) + 
                Math.pow(enemyData.y - gameState.player.y, 2)
            );
            
            let angle;
            if (distanceToPlayer < 3) {
                // Too close to player - move away
                const awayFromPlayerX = enemyData.x - gameState.player.x;
                const awayFromPlayerY = enemyData.y - gameState.player.y;
                angle = Math.atan2(awayFromPlayerY, awayFromPlayerX);
                console.log('Enemy', index, 'moving away from player');
            } else {
                // Random movement, but avoid getting too close
                angle = Math.random() * Math.PI * 2;
                
                // Check if random direction would bring enemy too close to player
                const testX = enemyData.x + Math.cos(angle) * enemyData.moveSpeed * 10;
                const testY = enemyData.y + Math.sin(angle) * enemyData.moveSpeed * 10;
                const testDistance = Math.sqrt(
                    Math.pow(testX - gameState.player.x, 2) + 
                    Math.pow(testY - gameState.player.y, 2)
                );
                
                if (testDistance < 2) {
                    // Random direction would be too close, move away instead
                    const awayFromPlayerX = enemyData.x - gameState.player.x;
                    const awayFromPlayerY = enemyData.y - gameState.player.y;
                    angle = Math.atan2(awayFromPlayerY, awayFromPlayerX);
                    console.log('Enemy', index, 'avoiding getting too close to player');
                }
            }
            
            enemyData.velocityX = Math.cos(angle) * enemyData.moveSpeed;
            enemyData.velocityY = Math.sin(angle) * enemyData.moveSpeed;
            enemyData.moveTimer = 60 + Math.random() * 120; // 1-3 seconds
            
            console.log('Enemy', index, 'changed direction to', enemyData.velocityX.toFixed(3), enemyData.velocityY.toFixed(3));
        }
        
        // Move enemy
        const newX = enemyData.x + enemyData.velocityX;
        const newY = enemyData.y + enemyData.velocityY;
        
        // Check collision with walls
        if (canMoveTo(newX, enemyData.y)) {
            enemyData.x = newX;
        } else {
            enemyData.velocityX = -enemyData.velocityX; // Bounce off wall
        }
        
        if (canMoveTo(enemyData.x, newY)) {
            enemyData.y = newY;
        } else {
            enemyData.velocityY = -enemyData.velocityY; // Bounce off wall
        }
        
        // Update mesh position
        enemy.position.set(enemyData.x, 0.825, enemyData.y);
        
        // Make enemy always face the camera
        enemy.lookAt(camera.position);
    });
    
    // Check if all enemies are defeated
    if (gameState.enemies.length === 0 && !gameState.tunnelOpen) {
        openTunnel();
        
        // Start elevator flashing
        gameState.elevatorFlashTimer = 0;
        gameState.elevatorFlashState = false;
    }
    
    // Update elevator flashing if active
    if (gameState.enemies.length === 0 && elevator) {
        gameState.elevatorFlashTimer++;
        
        // Flash every 15 frames (quarter second at 60fps)
        if (gameState.elevatorFlashTimer >= 15) {
            gameState.elevatorFlashTimer = 0;
            gameState.elevatorFlashState = !gameState.elevatorFlashState;
            
            // Change elevator color
            if (gameState.elevatorFlashState) {
                elevator.material.color.setHex(0xffd700); // Gold
            } else {
                elevator.material.color.setHex(0x888888); // Grey
            }
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
    // Handle rotation (instant, no momentum)
    if (keyboardState.ARROWLEFT) {
        gameState.player.angle -= gameState.player.rotSpeed;
        console.log('Rotating left');
    }
    if (keyboardState.ARROWRIGHT) {
        gameState.player.angle += gameState.player.rotSpeed;
        console.log('Rotating right');
    }
    
    // Calculate desired movement direction
    let desiredVelocityX = 0;
    let desiredVelocityY = 0;
    
    // Forward/Backward movement
    if (keyboardState.ARROWUP || keyboardState.W) {
        desiredVelocityX += Math.cos(gameState.player.angle) * gameState.player.maxSpeed;
        desiredVelocityY += Math.sin(gameState.player.angle) * gameState.player.maxSpeed;
        console.log('W/Up pressed - desired velocity:', desiredVelocityX.toFixed(3), desiredVelocityY.toFixed(3));
        
        // Temporary direct movement test
        gameState.player.x += Math.cos(gameState.player.angle) * 0.1;
        gameState.player.y += Math.sin(gameState.player.angle) * 0.1;
        console.log('DIRECT MOVEMENT TEST - new position:', gameState.player.x.toFixed(2), gameState.player.y.toFixed(2));
    }
    if (keyboardState.ARROWDOWN || keyboardState.S) {
        desiredVelocityX -= Math.cos(gameState.player.angle) * gameState.player.maxSpeed;
        desiredVelocityY -= Math.sin(gameState.player.angle) * gameState.player.maxSpeed;
        console.log('S/Down pressed - desired velocity:', desiredVelocityX.toFixed(3), desiredVelocityY.toFixed(3));
    }
    
    // Strafe movement
    if (keyboardState.A) {
        desiredVelocityX += Math.cos(gameState.player.angle - Math.PI / 2) * gameState.player.maxSpeed;
        desiredVelocityY += Math.sin(gameState.player.angle - Math.PI / 2) * gameState.player.maxSpeed;
        console.log('A pressed - strafe left');
    }
    if (keyboardState.D) {
        desiredVelocityX += Math.cos(gameState.player.angle + Math.PI / 2) * gameState.player.maxSpeed;
        desiredVelocityY += Math.sin(gameState.player.angle + Math.PI / 2) * gameState.player.maxSpeed;
        console.log('D pressed - strafe right');
    }
    
    // Apply acceleration towards desired velocity
    if (desiredVelocityX !== 0 || desiredVelocityY !== 0) {
        // Accelerate towards desired velocity
        gameState.player.velocityX += (desiredVelocityX - gameState.player.velocityX) * gameState.player.acceleration;
        gameState.player.velocityY += (desiredVelocityY - gameState.player.velocityY) * gameState.player.acceleration;
        console.log('Current velocity:', gameState.player.velocityX.toFixed(3), gameState.player.velocityY.toFixed(3));
    } else {
        // Apply friction when no keys are pressed
        gameState.player.velocityX *= gameState.player.friction;
        gameState.player.velocityY *= gameState.player.friction;
    }
    
    // Apply velocity to position with collision detection
    console.log('Velocity check - X:', gameState.player.velocityX.toFixed(4), 'Y:', gameState.player.velocityY.toFixed(4));
    
    if (Math.abs(gameState.player.velocityX) > 0.0001 || Math.abs(gameState.player.velocityY) > 0.0001) {
        const newX = gameState.player.x + gameState.player.velocityX;
        const newY = gameState.player.y + gameState.player.velocityY;
        
        console.log('Attempting to move from', gameState.player.x.toFixed(2), gameState.player.y.toFixed(2), 'to', newX.toFixed(2), newY.toFixed(2));
        
        // Try full movement first
        if (canMoveTo(newX, newY)) {
            gameState.player.x = newX;
            gameState.player.y = newY;
            console.log('Full movement allowed');
        } else {
            // Try sliding along X axis
            if (canMoveTo(newX, gameState.player.y)) {
                gameState.player.x = newX;
                gameState.player.velocityY = 0; // Stop Y velocity on collision
                console.log('X movement allowed, Y blocked');
            } else if (canMoveTo(gameState.player.x, newY)) {
                gameState.player.y = newY;
                gameState.player.velocityX = 0; // Stop X velocity on collision
                console.log('Y movement allowed, X blocked');
            } else {
                // Both directions blocked, stop all movement
                gameState.player.velocityX = 0;
                gameState.player.velocityY = 0;
                console.log('Movement blocked in all directions');
            }
        }
        
        console.log('Final position:', gameState.player.x.toFixed(2), gameState.player.y.toFixed(2));
    } else {
        console.log('Velocity too small, no movement');
    }
    
    // Always update camera when there's any movement or rotation
    if (Math.abs(gameState.player.velocityX) > 0.001 || Math.abs(gameState.player.velocityY) > 0.001 || 
        keyboardState.ARROWLEFT || keyboardState.ARROWRIGHT) {
        console.log('Player position:', gameState.player.x.toFixed(2), gameState.player.y.toFixed(2), 'angle:', gameState.player.angle.toFixed(2));
        console.log('Camera position:', camera.position.x.toFixed(2), camera.position.y.toFixed(2), camera.position.z.toFixed(2));
    }
}

function canMoveTo(x, y) {
    // 2. Increase wall collision radius for the player
    const playerRadius = 1.0; // Increased for better wall collision
    
    // Check multiple points around the player's position to create a capsule-like collision
    const checkPoints = [
        { x: x, y: y }, // Center
        { x: x + playerRadius, y: y }, // Right
        { x: x - playerRadius, y: y }, // Left
        { x: x, y: y + playerRadius }, // Forward
        { x: x, y: y - playerRadius }, // Backward
        { x: x + playerRadius * 0.7, y: y + playerRadius * 0.7 }, // Diagonal
        { x: x - playerRadius * 0.7, y: y + playerRadius * 0.7 }, // Diagonal
        { x: x + playerRadius * 0.7, y: y - playerRadius * 0.7 }, // Diagonal
        { x: x - playerRadius * 0.7, y: y - playerRadius * 0.7 }  // Diagonal
    ];
    
    // Check each point for collision
    for (const point of checkPoints) {
        const mapX = Math.floor(point.x);
        const mapY = Math.floor(point.y);
        
        // Check bounds for entire map
        if (mapX < 0 || mapX >= gameState.mapWidth || mapY < 0 || mapY >= gameState.mapHeight) {
            return false;
        }
        
        // Check if any point hits a wall
        if (gameState.map[mapY][mapX] === 1) {
            return false;
        }
    }
    
    return true;
}

function updateCamera() {
    // Update camera position and rotation
    camera.position.set(gameState.player.x, gameState.player.z, gameState.player.y);
    
    // Look direction
    const lookX = gameState.player.x + Math.cos(gameState.player.angle);
    const lookY = gameState.player.y + Math.sin(gameState.player.angle);
    camera.lookAt(lookX, gameState.player.z, lookY);
}

function updateProjectiles() {
    // Update projectile positions and check collisions
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        if (projectile.hasPhysics) {
            // Apply gravity and physics
            projectile.physicsVelocityY -= 0.01; // Gravity
            projectile.position.y += projectile.physicsVelocityY;
            
            // Apply friction to horizontal movement
            projectile.velocityX *= 0.98;
            projectile.velocityZ *= 0.98;
            
            // Check floor collision
            if (projectile.position.y <= 0.1) {
                projectile.position.y = 0.1;
                projectile.physicsVelocityY = 0;
                
                // Add random rotation after hitting floor
                projectile.rotation.x += (Math.random() - 0.5) * 0.5;
                projectile.rotation.y += (Math.random() - 0.5) * 0.5;
                projectile.rotation.z += (Math.random() - 0.5) * 0.5;
            }
            
            // Check wall collisions
            const wallCheckRadius = 0.5;
            const projectileX = Math.floor(projectile.position.x);
            const projectileZ = Math.floor(projectile.position.z);
            
            if (projectileX >= 0 && projectileX < gameState.mapWidth && 
                projectileZ >= 0 && projectileZ < gameState.mapHeight) {
                
                if (gameState.map[projectileZ][projectileX] === 1) {
                    // Hit wall - bounce
                    if (Math.abs(projectile.position.x - projectileX) < wallCheckRadius) {
                        projectile.velocityX = -projectile.velocityX * 0.5;
                    }
                    if (Math.abs(projectile.position.z - projectileZ) < wallCheckRadius) {
                        projectile.velocityZ = -projectile.velocityZ * 0.5;
                    }
                    
                    // Add random rotation after hitting wall
                    projectile.rotation.x += (Math.random() - 0.5) * 0.5;
                    projectile.rotation.y += (Math.random() - 0.5) * 0.5;
                    projectile.rotation.z += (Math.random() - 0.5) * 0.5;
                }
            }
            
            // Remove bullets after 3 seconds in physics mode - REMOVED THIS LINE
            // if (projectile.physicsTimer > 180) {
            //     scene.remove(projectile);
            //     projectiles.splice(i, 1);
            //     continue;
            // }
            // projectile.physicsTimer++;
        } else {
            // Normal projectile movement
            projectile.position.x += projectile.velocityX;
            projectile.position.z += projectile.velocityY; // Use velocityY for Z movement (this is the direction from player angle)
            
            // Check collision with enemies
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
                    enemyData.hitTimer = 30; // 0.5 seconds at 60fps
                    
                    // Visual hit effect
                    enemy.material.color.setHex(0xff0000); // Red flash
                    enemy.position.x += (Math.random() - 0.5) * 0.2; // Vibration
                    enemy.position.z += (Math.random() - 0.5) * 0.2;
                    
                    // Play random borg struck sound
                    const borgSounds = ['assets/borg_struck_phaser.mp3', 'assets/borg_struck_phaser_2.mp3'];
                    const randomSound = borgSounds[Math.floor(Math.random() * borgSounds.length)];
                    playSound(randomSound);
                    
                    if (enemyData.health <= 0) {
                        // Enemy defeated
                        scene.remove(enemy);
                        gameState.enemies.splice(j, 1);
                        console.log('Enemy defeated! Enemies remaining:', gameState.enemies.length);
                    }
                    
                    // Enable physics on projectile
                    projectile.hasPhysics = true;
                    projectile.physicsVelocityY = 0;
                    projectile.physicsTimer = 0;
                    break;
                }
            }
            
            // Check collision with walls
            const wallCheckRadius = 0.5;
            const projectileX = Math.floor(projectile.position.x);
            const projectileZ = Math.floor(projectile.position.z);
            
            if (projectileX >= 0 && projectileX < gameState.mapWidth && 
                projectileZ >= 0 && projectileZ < gameState.mapHeight) {
                
                if (gameState.map[projectileZ][projectileX] === 1) {
                    // Hit wall - enable physics
                    projectile.hasPhysics = true;
                    projectile.physicsVelocityY = 0;
                    projectile.physicsTimer = 0;
                    
                    // Add random rotation
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
        return; // Don't run main game logic during intro
    }
    
    handleInput(); // Call handleInput every frame
    updateCamera();
    updateProjectiles(); // Update projectile positions
    updateEnemies();
    
    // Check for elevator collision when it's flashing
    if (gameState.endingState === 'none' && gameState.enemies.length === 0 && elevator) {
        const distanceToElevator = Math.sqrt(
            Math.pow(gameState.player.x - 8, 2) + 
            Math.pow(gameState.player.y - 14, 2)
        );
        
        // Debug: Log distance and conditions
        if (gameState.introTimer % 60 === 0) { // Log every 60 frames (1 second)
            console.log('Elevator collision check:', {
                playerX: gameState.player.x,
                playerY: gameState.player.y,
                distanceToElevator: distanceToElevator,
                enemiesLength: gameState.enemies.length,
                endingState: gameState.endingState,
                elevatorExists: !!elevator
            });
        }
        
        if (distanceToElevator < 1.5) { // Player is close to elevator
            console.log('Player entered elevator! Starting ending sequence...');
            gameState.endingState = 'fading';
            gameState.endingFadeAlpha = 0.0;
            
            // Play door close sound
            playSound('assets/tng_door_close.mp3');
        }
    }
    
    // Handle ending sequence
    if (gameState.endingState !== 'none') {
        updateEndingSequence();
    }
    
    // Render appropriate scene
    if (gameState.endingState === 'video' && gameState.endingVideo) {
        // Render ending scene with video
        renderer.render(gameState.endingVideo.scene, gameState.endingVideo.camera);
    } else {
        // Render main game scene
        renderer.render(scene, camera);
    }
    
    // Render ending fade overlay if active
    if (gameState.endingState === 'fading' && gameState.endingFadeAlpha > 0) {
        console.log('Calling renderFadeOverlay from animate loop, fadeAlpha:', gameState.endingFadeAlpha);
        renderFadeOverlay();
    }
}

// Intro sequence functions
function updateIntroSequence() {
    gameState.introTimer++;
    
    // Hide UI elements during intro
    const crosshair = document.getElementById('crosshair');
    const weaponSprite = document.getElementById('weapon-sprite');
    const picardPortrait = document.getElementById('picard-portrait');
    
    if (gameState.introState !== 'game') {
        if (crosshair) crosshair.style.display = 'none';
        if (weaponSprite) weaponSprite.style.display = 'none';
        if (picardPortrait) picardPortrait.style.display = 'none';
    } else {
        if (crosshair) crosshair.style.display = 'block';
        if (weaponSprite) weaponSprite.style.display = 'flex';
        if (picardPortrait) picardPortrait.style.display = 'flex';
    }
    
    switch (gameState.introState) {
        case 'intro':
            // Fade in from black
            gameState.fadeAlpha = Math.max(0, gameState.fadeAlpha - 0.02);
            
            // Update star lines (move them)
            gameState.starLines.forEach(star => {
                star.x -= star.speed;
                if (star.x < -star.length) {
                    star.x = window.innerWidth + star.length;
                    star.y = Math.random() * window.innerHeight;
                }
            });
            
            // Start showing text after 2 seconds
            if (gameState.introTimer > 120) {
                gameState.textAlpha = Math.min(1.0, gameState.textAlpha + 0.02);
            }
            
            // Wait for input after text is fully visible
            if (gameState.textAlpha >= 1.0 && gameState.introTimer > 180) {
                gameState.introState = 'waiting';
            }
            break;
            
        case 'waiting':
            // Wait for any input (WASD or click)
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
                
                // Hide intro canvas
                const introCanvas = document.getElementById('intro-canvas');
                if (introCanvas) {
                    introCanvas.style.display = 'none';
                }
                
                // Initialize main game
                initThreeJS();
                
                // Ensure UI elements are visible
                const crosshair = document.getElementById('crosshair');
                const weaponSprite = document.getElementById('weapon-sprite');
                const picardPortrait = document.getElementById('picard-portrait');
                
                if (crosshair) crosshair.style.display = 'block';
                if (weaponSprite) weaponSprite.style.display = 'flex';
                if (picardPortrait) picardPortrait.style.display = 'flex';
            }
            break;
    }
}

function renderIntroSequence() {
    // Get or create canvas (only once)
    let canvas = document.getElementById('intro-canvas');
    if (!canvas) {
        console.log('Creating intro canvas for the first time...');
        canvas = document.createElement('canvas');
        canvas.id = 'intro-canvas';
        
        // Set all styles directly
        canvas.style.position = 'absolute';
        canvas.style.top = '0px';
        canvas.style.left = '0px';
        canvas.style.zIndex = '5';
        canvas.style.imageRendering = 'pixelated';
        canvas.style.pointerEvents = 'none';
        canvas.style.display = 'block';
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        
        // Set canvas dimensions
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Add to game container
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.appendChild(canvas);
            console.log('Added intro canvas to game container');
        } else {
            document.body.appendChild(canvas);
            console.log('Added intro canvas to body');
        }
    }
    
    // Only render if we're still in intro state
    if (gameState.introState === 'game') {
        return; // Don't render intro if game has started
    }
    
    // Ensure canvas is visible and properly sized
    canvas.style.display = 'block';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2D context for intro sequence');
        return;
    }
    
    // Fill with black
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
        
        // Add text shadow
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
    console.log('updateEndingSequence called, state:', gameState.endingState, 'fadeAlpha:', gameState.endingFadeAlpha);
    
    // Hide UI elements during ending
    const crosshair = document.getElementById('crosshair');
    const weaponSprite = document.getElementById('weapon-sprite');
    const picardPortrait = document.getElementById('picard-portrait');
    
    if (crosshair) crosshair.style.display = 'none';
    if (weaponSprite) weaponSprite.style.display = 'none';
    if (picardPortrait) picardPortrait.style.display = 'none';
    
    switch (gameState.endingState) {
        case 'fading':
            // Fade to black
            gameState.endingFadeAlpha = Math.min(1.0, gameState.endingFadeAlpha + 0.02);
            console.log('Fading to black, alpha:', gameState.endingFadeAlpha);
            
            if (gameState.endingFadeAlpha >= 1.0) {
                // Start video
                gameState.endingState = 'video';
                console.log('Fade complete, starting video...');
                
                // Remove the fade overlay
                const fadeOverlay = document.getElementById('fade-overlay');
                if (fadeOverlay) {
                    fadeOverlay.remove();
                    console.log('Removed fade overlay');
                }
                
                createEndingVideo();
            }
            break;
            
        case 'video':
            // Video is playing, just update the overlay
            console.log('Video playing...');
            
            // Check if video has ended
            if (gameState.endingVideo && gameState.endingVideo.video) {
                if (gameState.endingVideo.video.ended) {
                    console.log('Video ended, cleaning up...');
                    cleanupEndingVideo();
                }
            }
            break;
    }
}

// Add cleanup function for ending video
function cleanupEndingVideo() {
    if (gameState.endingVideo) {
        // Clear time update interval
        if (gameState.endingVideo.timeUpdateInterval) {
            clearInterval(gameState.endingVideo.timeUpdateInterval);
        }
        
        // Remove UI elements
        if (gameState.endingVideo.subtitleDisplay) {
            gameState.endingVideo.subtitleDisplay.remove();
        }
        
        // Clean up final overlay if it exists
        if (gameState.finalOverlay) {
            if (gameState.finalOverlay.container) {
                gameState.finalOverlay.container.remove();
            }
            gameState.finalOverlay = null;
        }
        
        // Reset ending state
        gameState.endingState = 'none';
        gameState.endingVideo = null;
        
        console.log('Ending video cleaned up');
    }
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
    video.muted = false;
    video.autoplay = true;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    
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
        makingOutVideo.muted = false;
        makingOutVideo.autoplay = true;
        makingOutVideo.crossOrigin = 'anonymous';
        makingOutVideo.playsInline = true;
        makingOutVideo.style.width = '100%';
        makingOutVideo.style.height = '100%';
        makingOutVideo.style.objectFit = 'cover';
        
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

function renderFadeOverlay() {
    console.log('renderFadeOverlay called, fadeAlpha:', gameState.endingFadeAlpha);
    
    // Create or get fade overlay div
    let fadeOverlay = document.getElementById('fade-overlay');
    if (!fadeOverlay) {
        console.log('Creating new fade overlay div...');
        fadeOverlay = document.createElement('div');
        fadeOverlay.id = 'fade-overlay';
        fadeOverlay.style.position = 'absolute';
        fadeOverlay.style.top = '0';
        fadeOverlay.style.left = '0';
        fadeOverlay.style.width = '100%';
        fadeOverlay.style.height = '100%';
        fadeOverlay.style.backgroundColor = 'black';
        fadeOverlay.style.zIndex = '1000';
        fadeOverlay.style.pointerEvents = 'none';
        fadeOverlay.style.transition = 'opacity 0.1s ease-out';
        
        // Add to game container
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.appendChild(fadeOverlay);
            console.log('Added fade overlay to game container');
        } else {
            document.body.appendChild(fadeOverlay);
            console.log('Added fade overlay to body');
        }
        
        console.log('Created fade overlay div with styles:', {
            position: fadeOverlay.style.position,
            top: fadeOverlay.style.top,
            left: fadeOverlay.style.left,
            width: fadeOverlay.style.width,
            height: fadeOverlay.style.height,
            backgroundColor: fadeOverlay.style.backgroundColor,
            zIndex: fadeOverlay.style.zIndex
        });
    } else {
        console.log('Using existing fade overlay div');
    }
    
    // Set opacity based on fade alpha
    fadeOverlay.style.opacity = gameState.endingFadeAlpha;
    
    console.log('Fade overlay opacity set to:', gameState.endingFadeAlpha);
    console.log('Fade overlay element:', fadeOverlay);
    console.log('Fade overlay computed styles:', {
        opacity: window.getComputedStyle(fadeOverlay).opacity,
        display: window.getComputedStyle(fadeOverlay).display,
        visibility: window.getComputedStyle(fadeOverlay).visibility
    });
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
        keyboard: {
            target: window
        },
        mouse: true,
        touch: false
    }
};

// Initialize everything
let game;

// Simple initialization - no waiting for load event
console.log('Starting initialization...');

// Check if Three.js loaded
if (typeof THREE === 'undefined') {
    console.error('THREE.js not loaded!');
} else {
    console.log('THREE.js loaded successfully');
    // Initialize Three.js first
    initThreeJS();
}

// Check if Phaser loaded  
if (typeof Phaser === 'undefined') {
    console.error('Phaser not loaded!');
} else {
    console.log('Phaser loaded successfully');
    // Then Phaser for input
    game = new Phaser.Game(config);
    
    // Wait a frame for Phaser to initialize
    setTimeout(() => {
        const inputScene = game.scene.getScene('InputScene');
        if (inputScene) {
            console.log('Input scene created successfully');
            console.log('WASD keys:', inputScene.wasd);
            console.log('Cursor keys:', inputScene.cursors);
        } else {
            console.error('Input scene not found!');
        }
    }, 100);
}

// Initialize the game
console.log('Initializing Picard Quest...');

// Wait for DOM to be ready before starting intro
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initIntroSequence();
        animate();
    });
} else {
    // DOM is already ready
    initIntroSequence();
    animate();
}

console.log('Game initialization complete!');

// Handle window resize
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

// Global keyboard event listeners
window.addEventListener('keydown', (event) => {
    const key = event.key.toUpperCase();
    if (keyboardState.hasOwnProperty(key)) {
        keyboardState[key] = true;
        console.log('Key pressed:', key);
    }
});

window.addEventListener('keyup', (event) => {
    const key = event.key.toUpperCase();
    if (keyboardState.hasOwnProperty(key)) {
        keyboardState[key] = false;
        console.log('Key released:', key);
    }
});

// Global click event listener for projectile
window.addEventListener('click', (event) => {
    console.log('Click detected at:', event.clientX, event.clientY);
    
    // Create projectile regardless of pointer lock state
    console.log('Creating projectile...');
    createProjectile();
    console.log('Projectile triggered by click');
});

// Global click handler for intro sequence
document.addEventListener('click', function(event) {
    if (gameState.introState === 'waiting') {
        gameState.introState = 'fading';
    }
});

// Initialize intro sequence
function initIntroSequence() {
    console.log('Initializing intro sequence...');
    
    // Create star lines for space travel effect
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
    
    console.log('Intro sequence initialized with', gameState.starLines.length, 'star lines');
}

// Initialize intro sequence
initIntroSequence();
