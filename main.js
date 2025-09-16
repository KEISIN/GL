import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// シーン
const scene = new THREE.Scene();

// カメラ
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

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

const positions = new Float32Array(starCount * 3);
const colors = new Float32Array(starCount * 3);

const clusterCenters = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(400, 200, -300),
    new THREE.Vector3(-350, -250, 250),
    new THREE.Vector3(250, -300, -400),
    new THREE.Vector3(-200, 350, 300),
    new THREE.Vector3(100, 100, 200),
];
const numClusters = clusterCenters.length;

// Box-Muller transform to get a normal distribution (provides a pair of random numbers)
function getBoxMullerTransform() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    const R = Math.sqrt(-2.0 * Math.log(u));
    const theta = 2.0 * Math.PI * v;
    return [R * Math.cos(theta), R * Math.sin(theta)];
}

for (let i = 0; i < starCount; i++) {
    // Pick a random cluster
    const cluster = clusterCenters[Math.floor(Math.random() * numClusters)];

    // Generate position with a Gaussian distribution around the cluster center
    const stdDev = 100; // Standard deviation - controls the spread of the cluster

    const [rand1, rand2] = getBoxMullerTransform();
    const rand3 = getBoxMullerTransform()[0]; // We only need one from the second pair

    const x = cluster.x + rand1 * stdDev;
    const y = cluster.y + rand2 * stdDev;
    const z = cluster.z + rand3 * stdDev;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // 色をランダムに設定
    colors[i * 3] = Math.random();
    colors[i * 3 + 1] = Math.random();
    colors[i * 3 + 2] = Math.random();
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

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
