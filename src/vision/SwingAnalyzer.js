import { Vec3Filter } from '../utils/Filters.js';

export const SWING_PHASE = {
    WAITING: 'WAITING',
    ADDRESS: 'ADDRESS',
    BACKSWING: 'BACKSWING',
    DOWNSWING: 'DOWNSWING',
    IMPACT: 'IMPACT',
    FOLLOW_THROUGH: 'FOLLOW_THROUGH'
};

export class SwingAnalyzer {
    constructor(onPhaseChange, onImpact) {
        this.onPhaseChange = onPhaseChange;
        this.onImpact = onImpact;

        this.phase = SWING_PHASE.WAITING;
        this.wristFilter = new Vec3Filter(0.6);

        this.history = [];
        this.maxHistory = 60; // 약 1~2초 분량의 데이터 저장

        this.lastVelocity = 0;
        this.isReady = false;
    }

    analyze(results) {
        if (!results.poseWorldLandmarks) return;

        // 양손목의 중간 지점을 추적하여 더 정확한 클럽 위치 추정
        const leftWrist = results.poseWorldLandmarks[15];
        const rightWrist = results.poseWorldLandmarks[16];
        const shoulders = [results.poseWorldLandmarks[11], results.poseWorldLandmarks[12]];

        const avgWrist = {
            x: (leftWrist.x + rightWrist.x) / 2,
            y: (leftWrist.y + rightWrist.y) / 2,
            z: (leftWrist.z + rightWrist.z) / 2,
            visibility: Math.min(leftWrist.visibility, rightWrist.visibility)
        };

        const wrist = this.wristFilter.filter(avgWrist);
        const timestamp = performance.now();

        // 어드레스 자세 여부 판단
        const isStance = this.checkAddressStance(leftWrist, rightWrist, shoulders);

        const data = { wrist, timestamp, isStance };

        this.history.push(data);
        if (this.history.length > this.maxHistory) this.history.shift();

        this.detectPhase();
    }

    checkAddressStance(left, right, shoulders) {
        // 1. 양손이 모여 있는가? (기준 완화: 0.2m -> 0.35m)
        const handDist = Math.sqrt((left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2);
        const handsTogether = handDist < 0.35;

        // 2. 양손이 어깨선 수준 이하인가? (어깨보다 약간 위여도 허용)
        const avgShoulderY = (shoulders[0].y + shoulders[1].y) / 2;
        const handsLow = left.y < (avgShoulderY + 0.2) && right.y < (avgShoulderY + 0.2);

        // 3. 양손이 몸의 중심축 근처에 있는가? (기준 완화: 0.3m -> 0.5m)
        const avgShoulderX = (shoulders[0].x + shoulders[1].x) / 2;
        const handsCentered = Math.abs((left.x + right.x) / 2 - avgShoulderX) < 0.5;

        // 4. 가시성 체크 (기준 완화: 0.5 -> 0.3)
        const visible = left.visibility > 0.3 && right.visibility > 0.3;

        return handsTogether && handsLow && handsCentered && visible;
    }

    detectPhase() {
        if (this.history.length < 5) return;

        const current = this.history[this.history.length - 1];
        const prev = this.history[this.history.length - 2];

        const dt = (current.timestamp - prev.timestamp) / 1000;
        if (dt <= 0) return;

        const velocity = {
            x: (current.wrist.x - prev.wrist.x) / dt,
            y: (current.wrist.y - prev.wrist.y) / dt,
            z: (current.wrist.z - prev.wrist.z) / dt
        };
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);

        // 페이즈 감지 로직
        switch (this.phase) {
            case SWING_PHASE.WAITING:
                // 속도가 낮고 + 골프 어드레스 자세가 감지되어야 함 (속도 기준 상향: 0.15 -> 0.25)
                if (speed < 0.25 && current.isStance) {
                    this.setPhase(SWING_PHASE.ADDRESS);
                }
                break;
            case SWING_PHASE.ADDRESS:
                if (velocity.y > 0.3) { // 손목이 위로 올라가면 백스윙 시작
                    this.setPhase(SWING_PHASE.BACKSWING);
                }
                break;
            case SWING_PHASE.BACKSWING:
                if (velocity.y < -0.5) { // 손목이 아래로 빠르게 내려오면 다운스윙 시작
                    this.setPhase(SWING_PHASE.DOWNSWING);
                }
                break;
            case SWING_PHASE.DOWNSWING:
                // 임팩트 감지: 속도가 정점을 찍고 급격히 줄어들거나, 궤적의 최하점 통과 시
                // 실내 웹캠 환경 고려하여 기준 완화 (5.0 -> 3.5)
                if (speed > 3.5 && speed < this.lastVelocity) {
                    this.handleImpact(speed, velocity);
                    this.setPhase(SWING_PHASE.IMPACT);
                }
                break;
            case SWING_PHASE.IMPACT:
                if (speed < 2.0) {
                    this.setPhase(SWING_PHASE.FOLLOW_THROUGH);
                }
                break;
            case SWING_PHASE.FOLLOW_THROUGH:
                if (speed < 0.2) {
                    this.setPhase(SWING_PHASE.WAITING);
                    this.wristFilter.reset();
                }
                break;
        }

        this.lastVelocity = speed;
    }

    setPhase(newPhase) {
        if (this.phase !== newPhase) {
            this.phase = newPhase;
            if (this.onPhaseChange) this.onPhaseChange(newPhase);
        }
    }

    handleImpact(speed, velocity) {
        // 실제 임팩트 물리량 산출 (생체역학 모델은 추후 보강)
        if (this.onImpact) {
            this.onImpact({
                speed: speed * 1.5, // 클럽 헤드 속도 추정치 보정
                direction: velocity,
                timestamp: performance.now()
            });
        }
    }
}
