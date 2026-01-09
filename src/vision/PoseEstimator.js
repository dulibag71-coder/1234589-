import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

export class PoseEstimator {
    constructor(videoElement, onResults) {
        this.videoElement = videoElement;
        this.onResults = onResults;
        this.pose = new Pose({
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

        const camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.pose.send({ image: this.videoElement });
            },
            width: 640,
            height: 480
        });
        camera.start();
    }
}
