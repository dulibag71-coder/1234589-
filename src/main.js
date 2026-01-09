import * as THREE from 'three';
import { PoseEstimator } from './vision/PoseEstimator.js';
import { SwingAnalyzer, SWING_PHASE } from './vision/SwingAnalyzer.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { CourseManager } from './logic/CourseManager.js';
import { KinematicChain } from './physics/KinematicChain.js';
import { AICoach } from './logic/AICoach.js';
import { Storage } from './utils/Storage.js';
import { AudioManager } from './utils/AudioManager.js';
import { VisualEnhancer } from './utils/VisualEnhancer.js';
import { Minimap } from './ui/Minimap.js';

class GolfApp {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.videoElement = document.getElementById('input-video');

        // UI 매핑 (신규 레이아웃 대응)
        this.ui = {
            ready: document.getElementById('swing-status'),
            metrics: document.getElementById('bottom-metrics'),
            ballSpeed: document.getElementById('val-ballspeed'),
            launchAngle: document.getElementById('val-launchangle'),
            backSpin: document.getElementById('val-backspin'),
            totalIdx: document.getElementById('val-totaldist'), // ID matched
            total: document.getElementById('val-totaldist'),
            carry: document.getElementById('val-carry'),
            distToPin: document.getElementById('dist-to-pin'),
            report: document.getElementById('ai-report'),
            reportContent: document.getElementById('report-content')
        };

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });

        this.physics = null;
        this.course = null;
        this.biomech = null;
        this.coach = null;
        this.storage = null;
        this.audio = null;
        this.minimap = null;

        this.isBallFlying = false;
        this.isReady = false;
        this.readyTimer = 0;

        this.clock = new THREE.Clock();
        this.tracerPoints = [];
        this.tracerLine = null;

        this.cameraMode = 'ADDRESS';
        this.shotResult = { carry: 0, total: 0 };

        // 렌더링 우선 시작
        this.setupRenderer();
        this.setupScene();
        this.animate();

        this.init();
    }

    async init() {
        try {
            if (typeof Ammo === 'function') await Ammo();

            this.physics = new PhysicsWorld();
            await this.physics.init();

            this.storage = new Storage();
            await this.storage.init();

            this.course = new CourseManager();
            this.biomech = new KinematicChain();
            this.coach = new AICoach();
            this.audio = new AudioManager();
            this.minimap = new Minimap('minimap', 'map-ball', 'map-pin');

            try { this.setupVision(); } catch (e) { console.error(e); }

            this.setupCourseObjects();
            this.minimap.setCourse(this.course.getCurrentHole());
            this.updateMinimap();

            this.updateHoleView();
            this.setCameraAddress(); // 코스 로드 완료 후 공 위치 재정렬
            window.addEventListener('resize', () => this.onWindowResize());
            console.log("GolfApp Fully Initialized");
        } catch (criticalError) {
            console.error("Init Error:", criticalError);
        }
    }

    setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
    }

    setupScene() {
        this.scene.background = new THREE.Color(0x0a2e5c);
        try {
            VisualEnhancer.createSkybox(this.scene);
        } catch (e) {
            console.warn("Skybox creation failed", e);
        }

        // 고성능 조명 설정
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(150, 300, 150);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 4096;
        sun.shadow.mapSize.height = 4096;
        sun.shadow.camera.left = -500;
        sun.shadow.camera.right = 500;
        sun.shadow.camera.top = 500;
        sun.shadow.camera.bottom = -2000;
        sun.shadow.bias = -0.00005;
        sun.shadow.normalBias = 0.02;
        this.scene.add(sun);

        // 지형 바닥 (노멀 맵 효과 포함)
        const groundGeo = new THREE.PlaneGeometry(1000, 2000, 64, 128);
        this.groundMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9,
            metalness: 0.05
        });
        this.ground = new THREE.Mesh(groundGeo, this.groundMat);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.z = -1000;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // AAAA급 잔디밭 (초기 배정)
        this.grassField = VisualEnhancer.createGrassField(this.scene, { x: 0, z: 0 });

        // 필드 오브젝트 대기
        const ballGeo = new THREE.SphereGeometry(0.021, 32, 32);
        this.ballMesh = new THREE.Mesh(ballGeo, VisualEnhancer.getBallMaterial());
        this.ballMesh.castShadow = true;
        this.scene.add(this.ballMesh);

        // Weather effects
        VisualEnhancer.createWeatherEffect(this.scene);

        const tracerMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        const tracerGeo = new THREE.BufferGeometry();
        this.tracerLine = new THREE.Line(tracerGeo, tracerMat);
        this.scene.add(this.tracerLine);
    }

    updateHoleView() {
        if (!this.course) return;
        const currentHole = this.course.getCurrentHole();

        // 지형 텍스처 업데이트
        this.groundMat.map = VisualEnhancer.createCourseTexture(currentHole);
        this.groundMat.needsUpdate = true;

        // 기존 코스 오브젝트 제거 (나무, 핀, 물, 잔디)
        const toDelete = [];
        this.scene.traverse(child => {
            if (child._isCourseObject) toDelete.push(child);
        });
        toDelete.forEach(c => this.scene.remove(c));

        // 워터 오브젝트 생성 (셰이더 기반)
        for (const w of currentHole.water) {
            const water = VisualEnhancer.createWater(this.scene, w.width, w.length, w.x, w.z);
            water._isCourseObject = true;
        }

        // 잔디 필드 위치 업데이트 (홀 티박스 주변으로 이동)
        if (this.grassField) {
            this.scene.remove(this.grassField);
        }
        this.grassField = VisualEnhancer.createGrassField(this.scene, currentHole.teePosition);
        this.grassField._isCourseObject = true;

        this.minimap.setCourse(currentHole);
        this.updateMinimap();

        // ⚠️ Definitive Ball Sync: Create physics body immediately
        if (this.physics) {
            this.physics.createBall(currentHole.teePosition);
            this.ballMesh.position.set(currentHole.teePosition.x, currentHole.teePosition.y + 0.021, currentHole.teePosition.z);
        }

        if (this.audio) this.audio.playAmbient();

        // UI 정보 갱신
        if (document.getElementById('ui-hole-num')) document.getElementById('ui-hole-num').innerText = `HOLE ${currentHole.hole}`;
        if (document.getElementById('ui-hole-par')) document.getElementById('ui-hole-par').innerText = `PAR ${currentHole.par} | ${currentHole.distance}m`;
    }

    setupCourseObjects() {
        if (!this.course) return;
        const currentHole = this.course.getCurrentHole();

        this.setupPin();

        // 코스 주변 나무 심기 (레이아웃에 맞춰 배치)
        for (let i = 0; i < 150; i++) {
            const x = (Math.random() - 0.5) * 600;
            const z = -(Math.random() * 2000);

            // 페어웨이 한가운데는 비우고 러프 쪽에 집중
            if (this.course.checkTerrain({ x, z }) === 'ROUGH') {
                const tree = VisualEnhancer.createTree(x, z);
                tree._isCourseObject = true;
                tree.castShadow = true;
                this.scene.add(tree);
            }
        }
    }

    setupPin() {
        if (!this.course) return;
        const pinPos = this.course.getCurrentHole().pinPosition;
        const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 3, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pinPos.x, 1.5, pinPos.z);
        pole._isCourseObject = true;
        this.scene.add(pole);

        const flagGeo = new THREE.PlaneGeometry(0.6, 0.4);
        const flagMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(pinPos.x + 0.3, 3 - 0.2, pinPos.z);
        flag._isCourseObject = true;
        this.scene.add(flag);
    }

    setCameraAddress() {
        this.cameraMode = 'ADDRESS';
        this.camera.position.set(0, 1.5, 3);
        this.camera.lookAt(0, 0, -50);

        // 공을 티박스 위치로 이동
        if (this.course && this.ballMesh) {
            const teePos = this.course.getCurrentHole().teePosition;
            this.ballMesh.position.set(teePos.x, teePos.y + 0.021, teePos.z);
            this.ballMesh.quaternion.set(0, 0, 0, 1);
        }

        // 궤적 초기화
        if (this.tracerLine) {
            this.tracerLine.geometry.setFromPoints([]);
        }
    }

    setupVision() {
        this.analyzer = new SwingAnalyzer(
            (phase) => {
                if (phase === SWING_PHASE.DOWNSWING && this.isReady) this.audio.playSwing();
                if (phase === SWING_PHASE.ADDRESS && this.ui.metrics) this.ui.metrics.style.display = 'none';
            },
            (impact) => {
                if (this.isReady) this.handleImpact(impact);
            }
        );

        this.poseEstimator = new PoseEstimator(this.videoElement, (results) => {
            this.analyzer.analyze(results);
            this.checkReadyCondition(results);
        });
    }

    checkReadyCondition(results) {
        if (this.isBallFlying) {
            this.isReady = false;
            return;
        }

        // 어드레스 상태가 1초(약 30프레임) 유지되어야 READY
        if (this.analyzer.phase === SWING_PHASE.ADDRESS) {
            this.readyTimer += 1;
            if (this.readyTimer > 30) {
                if (!this.isReady) this.speak("Ready");
                this.isReady = true;
                if (this.ui.ready) {
                    this.ui.ready.innerText = 'READY';
                    this.ui.ready.className = 'status-badge status-ready';
                }
            }
        } else if (this.analyzer.phase === SWING_PHASE.BACKSWING || this.analyzer.phase === SWING_PHASE.DOWNSWING) {
            // Processing
        } else {
            this.isReady = false;
            this.readyTimer = 0;
            if (this.ui.ready) {
                this.ui.ready.innerText = 'TAKE STANCE';
                this.ui.ready.className = 'status-badge status-wait';
            }
        }

        const debugEl = document.getElementById('vision-debug');
        if (debugEl && this.poseEstimator) {
            debugEl.innerText = `VISION: ${this.poseEstimator.status.toUpperCase()} | ${this.analyzer.phase}`;
        }
    }

    handleImpact(impact) {
        if (this.isBallFlying) return;
        this.tracerPoints = [];
        this.audio.playImpact();
        this.speak("Excellent Shot!");

        VisualEnhancer.createImpactVFX(this.scene, this.ballMesh.position);
        this.shakeCamera();

        const speeds = this.biomech.extractSpeeds(this.analyzer.history);
        const ballSpeed = this.biomech.calculateBallSpeed(null, speeds);

        const params = this.biomech.calculateLaunchParams(ballSpeed, impact.attackAngle || 10);
        const { launchAngle, backSpin, sideSpin } = params;

        this.ui.ballSpeed.innerText = ballSpeed.toFixed(1);
        this.ui.launchAngle.innerText = launchAngle.toFixed(1);
        this.ui.backSpin.innerText = Math.round(backSpin);

        const angleRad = launchAngle * (Math.PI / 180);
        const launchVelocity = {
            x: impact.direction.x * 0.5 + (sideSpin / 1000),
            y: ballSpeed * Math.sin(angleRad),
            z: -ballSpeed * Math.cos(angleRad)
        };

        if (this.physics.ball) this.physics.world.removeRigidBody(this.physics.ball);

        const teePos = this.course.getCurrentHole().teePosition;
        this.physics.createBall(teePos);
        this.physics.applyImpulse(this.physics.ball, launchVelocity, { backSpin, sideSpin });

        this.isBallFlying = true;
        this.cameraMode = 'FOLLOW';

        const feedback = this.coach.analyzeSwing(this.analyzer.history, { ballSpeed });
        this.ui.reportContent.innerText = feedback;
        this.ui.report.style.display = 'block';
    }

    shakeCamera() {
        const originalPos = this.camera.position.clone();
        const startTime = Date.now();
        const shake = () => {
            if (Date.now() - startTime < 200) {
                this.camera.position.x += (Math.random() - 0.5) * 0.1;
                this.camera.position.y += (Math.random() - 0.5) * 0.1;
                requestAnimationFrame(shake);
            } else {
                this.camera.position.copy(originalPos);
            }
        };
        shake();
    }

    speak(text) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = this.clock.getDelta();

        if (this.physics && this.physics.ball) {
            this.physics.step(dt);
            const transform = this.physics.getBallTransform();

            if (transform) {
                this.ballMesh.position.copy(transform.position);
                this.ballMesh.quaternion.copy(transform.quaternion);

                const terrain = this.course.checkTerrain(transform.position);
                this.physics.updatePhysicsProperties(terrain);

                if (this.isBallFlying) {
                    this.tracerPoints.push(new THREE.Vector3().copy(transform.position));
                    VisualEnhancer.updateNeonTracer(this.tracerLine, this.tracerPoints);
                    VisualEnhancer.applyCinematicCamera(this.camera, transform.position, this.cameraMode);

                    const dist = this.course.getDistanceToPin(transform.position);
                    const teePos = this.course.getCurrentHole().teePosition;
                    const carryDist = Math.sqrt((transform.position.x - teePos.x) ** 2 + (transform.position.z - teePos.z) ** 2);

                    if (this.ui.carry) this.ui.carry.innerText = carryDist.toFixed(1);
                    if (this.ui.total) this.ui.total.innerText = (carryDist * 1.05).toFixed(1);
                    if (this.ui.distToPin) this.ui.distToPin.innerText = Math.round(dist);

                    const vel = this.physics.ball.getLinearVelocity();
                    if (terrain === 'WATER') {
                        this.isBallFlying = false;
                        this.speak("Water Hazard!");
                        setTimeout(() => this.setCameraAddress(), 2000);
                    } else if (transform.position.y < 0.1 && Math.abs(vel.y()) < 0.1 && Math.sqrt(vel.x() ** 2 + vel.z() ** 2) < 0.2) {
                        this.isBallFlying = false;
                        if (this.course.isHoledOut(transform.position, vel)) {
                            this.speak("Hole in one! Incredible!");
                        }
                        setTimeout(() => this.setCameraAddress(), 3000);
                    } else if (transform.position.y < 0.1 && Math.abs(vel.y()) > 0.5) {
                        this.audio.playGroundHit();
                    }
                }
            }
        }

        this.renderer.render(this.scene, this.camera);
        if (this.minimap) {
            this.minimap.update(this.ballMesh.position, this.course.getCurrentHole().pinPosition);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

window.addEventListener('load', () => new GolfApp());
