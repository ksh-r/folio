import { gsap } from 'gsap';

export default class Cursor {
    constructor(element) {
        this.cursorElement = element;

        this.innerPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.outerPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.cursorPos = { x: this.innerPos.x, y: this.innerPos.y };
        this.cursorSpeed = { inner: 1, outer: 0.2};

        this.innerSetX = gsap.quickSetter(this.cursorElement.inner, "x", "px");
        this.innerSetY = gsap.quickSetter(this.cursorElement.inner, "y", "px");
        this.outerSetX = gsap.quickSetter(this.cursorElement.outer, "x", "px");
        this.outerSetY = gsap.quickSetter(this.cursorElement.outer, "y", "px");

        window.addEventListener('mousemove', this.updateCursorPostion.bind(this));
        gsap.ticker.add(this.moveCursor.bind(this));
    }
    updateCursorPostion(e) {
        this.cursorPos.x = e.clientX;
        this.cursorPos.y = e.clientY;
    }
    moveCursor() {
        // adjust speed for higher refresh monitors
        const deltaRatio = gsap.ticker.deltaRatio();
        const dtInner = 1.0 - Math.pow(1.0 - this.cursorSpeed.inner, deltaRatio);
        const dtOuter = 1.0 - Math.pow(1.0 - this.cursorSpeed.outer, deltaRatio);

        this.innerPos.x += (this.cursorPos.x - this.innerPos.x) * dtInner;
        this.innerPos.y += (this.cursorPos.y - this.innerPos.y) * dtInner;
        this.outerPos.x += (this.cursorPos.x - this.outerPos.x) * dtOuter;
        this.outerPos.y += (this.cursorPos.y - this.outerPos.y) * dtOuter;
        this.innerSetX(this.innerPos.x);
        this.innerSetY(this.innerPos.y);
        this.outerSetX(this.outerPos.x);
        this.outerSetY(this.outerPos.y);
    }
}