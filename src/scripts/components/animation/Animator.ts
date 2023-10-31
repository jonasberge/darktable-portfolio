type EasingFunc = (x: number) => number
type ProgressCallback = (progress: number, linearProgress: number) => void
type Callback = () => void

export class Animator {
  animationDurationMillis: number
  easingFunc: EasingFunc
  onRedraw: Callback
  onAnimationFrame: ProgressCallback
  onFinished: Callback
  isAnimating: boolean = false
  startTime: number = null

  constructor(options: {
    animationDurationMillis: number,
    easingFunc: EasingFunc,
    onRedraw?: Callback,
    onAnimationFrame: ProgressCallback,
    onFinished?: Callback
  }) {
    this.animationDurationMillis = options.animationDurationMillis
    this.easingFunc = options.easingFunc || null
    // TODO: call this on window resize
    this.onRedraw = options.onRedraw || null
    this.onAnimationFrame = options.onAnimationFrame
    this.onFinished = options.onFinished || null
  }

  start() {
    if (!this.isAnimating) {
      if (this.onRedraw) {
        this.onRedraw();
      }
      window.requestAnimationFrame(this._render.bind(this));
      this.isAnimating = true;
    }
  }

  _render(time: number) {
    this.startTime = this.startTime || time
    var delta = time - this.startTime;
    var linearProgress = delta / this.animationDurationMillis;
    linearProgress = Math.max(0, Math.min(1, linearProgress));
    var progress = linearProgress;
    if (this.easingFunc !== null) {
      progress = this.easingFunc(linearProgress);
    }
    this.onAnimationFrame(progress, linearProgress);
    if (linearProgress < 1) {
      window.requestAnimationFrame(this._render.bind(this));
    }
    else {
      this.isAnimating = false;
      if (this.onFinished) {
        this.onFinished();
      }
    }
  }
}
