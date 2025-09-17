import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
const colors = new Float32Array(particleCount * 3); // r, g, b

const color = new THREE.Color();

for (let i = 0; i < particleCount; i++) {
    // Initial position (close to the center)
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 0.1;
    positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
    positions[i3 + 2] = (Math.random() - 0.5) * 0.1;

    // Initial color (will be updated in animation loop)
    color.set(0xffffff); // Start as white
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    sizeAttenuation: true
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
let expansionFactor = 0.01;
let state = 'expanding'; // 'expanding' or 'contracting'
const maxExpansion = 100.0;
const expansionSpeed = 0.005;
const contractionSpeed = 0.01;

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Update state
    if (state === 'expanding') {
        expansionFactor += expansionSpeed;
        if (expansionFactor >= maxExpansion) {
            state = 'contracting';
        }
    } else { // contracting
        expansionFactor -= contractionSpeed;
        if (expansionFactor <= 0.01) {
            state = 'expanding';
            // Reset positions for the new "bang"
             for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * 0.1;
                positions[i3 + 1] = (Math.random() - 0.5) * 0.1;
                positions[i3 + 2] = (Math.random() - 0.5) * 0.1;
            }
        }
    }

    const positionsArray = particles.geometry.attributes.position.array;
    const colorsArray = particles.geometry.attributes.color.array;

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];

        const initialVector = new THREE.Vector3(x, y, z).normalize();

        positionsArray[i3] = initialVector.x * expansionFactor;
        positionsArray[i3+1] = initialVector.y * expansionFactor;
        positionsArray[i3+2] = initialVector.z * expansionFactor;

        const distance = Math.sqrt(
            positionsArray[i3]**2 + positionsArray[i3+1]**2 + positionsArray[i3+2]**2
        );

        // Color based on distance (blue=close, red=far)
        const colorRatio = Math.min(distance / maxExpansion, 1.0);
        const blue = 1 - colorRatio;
        const red = colorRatio;

        colorsArray[i3] = red;
        colorsArray[i3 + 1] = 0;
        colorsArray[i3 + 2] = blue;
    }

    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;

    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    renderer.render(scene, camera);
}

animate();
