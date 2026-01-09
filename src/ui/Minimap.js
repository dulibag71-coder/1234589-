export class Minimap {
    constructor(containerId, ballIconId, pinIconId) {
        this.container = document.getElementById(containerId);
        this.ballIcon = document.getElementById(ballIconId);
        this.pinIcon = document.getElementById(pinIconId);
        this.distText = document.getElementById('dist-to-pin');

        // 배경 캔버스 생성
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.container.offsetWidth;
        this.canvas.height = this.container.offsetHeight;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.zIndex = '1';
        this.container.insertBefore(this.canvas, this.container.firstChild);
        this.ctx = this.canvas.getContext('2d');

        this.mapScale = 0.5;
        this.mapHeight = this.canvas.height;
        this.mapWidth = this.canvas.width;
    }

    drawLayout(hole) {
        const ctx = this.ctx;
        const w = this.mapWidth;
        const h = this.mapHeight;

        // 배경 (러프)
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, w, h);

        const worldToMap = (x, z) => ({
            x: (w / 2) + (x * this.mapScale),
            y: (h - 50) + (z * this.mapScale)
        });

        // 1. Water
        ctx.fillStyle = '#1e3c72';
        for (const wat of hole.water) {
            const p = worldToMap(wat.x, wat.z);
            ctx.fillRect(p.x - wat.width * this.mapScale * 0.5, p.y - wat.length * this.mapScale * 0.5, wat.width * this.mapScale, wat.length * this.mapScale);
        }

        // 2. Fairway
        ctx.strokeStyle = '#4a7c44';
        ctx.lineWidth = hole.fairwayWidth * this.mapScale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < hole.fairwayPoints.length; i++) {
            const p = worldToMap(hole.fairwayPoints[i].x, hole.fairwayPoints[i].z);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // 3. Green
        ctx.fillStyle = '#5ebb47';
        const gp = worldToMap(hole.pinPosition.x, hole.pinPosition.z);
        ctx.beginPath();
        ctx.arc(gp.x, gp.y, hole.greenRadius * this.mapScale, 0, Math.PI * 2);
        ctx.fill();

        // 4. Bunkers
        ctx.fillStyle = '#d2b48c';
        for (const b of hole.bunkers) {
            const p = worldToMap(b.x, b.z);
            ctx.beginPath();
            ctx.arc(p.x, p.y, b.radius * this.mapScale, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    update(ballPos, pinPos) {
        // 골프존 스타일 미니맵: 아래가 플레이어, 위가 핀
        // 맵의 중심을 (0, 0, 0) 티박스로 가정

        // 핀 위치 표시
        const pX = (this.mapWidth / 2) + (pinPos.x * this.mapScale);
        const pZ = (this.mapHeight - 50) + (pinPos.z * this.mapScale); // 위로 갈수록 Z가 마이너스

        this.pinIcon.style.left = `${pX - 5}px`;
        this.pinIcon.style.top = `${pZ - 5}px`;

        // 공 위치 표시
        const bX = (this.mapWidth / 2) + (ballPos.x * this.mapScale);
        const bZ = (this.mapHeight - 50) + (ballPos.z * this.mapScale);

        this.ballIcon.style.left = `${bX - 4}px`;
        this.ballIcon.style.top = `${bZ - 4}px`;

        // 남은 거리 계산
        const dist = Math.sqrt((ballPos.x - pinPos.x) ** 2 + (ballPos.z - pinPos.z) ** 2);
        this.distText.innerText = dist.toFixed(0);
    }

    setCourse(holeData) {
        this.mapScale = (this.mapHeight - 100) / Math.abs(holeData.pinPosition.z);
        this.drawLayout(holeData);
    }
}
