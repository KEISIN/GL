import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createNoise3D } from 'simplex-noise';

// シーン
const scene = new THREE.Scene();

// カメラ
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 800;

// レンダラー
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 星のジオメトリを作成
const starGeometry = new THREE.BufferGeometry();
const starCount = 200000;

const positions = [];
const colors = [];

const noise3D = createNoise3D();
const density = 0.4; // ノイズのしきい値
const scale = 0.005; // ノイズのスケール
const radius = 500; // 星が分布する球体の半径

let starsAdded = 0;
while (starsAdded < starCount) {
    // 球体内にランダムな点を生成
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const r = Math.cbrt(Math.random()) * radius;

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    // Simplex Noiseを計算（フラクタルノイズ）
    const nx = x * scale;
    const ny = y * scale;
    const nz = z * scale;

    let noiseValue = 0;
    let frequency = 1;
    let amplitude = 1;
    for (let j = 0; j < 4; j++) {
        noiseValue += noise3D(nx * frequency, ny * frequency, nz * frequency) * amplitude;
        frequency *= 2;
        amplitude *= 0.5;
    }

    if (noiseValue > density) {
        positions.push(x, y, z);
        const color = new THREE.Color();
        color.setHSL(Math.random(), 0.8, 0.7);
        colors.push(color.r, color.g, color.b);
        starsAdded++;
    }
}

starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

// 星のマテリアルを作成
const starMaterial = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
});

// 星のパーティクルシステムを作成
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// アニメーションループ
function animate() {
    requestAnimationFrame(animate);

    controls.update();

    // 星を少し回転させる
    stars.rotation.x += 0.0001;
    stars.rotation.y += 0.0001;

    renderer.render(scene, camera);
}

// ウィンドウリサイズ時の処理
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
