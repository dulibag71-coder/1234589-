export class KinematicChain {
    constructor() {
        this.clubEfficiency = 1.45; // 드라이버 기준 스매시 팩터
        this.contactQuality = 1.0;
    }

    /**
     * @param {Object} landmarks MediaPipe 포즈 랜드마크
     * @param {Object} speeds 각 부위별 회전 각속도 추정치
     */
    calculateBallSpeed(landmarks, speeds) {
        // 생체 역학 기반 속도 산출 공식
        const { hip, torso, shoulder, arm, wrist } = speeds;

        const weightedSpeed = (
            hip * 0.25 +
            torso * 0.25 +
            shoulder * 0.2 +
            arm * 0.15 +
            wrist * 0.15
        );

        // 게임적 재미와 실제 비거리를 위해 증폭 계수 적용 (m/s 단위)
        // 보통 드라이버 볼스피드는 60~75m/s 수준임을 고려
        const boostFactor = 2.2;
        let ballSpeed = weightedSpeed * this.clubEfficiency * this.contactQuality * boostFactor;

        // 최소 발사 속도 보장 (성공적인 휘두름 시 최소한의 비행 보장)
        if (ballSpeed < 15) ballSpeed = 15 + Math.random() * 5;

        return ballSpeed;
    }

    /**
     * 랜드마크로부터 대략적인 각 부위의 속도/에너지를 추출합니다.
     */
    extractSpeeds(history) {
        if (history.length < 2) return { hip: 0, torso: 0, shoulder: 0, arm: 0, wrist: 0 };
        const last = history[history.length - 1];
        const prev = history[history.length - 2];
        const dt = (last.timestamp - prev.timestamp) / 1000;
        if (dt <= 0) return { hip: 0, torso: 0, shoulder: 0, arm: 0, wrist: 0 };

        const wristSpeed = Math.sqrt(
            ((last.wrist.x - prev.wrist.x) / dt) ** 2 +
            ((last.wrist.y - prev.wrist.y) / dt) ** 2 +
            ((last.wrist.z - prev.wrist.z) / dt) ** 2
        );

        return {
            hip: wristSpeed * 0.4,
            torso: wristSpeed * 0.5,
            shoulder: wristSpeed * 0.7,
            arm: wristSpeed * 0.9,
            wrist: wristSpeed
        };
    }

    /**
     * @param {number} ballSpeed 임팩트 시 계산된 볼 스피드 (m/s)
     * @param {number} attackAngle 임팩트 시 스윙 궤적 각도 (도)
     */
    calculateLaunchParams(ballSpeed, attackAngle) {
        // 드라이버 기준 표준 모델 (로프트 10.5도 기준 상상력 포함)
        const staticLoft = 10.5;

        // 실제 발사각 = 정적 로프트 + (공격각 * 보정계수)
        const launchAngle = staticLoft + (attackAngle * 0.5);

        // 백스핀 = (로프트 - 공격각) * 속도비례상수
        // 올려칠수록(AttackAngle +) 백스핀은 감소함
        const spinFactor = 250;
        const backSpin = Math.max(1500, (staticLoft - attackAngle) * spinFactor);

        return {
            launchAngle: Math.max(8, Math.min(25, launchAngle)),
            backSpin: backSpin,
            sideSpin: (Math.random() - 0.5) * 500 // 단순화된 사이드 스핀
        };
    }
}
