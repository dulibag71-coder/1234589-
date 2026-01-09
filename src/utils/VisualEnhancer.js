import * as THREE from 'three';

export class VisualEnhancer {
    static createTerrainLibrary() {
        const textures = {};

        // Fairway: 줄무늬 패턴
        textures.fairway = this.generateTexture('#4a7c44', (ctx) => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            for (let i = 0; i < 512; i += 32) ctx.fillRect(i, 0, 16, 512);
        });

        // Rough: 더 어둡고 거친 질감
        textures.rough = this.generateTexture('#2d5a27', (ctx) => {
            for (let i = 0; i < 30000; i++) {
                ctx.fillStyle = `rgba(10, 40, 10, ${Math.random() * 0.4})`;
                ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
            }
        });

        // Green: 매우 매끄럽고 밝은 연두색
        textures.green = this.generateTexture('#5ebb47', (ctx) => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            for (let i = 0; i < 100; i++) ctx.fillRect(Math.random() * 512, Math.random() * 512, 10, 10);
        });

        // Sand: 베이지색과 모래 입자
        textures.sand = this.generateTexture('#d2b48c', (ctx) => {
            for (let i = 0; i < 20000; i++) {
                ctx.fillStyle = `rgba(139, 69, 19, ${Math.random() * 0.1})`;
                ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
            }
        });

        // Water: 딥 블루와 애니메이션을 고려한 노이즈
        textures.water = this.generateTexture('#1e3c72', (ctx) => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            for (let i = 0; i < 50; i++) {
                ctx.beginPath();
                ctx.ellipse(Math.random() * 512, Math.random() * 512, 20, 5, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        return textures;
    }

    static generateTexture(baseColor, noiseFn) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 512, 512);
        if (noiseFn) noiseFn(ctx);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    static createCourseTexture(hole, width = 1024, height = 2048) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // 기본은 러프
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, width, height);

        // 좌표 변환 (World Z -500 ~ 500 -> Canvas Y 0 ~ height)
        const worldToCanvas = (x, z) => ({
            x: (x + 500) * (width / 1000),
            y: (z + 1000) * (height / 2000)
        });

        const invWorldToCanvas = (x, z) => ({
            x: (x / (width / 1000)) - 500,
            y: (z / (height / 2000)) - 1000
        });

        // 1. Water
        ctx.fillStyle = '#1e3c72';
        for (const w of hole.water) {
            const p = this.worldToTex(w.x, w.z, width, height);
            ctx.fillRect(p.x - w.width * 0.5, p.y - w.length * 0.5, w.width, w.length);
        }

        // 2. Fairway (Line based)
        ctx.strokeStyle = '#4a7c44';
        ctx.lineWidth = hole.fairwayWidth * (width / 200); // 대략적인 마스킹 굵기
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < hole.fairwayPoints.length; i++) {
            const p = this.worldToTex(hole.fairwayPoints[i].x, hole.fairwayPoints[i].z, width, height);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // 3. Green
        ctx.fillStyle = '#5ebb47';
        const gp = this.worldToTex(hole.pinPosition.x, hole.pinPosition.z, width, height);
        ctx.beginPath();
        ctx.arc(gp.x, gp.y, hole.greenRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        // 4. Bunkers
        ctx.fillStyle = '#d2b48c';
        for (const b of hole.bunkers) {
            const p = this.worldToTex(b.x, b.z, width, height);
            ctx.beginPath();
            ctx.arc(p.x, p.y, b.radius * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    static worldToTex(x, z, w, h) {
        // World: X(-500~500), Z(0 ~ -2000)
        // Tex: X(0~w), Y(h~0)
        return {
            x: (x + 500) * (w / 1000),
            y: h - (Math.abs(z) * (h / 2000))
        };
    }

    static createSkybox(scene) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, '#001a33'); // Darker top
        grad.addColorStop(0.5, '#1e3c72');
        grad.addColorStop(1, '#a1c4fd'); // Lighter horizon
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1, 512);

        const tex = new THREE.CanvasTexture(canvas);
        scene.background = tex;
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
