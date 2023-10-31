import { GalleryManager } from "../components/gallery/GalleryManager";
import { Renderer } from "../components/gallery/Renderer";
import { RowRenderStrategy } from "../components/gallery/RowRenderStrategy";
import { normalizedWidthPixels } from "./app";
import { showApp, showAppImmediately, styling } from "./app";
import navigation from "./navigation";
import { addScrollListener } from "./scrolling";
import { toTitleCase } from "./util/strings";

export default { init }

var currentNavigationElement = null;
var galleryManager = new GalleryManager();

var config = {
  imageMinWidthPixels: 300,
  hideNavigationArrowIfScrollLessThan: 16.0,
  monthCardAspectRatio: 2/3, // 1/4 with text
  rowVisiblePercentage: 1/2,
  scrollToOffsetTopPaddingPixels: 10,
  scrollToOffsetTopPixels: (function () {
    return document.querySelector('#navigation').clientHeight;
  })()
};

export function isGalleryVisible() {
  return !document.querySelector('#app').classList.contains('viewer');
}

function determineCurrentKey(minIndex: number): [HTMLElement, string] {
  var galleryElement: HTMLElement = document.querySelector('.gallery');
  var images: NodeListOf<HTMLElement> = galleryElement.querySelectorAll('.image-container');
  var targetY = null;
  var targetElement = null;
  var elements = Array.from(images);
  for (var element of elements) {
    var rect = element.getBoundingClientRect();
    var yValue = rect.y;
    if (yValue + rect.height * config.rowVisiblePercentage - config.scrollToOffsetTopPixels > 0) {
      /*if (targetY != null && Math.abs(yValue - targetY) > 1) {
        break;
      }
      if (targetY == null) {
        targetY = yValue;
      }*/
      // console.log('I', element, indexOfElementInParent(element), minIndex);
      if (indexOfElementInParent(element) < minIndex) {
        continue;
      }
      targetElement = element;
      break;
    }
  };
  if (targetElement === null) {
    if (elements.length == 0) {
      return null;
    }
    targetElement = elements[elements.length - 1];
  }
  return [targetElement, targetElement.getAttribute('data-key')];
}

function selectorForKey(key: string, additionalSelector: string = ''): string {
  return `.image-container${additionalSelector}[data-key="${key}"]`
}

function getTextForKey(key: string): string {
  var month = toTitleCase(key);
  var keyImages = document.querySelectorAll(selectorForKey(key, ':not(.month-card)'))
  var numberOfPhotos = keyImages.length;
  return `${month} \u2013 ${numberOfPhotos} photo${numberOfPhotos === 1 ? '' : 's'}`
}

// find's the first element that has the same key, a previous key or the next key.
// if direction == 0: find's the first sibling element with the same key.
// if direction < 0: find's the first sibling element with a key
//  that is different from the starting element's key going backward.
// if direction > 0: same as before, just going forward.
function firstKeyElement(startElement: HTMLElement, direction: number): HTMLElement {
  direction = Math.sign(direction);
  var nextSibling = function (e: HTMLElement): HTMLElement {
    return (direction <= 0 ? e.previousElementSibling : e.nextElementSibling) as HTMLElement;
  };
  var doReturn = false;
  var element = startElement;
  while (nextSibling(element) != null) {
    var sibling = nextSibling(element);
    if (sibling.getAttribute('data-key') != element.getAttribute('data-key')) {
      switch (direction) {
        case 0: return element;
        case 1: return sibling;
      }
      // at this point direction=-1, so we want the first element of the previous key,
      // meaning we have to find the next (second) key change,
      // i.e. we return not now, but the next time.
      if (doReturn) {
        return element;
      }
      doReturn = true;
    }
    element = sibling;
  }
  if (direction == 0 || doReturn && direction < 0) {
    return element;
  }
  return null;
}

function indexOfElementInParent(element: HTMLElement) {
  return Array.from(element.parentElement.children).indexOf(element)
}

var lastNavigationElement = null;
var lastArrowVisibleState = [false, false];
var lastScrolledElement = null;
var isScrollFinished = true;

function updateNavigation(preventArrowsVisible: boolean = false) {
  if (!isGalleryVisible())
    return;
  var minIndex = 0;
  if (lastScrolledElement !== null) {
    minIndex = indexOfElementInParent(lastScrolledElement);
  }
  var [element, key] = determineCurrentKey(minIndex);
  if (typeof key !== 'string') {
    return;
  }
  var animateDown = true;
  if (lastNavigationElement !== null) {
    if (indexOfElementInParent(element) < indexOfElementInParent(lastNavigationElement)) {
      animateDown = false;
    }
  }
  lastNavigationElement = element;
  if (preventArrowsVisible) {
    navigation.setLiveText(getTextForKey(key), animateDown,
      function () {
        if (isGalleryVisible()) {
          navigation.showLeft(false);
          navigation.showRight(false);
        }
      },
      function () {
        if (isGalleryVisible()) {
          var [showLeft, showRight] = lastArrowVisibleState;
          navigation.showLeft(showLeft);
          navigation.showRight(showRight);
        }
      }
    );
  }
  else {
    navigation.setLiveText(getTextForKey(key), animateDown);
  }
  currentNavigationElement = element;
  var previous = firstKeyElement(element, -1);
  var current = firstKeyElement(element, 0);
  var next = firstKeyElement(element, 1);

  // make sure the previous element is not on the same row.
  /*while (previous && Math.abs(
      previous.getBoundingClientRect().y - current.getBoundingClientRect().y) < 1) {
    previous = firstKeyElement(previous, -1);
  }
  // same goes for the next element
  while (next && Math.abs(
      next.getBoundingClientRect().y - current.getBoundingClientRect().y) < 1) {
    next = firstKeyElement(next, 1);
  }*/

  // console.log(element, previous, current, next);

  lastArrowVisibleState = [previous != null, next != null];
  var [showLeft, showRight] = lastArrowVisibleState;
  navigation.showLeft(showLeft);
  navigation.showRight(showRight);
  navigation.onLeft(function () {
    if (isScrollFinished) {
      lastScrolledElement = previous;
      isScrollFinished = false;
      previous.scrollIntoView();
    }
  });
  navigation.onCenter(function () {
    if (isScrollFinished) {
      lastScrolledElement = current;
      isScrollFinished = false;
      current.scrollIntoView();
    }
  });
  navigation.onRight(function () {
    if (isScrollFinished) {
      lastScrolledElement = next;
      isScrollFinished = false;
      next.scrollIntoView();
    }
  })
}

export function init() {
  renderGalleries();

  updateNavigation(true);

  var previousDirection = null;
  addScrollListener(function (y: number, height: number, targetDistance: number) {
    if (Math.abs(targetDistance) < 0.01) {
      isScrollFinished = true;
    }
    if (Math.abs(targetDistance) < 0.1) {
      previousDirection = null;
    }
    // 1. if the scroll direction changes we clear the last scrolled element
    if (previousDirection) {
      if (Math.sign(targetDistance) !== Math.sign(previousDirection)) {
        lastScrolledElement = null;
        isScrollFinished = true;
      }
    }
    previousDirection = targetDistance;
    // 2. if we scroll beyond it we also clear it
    if (lastScrolledElement) {
      var rect = lastScrolledElement.getBoundingClientRect();
      if (targetDistance > 0 && rect.y < 0) {
        lastScrolledElement = null;
        isScrollFinished = true;
      }
      else if (targetDistance < 0 && rect.y > rect.height / 2) {
        lastScrolledElement = null;
        isScrollFinished = true;
      }
    }
    if (!isGalleryVisible()) {
      return;
    }
    // highlight the target scroll element
    if (Math.abs(targetDistance) < 1 && lastScrolledElement) {
      var element = lastScrolledElement;
      element.classList.add('target-highlight');
      // navigation.setLiveText(getTextForKey(element.getAttribute('data-key')));
      var duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--target-highlight-animation-duration'));
      setTimeout(function () {
        element.classList.remove('target-highlight');
        lastScrolledElement = null;
      }, duration * 1000);
    }
    updateNavigation();
    if (y < config.hideNavigationArrowIfScrollLessThan) {
      navigation.showLeft(false);
    }
    if (y > height - config.hideNavigationArrowIfScrollLessThan) {
      navigation.showRight(false);
    }
  });
  window.addEventListener('resize', function () {
    updateNavigation();
  });
}

function determineMonthCardName(imageElement: HTMLElement) {
  var monthName = toTitleCase(imageElement.getAttribute('data-key'));
  var year = new Date(imageElement.getAttribute('data-date')).getFullYear();
  return monthName + ' ' + year;
}

function createMonthCards(galleryElement: HTMLElement, showFirstMonthCard: boolean = false) {
  var imageContainers = galleryElement.querySelectorAll('.image-container');
  var previousImageContainer = null;
  for (var i = 0; i < imageContainers.length; i++) {
    var imageContainer = imageContainers.item(i);
    if (i == 0 && showFirstMonthCard || previousImageContainer !== null) {
      var nextMonth = imageContainer.getAttribute('data-key');
      if (i == 0 && showFirstMonthCard || nextMonth !== previousImageContainer.getAttribute('data-key')) {
        var newNode = imageContainer.cloneNode(true) as HTMLElement;
        newNode.removeAttribute('href');
        newNode.classList.add('month-card');
        newNode.classList.add('is-text');
        newNode.setAttribute('data-aspect-ratio', (config.monthCardAspectRatio).toFixed(4));
        newNode.setAttribute('data-orientation', 'portrait');
        var textElement = document.createElement('div');
        // is the text really necessary?
        // 1. the title already says which month it is
        // 2. the separator helps in getting a grasp of what belongs where
        // 3. in the end the exact month of a photo doesn't really matter,
        // it's not important at all actually.
        // it matters more how the gallery looks.
        textElement.innerText = determineMonthCardName(newNode);
        newNode.prepend(textElement);
        imageContainer.before(newNode);
      }
    }
    previousImageContainer = imageContainer;
  }
}

function finalizeImageOrder(galleryElement: HTMLElement) {
  var imageContainers = galleryElement.querySelectorAll('.image-container');
  var previousImageContainer = null;
  var order = 0;
  for (var i = 0; i < imageContainers.length; i++) {
    var imageContainer = imageContainers.item(i);
    if (previousImageContainer !== null) {
      var nextMonth = imageContainer.getAttribute('data-key');
      if (nextMonth !== previousImageContainer.getAttribute('data-key')) {
        order++;
      }
    }
    previousImageContainer = imageContainer;
    imageContainer.setAttribute('data-order', Math.round(order).toString());
  }
}

function renderGalleries() {
  galleryManager.registerRendererFactory(
    function (galleryElement: HTMLElement): Renderer {
      var galleryContainer = galleryElement.parentElement;
      if (!galleryContainer.classList.contains('gallery-container')) {
        throw new Error('gallery parent must be a gallery-container');
      }

      // TODO
      // get this from the element's data attribute
      var renderStrategy = new RowRenderStrategy();
      var imageMinWidthPixels = config.imageMinWidthPixels; // 300
      var allowWideColumnLandscapes = true;

      return new Renderer(renderStrategy, {
        galleryContainerElement: galleryContainer,
        imageContainerElement: galleryElement,
        imageMinWidthPixels: normalizedWidthPixels(imageMinWidthPixels),
        paddingPixels: styling.padding,
        galleryPaddingPixels: styling.padding - styling.borderWidth,
        allowWideColumnLandscapes: allowWideColumnLandscapes,
      });
    });

  galleryManager.registerImageLoader(
    function (image: HTMLImageElement, isLast: boolean, cb: () => void): void {
      // check if the first row is loaded (this is the image of a next row)
      // and show the app if that is the case
      var imageContainer = image.parentElement;
      var top = parseFloat(getComputedStyle(imageContainer).top);
      if (top > 0) {
        showApp();
      }

      var loadNext = function () {
        if (isLast) {
          // make sure to show the app if this was the last image
          showApp();
        }
        cb();
      };
      image.addEventListener('load', function (e) {
        this.parentElement.classList.remove('not-loaded');
        loadNext();
      })
      image.addEventListener('error', function (e) {
        loadNext();
      })
      // console.log(image, image.getAttribute('data-src'));
      image.src = image.getAttribute('data-src');
    });

  var galleries: NodeListOf<HTMLElement> = document.querySelectorAll('.gallery');
  // first add an element before each image which depicts its month
  for (var galleryElement of Array.from(galleries)) {
    // createMonthCards(galleryElement);
    finalizeImageOrder(galleryElement);
  }

  if (galleries.length > 0)
    galleryManager.renderAll(galleries);
  else
    // show the app immediately in case there are no galleries
    showAppImmediately();
}
