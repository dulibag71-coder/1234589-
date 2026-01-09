export class PhysicsWorld {
    constructor() {
        this.world = null;
        this.ball = null;
        this.balls = [];
        this.gravity = -9.81;
        this.airDensity = 1.225; // kg/m^3
        this.wind = null;
    }

    async init() {
        if (typeof Ammo === 'undefined') {
            console.error('Ammo is not loaded. Ensure ammo.js is included.');
            return;
        }

        const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
        const overlappingPairCache = new Ammo.btDbvtBroadphase();
        const solver = new Ammo.btSequentialImpulseConstraintSolver();

        this.world = new Ammo.btDiscreteDynamicsWorld(
            dispatcher, overlappingPairCache, solver, collisionConfiguration
        );
        this.world.setGravity(new Ammo.btVector3(0, this.gravity, 0));
        this.wind = new Ammo.btVector3(0, 0, 0);

        this.createGround();
    }

    createGround() {
        const groundShape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(0, 1, 0), 0);
        const groundTransform = new Ammo.btTransform();
        groundTransform.setIdentity();

        const motionState = new Ammo.btDefaultMotionState(groundTransform);
        const localInertia = new Ammo.btVector3(0, 0, 0);
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(0, motionState, groundShape, localInertia);
        const groundBody = new Ammo.btRigidBody(rbInfo);

        groundBody.setRestitution(0.3);
        groundBody.setFriction(0.5);
        this.world.addRigidBody(groundBody);
    }

    createBall(position) {
        const radius = 0.021;
        const mass = 0.045; // kg
        const shape = new Ammo.btSphereShape(radius);
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(position.x, position.y + radius, position.z));

        const localInertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(mass, localInertia);

        const motionState = new Ammo.btDefaultMotionState(transform);
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const body = new Ammo.btRigidBody(rbInfo);

        body.setRestitution(0.6);
        body.setFriction(0.3);
        body.setRollingFriction(0.1);

        this.world.addRigidBody(body);
        this.ball = body;
        return body;
    }

    applyImpulse(body, force, spin = { backSpin: 0, sideSpin: 0 }) {
        const impulse = new Ammo.btVector3(force.x, force.y, force.z);
        body.applyCentralImpulse(impulse);

        // 스핀 적용 (각속도 부여)
        // 백스핀은 X축 회전, 사이드스핀은 Y축 회전
        const angularImpulse = new Ammo.btVector3(
            spin.backSpin / 10,  // 계수 조정 필요
            spin.sideSpin / 10,
            0
        );
        body.applyTorqueImpulse(angularImpulse);
    }

    updatePhysicsProperties(terrainType) {
        if (!this.ball) return;

        const props = {
            'FAIRWAY': { restitution: 0.5, friction: 0.5, rollingFriction: 0.1 },
            'ROUGH': { restitution: 0.2, friction: 0.9, rollingFriction: 0.5 },
            'BUNKER': { restitution: 0.05, friction: 1.5, rollingFriction: 2.0 },
            'GREEN': { restitution: 0.6, friction: 0.3, rollingFriction: 0.05 }
        };

        const config = props[terrainType] || props['FAIRWAY'];
        this.ball.setRestitution(config.restitution);
        this.ball.setFriction(config.friction);
        this.ball.setRollingFriction(config.rollingFriction);
    }

    step(dt) {
        if (!this.world) return;
        if (this.ball) this.applyAerodynamics(this.ball);
        this.world.stepSimulation(dt, 10);
    }

    applyAerodynamics(body) {
        const velocity = body.getLinearVelocity();
        const v = Math.sqrt(velocity.x() ** 2 + velocity.y() ** 2 + velocity.z() ** 2);
        if (v < 0.1) return;

        // 항력 (Drag Force)
        const Cd = 0.45;
        const area = Math.PI * (0.021 ** 2);
        const dragMagnitude = 0.5 * Cd * this.airDensity * area * (v ** 2);

        const dragForce = new Ammo.btVector3(
            -velocity.x() / v * dragMagnitude,
            -velocity.y() / v * dragMagnitude,
            -velocity.z() / v * dragMagnitude
        );
        body.applyCentralForce(dragForce);

        // 정교화된 마그누스 효과 (Lift Force based on Spin)
        // 공의 회전 속도(Spin)를 물리 바디의 각속도로부터 추출하거나 별도 저장 가능
        const angularVelocity = body.getAngularVelocity();
        const spinRads = angularVelocity.x(); // 백스핀 (X축 회전)

        // Cl보정: 스핀이 높을수록 리프트가 강해짐
        const Cl = 0.15 + (Math.abs(spinRads) / 1000) * 0.1;
        const liftMagnitude = 0.5 * Cl * this.airDensity * area * (v ** 2);

        // 리프트 방향: 속도 벡터와 스핀 벡터의 외적 방향 (단순화하여 위쪽 방향)
        const liftForce = new Ammo.btVector3(0, liftMagnitude, 0);
        body.applyCentralForce(liftForce);

        body.applyCentralForce(this.wind);
    }

    getBallTransform() {
        if (!this.ball) return null;
        const transform = new Ammo.btTransform();
        this.ball.getMotionState().getWorldTransform(transform);
        const origin = transform.getOrigin();
        const rotation = transform.getRotation();
        return {
            position: { x: origin.x(), y: origin.y(), z: origin.z() },
            quaternion: { x: rotation.x(), y: rotation.y(), z: rotation.z(), w: rotation.w() }
        };
    }
}
