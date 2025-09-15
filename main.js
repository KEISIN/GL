import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- シーンのセットアップ ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- カメラの初期位置 ---
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);

// --- OrbitControls ---
const controls = new OrbitControls(camera, renderer.domElement);

// --- 光源 ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// --- 地面のグリッド ---
const gridHelper = new THREE.GridHelper(100, 100);
scene.add(gridHelper);


// --- 設定値 ---
const CONFIG = {
    transitionTime: 7, // 状態遷移の時間（秒）
    colors: {
        spore: 0x00ff00, // 緑
        worm: 0xffff00, // 黄
        amoeba: 0xffa500, // オレンジ
        fruitingBody: 0xff4500, // 赤みがかったオレンジ
    },
    material: {
        metalness: 0.5,
        roughness: 0.5,
    }
};

// --- 粘菌のライフサイクル状態 ---
const STATE = {
    SPORE: 'spore',
    WORM: 'worm',
    AMOEBA: 'amoeba',
    FRUITING_BODY: 'fruiting_body'
};

/**
 * 粘菌のライフサイクルを管理するクラス
 * 状態（STATE）に応じて、自身の形状と動きを変化させる
 */
class SlimeMold {
    constructor() {
        this.state = STATE.SPORE;
        this.object = new THREE.Group();
        this.clock = new THREE.Clock();

        this.createSpore();
    }

    /**
     * 現在表示されている3Dオブジェクトをすべて削除する
     */
    clearObject() {
        while(this.object.children.length > 0){
            this.object.remove(this.object.children[0]);
        }
    }

    /**
     * 胞子状態のオブジェクトを作成する
     */
    createSpore() {
        console.log("State: Spore");
        this.clearObject();
        this.state = STATE.SPORE;
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: CONFIG.colors.spore,
            ...CONFIG.material
        });
        const spore = new THREE.Mesh(geometry, material);
        this.object.add(spore);
    }

    /**
     * ワーム状態のオブジェクトを作成する
     */
    createWorm() {
        console.log("State: Worm");
        this.clearObject();
        this.state = STATE.WORM;

        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-2, 0, 0),
            new THREE.Vector3(0, 0, 1.5),
            new THREE.Vector3(2, 0, 0),
            new THREE.Vector3(3, 0, -1.5),
        ]);

        const geometry = new THREE.TubeGeometry(curve, 20, 0.1, 8, false);
        const material = new THREE.MeshStandardMaterial({
            color: CONFIG.colors.worm,
            ...CONFIG.material
        });
        const worm = new THREE.Mesh(geometry, material);
        this.object.add(worm);
    }

    /**
     * アメーバ状態のオブジェクトを作成する
     */
    createAmoeba() {
        console.log("State: Amoeba");
        this.clearObject();
        this.state = STATE.AMOEBA;

        const material = new THREE.MeshStandardMaterial({
            color: CONFIG.colors.amoeba,
            ...CONFIG.material
        });
        const sphereCount = 20;

        for (let i = 0; i < sphereCount; i++) {
            const radius = THREE.MathUtils.randFloat(0.2, 0.5);
            const geometry = new THREE.SphereGeometry(radius, 16, 16);
            const sphere = new THREE.Mesh(geometry, material);

            sphere.position.set(
                THREE.MathUtils.randFloatSpread(2.5),
                THREE.MathUtils.randFloatSpread(2.5),
                THREE.MathUtils.randFloatSpread(2.5)
            );
            this.object.add(sphere);
        }
    }

    /**
     * 子実体状態のオブジェクトを作成する
     */
    createFruitingBody() {
        console.log("State: Fruiting Body");
        this.clearObject();
        this.state = STATE.FRUITING_BODY;

        const material = new THREE.MeshStandardMaterial({
            color: CONFIG.colors.fruitingBody,
            ...CONFIG.material
        });

        const stalkHeight = 3.5;
        const stalkGeometry = new THREE.CylinderGeometry(0.15, 0.25, stalkHeight, 16);
        const stalk = new THREE.Mesh(stalkGeometry, material);
        stalk.position.y = stalkHeight / 2;

        const capGeometry = new THREE.SphereGeometry(1.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.8);
        const cap = new THREE.Mesh(capGeometry, material);
        cap.position.y = stalkHeight;

        this.object.add(stalk);
        this.object.add(cap);
    }

    /**
     * フレームごとに呼び出され、アニメーションと状態遷移を処理する
     */
    update() {
        const elapsedTime = this.clock.getElapsedTime();

        // 状態に応じたアニメーション処理
        switch (this.state) {
            case STATE.SPORE:
                if (this.object.children[0]) {
                    this.object.children[0].position.y = Math.abs(Math.sin(elapsedTime * 2)) * 0.2 + 0.2;
                }
                break;
            case STATE.WORM:
                this.object.rotation.y += 0.005;
                break;
            case STATE.AMOEBA:
                this.object.rotation.x += 0.001;
                this.object.rotation.y += 0.002;
                this.object.children.forEach((child, i) => {
                    const scale = 1.0 + Math.sin(elapsedTime * 4 + i * 0.5) * 0.15;
                    child.scale.set(scale, scale, scale);
                });
                break;
            case STATE.FRUITING_BODY:
                 this.object.rotation.y += 0.003;
                break;
        }

        // 時間経過による状態遷移
        if (elapsedTime > CONFIG.transitionTime) {
            switch(this.state) {
                case STATE.SPORE: this.createWorm(); break;
                case STATE.WORM: this.createAmoeba(); break;
                case STATE.AMOEBA: this.createFruitingBody(); break;
                case STATE.FRUITING_BODY: this.createSpore(); break;
            }
            this.clock.start(); // タイマーをリセット
        }
    }
}

// --- 粘菌のインスタンス化 ---
const slimeMold = new SlimeMold();
scene.add(slimeMold.object);


// --- アニメーションループ ---
function animate() {
    requestAnimationFrame(animate);

    slimeMold.update(); // 粘菌の状態を更新

    controls.update();
    renderer.render(scene, camera);
}

animate();

// --- ウィンドウリサイズ対応 ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
