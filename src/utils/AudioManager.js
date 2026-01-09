export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
    }

    // 간단한 신시사이저 소리 생성 (실제 파일 대신 데모용)
    async createSyntheticSound(type) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        if (type === 'IMPACT') {
            osc.className = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);

            // 모바일 진동 피드백
            if (navigator.vibrate) navigator.vibrate(50);
        } else if (type === 'SWISH') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'GROUND') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        }
    }

    playAmbient() {
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const lfoGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        lfo.frequency.setValueAtTime(0.5, this.ctx.currentTime);
        lfoGain.gain.setValueAtTime(50, this.ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
        lfo.start();
        osc.start();
        // Background wind simulation
    }

    playImpact() { this.createSyntheticSound('IMPACT'); }
    playSwing() { this.createSyntheticSound('SWISH'); }
    playGroundHit() { this.createSyntheticSound('GROUND'); }
}
