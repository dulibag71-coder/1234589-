import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';

export class PostProcessingManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.composer = new EffectComposer(renderer);

        this.init();
    }

    init() {
        // 1. 기본 렌더 패스
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // 2. SSAO (앰비언트 오클루전 - 그림자 깊이감)
        const ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
        ssaoPass.kernelRadius = 16;
        ssaoPass.minDistance = 0.005;
        ssaoPass.maxDistance = 0.1;
        this.composer.addPass(ssaoPass);

        // 3. Bloom (빛 번짐 - 하이라이트 강조)
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.4, // 강도
            0.4, // 반경
            0.85 // 임계점
        );
        this.composer.addPass(bloomPass);

        // 4. 감마 보정
        const gammaPass = new ShaderPass(GammaCorrectionShader);
        this.composer.addPass(gammaPass);
    }

    render() {
        this.composer.render();
    }

    setSize(width, height) {
        this.composer.setSize(width, height);
    }
}
