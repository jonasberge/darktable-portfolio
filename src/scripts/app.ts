import gallery from "./app/gallery"
import navigation from "./app/navigation";
import scrolling from "./app/scrolling";
import { isMobile } from "./app/util/ismobile";
import viewer from "./app/viewer";


navigation.init();
gallery.init();
viewer.init();

if (!isMobile()) {
  scrolling.init();
}
else {
  document.documentElement.classList.add('is-mobile');
}


/*
var documentStyle = getComputedStyle(document.documentElement);
var styling = {
  padding: parseFloat(documentStyle.getPropertyValue('--gallery-padding')),
  borderWidth: parseFloat(documentStyle.getPropertyValue('--gallery-image-border-width')),
};

// Gallery code
(function () {
  function showApp() {
    document.querySelector('#app').classList.remove('blurred');
  }
  function showAppImmediately() {
    var appElement: HTMLElement = document.querySelector('#app');
    var mainElement: HTMLElement = appElement.querySelector('#main');
    mainElement.style.transition = 'filter 0s';
    appElement.classList.remove('blurred');
  }

  var galleryManager = new GalleryManager();

  galleryManager.registerRendererFactory(
    function (galleryElement: HTMLElement): Renderer {
      var galleryContainer = galleryElement.parentElement;
      if (!galleryContainer.classList.contains('gallery-container')) {
        throw new Error('gallery parent must be a gallery-container');
      }

      // TODO
      // get this from the element's data attribute
      var renderStrategy = new RowRenderStrategy();
      var imageMinWidthPixels = 250; // 300
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
  if (galleries.length > 0)
    galleryManager.renderAll(galleries);
  else
    // show the app immediately in case there are no galleries
    showAppImmediately();
})();
*/

/*
// Viewer code
(function () {
  // TODOs:
  // - disable scrolling (make scrolling accessible here)
  //   => done by visibility:hidden in CSS
  // - pause loading the medium images (for the gallery),
  //   at least while the large ones are loading.

  function showViewer() {
    document.getElementById('app').classList.add('viewer');
  }

  var resizeListeners = {};
  var resizeListenerKey = 0;
  window.addEventListener('resize', function () {
    for (var [_, callback] of Object.entries(resizeListeners)) {
      var fn = callback as () => void;
      fn();
    }
  });

  function animateImage(element: HTMLElement, getTarget: () => [HTMLElement, number]) {
    var imageContainer: HTMLElement = element.querySelector('.viewer-image-container');
    var imageElement: HTMLElement = element.querySelector('img');

    var resizeKey = resizeListenerKey++;
    var easingFunc = easeOutQuart;

    var animation = new Animator({
      animationDurationMillis: 250,
      easingFunc: easingFunc,
      onRedraw: function () {
        var parent = element.parentElement;
        var parentWidth = parent.clientWidth;
        var [_, targetWidth] = getTarget();
        var maxWidth = Math.max(imageElement.clientWidth, targetWidth);
        var elementWidth = (maxWidth + 2 * styling.borderWidth);
        var elementOffset = ((parentWidth - maxWidth) / 2 - styling.borderWidth)
        element.style.width = elementWidth + 'px';
        element.style.left = elementOffset + 'px';
        imageContainer.style.marginLeft = (-1 * elementOffset) + 'px';
        console.log(maxWidth, parentWidth);
      },
      onAnimationFrame: function (progress, linearProgress) {
        var moveProgress = easingFunc(Math.min(1, linearProgress * 1.0));
        var [targetElement, targetWidth] = getTarget();
        var maxWidth = Math.max(imageElement.clientWidth, targetWidth)
        element.style.width = ((1 - progress) * maxWidth) + 'px';
        var targetImage = targetElement.querySelector('img');
        targetImage.style.marginRight = (-1 * (1 - progress) * maxWidth * 0.05) + 'px';
      },
      onFinished: function () {
        delete resizeListeners[resizeKey];
      }
    })

    // setTimeout(() => animation.start(), 500)
    resizeListeners[resizeKey] = function onResize() {
      animation.onRedraw();
    }

    animation.start()
  }

  var index = 1;
  var elements: HTMLElement[] = Array.from(document.querySelectorAll('.viewer-image'));
  var scrollNext = function () {
    console.log(index, elements);
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
  };

  window.addEventListener('load', function () {
    // showViewer();

    /*var elements: HTMLElement[] = Array.from(this.document.querySelectorAll('.viewer-image'));
    animateImage(elements[elements.length - 1], function () {
      return elements[elements.length - 2].querySelector('img').getBoundingClientRect().width;
    });
    setTimeout(function () {
      animateImage(elements[elements.length - 2], function () {
        return elements[elements.length - 3].querySelector('img').getBoundingClientRect().width;
      });
    }, 400);
    setTimeout(function () {
      animateImage(elements[elements.length - 3], function () {
        return elements[elements.length - 4].querySelector('img').getBoundingClientRect().width;
      });
    }, 800);-/
  });

  document.addEventListener('wheel', function () {
    scrollNext();
  });

  document.addEventListener('click', function () {
    scrollNext();
  });
})();
*/

/*

show banner when viewing photos
title: September -- 9/17
- but: hide the navigation
- i.e. only show top center element
- make it smaller when showing photos, with padding transition

finish viewer scroll/next/previous animation (almost done)




*/
