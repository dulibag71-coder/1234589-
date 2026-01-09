export class EMAFilter {
    constructor(alpha = 0.5) {
        this.alpha = alpha;
        this.prevValue = null;
    }

    filter(value) {
        if (this.prevValue === null) {
            this.prevValue = value;
            return value;
        }
        const filtered = this.alpha * value + (1 - this.alpha) * this.prevValue;
        this.prevValue = filtered;
        return filtered;
    }

    reset() {
        this.prevValue = null;
    }
}

export class Vec3Filter {
    constructor(alpha = 0.5) {
        this.xFilter = new EMAFilter(alpha);
        this.yFilter = new EMAFilter(alpha);
        this.zFilter = new EMAFilter(alpha);
    }

    filter(vec) {
        return {
            x: this.xFilter.filter(vec.x),
            y: this.yFilter.filter(vec.y),
            z: this.zFilter.filter(vec.z)
        };
    }

    reset() {
        this.xFilter.reset();
        this.yFilter.reset();
        this.zFilter.reset();
    }
}
