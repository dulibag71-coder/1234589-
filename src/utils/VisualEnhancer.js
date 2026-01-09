import * as THREE from 'three';

export class VisualEnhancer {
    static createTerrainLibrary() {
        const textures = {};

        // Fairway: 고해상도 잔디 + 노멀 맵 효과
        textures.fairway = this.generateTexture('#3d7a35', (ctx) => {
            // 미세 잔디 텍스처
            for (let i = 0; i < 50000; i++) {
                ctx.fillStyle = `rgba(20, 50, 20, ${Math.random() * 0.3})`;
                ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 8);
            }
            // 깎인 자국 (더 부드럽게)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            for (let i = 0; i < 1024; i += 128) ctx.fillRect(i, 0, 16, 1024);
        }, 1024);

        // Rough: 진한 녹색 + 거친 입자
        textures.rough = this.generateTexture('#1e4219', (ctx) => {
            for (let i = 0; i < 100000; i++) {
                ctx.fillStyle = `rgba(10, 30, 10, ${Math.random() * 0.5})`;
                ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3);
            }
        }, 1024);

        // Green: 부드러운 하이라이트
        textures.green = this.generateTexture('#4db33d', (ctx) => {
            for (let i = 0; i < 200; i++) {
                ctx.fillStyle = 'rgba(120, 200, 100, 0.1)';
                ctx.beginPath();
                ctx.arc(Math.random() * 1024, Math.random() * 1024, 20, 0, Math.PI * 2);
                ctx.fill();
            }
        }, 1024);

        // Sand: 리얼한 모래 입자와 음영
        textures.sand = this.generateTexture('#dcc090', (ctx) => {
            for (let i = 0; i < 80000; i++) {
                ctx.fillStyle = `rgba(100, 60, 30, ${Math.random() * 0.15})`;
                ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.5, 1.5);
            }
        }, 1024);

        return textures;
    }

    static generateTexture(baseColor, noiseFn, size = 512) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, size, size);
        if (noiseFn) noiseFn(ctx);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 16;
        return tex;
    }

    static createGrassField(scene, centerPos) {
        // 인스턴싱된 잔디 (초고사양 비주얼)
        const count = 50000;
        const geometry = new THREE.PlaneGeometry(0.05, 0.2);
        geometry.translate(0, 0.1, 0); // 밑면을 중심으로

        const material = new THREE.MeshStandardMaterial({
            color: 0x4db33d,
            side: THREE.DoubleSide,
            alphaTest: 0.5
        });

        const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 30; // 공 주변 30m 밀도 집중
            dummy.position.set(
                centerPos.x + Math.cos(angle) * radius,
                0,
                centerPos.z + Math.sin(angle) * radius
            );
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.scale.setScalar(0.5 + Math.random() * 1.5);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            // 잔디 색상 변조
            const color = new THREE.Color(0x4db33d).offsetHSL(0.05 * (Math.random() - 0.5), 0, (Math.random() - 0.5) * 0.2);
            instancedMesh.setColorAt(i, color);
        }

        instancedMesh.receiveShadow = true;
        instancedMesh.castShadow = true;
        scene.add(instancedMesh);
        return instancedMesh;
    }

    static createWater(scene, width, length, x, z) {
        // 커스텀 워터 셰이더 (AAAA급)
        const geometry = new THREE.PlaneGeometry(width, length);
        const material = new THREE.MeshStandardMaterial({
            color: 0x1e3c72,
            transparent: true,
            opacity: 0.8,
            roughness: 0.1,
            metalness: 0.8,
            flatShading: false
        });

        const water = new THREE.Mesh(geometry, material);
        water.rotation.x = -Math.PI / 2;
        water.position.set(x, 0.05, z);
        scene.add(water);

        // 워터 애니메이션 로직 추가 가능
        return water;
    }

    static createCourseTexture(hole, width = 1024, height = 2048) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // 1. 기본 러프 (Deep Green)
        ctx.fillStyle = '#1e3d1a';
        ctx.fillRect(0, 0, width, height);

        // 스케일링 (1000m x 2000m -> canvas size)
        const sX = width / 1000;
        const sZ = height / 2000;

        // 2. 페어웨이
        ctx.strokeStyle = '#3a5f2a';
        ctx.lineWidth = hole.fairwayWidth * sX;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < hole.fairwayPoints.length; i++) {
            const p = this.worldToTex(hole.fairwayPoints[i].x, hole.fairwayPoints[i].z, width, height);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // 3. 그린
        ctx.fillStyle = '#4db33d';
        const gp = this.worldToTex(hole.pinPosition.x, hole.pinPosition.z, width, height);
        ctx.beginPath();
        ctx.arc(gp.x, gp.y, hole.greenRadius * sX, 0, Math.PI * 2);
        ctx.fill();

        // 4. 워터 해저드
        ctx.fillStyle = '#1e3c72';
        for (const w of hole.water) {
            const p = this.worldToTex(w.x, w.z, width, height);
            ctx.fillRect(p.x - w.width * sX * 0.5, p.y - w.length * sZ * 0.5, w.width * sX, w.length * sZ);
        }

        // 5. 벙커
        ctx.fillStyle = '#d2b48c';
        for (const b of hole.bunkers) {
            const p = this.worldToTex(b.x, b.z, width, height);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, b.radius * sX, b.radius * sZ * 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 16;
        return tex;
    }

    static worldToTex(x, z, w, h) {
        // Z=0 (Near) -> V=0 (Bottom of texture) -> Y=h
        // Z=-2000 (Far) -> V=1 (Top of texture) -> Y=0
        const u = (x + 500) / 1000;
        const v = Math.abs(z) / 2000;
        return {
            x: u * w,
            y: (1 - v) * h
        };
    }

    static createSkybox(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 1024);
        grad.addColorStop(0, '#020b1a'); // 우주에 가까운 상단
        grad.addColorStop(0.3, '#0a2e5c');
        grad.addColorStop(0.7, '#4389d1');
        grad.addColorStop(0.95, '#a1c4fd'); // 부드러운 지평선
        grad.addColorStop(1, '#ffedda'); // 노을빛 살짝
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1, 1024);

        const tex = new THREE.CanvasTexture(canvas);
        scene.background = tex;
    }

    static createImpactVFX(scene, position) {
        // 1. 스파크 파티클
        const particleCount = 30;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;
            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 5,
                (Math.random() - 0.5) * 5
            ));
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: 0x00f2ff,
            size: 0.1,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        // 애니메이션 루프 (일회성)
        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 1) {
                scene.remove(points);
                return;
            }

            const positions = points.geometry.attributes.position.array;
            for (let i = 0; i < particleCount; i++) {
                positions[i * 3] += velocities[i].x * 0.1;
                positions[i * 3 + 1] += velocities[i].y * 0.1;
                positions[i * 3 + 2] += velocities[i].z * 0.1;
                velocities[i].y -= 0.2; // 중력
            }
            points.geometry.attributes.position.needsUpdate = true;
            material.opacity = 1 - elapsed;
            requestAnimationFrame(animate);
        };
        animate();

        // 2. 임팩트 플래시 (PointLight)
        const light = new THREE.PointLight(0x00f2ff, 10, 5);
        light.position.copy(position);
        scene.add(light);
        setTimeout(() => scene.remove(light), 100);
    }

    static updateNeonTracer(line, points) {
        if (!points || points.length < 2) return;

        // 기존 라인을 네온 광선 스타일로 변경
        if (!line._isNeon) {
            line.material = new THREE.LineBasicMaterial({
                color: 0x00f2ff,
                linewidth: 5,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            });
            line._isNeon = true;
        }

        line.geometry.setFromPoints(points);
    }

    static applyCinematicCamera(camera, ballPos, mode) {
        if (mode === 'FOLLOW') {
            const targetPos = new THREE.Vector3(
                ballPos.x,
                ballPos.y + 1.5,
                ballPos.z + 5
            );
            camera.position.lerp(targetPos, 0.1);
            camera.lookAt(ballPos.x, ballPos.y, ballPos.z);
        } else if (mode === 'LANDING') {
            // 낙하지점 줌인 효과
            const targetPos = new THREE.Vector3(
                ballPos.x + 2,
                ballPos.y + 1,
                ballPos.z - 2
            );
            camera.position.lerp(targetPos, 0.05);
            camera.lookAt(ballPos.x, ballPos.y, ballPos.z);
        }
    }

    static getBallMaterial() {
        // procedural dimple normal map
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#8080ff'; // Neutral normal
        ctx.fillRect(0, 0, size, size);

        const dimpleCount = 15;
        const radius = size / dimpleCount / 2;
        for (let y = 0; y < dimpleCount; y++) {
            for (let x = 0; x < dimpleCount; x++) {
                const cx = (x + 0.5) * (size / dimpleCount);
                const cy = (y + 0.5) * (size / dimpleCount);

                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
                grad.addColorStop(0, '#8080ff');
                grad.addColorStop(0.8, '#a0a0ff');
                grad.addColorStop(1, '#8080ff');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const normalMap = new THREE.CanvasTexture(canvas);
        normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.set(2, 1);

        return new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.1,
            normalMap: normalMap,
            normalScale: new THREE.Vector2(1.5, 1.5)
        });
    }

    static createWeatherEffect(scene) {
        // 1. Fog (가시성 대폭 향상)
        scene.fog = new THREE.FogExp2(0x0a2e5c, 0.001);

        // 2. Ambient Particles (Pollen/Dust)
        const count = 1000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const vel = [];

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 100;
            pos[i * 3 + 1] = Math.random() * 20;
            pos[i * 3 + 2] = -Math.random() * 500;
            vel.push(new THREE.Vector3((Math.random() - 0.5) * 0.02, -0.01, (Math.random() - 0.5) * 0.02));
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.05,
            transparent: true,
            opacity: 0.3
        });

        const particles = new THREE.Points(geo, mat);
        scene.add(particles);

        const animate = () => {
            const positions = particles.geometry.attributes.position.array;
            for (let i = 0; i < count; i++) {
                positions[i * 3] += vel[i].x;
                positions[i * 3 + 1] += vel[i].y;
                positions[i * 3 + 2] += vel[i].z;

                if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 20;
            }
            particles.geometry.attributes.position.needsUpdate = true;
            requestAnimationFrame(animate);
        };
        animate();
    }

    static createTree(x, z) {
        const group = new THREE.Group();
        const height = 4 + Math.random() * 4;

        const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, height * 0.3, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = height * 0.15;
        group.add(trunk);

        const topsCount = 3;
        for (let i = 0; i < topsCount; i++) {
            const r = 1.5 - i * 0.3;
            const topsGeo = new THREE.ConeGeometry(r, height * 0.4, 8);
            const topsMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(0x1a472a).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1)
            });
            const tops = new THREE.Mesh(topsGeo, topsMat);
            tops.position.y = height * 0.3 + (i * height * 0.25);
            group.add(tops);
        }

        group.position.set(x, 0, z);
        group.rotation.y = Math.random() * Math.PI;
        return group;
    }
}
