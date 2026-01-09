export class CourseManager {
    constructor() {
        this.holes = this.generate18Holes();
        this.currentHoleIndex = 0;
    }

    generate18Holes() {
        const holes = [];
        for (let i = 1; i <= 18; i++) {
            // 난이도 및 홀 특성에 따른 거리 조정
            const baseDistance = 150 + (i % 6) * 70 + Math.random() * 50;
            const par = baseDistance > 450 ? 5 : (baseDistance < 220 ? 3 : 4);

            // 홀 레이아웃 (페어웨이 포인트: 페어웨이의 중심축을 정의)
            const fairwayPoints = [
                { x: 0, z: 0 }, // 티잉 구역
                { x: (Math.random() - 0.5) * 40, z: -baseDistance * 0.4 }, // 중간 지점 1
                { x: (Math.random() - 0.5) * 60, z: -baseDistance * 0.7 }, // 중간 지점 2
                { x: (Math.random() - 0.5) * 20, z: -baseDistance } // 그린 위치 근처
            ];

            holes.push({
                hole: i,
                par: par,
                distance: Math.round(baseDistance),
                teePosition: { x: 0, y: 0, z: 0 },
                pinPosition: { x: fairwayPoints[3].x + (Math.random() - 0.5) * 10, y: 0, z: -(baseDistance + 10) },
                fairwayPoints: fairwayPoints,
                fairwayWidth: 35 + Math.random() * 10,
                greenRadius: 15,
                bunkers: this.generateBunkers(baseDistance, fairwayPoints),
                water: this.generateWater(baseDistance, fairwayPoints)
            });
        }
        return holes;
    }

    generateBunkers(dist, points) {
        const bunkers = [];
        // 페어웨이 주변 및 그린 주변 벙커 생성
        for (let i = 0; i < 3 + Math.random() * 3; i++) {
            const side = Math.random() > 0.5 ? 1 : -1;
            const z = -(50 + Math.random() * (dist - 100));
            bunkers.push({
                x: side * (20 + Math.random() * 20),
                z: z,
                radius: 5 + Math.random() * 8
            });
        }
        // 그린 주변 벙커
        bunkers.push({ x: points[3].x + 15, z: points[3].z - 5, radius: 10 });
        return bunkers;
    }

    generateWater(dist, points) {
        const water = [];
        if (Math.random() > 0.5) {
            water.push({
                x: (Math.random() - 0.5) * 100,
                z: -(dist * 0.5),
                width: 40 + Math.random() * 40,
                length: 30 + Math.random() * 30
            });
        }
        return water;
    }

    getCurrentHole() {
        return this.holes[this.currentHoleIndex];
    }

    nextHole() {
        if (this.currentHoleIndex < 17) {
            this.currentHoleIndex++;
            return true;
        }
        return false;
    }

    checkTerrain(position) {
        const hole = this.getCurrentHole();

        // 1. Water Hazard 체크
        for (const w of hole.water) {
            if (Math.abs(position.x - w.x) < w.width / 2 && Math.abs(position.z - w.z) < w.length / 2) return 'WATER';
        }

        // 2. Bunker 체크
        for (const bunker of hole.bunkers) {
            const dx = position.x - bunker.x;
            const dz = position.z - bunker.z;
            if (Math.sqrt(dx * dx + dz * dz) < bunker.radius) return 'BUNKER';
        }

        // 3. Green 체크
        const dPin = Math.sqrt(
            (position.x - hole.pinPosition.x) ** 2 +
            (position.z - hole.pinPosition.z) ** 2
        );
        if (dPin < hole.greenRadius) return 'GREEN';

        // 4. Fairway 체크 (페어웨이 포인트를 잇는 선분과의 거리 기반)
        let minPlayerDistToFairwayPath = Infinity;
        for (let i = 0; i < hole.fairwayPoints.length - 1; i++) {
            const p1 = hole.fairwayPoints[i];
            const p2 = hole.fairwayPoints[i + 1];
            const d = this.distToSegment(position.x, position.z, p1.x, p1.z, p2.x, p2.z);
            if (d < minPlayerDistToFairwayPath) minPlayerDistToFairwayPath = d;
        }

        if (minPlayerDistToFairwayPath < hole.fairwayWidth / 2) return 'FAIRWAY';

        return 'ROUGH';
    }

    distToSegment(px, pz, x1, z1, x2, z2) {
        const l2 = (x1 - x2) ** 2 + (z1 - z2) ** 2;
        if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (pz - z1) ** 2);
        let t = ((px - x1) * (x2 - x1) + (pz - z1) * (z2 - z1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (pz - (z1 + t * (z2 - z1))) ** 2);
    }

    isHoledOut(position, velocity) {
        const hole = this.getCurrentHole();
        const dPin = Math.sqrt(
            (position.x - hole.pinPosition.x) ** 2 +
            (position.z - hole.pinPosition.z) ** 2
        );
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);

        // 컵 반경 0.1m 이내 + 속도 0.5m/s 이하 시 홀컵 인
        return dPin < 0.108 && speed < 0.5;
    }
}
