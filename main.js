import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- シーンのセットアップ ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.set(15, 25, 25);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

const gridHelper = new THREE.GridHelper(100, 100);
scene.add(gridHelper);

// --- 定数と設定 ---
const CONFIG = {
    maxGeneration: 8,
    transitionTime: 7,
    fadeTime: 1.5,
    colors: {
        spore: 0x00ff00,
        worm: 0xffff00,
        amoeba: 0xffa500,
        fruitingBody: 0xff4500,
    },
    material: {}
};

const STATE = {
    SPORE: 'spore',
    WORM: 'worm',
    AMOEBA: 'amoeba',
    FRUITING_BODY: 'fruiting_body'
};

/**
 * 個々の粘菌のライフサイクルを管理するクラス
 */
class SlimeMold {
    /**
     * @param {THREE.Scene} scene - Three.jsのシーン
     * @param {THREE.Vector3} initialPosition - 初期位置
     * @param {number} generation - 世代数
     */
    constructor(scene, initialPosition = new THREE.Vector3(0, 0, 0), generation = 0) {
        this.scene = scene;
        this.state = STATE.SPORE;
        this.generation = generation;
        this.isAlive = true;

        this.object = null;
        this.oldObject = null;

        this.clock = new THREE.Clock();
        this.transitionClock = new THREE.Clock();
        this.isTransitioning = false;

        this.object = this._createSpore(true);
        this.object.position.copy(initialPosition);
        this.scene.add(this.object);

        console.log(`New mold created at generation ${this.generation}, total: ${this.scene.children.length}`);
    }

    // --- Private Methods ---

    /**
     * グループ内のジオメトリとマテリアルを解放する
     * @param {THREE.Group} group
     */
    _disposeGroup(group) {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh) {
                child.geometry?.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }

    /**
     * グループ内の全メッシュの透明度を設定する
     * @param {THREE.Group} group
     * @param {number} opacity
     */
    _setOpacity(group, opacity) {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh) {
                child.material.opacity = opacity;
            }
        });
    }

    _createSpore(isInitial = false) {
        this.state = STATE.SPORE;
        const group = new THREE.Group();
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshLambertMaterial({
            color: CONFIG.colors.spore, ...CONFIG.material,
            transparent: true, opacity: isInitial ? 1.0 : 0.0
        });
        group.add(new THREE.Mesh(geometry, material));
        return group;
    }

    _createWorm() {
        this.state = STATE.WORM;
        const group = new THREE.Group();
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-2, 0, 0), new THREE.Vector3(0, 0, 1.5),
            new THREE.Vector3(2, 0, 0), new THREE.Vector3(3, 0, -1.5),
        ]);
        const geometry = new THREE.TubeGeometry(curve, 10, 0.1, 5, false);
        const material = new THREE.MeshLambertMaterial({
            color: CONFIG.colors.worm, ...CONFIG.material,
            transparent: true, opacity: 0.0
        });
        group.add(new THREE.Mesh(geometry, material));
        return group;
    }

    _createAmoeba() {
        this.state = STATE.AMOEBA;
        const group = new THREE.Group();
        const material = new THREE.MeshLambertMaterial({
            color: CONFIG.colors.amoeba, ...CONFIG.material,
            transparent: true, opacity: 0.0
        });
        const sphereCount = 15;
        for (let i = 0; i < sphereCount; i++) {
            const radius = THREE.MathUtils.randFloat(0.2, 0.5);
            const geometry = new THREE.SphereGeometry(radius, 8, 8);
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(
                THREE.MathUtils.randFloatSpread(2.5),
                THREE.MathUtils.randFloatSpread(2.5),
                THREE.MathUtils.randFloatSpread(2.5)
            );
            group.add(sphere);
        }
        return group;
    }

    _createFruitingBody() {
        this.state = STATE.FRUITING_BODY;
        const group = new THREE.Group();
        const material = new THREE.MeshLambertMaterial({
            color: CONFIG.colors.fruitingBody, ...CONFIG.material,
            transparent: true, opacity: 0.0
        });
        const stalkHeight = 3.5;
        const stalkGeometry = new THREE.CylinderGeometry(0.15, 0.25, stalkHeight, 8);
        const stalk = new THREE.Mesh(stalkGeometry, material);
        stalk.position.y = stalkHeight / 2;
        const capGeometry = new THREE.SphereGeometry(1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8);
        const cap = new THREE.Mesh(capGeometry, material);
        cap.position.y = stalkHeight;
        group.add(stalk, cap);
        return group;
    }

    _destroy() {
        this.isAlive = false;
        this.isTransitioning = true;
        this.transitionClock.start();
        this.oldObject = this.object;
        this.object = null;
    }

    /**
     * 現在の状態に基づいてオブジェクトをアニメーションさせる
     * @param {number} elapsedTime - ライフサイクルタイマーの経過時間
     */
    _updateAnimation(elapsedTime) {
        if (!this.object) return;
        switch (this.state) {
            case STATE.SPORE:
                this.object.children[0].position.y = Math.abs(Math.sin(elapsedTime * 2)) * 0.2 + 0.2;
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

    /**
     * 状態遷移を処理する
     * @param {number} elapsedTime - ライフサイクルタイマーの経過時間
     * @returns {object[]} - 生成する新しい粘菌の設定情報の配列
     */
    _updateLifecycle(elapsedTime) {
        let offspringConfigs = [];
        if (this.isTransitioning) {
            const transitionElapsedTime = this.transitionClock.getElapsedTime();
            const progress = Math.min(transitionElapsedTime / CONFIG.fadeTime, 1.0);

            this._setOpacity(this.object, progress);
            this._setOpacity(this.oldObject, 1.0 - progress);

            if (progress >= 1.0) {
                this.isTransitioning = false;
                if (this.oldObject) {
                    this.scene.remove(this.oldObject);
                    this._disposeGroup(this.oldObject);
                }
                this.oldObject = null;
                if (!this.object) {
                    this.isAlive = false;
                }
            }
        } else if (elapsedTime > CONFIG.transitionTime) {
            if (this.state === STATE.FRUITING_BODY) {
                if (this.generation < CONFIG.maxGeneration) {
                    const nextGen = this.generation + 1;
                    const pos = this.object.position;
                    const angle1 = Math.random() * Math.PI * 2;
                    const dist1 = THREE.MathUtils.randFloat(1.5, 3.0);
                    const p1 = pos.clone().add(new THREE.Vector3(Math.cos(angle1) * dist1, 0, Math.sin(angle1) * dist1));
                    const angle2 = angle1 + Math.PI + THREE.MathUtils.randFloat(-0.5, 0.5);
                    const dist2 = THREE.MathUtils.randFloat(1.5, 3.0);
                    const p2 = pos.clone().add(new THREE.Vector3(Math.cos(angle2) * dist2, 0, Math.sin(angle2) * dist2));
                    offspringConfigs.push({ position: p1, generation: nextGen });
                    offspringConfigs.push({ position: p2, generation: nextGen });
                }
                this._destroy();
            } else {
                this.isTransitioning = true;
                this.transitionClock.start();
                this.clock.start();
                this.oldObject = this.object;
                const creators = {
                    [STATE.SPORE]: () => this._createWorm(),
                    [STATE.WORM]: () => this._createAmoeba(),
                    [STATE.AMOEBA]: () => this._createFruitingBody(),
                };
                this.object = creators[this.state]();
                this.object.position.copy(this.oldObject.position);
                this.scene.add(this.object);
            }
        }
        return offspringConfigs;
    }

    /**
     * フレームごとに呼び出されるメインの更新メソッド
     * @returns {object[]} - 生成する新しい粘菌の設定情報の配列
     */
    update() {
        if (!this.isAlive && !this.isTransitioning) return [];
        const elapsedTime = this.clock.getElapsedTime();
        this._updateAnimation(elapsedTime);
        return this._updateLifecycle(elapsedTime);
    }
}

/**
 * シミュレーション全体を管理するクラス
 */
class Simulation {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.scene = scene;
        this.slimeMolds = [];
    }

    /**
     * シミュレーションを初期化またはリセットする
     */
    init() {
        this.slimeMolds.forEach(mold => {
            mold._disposeGroup(mold.object);
            mold._disposeGroup(mold.oldObject);
            if(mold.object) this.scene.remove(mold.object);
            if(mold.oldObject) this.scene.remove(mold.oldObject);
        });
        this.slimeMolds = [];
        this.slimeMolds.push(new SlimeMold(this.scene, new THREE.Vector3(0, 0, 0), 0));
    }

    /**
     * シミュレーションの1フレーム分の更新処理
     */
    update() {
        let allOffspringConfigs = [];
        for (const mold of this.slimeMolds) {
            const offspring = mold.update();
            if (offspring.length > 0) {
                allOffspringConfigs.push(...offspring);
            }
        }

        if (allOffspringConfigs.length > 0) {
            const newMolds = allOffspringConfigs.map(config =>
                new SlimeMold(this.scene, config.position, config.generation)
            );
            this.slimeMolds.push(...newMolds);
        }

        this.slimeMolds = this.slimeMolds.filter(mold => mold.isAlive || mold.isTransitioning);
    }
}

// --- メイン処理 ---
const simulation = new Simulation(scene);
simulation.init();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    simulation.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
