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
        // ballSpeed = (hipω * 0.25 + torsoω * 0.25 + shoulderω * 0.2 + armω * 0.15 + wristω * 0.15) * clubEfficiency * contactQuality

        const { hip, torso, shoulder, arm, wrist } = speeds;

        const weightedSpeed = (
            hip * 0.25 +
            torso * 0.25 +
            shoulder * 0.2 +
            arm * 0.15 +
            wrist * 0.15
        );

        return weightedSpeed * this.clubEfficiency * this.contactQuality;
    }

    /**
     * 랜드마크로부터 대략적인 각 부위의 속도/에너지를 추출합니다.
     */
    extractSpeeds(history) {
        // 실제 구현 시 프레임 간 랜드마크 각도 변화율 계산
        // 현재는 손목 속도를 기반으로 역산하거나 단순화된 모델 사용
        const last = history[history.length - 1];
        const prev = history[history.length - 2];
        const dt = (last.timestamp - prev.timestamp) / 1000;

        // 가상의 각속도 데이터 (실제 분석 로직으로 대체 필요)
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
}
