import { Animator } from "../components/animation/Animator";
import { styling } from "./app";
import navigation from "./navigation";
import scrolling from "./scrolling";
import { easeOutQuart } from "./util/easings";
import { toTitleCase } from "./util/strings";

export default { init }

export var config = {
  animationSpeedMillis: 150, // 200 // PRODUCTION: 250
  animationNextMoveDistanceMultiplier: 0.1,
};

function initialViewerState() {
  return {
    visible: false,
    imageElement: null,
    viewerElement: null,
  };
}

var viewerState: {
  visible: boolean,
  imageElement: HTMLElement,
  viewerElement: HTMLElement,
} = initialViewerState();

function init() {
  var viewerElement = document.querySelector('#viewer');
  var viewerContentElement = viewerElement.querySelector('.viewer-content');

  var resizeListeners = {};
  var resizeListenerKey = 0;
  window.addEventListener('resize', function () {
    for (var [_, callback] of Object.entries(resizeListeners)) {
      var fn = callback as () => void;
      fn();
    }
  });

  function addImageToViewer(fromImageContainer: HTMLElement): HTMLElement {
    /*
    <div class="viewer-image">
      <div class="viewer-image-container">
        <img src="/media/large/10463/P1013642.jpg">
      </div>
    </div>
    */
    var imageElement: HTMLImageElement = fromImageContainer.querySelector('img');
    var viewerSource = imageElement.getAttribute('data-viewer-src');
    var loadedSmallerSource = imageElement.src;
    var div1 = document.createElement('div');
    var div2 = document.createElement('div');
    div1.classList.add('viewer-image');
    div1.classList.add('loading');
    div2.classList.add('viewer-image-container');
    div1.append(div2);
    var img1 = document.createElement('img');
    var img2 = document.createElement('img');
    img1.onload = function () {
      div1.classList.remove('loading');
      /*setTimeout(function () {
        div1.classList.remove('loading');
      }, 50);*/
    };
    div2.append(img1);
    div2.append(img2);
    img1.classList.add('original');
    img2.classList.add('placeholder');
    img2.style.width = imageElement.getAttribute('data-viewer-width') + 'px';
    img2.style.height = imageElement.getAttribute('data-viewer-height') + 'px';
    img2.src = loadedSmallerSource;
    img1.src = viewerSource;
    var children = viewerContentElement.children;
    var zIndex = 0;
    if (children.length > 0) {
      var lastChild = children.item(children.length - 1)
      zIndex = parseInt(getComputedStyle(lastChild).zIndex) - 1;
    }
    div1.style.zIndex = zIndex.toString();
    viewerContentElement.append(div1);

    updateViewerLiveTitle(fromImageContainer);

    return div1;
  }

  function animateImage(element: HTMLElement, targetElement: HTMLElement, direction: number = 1) {
    var imageContainer: HTMLElement = element.querySelector('.viewer-image-container');
    var imageElement: HTMLElement = element.querySelector('img');
    var targetWidth = targetElement.querySelector('img').getBoundingClientRect().width;

    var resizeKey = resizeListenerKey++;
    var easingFunc = easeOutQuart;

    element.classList.add('animating');
    if (direction > 0) {
      element.style.left = (0).toString();
    }
    else {
      element.style.right = (0).toString();
    }

    var animation = new Animator({
      animationDurationMillis: (direction < 1 ? 2 : 1) * config.animationSpeedMillis,
      easingFunc: easingFunc,
      onRedraw: function () {
        var parent = element.parentElement;
        var parentWidth = parent.clientWidth;
        var maxWidth = Math.max(imageElement.clientWidth, targetWidth);
        var elementWidth = (maxWidth + 2 * styling.borderWidth);
        var elementOffset = ((parentWidth - maxWidth) / 2 - styling.borderWidth)
        element.style.width = elementWidth + 'px';
        if (direction > 0) {
          element.style.left = elementOffset + 'px';
          imageContainer.style.marginLeft = (-1 * elementOffset) + 'px';
        }
      },
      onAnimationFrame: function (progress, linearProgress) {
        // var moveProgress = easingFunc(Math.min(1, linearProgress * 1.0));
        var maxWidth = Math.max(imageElement.clientWidth, targetWidth)
        var targetImage = targetElement.querySelector('img');
        if (direction > 0) {
          element.style.width = ((1 - progress) * maxWidth) + 'px';
          targetImage.style.marginRight = (-1 * (1 - progress) * maxWidth * config.animationNextMoveDistanceMultiplier) + 'px';
        }
        if (direction < 0) {
          var borderWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--viewer-image-border-width'));
          var contentWidth = viewerContentElement.getBoundingClientRect().width; //- 2 * borderWidth;
          var thatWidth = ((1 - progress) * contentWidth);
          element.style.width = thatWidth + 'px';
          imageContainer.style.marginLeft = -(contentWidth - thatWidth) + 'px';
          targetImage.style.marginRight = (-Math.sign(direction) * (1 - progress) * thatWidth * config.animationNextMoveDistanceMultiplier / 2) + 'px';
        }
      },
      onFinished: function () {
        // element.classList.remove('animating');
        element.parentElement.removeChild(element);
        delete resizeListeners[resizeKey];
        if (targetElement && targetElement.parentElement.children.length === 1) {
          targetElement.style.zIndex = (0).toString();
        }
      }
    })

    // setTimeout(() => animation.start(), 500)
    resizeListeners[resizeKey] = function onResize() {
      animation.onRedraw();
    }

    animation.start()
  }

  /*var index = 1;
  var elements: HTMLElement[] = Array.from(document.querySelectorAll('.viewer-image'));
  var scrollNext = function () {
    if (index >= elements.length) {
      return;
    }
    var indexCopy = index++;
    animateImage(elements[elements.length - indexCopy], (function (element) {
      return function () {
        var width = element.querySelector('img').getBoundingClientRect().width;
        return [element, width];
      };
    })(elements[elements.length - indexCopy - 1]));
  };*/

  function preloadViewerImageFrom(imageContainerElement: HTMLElement) {
    var img = document.createElement('img');
    img.onload = function () {
      // console.log('preloaded');
    };
    img.src = imageContainerElement.querySelector('img').getAttribute('data-viewer-src');
  }

  function clearViewer() {
    for (var element of Array.from(viewerContentElement.children)) {
      viewerContentElement.removeChild(element);
    }
  }

  var currentLiveText = '';

  function closeViewer() {
    document.getElementById('app').classList.remove('viewer');
    document.getElementById('navigation').classList.remove('is-compact');
    viewerState = initialViewerState();
    clearViewer();
    navigation.setLiveText(currentLiveText, true);
  }

  function updateViewerLiveTitle(imageContainer: HTMLElement) {
    var children = Array.from(document.querySelector('#gallery .gallery').children).filter(x => x.getAttribute('data-order') == imageContainer.getAttribute('data-order'))
    navigation.setLiveText(
      toTitleCase(imageContainer.getAttribute('data-key')) +
      ' \u2012 ' +
      (children.indexOf(imageContainer) + 1) +
      ' of ' +
      children.length, false);
  }

  function showViewer(imageContainer: HTMLElement) {
    currentLiveText = navigation.getCurrentLiveText();

    clearViewer();
    document.getElementById('app').classList.add('viewer');
    document.getElementById('navigation').classList.add('is-compact');
    viewerState = initialViewerState();
    viewerState.visible = true;
    viewerState.imageElement = imageContainer;
    viewerState.viewerElement = addImageToViewer(imageContainer);
    navigation.showLeft(hasPreviousImage());
    navigation.showRight(hasNextImage());
    navigation.onCenter(function () {
      closeViewer();
    });
    navigation.onClose(function () {
      closeViewer();
    });
    navigation.onLeft(function () {
      showPreviousImage();
    });
    navigation.onRight(function () {
      showNextImage();
    });
    updateViewerLiveTitle(imageContainer);

    if (hasPreviousImage()) preloadViewerImageFrom(previousImage());
    if (hasNextImage()) preloadViewerImageFrom(nextImage());
  }

  function nextImage(): HTMLElement {
    if (!viewerState.imageElement) return null;
    return viewerState.imageElement.nextElementSibling as HTMLElement || null;
  }
  function previousImage(): HTMLElement {
    if (!viewerState.imageElement) return null;
    return viewerState.imageElement.previousElementSibling as HTMLElement || null;
  }

  function hasNextImage() { return !!nextImage(); }
  function hasPreviousImage() { return !!previousImage(); }

  function showPreviousImage() {
    if (!hasPreviousImage()) return;

    var currentImage = viewerState.imageElement;
    var currentViewerElement = viewerState.viewerElement;
    var nextImageElement = currentImage.previousElementSibling as HTMLElement;
    var nextViewerElement = addImageToViewer(nextImageElement);
    viewerState.imageElement = nextImageElement;
    viewerState.viewerElement = nextViewerElement;
    animateImage(currentViewerElement, nextViewerElement, -1);

    navigation.showLeft(hasPreviousImage());
    navigation.showRight(hasNextImage());

    if (hasPreviousImage()) preloadViewerImageFrom(previousImage());
    if (hasNextImage()) preloadViewerImageFrom(nextImage());
  }

  function showNextImage() {
    if (!hasNextImage()) return;

    var currentImage = viewerState.imageElement;
    var currentViewerElement = viewerState.viewerElement;
    var nextImageElement = currentImage.nextElementSibling as HTMLElement;
    var nextViewerElement = addImageToViewer(nextImageElement);
    viewerState.imageElement = nextImageElement;
    viewerState.viewerElement = nextViewerElement;
    animateImage(currentViewerElement, nextViewerElement, 1);

    navigation.showLeft(hasPreviousImage());
    navigation.showRight(hasNextImage());

    if (hasPreviousImage()) preloadViewerImageFrom(previousImage());
    if (hasNextImage()) preloadViewerImageFrom(nextImage());
  }

  // register a click listener on all images of all galleries.
  // whenever the user clicks on an image
  // the viewer is initialized for that gallery
  var galleries = document.querySelectorAll('.gallery');
  for (var gallery of Array.from(galleries)) {
    var imageContainers = gallery.querySelectorAll('.image-container');
    for (var imageContainer of Array.from(imageContainers)) {
      imageContainer.addEventListener('click', function (e) {
        e.preventDefault();
        if (!scrolling.isCancelMouseClick()) {
          showViewer(this);
        }
      });
      imageContainer.addEventListener('dragstart', function (e) {
        e.preventDefault();
      })
    }
  }

  window.addEventListener('keydown', function (e: KeyboardEvent) {
    if (viewerState.visible) {
      if (e.key === 'Escape' || e.key === 'Delete') {
        closeViewer();
      }
      if (e.key === 'ArrowRight') {
        showNextImage();
      }
      if (e.key === 'ArrowLeft') {
        showPreviousImage();
      }
    }
  });

  /*window.addEventListener('load', function () {
    showViewer(galleries.item(0) as HTMLElement);
  });*/

  document.addEventListener('wheel', function (e: WheelEvent) {
    if (e.deltaY < 0) {
      showPreviousImage();
    }
    else {
      showNextImage();
    }
  });
}
