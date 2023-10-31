import { Animator } from "../components/animation/Animator";
import { easeInOutCirc, easeOutCirc, easeOutCubic, easeOutQuart } from "./util/easings";


export default { init, onLeft, onCenter, onRight, showLeft, showRight, setLiveText }

var noop = function () {};

var callbacks = {
  left: { cb: noop },
  center: { cb: noop },
  right: { cb: noop },
};

var config = {
  clickHoldDelayMillis: 250,
  clickHoldSpeedMillis: 100
};

var navigation: HTMLElement = document.querySelector('#navigation');
// var liveTextElement: HTMLElement = document.querySelector('.live-title-content')

export function init() {

  var menuLinks = document.querySelectorAll('a.button');
  menuLinks.forEach(function (element: HTMLElement) {
    element.addEventListener('mousedown', function (e) {
      if (e.buttons !== 1)
        return;
      this.classList.add('mouse-down');
    });
    element.addEventListener('mouseup', function (e) {
      this.classList.remove('mouse-down');
    });
    element.addEventListener('click', function (e) {
      this.classList.remove('mouse-down');
    });
  });

  function registerButton(element: HTMLElement, callbackObject: { cb: () => void }) {
    /*var clickHoldTimeout = null;
    var clickHoldInterval = null;
    var clearTimeouts = function () {
      clearTimeout(clickHoldTimeout);
      clearInterval(clickHoldInterval);
      clickHoldTimeout = null;
      clickHoldInterval = null;
    };*/
    element.addEventListener('click', function (e) {
      e.preventDefault();
      // clearTimeouts();
      if (element.classList.contains('invisible'))
        return;
      if (e.buttons !== 1)
        return;
      callbackObject.cb();
    });
    element.addEventListener('mousedown', function (e) {
      e.preventDefault();
      if (element.classList.contains('invisible'))
        return;
      if (e.buttons !== 1) {
        return;
      }
      callbackObject.cb();
      /*clearTimeouts();
      clickHoldTimeout = setTimeout(function () {
        callbackObject.cb();
        clickHoldInterval = setInterval(function () {
          callbackObject.cb();
        }, config.clickHoldSpeedMillis);
      }, config.clickHoldDelayMillis);*/
    });
    element.addEventListener('keydown', function (e: KeyboardEvent) {
      //clearTimeouts();
      if (element.classList.contains('invisible'))
        return;
      if (e.key === 'Enter') {
        callbackObject.cb();
        this.blur();
      }
    });
    /*element.addEventListener('mouseup', function (e) {
      clearTimeouts();
    });
    window.addEventListener('resize', function (e) {
      clearTimeouts();
    });*/
  }

  var buttons = [
    [navigation.querySelector('.action-left'), callbacks.left],
    [navigation.querySelector('.action-center'), callbacks.center],
    [navigation.querySelector('.action-right'), callbacks.right]
  ]
  buttons.forEach((args: [HTMLElement, { cb: () => void }]) => {
    var [element, callbackObject] = args;
    registerButton(element, callbackObject);
  });
}

export function onLeft(cb: () => void) { callbacks.left.cb = cb; }
export function onCenter(cb: () => void) { callbacks.center.cb = cb; }
export function onRight(cb: () => void) { callbacks.right.cb = cb; }

var currentLiveText = "";
var nextLiveArgs = null;
var isAnimating = false;

export function setLiveText(
    text: string,
    animateDown: boolean = true,
    onAnimationFrame: (progress: number) => void = (() => {}),
    onAnimationDone: () => void = (() => {})
) {
  if (currentLiveText === text) {
    return;
  }
  if (isAnimating) {
    nextLiveArgs = [text, animateDown, onAnimationFrame, onAnimationDone];
    return;
  }
  currentLiveText = text;
  var menuElement = document.querySelector('.menu.center');
  var animationHeight = menuElement.clientHeight * 1.5;
  var firstLiveTextElement: HTMLElement = document.querySelector('.live-title-content');
  var secondLiveTextElement = firstLiveTextElement.cloneNode(true) as HTMLElement;
  firstLiveTextElement.classList.add('animating');
  secondLiveTextElement.classList.add('animating');
  if (animateDown) {
    firstLiveTextElement.before(secondLiveTextElement);
    secondLiveTextElement.style.marginTop = -animationHeight + 'px';
    secondLiveTextElement.innerText = text;
  }
  else {
    firstLiveTextElement.after(secondLiveTextElement);
    secondLiveTextElement.style.marginTop = animationHeight + 'px';
    firstLiveTextElement.innerText = text;
  }

  var animation = new Animator({
    animationDurationMillis: 500,
    easingFunc: easeOutQuart,
    onAnimationFrame: function (progress) {
      if (!animateDown) {
        progress = 1 - progress;
      }
      secondLiveTextElement.style.marginTop = ((1 - progress) * -animationHeight) + 'px';
      firstLiveTextElement.style.marginTop = (progress * animationHeight) + 'px';
      onAnimationFrame(progress);
    },
    onFinished: function () {
      firstLiveTextElement.style.marginTop = null;
      secondLiveTextElement.style.marginTop = null;
      firstLiveTextElement.classList.remove('animating');
      secondLiveTextElement.classList.remove('animating');
      var elementToRemove = animateDown ? firstLiveTextElement : secondLiveTextElement;
      elementToRemove.parentElement.removeChild(elementToRemove);
      menuElement.classList.remove('hide-overflow');
      onAnimationDone();
      if (nextLiveArgs !== null) {
        setLiveText.apply(null, nextLiveArgs);
      }
      nextLiveArgs = null;
      isAnimating = false;
    }
  });

  menuElement.classList.add('hide-overflow');
  animation.start();
  isAnimating = true;
}

export function showLeft(visible: boolean = true) {
  var element: HTMLElement = navigation.querySelector('.action-left');
  if (visible) {
    element.classList.remove('invisible');
    element.tabIndex = 0;
  }
  else {
    element.classList.add('invisible')
    element.tabIndex = -1;
  }
}

export function showRight(visible: boolean = true) {
  var element: HTMLElement = navigation.querySelector('.action-right');
  if (visible) {
    element.classList.remove('invisible');
    element.tabIndex = 0;
  }
  else {
    element.classList.add('invisible')
    element.tabIndex = -1;
  }
}
