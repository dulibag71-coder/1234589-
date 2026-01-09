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

        const rawWrist = results.poseWorldLandmarks[16]; // 오른손잡이 기준 오른손목(16) 또는 왼손목(15). 여기서는 혼합 고려 가능
        const wrist = this.wristFilter.filter(rawWrist);

        const timestamp = performance.now();
        const data = { wrist, timestamp };

        this.history.push(data);
        if (this.history.length > this.maxHistory) this.history.shift();

        this.detectPhase();
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

        // 페이즈 감지 로직 (간략화된 버전)
        switch (this.phase) {
            case SWING_PHASE.WAITING:
                if (speed < 0.1) {
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
                if (speed > 5.0 && speed < this.lastVelocity) {
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
