// =====================================================
// SOUND MANAGER - Universal Click Sound System
// =====================================================
// Handles all click sounds and audio interactions in the game

class SoundManager {
    constructor() {
        this.clickSound = null;
        this.gameMusic = null;
        this.introMusic = null; // Intro music for queue waiting
        this.isEnabled = true;
        this.isLoaded = false;
        this.audioPool = []; // Pool of audio objects to prevent cutting off
        this.poolSize = 5;
        this.currentMusic = null; // Track currently playing music
        this.userHasInteracted = false; // Track if user has interacted to unlock audio

        this.init();
    }

    async init() {
        try {
            // Create a pool of audio objects for overlapping sounds
            for (let i = 0; i < this.poolSize; i++) {
                const audio = new Audio('./sounds/click.mp3');
                audio.preload = 'auto';
                audio.volume = 0.7; // Adjust volume as needed
                this.audioPool.push(audio);
            }

            // Initialize game music
            this.gameMusic = new Audio('./sounds/intenseGame.mp3');
            this.gameMusic.preload = 'auto';
            this.gameMusic.volume = 0.8; // Increased volume for better audibility
            this.gameMusic.loop = false; // Don't loop the intense music

            // Initialize intro music for queue waiting
            this.introMusic = new Audio('./sounds/intro.mp3');
            this.introMusic.preload = 'auto';
            this.introMusic.volume = 0.6; // Slightly lower volume for background music
            this.introMusic.loop = true; // Loop the intro music during queue waiting

            // Add event listeners for debugging
            this.gameMusic.addEventListener('loadstart', () => console.log('🎵 Game music loading started'));
            this.gameMusic.addEventListener('canplay', () => console.log('🎵 Game music can start playing'));
            this.gameMusic.addEventListener('canplaythrough', () => console.log('🎵 Game music fully loaded'));
            this.gameMusic.addEventListener('play', () => console.log('🎵 Game music started playing'));
            this.gameMusic.addEventListener('pause', () => console.log('🎵 Game music paused'));
            this.gameMusic.addEventListener('ended', () => console.log('🎵 Game music ended'));
            this.gameMusic.addEventListener('error', (e) => console.error('🎵 Game music error:', e));

            // Add event listeners for intro music debugging
            this.introMusic.addEventListener('loadstart', () => console.log('🎶 Intro music loading started'));
            this.introMusic.addEventListener('canplay', () => console.log('🎶 Intro music can start playing'));
            this.introMusic.addEventListener('canplaythrough', () => console.log('🎶 Intro music fully loaded'));
            this.introMusic.addEventListener('play', () => console.log('🎶 Intro music started playing'));
            this.introMusic.addEventListener('pause', () => console.log('🎶 Intro music paused'));
            this.introMusic.addEventListener('ended', () => console.log('🎶 Intro music ended'));
            this.introMusic.addEventListener('error', (e) => console.error('🎶 Intro music error:', e));

            // Load the sounds and mark as ready
            await this.preloadSound();
            await this.preloadGameMusic();
            await this.preloadIntroMusic();
            this.isLoaded = true;
            console.log('✅ Sound Manager initialized successfully');

            // Set up global click listeners
            this.setupGlobalListeners();

        } catch (error) {
            console.warn('⚠️ Sound Manager failed to initialize:', error);
            this.isEnabled = false;
        }
    }

    async preloadSound() {
        return new Promise((resolve, reject) => {
            const testAudio = this.audioPool[0];

            testAudio.addEventListener('canplaythrough', () => {
                resolve();
            }, { once: true });

            testAudio.addEventListener('error', (e) => {
                reject(e);
            }, { once: true });

            // Trigger loading
            testAudio.load();
        });
    }

    async preloadGameMusic() {
        return new Promise((resolve, reject) => {
            this.gameMusic.addEventListener('canplaythrough', () => {
                resolve();
            }, { once: true });

            this.gameMusic.addEventListener('error', (e) => {
                reject(e);
            }, { once: true });

            // Trigger loading
            this.gameMusic.load();
        });
    }

    async preloadIntroMusic() {
        return new Promise((resolve, reject) => {
            this.introMusic.addEventListener('canplaythrough', () => {
                resolve();
            }, { once: true });

            this.introMusic.addEventListener('error', (e) => {
                reject(e);
            }, { once: true });

            // Trigger loading
            this.introMusic.load();
        });
    }

    playClick() {
        if (!this.isEnabled || !this.isLoaded) return;

        // Unlock audio context on first user interaction
        this.unlockAudio();

        try {
            // Find an available audio object from the pool
            const availableAudio = this.audioPool.find(audio =>
                audio.paused || audio.ended || audio.currentTime === 0
            );

            if (availableAudio) {
                availableAudio.currentTime = 0; // Reset to beginning
                availableAudio.play().catch(error => {
                    console.warn('Sound play failed:', error);
                });
            }
        } catch (error) {
            console.warn('Sound playback error:', error);
        }
    }

    // Unlock audio context on first user interaction
    unlockAudio() {
        if (this.userHasInteracted) return;

        this.userHasInteracted = true;
        console.log('🔓 Audio unlocked - user has interacted');

        // Try to play and immediately pause the music to unlock it
        if (this.gameMusic) {
            this.gameMusic.play().then(() => {
                this.gameMusic.pause();
                this.gameMusic.currentTime = 0;
                console.log('🎵 Music context unlocked successfully');
            }).catch(error => {
                console.warn('🎵 Failed to unlock music context:', error);
            });
        }

        // Start intro music immediately when audio is unlocked
        setTimeout(() => {
            console.log('🎶 Starting intro music after audio unlock');
            this.playIntroMusic();
        }, 100);
    }

    setupGlobalListeners() {
        // Add click sound to all interactive elements
        document.addEventListener('click', (event) => {
            const target = event.target;

            // Check if the clicked element is interactive
            if (this.isInteractiveElement(target)) {
                this.playClick();
            }
        }, true); // Use capture phase to catch all clicks

        // Also add to mouse down for immediate feedback
        document.addEventListener('mousedown', (event) => {
            const target = event.target;

            // Always unlock audio on any interaction
            this.unlockAudio();

            if (this.isInteractiveElement(target)) {
                // Small delay to make it feel more responsive
                setTimeout(() => this.playClick(), 10);
            }
        }, true);

        // Touch events for mobile
        document.addEventListener('touchstart', (event) => {
            const target = event.target;

            // Always unlock audio on any interaction
            this.unlockAudio();

            if (this.isInteractiveElement(target)) {
                this.playClick();
            }
        }, true);

        // Generic interaction listeners to unlock audio
        ['click', 'keydown', 'touchend'].forEach(eventType => {
            document.addEventListener(eventType, () => {
                this.unlockAudio();
            }, { once: false, passive: true });
        });
    }

    isInteractiveElement(element) {
        if (!element) return false;

        const tagName = element.tagName.toLowerCase();
        const className = element.className || '';
        const hasClickListener = element.onclick !== null;

        // Check for specific interactive elements
        const interactiveElements = [
            'button',
            'a',
            'input',
            'select',
            'textarea'
        ];

        // Check for interactive classes commonly used in the game
        const interactiveClasses = [
            'btn',
            'rps-choice',
            'cell',
            'mole-hole',
            'choice-image',
            'reaction-zone'
        ];

        // Check for cursor pointer style
        const hasPointerCursor = window.getComputedStyle(element).cursor === 'pointer';

        return (
            interactiveElements.includes(tagName) ||
            interactiveClasses.some(cls => className.includes(cls)) ||
            hasClickListener ||
            hasPointerCursor ||
            element.hasAttribute('data-choice') ||
            element.hasAttribute('data-index') ||
            element.hasAttribute('data-position')
        );
    }

    // Method to enable/disable sounds
    toggle() {
        this.isEnabled = !this.isEnabled;
        console.log(`🔊 Sound ${this.isEnabled ? 'enabled' : 'disabled'}`);
        return this.isEnabled;
    }

    // Method to adjust volume
    setVolume(volume) {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.audioPool.forEach(audio => {
            audio.volume = clampedVolume;
        });
        console.log(`🔊 Volume set to ${Math.round(clampedVolume * 100)}%`);
    }

    // Play intense game music when a game starts
    playGameMusic() {
        console.log('🎵 playGameMusic called - checking conditions...');
        console.log(`🎵 isEnabled: ${this.isEnabled}, isLoaded: ${this.isLoaded}, userHasInteracted: ${this.userHasInteracted}`);

        if (!this.isEnabled || !this.isLoaded || !this.gameMusic) {
            console.warn('🎵 Cannot play music - conditions not met');
            return;
        }

        if (!this.userHasInteracted) {
            console.warn('🎵 Cannot play music - user has not interacted yet (browser autoplay restriction)');
            return;
        }

        try {
            // Stop any currently playing music (including intro music)
            this.stopGameMusic();
            this.stopIntroMusic();

            // Reset and play the game music
            this.gameMusic.currentTime = 0;
            console.log('🎵 Attempting to play intense game music...');

            this.currentMusic = this.gameMusic.play().then(() => {
                console.log('🎵 ✅ Music started successfully!');
            }).catch(error => {
                console.error('🎵 ❌ Game music play failed:', error);
            });

        } catch (error) {
            console.error('🎵 Game music playback error:', error);
        }
    }

    // Stop the current game music
    stopGameMusic() {
        if (this.gameMusic && !this.gameMusic.paused) {
            this.gameMusic.pause();
            this.gameMusic.currentTime = 0;
            console.log('🎵 Stopped game music');
        }
    }

    // Play intro music when entering queue
    playIntroMusic() {
        console.log('🎶 playIntroMusic called - checking conditions...');
        console.log(`🎶 isEnabled: ${this.isEnabled}, isLoaded: ${this.isLoaded}, userHasInteracted: ${this.userHasInteracted}`);

        if (!this.isEnabled || !this.isLoaded || !this.introMusic) {
            console.warn('🎶 Cannot play intro music - conditions not met');
            return;
        }

        if (!this.userHasInteracted) {
            console.warn('🎶 Cannot play intro music - user has not interacted yet (browser autoplay restriction)');
            return;
        }

        try {
            // Stop any currently playing music first
            this.stopGameMusic();
            this.stopIntroMusic(); // Stop existing intro music if already playing

            // Reset and play the intro music
            this.introMusic.currentTime = 0;
            console.log('🎶 Attempting to play intro music...');

            this.currentMusic = this.introMusic.play().then(() => {
                console.log('🎶 ✅ Intro music started successfully!');
            }).catch(error => {
                console.error('🎶 ❌ Intro music play failed:', error);
            });

        } catch (error) {
            console.error('🎶 Intro music playback error:', error);
        }
    }

    // Stop the intro music
    stopIntroMusic() {
        if (this.introMusic && !this.introMusic.paused) {
            this.introMusic.pause();
            this.introMusic.currentTime = 0;
            console.log('🎶 Stopped intro music');
        }
    }

    // Method to play specific sounds (for future expansion)
    playSound(soundName) {
        switch(soundName) {
            case 'click':
                this.playClick();
                break;
            case 'gameStart':
            case 'intense':
                this.playGameMusic();
                break;
            case 'intro':
            case 'queue':
                this.playIntroMusic();
                break;
            default:
                console.warn(`Unknown sound: ${soundName}`);
        }
    }

    // Test methods for debugging (call from console)
    testMusic() {
        console.log('🎵 Testing music manually...');
        this.unlockAudio(); // Force unlock
        setTimeout(() => {
            this.playGameMusic();
        }, 100);
    }

    debugStatus() {
        console.log('🔍 Sound Manager Debug Status:');
        console.log(`  • Enabled: ${this.isEnabled}`);
        console.log(`  • Loaded: ${this.isLoaded}`);
        console.log(`  • User Interacted: ${this.userHasInteracted}`);
        console.log(`  • Game Music: ${this.gameMusic ? 'Created' : 'Not Created'}`);
        if (this.gameMusic) {
            console.log(`  • Music Ready State: ${this.gameMusic.readyState}`);
            console.log(`  • Music Paused: ${this.gameMusic.paused}`);
            console.log(`  • Music Volume: ${this.gameMusic.volume}`);
            console.log(`  • Music Duration: ${this.gameMusic.duration}`);
            console.log(`  • Music Error: ${this.gameMusic.error}`);
        }
    }

    forceUnlock() {
        console.log('🔓 Force unlocking audio...');
        this.userHasInteracted = true;
        this.unlockAudio();
    }
}

// Initialize the sound manager when the page loads
let soundManager;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 Initializing SoundManager...');
    soundManager = new SoundManager();

    // Make it globally accessible AFTER creation
    window.soundManager = soundManager;
    console.log('🎵 SoundManager set on window object');
});

// Make class globally accessible for debugging and manual control
window.SoundManager = SoundManager;