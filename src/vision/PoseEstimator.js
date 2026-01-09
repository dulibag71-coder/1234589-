// CDN을 통한 전역 객체 사용 (Vite 번들링 이슈 해결)
export class PoseEstimator {
    constructor(videoElement, onResults) {
        this.videoElement = videoElement;
        this.onResults = onResults;

        // global Pose 객체 확인 (다양한 네임스페이스 시도)
        const PoseObj = window.Pose ||
            (window.mpPose ? window.mpPose.Pose : null) ||
            (typeof Pose !== 'undefined' ? Pose : null);

        this.status = "Initializing...";
        console.log("MediaPipe Pose Search:", {
            windowPose: !!window.Pose,
            mpPose: !!window.mpPose,
            globalPose: typeof Pose !== 'undefined',
            found: !!PoseObj
        });

        if (!PoseObj) {
            this.status = "Pose Library NOT Found";
            console.error(this.status);
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
            this.status = results.poseLandmarks ? "Tracking Active" : "No Person Detected";
            if (this.onResults) {
                this.onResults(results);
            }
        });

        const CameraObj = window.Camera ||
            (window.mpCamera ? window.mpCamera.Camera : null) ||
            (typeof Camera !== 'undefined' ? Camera : null);

        if (!CameraObj) {
            this.status = "Camera Library NOT Found";
            console.error(this.status);
            return;
        }

        this.status = "Camera Loading...";

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
