// CDN을 통한 전역 객체 사용 (Vite 번들링 이슈 해결)
export class PoseEstimator {
    constructor(videoElement, onResults) {
        this.videoElement = videoElement;
        this.onResults = onResults;

        // global Pose 객체 확인 (game.html에서 CDN으로 로드됨)
        const PoseObj = window.Pose || (typeof Pose !== 'undefined' ? Pose : null);

        if (!PoseObj) {
            console.error("MediaPipe Pose library not loaded properly.");
            return;
        }

        this.pose = new PoseObj({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });

        this.init();
    }

    init() {
        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.pose.onResults((results) => {
            if (this.onResults) {
                this.onResults(results);
            }
        });

        const CameraObj = window.Camera || (typeof Camera !== 'undefined' ? Camera : null);

        if (!CameraObj) {
            console.error("MediaPipe Camera library not loaded properly.");
            return;
        }

        const camera = new CameraObj(this.videoElement, {
            onFrame: async () => {
                await this.pose.send({ image: this.videoElement });
            },
            width: 640,
            height: 480
        });
        camera.start();
    }
}
