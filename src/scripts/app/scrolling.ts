import { easeOutQuart } from "./util/easings";

export default { init, isCancelMouseClick }

var config = {
  onScrollUpdateFrequencyMillis: 250,
  scrollIntoViewPaddingPixels: 0 + 10, // 10
};

type ScrollCallback = (y: number, height: number, targetDistance: number) => void;

var onScrollListeners: ScrollCallback[] = [];
var lastOnScrollUpdate = 0;

export function addScrollListener(listener: ScrollCallback) {
  onScrollListeners.push(listener);
}

function triggerOnScrollListeners(y: number, height: number, targetDistance: number) {
  for (var listener of onScrollListeners) {
    listener(y, height, targetDistance);
  }
}

var maxScrollStepPixels = 150; // 120
var scrollDuration = 1000;
var scrollComparisonEpsilon = 0.001;
var scrollRootElement: HTMLElement = document.querySelector('#app');
var scrollElement: HTMLElement = document.querySelector('#main');
var pageScrollEasingFunc = easeOutQuart; // easeInOutCirc;
// var pageScrollEasingFuncInverse = easeOutQuintInverse;

var currentScrollPosition = 0;
var currentScrollTarget = currentScrollPosition;

var handlePageScroll = null;
var handlePageResize = null;

// state variables during smooth scrolling
// reset these if scrolling is finished
var isScrolling = false;
var scrollDirection = undefined;
var startScrollPosition = undefined;
var startTime = undefined;

var originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
HTMLElement.prototype.scrollIntoView = function () {
  resetNativeScroll();
  var matches = Array.from(scrollElement.style.transform.matchAll(/translateY\(([-\d.]+)px\)/g));
  var rootY = parseFloat(matches.length > 0 ? matches[0][1] : '0');
  var rootRectY = scrollElement.getBoundingClientRect().y;
  var awayFromTop = rootRectY - rootY;
  var rect = this.getBoundingClientRect();
  var targetY = rect.y - awayFromTop - config.scrollIntoViewPaddingPixels; // - rootY - awayFromTop;
  var deltaY = targetY;
  currentScrollTarget = currentScrollPosition;
  handlePageScroll(deltaY, false);
  // console.log(deltaY, rootY, rect.y, targetY, awayFromTop);
};

// resets the native scroll offset,
// e.g. in case the users scrolled by tabbing through the site
// or by pressing "move element to visible area" in firefox's element viewer.
function resetNativeScroll() {
  originalScrollIntoView.call(document.querySelector('.app-content'));
}

// https://stackoverflow.com/a/60985805
function getKeyboardFocusableElements(element: Element = document.documentElement): Element[] {
  return Array.from(element.querySelectorAll(
    'a, button, input, textarea, select, details,[tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.hasAttribute('disabled')) as Element[];
}

var doCancelMouseClick = false;

export function isCancelMouseClick() {
  return doCancelMouseClick;
}

export function init() {

  var appElement = document.querySelector('#app');
  var mainElement = document.querySelector('#main');

  var isMouseDown = false;
  var wasWindowBlur = false;
  var wasWindowBlurThenFocus = false;
  document.addEventListener('mousedown', function () { isMouseDown = true; });
  document.addEventListener('mousemove', function () { isMouseDown = false; })
  document.addEventListener('mouseup', function () { isMouseDown = false; });
  window.addEventListener('blur', function () {
    wasWindowBlur = true;
  });
  window.addEventListener('focus', function () {
    wasWindowBlurThenFocus = wasWindowBlur;
    wasWindowBlur = false;
    this.setTimeout(function () {
      wasWindowBlurThenFocus = false;
    }, 1/60);
  })
  var focusableElements = getKeyboardFocusableElements();
  for (var element of focusableElements) {
    element.addEventListener('focus', function (e) {
      if (!isMouseDown && !wasWindowBlurThenFocus) {
        if (mainElement.contains(this)) {
          this.scrollIntoView();
        }
      }
    });
  }

  /*window.addEventListener('load', () => {
    var scrollElement = document.querySelector('#main');
    // console.log(scrollElement.clientHeight, scrollElement.clientLeft);
  });*/

  scrollRootElement.style.overflow = 'hidden';

  var getContentHeight = () => scrollElement.clientHeight
    + parseInt(getComputedStyle(scrollRootElement).paddingTop)
    + parseInt(getComputedStyle(scrollRootElement).paddingBottom);
  var getPageHeight = () => scrollRootElement.clientHeight;
  var getPageWidth = () => scrollRootElement.clientWidth;

  var getMaxScroll = function () {
    return getContentHeight() - getPageHeight();
  };

  var limitScrollValue = function (value) {
    return Math.max(0, Math.min(value, getMaxScroll()))
  };

  var isAboutEqual = function (a, b) {
    return Math.abs(a - b) < scrollComparisonEpsilon;
  };

  var setScrollOffset = function (offset) {
    currentScrollPosition = offset;
    var offsetString = offset.toFixed(18);
    scrollElement.style.transform = `translateY(-${offsetString}px)`
  };

  // runs continuously
  var updateScroll = function (timestamp) {
    if (startScrollPosition === undefined) {
      console.warn('undefined startScrollPosition!');
      return;
    }
    if (isScrolling === false) {
      console.warn('isScrolling is false!');
      return;
    }

    // calculate the new partial offset
    startTime = startTime || timestamp;
    var timeElapsed = timestamp - startTime;
    var newOffset = startScrollPosition
      + (currentScrollTarget - startScrollPosition)
      * pageScrollEasingFunc(timeElapsed / scrollDuration);

    // console.log(timeElapsed / scrollDuration, pageScrollEasingFunc(timeElapsed / scrollDuration), pageScrollEasingFuncInverse(pageScrollEasingFunc(timeElapsed / scrollDuration)));

    // scroll to the calculated offset
    var prettyMuchThere = isAboutEqual(newOffset, currentScrollTarget);
    setScrollOffset(prettyMuchThere ? currentScrollTarget : newOffset);

    var targetDistance = currentScrollTarget - currentScrollPosition;

    var now = Date.now();
    if (lastOnScrollUpdate + config.onScrollUpdateFrequencyMillis < now) {
      triggerOnScrollListeners(currentScrollPosition, getMaxScroll(), targetDistance);
      lastOnScrollUpdate = now;
    }

    // continue scrolling if there is more to scroll
    if (!prettyMuchThere && timeElapsed <= scrollDuration) {
      window.requestAnimationFrame(updateScroll);
    }
    else {
      isScrolling = false;
      scrollDirection = undefined;
      startScrollPosition = undefined;
      startTime = undefined;
      // trigger them at the end of the scroll as well
      triggerOnScrollListeners(currentScrollPosition, getMaxScroll(), targetDistance);
    }
  };

  handlePageScroll = function (deltaY: number, limitScroll: boolean = true) {
    // update the scroll target
    // flip sign, as scrolling down gives a negative delta
    var direction = Math.sign(deltaY);
    var stepPixels = Math.abs(deltaY);
    if (limitScroll)
      stepPixels = Math.min(maxScrollStepPixels, stepPixels); // Math.abs(deltaY); // Math.min(maxScrollStepPixels, Math.abs(deltaY) * 2);
    // add to the currentScrollTarget, to
    // 1. allow scrolling far by scrolling a lot quickly and early
    // 2. smoothing out scrolling back (as if we were reducing the velocity)
    currentScrollTarget = currentScrollTarget + direction * stepPixels;

    currentScrollTarget = limitScrollValue(currentScrollTarget);

    // do not request an animation frame again, if we're already scrolling
    if (isScrolling) {
      // restart the easing function from our current position
      // whenever we change directions when we are close to
      // the top or bottom of the page,
      // in which case the animation should finish without interruption,
      // so it does not take forever to arrive at said destination
      // NOTE: enabling this makes it jump weird sometimes.
      /*if (scrollDirection != direction
          || !(isAboutEqual(currentScrollTarget, 0.0) // && Math.abs(currentScrollPosition) < maxScrollStepPixels)
          && !(isAboutEqual(currentScrollTarget, getMaxScroll())))) { // && Math.abs(currentScrollTarget - currentScrollPosition) < maxScrollStepPixels)) {
        startScrollPosition = currentScrollPosition;
        startTime = undefined;
      }*/
      startScrollPosition = currentScrollPosition;
      startTime = undefined;
      return true;
    }

    // start the scrolling animation
    startScrollPosition = currentScrollPosition;
    window.requestAnimationFrame(updateScroll);
    scrollDirection = direction;
    isScrolling = true;

    return true;
  };

  // add a little bit of delay to do less processing than necessary
  // resizing quickly doesn't need an instant response
  var resizeHandlerDelay = 10;
  var resizeTimeout = null;

  var onResize = function (e) {
    currentScrollTarget = limitScrollValue(currentScrollTarget);
    setScrollOffset(currentScrollTarget);
  };

  handlePageResize = function (e) {
    if (resizeTimeout != null) {
      clearTimeout(resizeTimeout);
      resizeTimeout = null;
    }
    resizeTimeout = setTimeout(() => {
      onResize(e);
    }, resizeHandlerDelay);
  };

  // The scroll handlers are called in order.
  // As soon as one returns true,
  // none of the remaining scroll handlers will be called.
  var scrollHandlers = [
    // ...
    handlePageScroll // comes last, if no other scroll handler is called
  ];

  var resizeHandlers = [
    handlePageResize
  ];

  var maxUpdatesPerSecond = 20;
  var lastUpdate = null;
  var accumulatedDeltaY = 0;
  var lastDeltaY = 0;
  var nextTimeout = null;

  var handleScrollEvent = function (deltaY: number) {
    if (appElement.classList.contains('blurred')) {
      return;
    }

    var handleScroll = function () {
      // e.preventDefault();
      for (var scrollHandler of scrollHandlers) {
        var hasScrolled = scrollHandler(accumulatedDeltaY);
        if (hasScrolled !== true && hasScrolled !== false) {
          console.warn('a scroll handler must return a boolean value')
        }
        if (hasScrolled) {
          break;
        }
      }
      accumulatedDeltaY = 0;
    }

    accumulatedDeltaY += deltaY;
    if (nextTimeout !== null) {
      clearTimeout(nextTimeout);
      nextTimeout = null;
    }

    // if we change signs, handle the scroll immediately
    if (Math.sign(deltaY) != Math.sign(lastDeltaY)) {
      // console.log(deltaY, lastDeltaY)
      accumulatedDeltaY = deltaY;
      lastUpdate = Date.now();
      lastDeltaY = deltaY;
      handleScroll();
      return;
    }

    var now = Date.now();
    if (lastUpdate !== null) {
      var delay = 1000 / maxUpdatesPerSecond
      if (now - lastUpdate < delay) {
        if (nextTimeout !== null) {
          clearTimeout(nextTimeout);
        }
        nextTimeout = setTimeout(function () {
          handleScroll();
          nextTimeout = null;
        }, delay - (now - lastUpdate));
        return;
      }
    }
    lastUpdate = Date.now();
    lastDeltaY = deltaY;

    // console.log(accumulatedDeltaY, e.deltaY);
    // accumulatedDeltaY = e.deltaY;

    handleScroll();
  };

  /* DRAG SCROLL */

  var distancePixelsThresholdCancelClick = 8;
  var dragDeltaMultiplier = 8;
  var dragDeltaMultiplierTouch = 2;

  var lastMouseDownCoords = null;
  var lastMouseUpCoords = null;
  var lastMouseMoveCoords = null;

  var handleDragStart = function (x, y) {
    lastMouseDownCoords = [x, y];
  };

  mainElement.addEventListener('mousedown', function (e: MouseEvent) {
   if (e.buttons === 1) {
    handleDragStart(e.clientX, e.clientY);
   }
  });
  mainElement.addEventListener('touchstart', function (e: TouchEvent) {
    if (e.touches.length == 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  });

  var getSquaredTravelDistance = function (x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return dx*dx + dy*dy;
  };

  var isSquaredDistanceSmaller = function (x1, y1, x2, y2, targetDistance) {
    var distanceSquared = getSquaredTravelDistance(x1, y1, x2, y2);
    var targetDistanceSquared = targetDistance * targetDistance;
    return targetDistanceSquared < distanceSquared;
  };

  var handleDragEnd = function (x, y) {
    if (lastMouseDownCoords == null) {
      return;
    }
    lastMouseUpCoords = [x, y];
    var [downX, downY] = lastMouseDownCoords;
    var [upX, upY] = lastMouseUpCoords;
    if (isSquaredDistanceSmaller(downX, downY, upX, upY, distancePixelsThresholdCancelClick)) {
      doCancelMouseClick = true;
    }
  };

  mainElement.addEventListener('mouseup', function (e: MouseEvent) {
    handleDragEnd(e.clientX, e.clientY);
  });
  mainElement.addEventListener('touchend', function (e: TouchEvent) {
    if (e.touches.length == 1) {
      handleDragEnd(e.touches[0].clientX, e.touches[0].clientY);
    }
    resetDrag();
  });

  var handleDragMove = function (x, y, isTouch = false) {
    if (lastMouseDownCoords === null) {
      return;
    }
    if (lastMouseMoveCoords === null) {
      lastMouseMoveCoords = lastMouseDownCoords;
    }
    var [downX, downY] = lastMouseMoveCoords;
    var [x, y] = [x, y];
    var deltaY = -1 * (y - downY);
    if (Math.abs(deltaY) === 0) {
      return;
    }
    if (isTouch) {
      deltaY *= dragDeltaMultiplierTouch;
    }
    else {
      deltaY *= dragDeltaMultiplier;
    }
    console.log(deltaY);
    handleScrollEvent(deltaY);
    lastMouseMoveCoords = [x, y];
    // also cancel the mouse click if at any time during the drag
    // we have moved beyond the distance acceptable for a click.
    if (isSquaredDistanceSmaller(downX, downY, x, y, distancePixelsThresholdCancelClick)) {
      doCancelMouseClick = true;
    }
    document.getElementById('app').classList.add('default-cursor');
  };

  mainElement.addEventListener('mousemove', function (e: MouseEvent) {
    handleDragMove(e.clientX, e.clientY);
  });
  mainElement.addEventListener('touchmove', function (e: TouchEvent) {
    if (e.touches.length == 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY, true);
    }
  });

  var resetDrag = function () {
    lastMouseDownCoords = null;
    lastMouseUpCoords = null;
    lastMouseMoveCoords = null;
    doCancelMouseClick = false;
    document.getElementById('app').classList.remove('default-cursor');
  };

  mainElement.addEventListener('click', function (e: MouseEvent) {
    if (doCancelMouseClick) {
      e.preventDefault();
    }
    resetDrag();
  });

  window.addEventListener('blur', function () {
    resetDrag();
  });

  document.body.addEventListener('mouseleave', function () {
    resetDrag();
  });

  /* DRAG SCROLL END */

  mainElement.addEventListener('wheel', (e: WheelEvent) => {
    handleScrollEvent(e.deltaY);
  });

  window.addEventListener('resize', e => {
    for (var resizeHandler of resizeHandlers) {
      resizeHandler(e);
    }
  });

  /*
  var touchPos;

  // store the touching position at the start of each touch
  document.body.ontouchstart = function(e){
      touchPos = e.changedTouches[0].clientY;
  }

  // detect wether the "old" touchPos is
  // greater or smaller than the newTouchPos
  document.body.ontouchmove = function(e){
      let newTouchPos = e.changedTouches[0].clientY;
      if(newTouchPos > touchPos) {
          console.log("finger moving down", newTouchPos - touchPos);
      }
      if(newTouchPos < touchPos) {
          console.log("finger moving up", newTouchPos - touchPos);
      }
  }
  */
}

/*function scrollBy(element, value, duration, easingFunc) {
  var startTime;
  var startPos = element.scrollTop;
  var clientHeight = element.clientHeight;
  var maxScroll = element.scrollHeight - clientHeight;
  var scrollIntendedDestination = startPos + value;
  // low and high bounds for possible scroll destinations
  var scrollEndValue = Math.max(scrollIntendedDestination, 0)
  console.log(startPos, scrollEndValue, maxScroll)
  // create recursive function to call every frame
  var scroll = function(timestamp) {
    startTime = startTime || timestamp;
    var elapsed = timestamp - startTime;
    element.scrollTop = startPos + (scrollEndValue - startPos) * easingFunc(elapsed / duration);
    elapsed <= duration && window.requestAnimationFrame(scroll);
  };
  // call recursive function
  if (startPos != scrollEndValue) window.requestAnimationFrame(scroll);
}*/
