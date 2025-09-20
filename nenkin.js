import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * 粘菌のライフサイクルの一連の流れを管理するクラス
 */
class SlimeMoldCycle {
  constructor(scene, basePos = new THREE.Vector3(), color = 0xffe066) {
    this.scene = scene;
    this.basePos = basePos.clone();
    this.color = color;
    this.phase = 0;
    this.phaseTime = 0;
    this.WORM_SEGMENTS = 18;
    this.wormHeadPos = this.basePos.clone().add(new THREE.Vector3(0, 1.5, 0));
    this.wormPath = [this.wormHeadPos.clone()];
    this.wormSpheres = [];
    this.spores = [];
    this.mushroomCap = null;
    this.mushroomStem = null;
    this.myceliumLines = [];
    this._initObjects();
  }

  _initObjects() {
    const sphereGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      emissive: this.color,
      emissiveIntensity: 0.5,
    });
    this.amoeba = new THREE.Mesh(sphereGeo, sphereMat);
    this.amoeba.position.copy(this.wormHeadPos);
    this.scene.add(this.amoeba);

    const wormGeo = new THREE.SphereGeometry(0.6, 16, 16);
    for (let i = 0; i < this.WORM_SEGMENTS; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: this.color,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
        emissive: this.color,
        emissiveIntensity: 0.5,
      });
      const mesh = new THREE.Mesh(wormGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.wormSpheres.push(mesh);
    }
  }

  dispose() {
    this.scene.remove(this.amoeba);
    this.amoeba.geometry.dispose();
    this.amoeba.material.dispose();
    this.wormSpheres.forEach(s => {
      this.scene.remove(s);
      s.geometry.dispose();
      s.material.dispose();
    });
    if (this.mushroomCap) {
      this.scene.remove(this.mushroomCap);
      this.mushroomCap.geometry.dispose();
      this.mushroomCap.material.dispose();
    }
    if (this.mushroomStem) {
      this.scene.remove(this.mushroomStem);
      this.mushroomStem.geometry.dispose();
      this.mushroomStem.material.dispose();
    }
    this.spores.forEach(sp => {
      this.scene.remove(sp.mesh);
      sp.mesh.geometry.dispose();
      sp.mesh.material.dispose();
    });
  }

  _animatePhase0_WormAndMushroom(t) {
    let gatherTime = 12.0, morphStart = 18.0, morphEnd = 24.0, growthEndTime = morphEnd + 8.0;

    if (this.phaseTime <= morphEnd) {
      const r = 3.5 + Math.sin(t * 0.7 + this.basePos.x) * 1.2 + Math.sin(t * 0.3 + this.basePos.z) * 0.7;
      this.wormHeadPos.x = this.basePos.x + Math.cos(t * 0.6 + Math.sin(t * 0.2 + this.basePos.y)) * r;
      this.wormHeadPos.z = this.basePos.z + Math.sin(t * 0.6 + Math.cos(t * 0.3 + this.basePos.x)) * r;
      this.wormHeadPos.y = this.basePos.y + 1.5 + Math.sin(t * 1.2 + this.basePos.z) * 0.5 + Math.sin(t * 0.5 + this.basePos.x) * 0.2;
      this.wormPath.unshift(this.wormHeadPos.clone());
      if (this.wormPath.length > this.WORM_SEGMENTS * 3) this.wormPath.pop();

      let gather = (this.phaseTime > gatherTime) ? Math.min(1, (this.phaseTime - gatherTime) / (morphStart - gatherTime)) : 0;
      const amoebaCenter = this.basePos.clone().add(new THREE.Vector3(0, 1.5, 0));

      this.wormSpheres.forEach((sphere, i) => {
        const idx = Math.min(i * 3, this.wormPath.length - 1);
        let pos = this.wormPath[idx].clone().lerp(amoebaCenter, gather);
        sphere.position.copy(pos);
        let scale = 1.1 - (i / this.WORM_SEGMENTS) * 0.7 + Math.sin(t * 2 + i) * 0.05;
        sphere.scale.setScalar(scale * (1 - gather) + 1.5 * gather);
        const h = 0.13 + Math.sin(t * 0.5 + i * 0.1 + this.basePos.x) * 0.03;
        sphere.material.color.setHSL(h, 0.95, 0.65);
        sphere.material.opacity = 0.85 * (1 - gather * 0.5);
        sphere.material.emissive.set(sphere.material.color);
        sphere.visible = true;
      });

      this.amoeba.visible = gather === 1;
      if (gather === 1) this.amoeba.position.copy(amoebaCenter);

      let morph = (this.phaseTime > morphStart) ? Math.min(1, (this.phaseTime - morphStart) / (morphEnd - morphStart)) : 0;
      if (morph > 0) this._animateMorphToMushroom(morph, amoebaCenter);
    }

    if (this.phaseTime > morphEnd && this.phaseTime <= growthEndTime) {
      if (this.wormSpheres.length > 0 && this.wormSpheres[0].visible) {
        this.wormSpheres.forEach(s => s.visible = false);
        this.amoeba.visible = false;
      }
      const grow = (this.phaseTime - morphEnd) / (growthEndTime - morphEnd);
      this.mushroomStem.scale.y = grow;
      this.mushroomCap.scale.set(grow, grow * 0.6, grow);
      const stemTopY = this.mushroomStem.position.y + (3 / 2) * grow;
      this.mushroomCap.position.y = stemTopY;
    }

    if (this.phaseTime > growthEndTime) {
      this.phase = 2; this.phaseTime = 0;
      this.spores = [];
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(angle), 0.5 + Math.random() * 0.5, Math.sin(angle)).normalize();
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffcc }));
        mesh.position.copy(this.mushroomCap.position);
        this.scene.add(mesh);
        this.spores.push({ mesh, pos: this.mushroomCap.position.clone(), dir, t: 0 });
      }
    }
  }

  _animateMorphToMushroom(morph, amoebaCenter) {
    const stemHeight = 3;
    const stemRadius = 0.35;
    let stemTarget = this.wormHeadPos.clone().add(new THREE.Vector3(0, (stemHeight / 2) - 1.5, 0));
    let capTarget = stemTarget.clone().add(new THREE.Vector3(0, stemHeight / 2, 0));
    let capRadius = 1.7;

    this.wormSpheres.forEach((sphere, i) => {
      let pos = amoebaCenter.clone();
      if (i < this.WORM_SEGMENTS * 0.5) {
        const tStem = i / (this.WORM_SEGMENTS * 0.5 - 1);
        let stemPos = stemTarget.clone();
        stemPos.y += (tStem - 0.5) * stemHeight;
        pos.lerp(stemPos, morph);
        const stemScale = stemRadius * (0.7 + 0.6 * (1 - Math.abs(tStem - 0.5) * 2));
        sphere.scale.setScalar(1.5 * (1 - morph) + stemScale * morph);
        sphere.material.color.lerp(new THREE.Color(0xffffff), morph * 0.7);
      } else {
        const tCap = (i - this.WORM_SEGMENTS * 0.5) / (this.WORM_SEGMENTS * 0.5 - 1);
        const theta = Math.PI * 0.15 + Math.PI * 0.7 * tCap;
        const phi = Math.PI * 2 * tCap;
        let capPos = capTarget.clone();
        capPos.x += Math.cos(phi) * Math.sin(theta) * capRadius;
        capPos.y += Math.cos(theta) * capRadius * 0.5;
        capPos.z += Math.sin(phi) * Math.sin(theta) * capRadius;
        pos.lerp(capPos, morph);
        const capScale = capRadius * 0.5 * (0.7 + 0.6 * Math.sin(theta));
        const scale = 1.5 * (1 - morph) + capScale * morph;
        sphere.scale.set(scale, scale * 0.7, scale);
        sphere.material.color.lerp(new THREE.Color(0xdd2222), morph * 0.7);
      }
      sphere.position.copy(pos);
      sphere.material.opacity = 0.85 * (1 - morph * 0.7);
      sphere.material.emissive.set(sphere.material.color);
    });
    this.amoeba.visible = morph < 0.7;
    this.amoeba.material.opacity = 0.85 * (1 - morph);

    if (!this.mushroomCap && !this.mushroomStem) {
      const stemGeo = new THREE.CylinderGeometry(stemRadius, stemRadius * 1.2, stemHeight, 16);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, transparent: true, opacity: 0 });
      this.mushroomStem = new THREE.Mesh(stemGeo, stemMat);
      this.mushroomStem.position.copy(stemTarget);
      this.scene.add(this.mushroomStem);
      const capGeo = new THREE.SphereGeometry(capRadius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.5, transparent: true, opacity: 0 });
      this.mushroomCap = new THREE.Mesh(capGeo, capMat);
      this.mushroomCap.position.copy(capTarget);
      this.scene.add(this.mushroomCap);
    }
    this.mushroomStem.visible = true; this.mushroomCap.visible = true;
    this.mushroomStem.material.opacity = morph; this.mushroomCap.material.opacity = morph;
    this.mushroomStem.scale.y = morph; this.mushroomCap.scale.set(morph, morph * 0.6, morph);
  }

  _animatePhase2_SporeRelease(dt) {
    let allGone = true;
    this.spores.forEach(s => {
      s.t += dt;
      s.pos.addScaledVector(s.dir, 0.08);
      s.pos.y -= s.t * 0.04;
      s.mesh.position.copy(s.pos);
      if (s.pos.y > 0.2) allGone = false;
    });
    if (allGone && this.phaseTime > 8) {
      this.phase = 3; this.phaseTime = 0;
      this.spores.slice(1).forEach(s => {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
      });
      this.spores = [this.spores[0]];
      this.myceliumLines = [];
      const dirCount = 8;
      for (let i = 0; i < dirCount; i++) {
        const angle = (i / dirCount) * Math.PI * 2;
        this.myceliumLines.push({ dir: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)), len: 0, mesh: null });
      }
    }
  }

  _animatePhase3_MyceliumGrowth() {
    let grow = Math.min(1, this.phaseTime / 3.0);
    const originPos = this.basePos.clone();
    this.myceliumLines.forEach(line => {
      if (!line.mesh) {
        const geo = new THREE.CylinderGeometry(0.1, 0.1, 1, 6);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffcc });
        line.mesh = new THREE.Mesh(geo, mat);
        this.scene.add(line.mesh);
      }
      line.len = grow * 15.0;
      const mid = originPos.clone().add(line.dir.clone().multiplyScalar(line.len / 2));
      line.mesh.position.copy(mid).setY(0.1);
      line.mesh.scale.set(1, line.len, 1);

      const quaternion = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      quaternion.setFromUnitVectors(up, line.dir.clone().normalize());
      line.mesh.quaternion.copy(quaternion);

      line.mesh.visible = true;
    });
    if (grow >= 1 && this.phaseTime > 3.5) {
      this.phase = 5; // Transition to new gathering phase
      this.phaseTime = 0;
    }
  }

  _animatePhase5_MyceliumGather() {
    let gatherProgress = Math.min(1, this.phaseTime / 2.0); // 2 seconds to gather

    // Make amoeba appear and grow
    if (!this.amoeba) {
      const sphereGeo = new THREE.SphereGeometry(1.5, 32, 32);
      const sphereMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.8, metalness: 0.1, transparent: true, opacity: 0, emissive: this.color, emissiveIntensity: 0.5 });
      this.amoeba = new THREE.Mesh(sphereGeo, sphereMat);
      this.amoeba.position.copy(this.basePos).setY(1.5);
      this.scene.add(this.amoeba);
    }
    this.amoeba.visible = true;
    this.amoeba.material.opacity = gatherProgress;
    this.amoeba.scale.setScalar(gatherProgress * 1.5);

    // Shrink mycelium
    this.myceliumLines.forEach(line => {
      if (line.mesh) {
        const currentLen = (1 - gatherProgress) * 15.0;
        line.mesh.scale.set(1, currentLen, 1);
        const mid = this.basePos.clone().add(line.dir.clone().multiplyScalar(currentLen / 2));
        line.mesh.position.copy(mid).setY(0.1);
      }
    });

    if (gatherProgress >= 1) {
      this.phase = 0; this.phaseTime = 0;
      this.myceliumLines.forEach(line => {
        if (line.mesh) {
          this.scene.remove(line.mesh);
          line.mesh.geometry.dispose();
          line.mesh.material.dispose();
        }
      });
      this.myceliumLines = [];
      this.wormHeadPos.copy(this.amoeba.position);
      this.wormPath = Array(this.WORM_SEGMENTS * 3).fill(this.wormHeadPos.clone());
      this.wormSpheres.forEach(s => s.visible = true);
      this.spores.forEach(s => {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
      });
      this.spores = [];
    }
  }


  animate(t, dt) {
    this.phaseTime += dt;
    switch (this.phase) {
      case 0: this._animatePhase0_WormAndMushroom(t); break;
      case 2: this._animatePhase2_SporeRelease(dt); break;
      case 3: this._animatePhase3_MyceliumGrowth(); break;
      case 5: this._animatePhase5_MyceliumGather(); break;
    }
  }
}

/**
 * Three.jsのシーンやレンダリング、全体のシミュレーションを管理するクラス
 */
class Simulation {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1024 / 568, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.cycles = [];
    this.cycleStartOffsets = [];
    this._setup();
  }

  _setup() {
    this._setupScene();
    this._setupLights();
    this._setupGround();
    this._setupInstances();
    this._setupEventListeners();
  }

  _setupScene() {
    this.scene.background = new THREE.Color(0x228b22);
    this.camera.position.set(0, 5, 18);
    this.camera.lookAt(0, 2, 0);
    const renderDiv = document.createElement("div");
    renderDiv.style.width = "1024px";
    renderDiv.style.height = "568px";
    renderDiv.style.margin = "0 auto";
    renderDiv.style.position = "relative";
    document.body.appendChild(renderDiv);
    this.renderer.setSize(1024, 568);
    renderDiv.appendChild(this.renderer.domElement);
  }

  _setupLights() {
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(10, 20, 10);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x8888aa, 0.7));
  }

  _setupGround() {
    const grid = new THREE.GridHelper(40, 40, 0x888888, 0x444444);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  _setupInstances() {
    const center = new THREE.Vector3(0, 0, 0);
    const radius = 3.5;
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.2;
      const r = radius + Math.random() * 1.2 - 0.6;
      const pos = new THREE.Vector3(center.x + Math.cos(angle) * r, 0, center.z + Math.sin(angle) * r);
      const h = 0.13 + Math.random() * 0.04;
      const s = 0.93 + Math.random() * 0.07;
      const l = 0.6 + Math.random() * 0.08;
      const color = new THREE.Color().setHSL(h, s, l);
      this.cycles.push(new SlimeMoldCycle(this.scene, pos, color.getHex()));
      this.cycleStartOffsets.push(Math.random() * 6);
    }
  }

  _setupEventListeners() {
    window.addEventListener("resize", () => this.onWindowResize());
  }

  start() {
    this.animate();
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    const t = performance.now() * 0.001;
    const dt = 0.016; // Assuming 60fps
    this.cycles.forEach((cycle, i) => {
      cycle.animate(t - this.cycleStartOffsets[i], dt);
    });
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.renderer.setSize(1024, 568);
    this.camera.aspect = 1024 / 568;
    this.camera.updateProjectionMatrix();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const simulation = new Simulation();
  simulation.start();
});
