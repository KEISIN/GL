import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise3D } from 'simplex-noise';
// Initialize the scene, camera, and renderer
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set background color to black
scene.background = new THREE.Color(0x000000);

// --- Star generation ---
const particleCount = 10000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3); // x, y, z
const colors = new Float32Array(particleCount * 3); // r, g, b (final color)
const baseColors = new Float32Array(particleCount * 3); // r, g, b (initial random color)
const fadeVelocities = new Float32Array(particleCount * 3); // x, y, z for fading

const color = new THREE.Color();

// --- Filament Structure using Simplex Noise ---
const noise3D = createNoise3D(Math.random);
const noiseFrequency = 2.0;
const noiseThreshold = 0.3;
const generationVolume = 2.0; // The size of the volume to generate points in

let currentParticles = 0;
while (currentParticles < particleCount) {
    // Generate a random point in a cube
    const x = (Math.random() - 0.5) * generationVolume;
    const y = (Math.random() - 0.5) * generationVolume;
    const z = (Math.random() - 0.5) * generationVolume;

    // Get the noise value at that point
    const noiseValue = noise3D(x * noiseFrequency, y * noiseFrequency, z * noiseFrequency);

    // If the noise value is above the threshold, accept the particle
    if (noiseValue > noiseThreshold) {
        const i3 = currentParticles * 3;
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;

        // Assign a fully random base color
        const baseColor = new THREE.Color(Math.random() * 0xffffff);
        baseColors[i3] = baseColor.r;
        baseColors[i3 + 1] = baseColor.g;
        baseColors[i3 + 2] = baseColor.b;

        // Set initial color
        colors[i3] = baseColor.r;
        colors[i3 + 1] = baseColor.g;
        colors[i3 + 2] = baseColor.b;

        currentParticles++;
    }
}

// Create a read-only copy of initial positions for reference
const initialPositions = new Float32Array(positions);

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('baseColor', new THREE.BufferAttribute(baseColors, 3));
geometry.setAttribute('fadeVelocity', new THREE.BufferAttribute(fadeVelocities, 3));

const material = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);


// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
controls.dampingFactor = 0.05;


// Animation state
let animationState = 'expanding'; // expanding, fading
let expansionFactor = 0.01;
const maxExpansion = 100.0; // We can use this to normalize color
const expansionSpeed = 0.055;

const clock = new THREE.Clock();
let animationId;

function animate() {
    animationId = requestAnimationFrame(animate);

    // State machine
    if (animationState === 'expanding') {
        // Switch to fading after 30 seconds
        if (clock.getElapsedTime() > 30) {
            animationState = 'fading';
        }

        // Expansion logic
        expansionFactor += expansionSpeed;

    } else if (animationState === 'fading') {
        const velocities = particles.geometry.attributes.fadeVelocity;
        // Check if velocities have been initialized for this fading phase
        if (velocities.array[0] === 0) { // A simple check, assumes first velocity component is non-zero
            const velocitySpread = 0.1;
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                velocities.array[i3] = (Math.random() - 0.5) * velocitySpread;
                velocities.array[i3 + 1] = (Math.random() - 0.5) * velocitySpread;
                velocities.array[i3 + 2] = (Math.random() - 0.5) * velocitySpread;
            }
        }

        // Fade out the material
        particles.material.opacity -= 0.005;

        // Stop animation when faded out
        if (particles.material.opacity <= 0) {
            cancelAnimationFrame(animationId);
            return;
        }

        const positionsArray = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positionsArray[i3] += velocities.array[i3];
            positionsArray[i3 + 1] += velocities.array[i3 + 1];
            positionsArray[i3 + 2] += velocities.array[i3 + 2];
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }

    // Common rendering logic, but position/color updates only happen during expansion for now
    if (animationState === 'expanding') {
        const positionsArray = particles.geometry.attributes.position.array;
        const colorsArray = particles.geometry.attributes.color.array;
        const baseColorsArray = particles.geometry.attributes.baseColor.array;
        const redshiftColor = new THREE.Color();

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;

            const x = initialPositions[i3];
            const y = initialPositions[i3 + 1];
            const z = initialPositions[i3 + 2];

            // Scale the initial position directly to create uniform expansion
            positionsArray[i3] = x * expansionFactor;
            positionsArray[i3 + 1] = y * expansionFactor;
            positionsArray[i3 + 2] = z * expansionFactor;

            const distance = Math.sqrt(
                positionsArray[i3] ** 2 + positionsArray[i3 + 1] ** 2 + positionsArray[i3 + 2] ** 2
            );

            // Get the base color
            const baseColor = new THREE.Color(baseColorsArray[i3], baseColorsArray[i3 + 1], baseColorsArray[i3 + 2]);

            // Determine the redshift color (blue to red)
            const colorRatio = Math.min(distance / maxExpansion, 1.0);
            redshiftColor.setRGB(colorRatio, 0, 1 - colorRatio);

            // Blend base color with redshift color
            baseColor.lerp(redshiftColor, colorRatio * 0.8); // Stronger redshift effect on color

            colorsArray[i3] = baseColor.r;
            colorsArray[i3 + 1] = baseColor.g;
            colorsArray[i3 + 2] = baseColor.b;
        }

        particles.geometry.attributes.position.needsUpdate = true;
        particles.geometry.attributes.color.needsUpdate = true;
    }

    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
    renderer.render(scene, camera);
}

animate();
