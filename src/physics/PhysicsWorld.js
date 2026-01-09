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

    applyImpulse(body, force) {
        const impulse = new Ammo.btVector3(force.x, force.y, force.z);
        body.applyCentralImpulse(impulse);
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

        // 항력
        const Cd = 0.45;
        const area = Math.PI * (0.021 ** 2);
        const dragMagnitude = 0.5 * Cd * this.airDensity * area * (v ** 2);

        const dragForce = new Ammo.btVector3(
            -velocity.x() / v * dragMagnitude,
            -velocity.y() / v * dragMagnitude,
            -velocity.z() / v * dragMagnitude
        );
        body.applyCentralForce(dragForce);

        // 정교화된 마그누스 효과
        const Cl = 0.15;
        const liftMagnitude = 0.5 * Cl * this.airDensity * area * (v ** 2);
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
