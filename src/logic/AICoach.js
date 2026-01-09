export class AICoach {
    constructor() {
        this.analysis = {
            tempo: 0,
            path: 'NEUTRAL',
            errors: []
        };
    }

    analyzeSwing(history, impactData) {
        this.analysis.errors = [];

        const backswingStart = history.findIndex(h => h.phase === 'BACKSWING');
        const downswingStart = history.findIndex(h => h.phase === 'DOWNSWING');
        const impact = history.findIndex(h => h.phase === 'IMPACT');

        if (backswingStart !== -1 && downswingStart !== -1 && impact !== -1) {
            const bt = (history[downswingStart].timestamp - history[backswingStart].timestamp);
            const dt = (history[impact].timestamp - history[downswingStart].timestamp);
            this.analysis.tempo = (bt / dt).toFixed(2);
        }

        if (downswingStart !== -1 && impact !== -1) {
            let xDev = 0;
            for (let i = downswingStart; i < impact; i++) {
                xDev += history[i].wrist.x;
            }
            if (xDev > 0.8) this.analysis.path = 'OUT-SIDE IN (Slice)';
            else if (xDev < -0.8) this.analysis.path = 'IN-SIDE OUT (Hook)';
            else this.analysis.path = 'STRAIGHT';
        }

        return this.getFeedback();
    }

    getFeedback() {
        let message = `[분석 리포트]\n`;
        message += `- 스윙 궤적: ${this.analysis.path}\n`;
        message += `- 스윙 템포 비율: ${this.analysis.tempo || '분석 중'}\n`;

        if (this.analysis.tempo > 3.5) {
            message += "⚠️ 백스윙이 너무 느립니다. 조금 더 간결하게 가져가세요.\n";
        } else if (this.analysis.tempo < 2.3) {
            message += "⚠️ 급격한 스윙입니다. 백스윙에서 여유를 가지세요.\n";
        }

        if (this.analysis.path.includes('OUT-SIDE IN')) {
            message += "💡 슬라이스가 발생하기 쉽습니다. 팔꿈치를 몸 안쪽으로 넣어보세요.";
        } else if (this.analysis.path.includes('IN-SIDE OUT')) {
            message += "💡 훅이 발생할 수 있습니다. 피니시까지 몸의 회전을 유지하세요.";
        } else {
            message += "✅ 완벽한 스윙 궤적입니다!";
        }

        return message;
    }
}
