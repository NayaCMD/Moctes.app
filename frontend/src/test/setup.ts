import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}

if (!globalThis.ResizeObserver) {
    Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        writable: true,
        value: ResizeObserverMock,
    });
}

if (!window.HTMLElement.prototype.setPointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
        configurable: true,
        writable: true,
        value: function setPointerCapture() { },
    });
}

if (!window.HTMLElement.prototype.releasePointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
        configurable: true,
        writable: true,
        value: function releasePointerCapture() { },
    });
}

if (!window.document.elementFromPoint) {
    Object.defineProperty(window.document, "elementFromPoint", {
        configurable: true,
        writable: true,
        value: () => null,
    });
}
