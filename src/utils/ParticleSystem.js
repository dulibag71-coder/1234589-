import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    createImpactEffect(position, terrainType) {
        const count = 30;
        const color = terrainType === 'BUNKER' ? 0xedc9af : 0x27ae60;
        const size = terrainType === 'BUNKER' ? 0.02 : 0.04;

        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ color: color });

        for (let i = 0; i < count; i++) {
            const part = new THREE.Mesh(geometry, material);
            part.position.copy(position);

            // 랜덤 속도
            part.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 8,
                (Math.random() - 0.5) * 5
            );
            part.userData.life = 1.0; // 생명주기

            this.scene.add(part);
            this.particles.push(part);
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.add(p.userData.velocity.clone().multiplyScalar(dt));
            p.userData.velocity.y -= 9.8 * dt; // 중력
            p.userData.life -= dt * 0.8;
            p.scale.setScalar(p.userData.life);

            if (p.userData.life <= 0) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            }
        }
    }
}
