import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- シーンのセットアップ ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- カメラの初期位置 ---
camera.position.set(15, 25, 25);
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
    maxGeneration: 8, // 増殖が停止する世代
    transitionTime: 7, // 状態遷移の時間（秒）
    fadeTime: 1.5, // クロスフェードの時間（秒）
    colors: {
        spore: 0x00ff00, // 緑
        worm: 0xffff00, // 黄
        amoeba: 0xffa500, // オレンジ
        fruitingBody: 0xff4500, // 赤みがかったオレンジ
    },
    material: {}
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
    constructor(initialPosition = new THREE.Vector3(0, 0, 0), generation = 0) {
        this.state = STATE.SPORE;
        this.generation = generation;
        this.isAlive = true;

        this.object = null; // 現在のオブジェクト
        this.oldObject = null; // フェードアウト中のオブジェクト

        this.clock = new THREE.Clock();
        this.transitionClock = new THREE.Clock();
        this.isTransitioning = false;

        this.object = this.createSpore(true); // 初期オブジェクト
        this.object.position.copy(initialPosition);
        scene.add(this.object);

        console.log(`New mold created at generation ${this.generation}`);
    }

    /**
     * グループ内のジオメトリとマテリアルを解放する
     * @param {THREE.Group} group
     */
    disposeGroup(group) {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }

    /**
     * 指定されたグループ内の全メッシュの透明度を設定する
     * @param {THREE.Group} group - 対象のグループ
     * @param {number} opacity - 設定する透明度 (0.0 - 1.0)
     */
    setOpacity(group, opacity) {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.opacity = opacity;
            }
        });
    }

    /**
     * 胞子状態のオブジェクトを作成する
     * @param {boolean} isInitial - 初期生成かどうか
     */
    createSpore(isInitial = false) {
        console.log("State: Spore");
        this.state = STATE.SPORE;
        const group = new THREE.Group();
        const geometry = new THREE.SphereGeometry(0.2, 8, 8); // 簡略化
        const material = new THREE.MeshLambertMaterial({
            color: CONFIG.colors.spore,
            ...CONFIG.material,
            transparent: true,
            opacity: isInitial ? 1.0 : 0.0
        });
        const spore = new THREE.Mesh(geometry, material);
        group.add(spore);
        return group;
    }

    /**
     * ワーム状態のオブジェクトを作成する
     */
    createWorm() {
        console.log("State: Worm");
        this.state = STATE.WORM;
        const group = new THREE.Group();
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-2, 0, 0),
            new THREE.Vector3(0, 0, 1.5),
            new THREE.Vector3(2, 0, 0),
            new THREE.Vector3(3, 0, -1.5),
        ]);
        const geometry = new THREE.TubeGeometry(curve, 10, 0.1, 5, false); // 簡略化
        const material = new THREE.MeshLambertMaterial({
            color: CONFIG.colors.worm,
            ...CONFIG.material,
            transparent: true,
            opacity: 0.0
        });
        const worm = new THREE.Mesh(geometry, material);
        group.add(worm);
        return group;
    }

    /**
     * アメーバ状態のオブジェクトを作成する
     */
    createAmoeba() {
        console.log("State: Amoeba");
        this.state = STATE.AMOEBA;
        const group = new THREE.Group();
        const material = new THREE.MeshLambertMaterial({
            color: CONFIG.colors.amoeba,
            ...CONFIG.material,
            transparent: true,
            opacity: 0.0
        });
        const sphereCount = 15; // 少し減らす
        for (let i = 0; i < sphereCount; i++) {
            const radius = THREE.MathUtils.randFloat(0.2, 0.5);
            const geometry = new THREE.SphereGeometry(radius, 8, 8); // 簡略化
            const sphere = new THREE.Mesh(geometry, material); // material.clone() を削除
            sphere.position.set(
                THREE.MathUtils.randFloatSpread(2.5),
                THREE.MathUtils.randFloatSpread(2.5),
                THREE.MathUtils.randFloatSpread(2.5)
            );
            group.add(sphere);
        }
        return group;
    }

    /**
     * 子実体状態のオブジェクトを作成する
     */
    createFruitingBody() {
        console.log("State: Fruiting Body");
        this.state = STATE.FRUITING_BODY;
        const group = new THREE.Group();
        const material = new THREE.MeshLambertMaterial({
            color: CONFIG.colors.fruitingBody,
            ...CONFIG.material,
            transparent: true,
            opacity: 0.0
        });
        const stalkHeight = 3.5;
        const stalkGeometry = new THREE.CylinderGeometry(0.15, 0.25, stalkHeight, 8); // 簡略化
        const stalk = new THREE.Mesh(stalkGeometry, material); // material.clone() を削除
        stalk.position.y = stalkHeight / 2;
        const capGeometry = new THREE.SphereGeometry(1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8); // 簡略化
        const cap = new THREE.Mesh(capGeometry, material); // material.clone() を削除
        cap.position.y = stalkHeight;
        group.add(stalk);
        group.add(cap);
        return group;
    }

    /**
     * インスタンスをシーンから削除する
     */
    destroy() {
        this.isAlive = false;
        this.isTransitioning = true; // フェードアウト処理のために遷移状態にする
        this.transitionClock.start();

        this.oldObject = this.object;
        this.object = null; // 新しいオブジェクトは作らない
    }

    /**
     * フレームごとに呼び出され、アニメーションと状態遷移を処理する
     * @returns {SlimeMold[]} - 生成された新しいSlimeMoldインスタンスの配列
     */
    update() {
        if (!this.isAlive) return [];

        const elapsedTime = this.clock.getElapsedTime();
        let offspring = [];

        // 状態に応じたアニメーション処理
        if (this.object) {
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
        }

        // 遷移中のフェード処理
        if (this.isTransitioning) {
            const transitionElapsedTime = this.transitionClock.getElapsedTime();
            const progress = Math.min(transitionElapsedTime / CONFIG.fadeTime, 1.0);

            this.setOpacity(this.object, progress);
            this.setOpacity(this.oldObject, 1.0 - progress);

            if (progress >= 1.0) {
                this.isTransitioning = false;
                if(this.oldObject) {
                    scene.remove(this.oldObject);
                    this.disposeGroup(this.oldObject);
                }
                this.oldObject = null;
                 // 寿命で死ぬ場合、objectはnullなので何もしない
                if (!this.object) {
                    this.isAlive = false;
                }
            }
        }

        // 時間経過による状態遷移の開始
        if (!this.isTransitioning && elapsedTime > CONFIG.transitionTime) {

            // 子実体からの遷移は特別扱い (増殖または死)
            if (this.state === STATE.FRUITING_BODY) {
                if (this.generation < CONFIG.maxGeneration) {
                    const nextGen = this.generation + 1;
                    const pos = this.object.position;

                    // 2つの新しい胞子をランダムな方向に生成
                    const angle1 = Math.random() * Math.PI * 2;
                    const dist1 = THREE.MathUtils.randFloat(1.5, 3.0);
                    const p1 = pos.clone().add(new THREE.Vector3(Math.cos(angle1) * dist1, 0, Math.sin(angle1) * dist1));

                    const angle2 = angle1 + Math.PI + THREE.MathUtils.randFloat(-0.5, 0.5); // 少し角度をずらす
                    const dist2 = THREE.MathUtils.randFloat(1.5, 3.0);
                    const p2 = pos.clone().add(new THREE.Vector3(Math.cos(angle2) * dist2, 0, Math.sin(angle2) * dist2));

                    offspring.push(new SlimeMold(p1, nextGen));
                    offspring.push(new SlimeMold(p2, nextGen));
                }
                this.destroy();
                return offspring;
            }

            this.isTransitioning = true;
            this.transitionClock.start();
            this.clock.start();

            this.oldObject = this.object;
            let nextStateCreator;

            switch(this.state) {
                case STATE.SPORE: nextStateCreator = () => this.createWorm(); break;
                case STATE.WORM: nextStateCreator = () => this.createAmoeba(); break;
                case STATE.AMOEBA: nextStateCreator = () => this.createFruitingBody(); break;
            }

            this.object = nextStateCreator();
            if (this.oldObject) {
                this.object.position.copy(this.oldObject.position);
            }
            scene.add(this.object);
        }
        return offspring;
    }
}

// --- シミュレーション管理 ---
let slimeMolds = [];

function initSimulation() {
    // 既存の粘菌をすべて削除
    slimeMolds.forEach(mold => {
        if (mold.object) scene.remove(mold.object);
        if (mold.oldObject) scene.remove(mold.oldObject);
    });
    slimeMolds.length = 0;

    // 最初の粘菌を生成
    slimeMolds.push(new SlimeMold(new THREE.Vector3(0, 0, 0), 0));
}


// --- アニメーションループ ---
function animate() {
    requestAnimationFrame(animate);

    let allOffspring = [];
    // すべての粘菌インスタンスを更新
    for (const mold of slimeMolds) {
        const offspring = mold.update();
        if (offspring.length > 0) {
            allOffspring.push(...offspring);
        }
    }

    // 新しい子孫を追加
    if (allOffspring.length > 0) {
        slimeMolds.push(...allOffspring);
    }

    // 死んだインスタンスをフィルタリング
    slimeMolds = slimeMolds.filter(mold => mold.isAlive || mold.isTransitioning);


    controls.update();
    renderer.render(scene, camera);
}

initSimulation();

animate();

// --- ウィンドウリサイズ対応 ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
