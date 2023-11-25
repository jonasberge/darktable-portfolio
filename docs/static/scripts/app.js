'use strict';

var GalleryManager = /** @class */function () {
  function GalleryManager() {
    this.rendererFactory = null;
    this.imageLoader = null;
    var self = this;
    window.addEventListener('load', function () {
      self.windowLoaded = true;
    });
    this.renderers = [];
  }
  GalleryManager.prototype.registerRendererFactory = function (factory) {
    this.rendererFactory = factory;
  };
  GalleryManager.prototype.registerImageLoader = function (imageLoader) {
    this.imageLoader = imageLoader;
  };
  GalleryManager.prototype.renderAll = function (galleryElementsList) {
    if (this.rendererFactory === null) {
      throw new Error('missing renderer factory');
    }
    var galleryElements = Array.from(galleryElementsList);
    var self = this;
    var renderCount = 0;
    var renderedImages = [];
    for (var _i = 0, galleryElements_1 = galleryElements; _i < galleryElements_1.length; _i++) {
      var element = galleryElements_1[_i];
      var renderer = this.rendererFactory(element);
      // FIXME: this needs to be called twice for some reason
      renderer.render();
      var onLoad = function onLoad() {
        self.renderers.push(renderer);
        var images = renderer.render();
        for (var _i = 0, images_1 = images; _i < images_1.length; _i++) {
          var image = images_1[_i];
          renderedImages.push(image);
        }
        renderCount += 1;
        if (renderCount == galleryElements.length) {
          self._loadImages(renderedImages);
        }
        window.addEventListener('resize', function (e) {
          renderer.render();
        });
      };
      if (this.windowLoaded) {
        onLoad();
      } else {
        window.addEventListener('load', onLoad);
      }
    }
  };
  GalleryManager.prototype._loadImages = function (images) {
    var self = this;
    var loadImage = function loadImage(index) {
      if (index === void 0) {
        index = 0;
      }
      if (index == images.length) return;
      var container = images[index].containerElement;
      var image = container.querySelector('img');
      var isLast = index == images.length - 1;
      self.imageLoader(image, isLast, function () {
        return loadImage(index + 1);
      });
    };
    loadImage();
  };
  return GalleryManager;
}();

// iterates image elements in a custom order utilizing their aspect ratio.
// the caller can decide if they want to continue in the original image order,
// by simply calling next() all the time, or, if necessary,
// they can request the next portrait or landscape image.
// each call to next(), nextPortrait() and nextLandscape()
// returns the first element that comes in the original image order.
var ImageIterator = /** @class */function () {
  function ImageIterator(galleryImages) {
    this.portraitImages = [];
    this.landscapeImages = [];
    this.portraitIndex = 0;
    this.landscapeIndex = 0;
    for (var i = 0; i < galleryImages.length; i++) {
      if (galleryImages[i].isLandscape()) this.landscapeImages.push([i, galleryImages[i]]);else this.portraitImages.push([i, galleryImages[i]]);
    }
  }
  ImageIterator.prototype.hasPortrait = function () {
    return this.portraitIndex < this.portraitImages.length;
  };
  ImageIterator.prototype.hasLandscape = function () {
    return this.landscapeIndex < this.landscapeImages.length;
  };
  ImageIterator.prototype.hasNext = function () {
    return this.hasPortrait() || this.hasLandscape();
  };
  ImageIterator.prototype.nextPortrait = function () {
    if (this.hasPortrait()) return this.portraitImages[this.portraitIndex++][1];
    return this.next();
  };
  ImageIterator.prototype.nextLandscape = function () {
    if (this.hasLandscape()) return this.landscapeImages[this.landscapeIndex++][1];
    return this.next();
  };
  ImageIterator.prototype.peekPortrait = function () {
    if (this.hasPortrait()) return this.portraitImages[this.portraitIndex][1];
    return null;
  };
  ImageIterator.prototype.peekLandscape = function () {
    if (this.hasLandscape()) return this.landscapeImages[this.portraitIndex][1];
    return null;
  };
  ImageIterator.prototype.peek = function () {
    if (!this.hasNext()) return null;
    var hasPortrait = this.hasPortrait();
    var hasLandscape = this.hasLandscape();
    var _a = hasPortrait ? this.portraitImages[this.portraitIndex] : [Infinity, null],
      pi = _a[0],
      portraitImage = _a[1];
    var _b = hasLandscape ? this.landscapeImages[this.landscapeIndex] : [Infinity, null],
      li = _b[0],
      landscapeImage = _b[1];
    if (pi < li) return portraitImage;
    if (li < pi) return landscapeImage;
    throw Error('this should not happen');
  };
  ImageIterator.prototype.next = function () {
    if (!this.hasNext()) return null;
    var galleryImage = this.peek();
    if (galleryImage.isLandscape()) this.landscapeIndex++;else this.portraitIndex++;
    return galleryImage;
  };
  return ImageIterator;
}();
var ImagePlacement = /** @class */function () {
  function ImagePlacement(image, column, columnWidth) {
    this.image = image;
    this.column = column;
    this.columnWidth = columnWidth;
  }
  return ImagePlacement;
}();
var ImageTopDownPositioner = /** @class */function () {
  function ImageTopDownPositioner(columns, columnSize, paddingPixels) {
    this.columns = columns;
    this.columnSize = columnSize;
    this.paddingPixels = paddingPixels;
    this.yOffsets = [];
    for (var i = 0; i < this.columns; i++) this.yOffsets.push(0);
  }
  ImageTopDownPositioner.prototype.getColumn = function () {
    var minColumn = 0;
    var minOffset = Infinity;
    for (var i = 0; i < this.columns; i++) {
      var yOffset = this.yOffsets[i];
      if (yOffset < minOffset) {
        minOffset = yOffset;
        minColumn = i;
      }
    }
    return minColumn;
  };
  ImageTopDownPositioner.prototype.getPosition = function (column, columnWidth) {
    return [column * (this.columnSize + this.paddingPixels), columnWidth == 1 // y/top
    ? this.yOffsets[column] : Math.max(this.yOffsets[column], column + 1 < this.yOffsets.length ? this.yOffsets[column + 1] : 0)];
  };
  ImageTopDownPositioner.prototype.getTotalHeight = function () {
    return Math.max(0, Math.max.apply(Math, this.yOffsets)) + this.paddingPixels;
  };
  ImageTopDownPositioner.prototype.getTop = function (column) {
    return this.yOffsets[column];
  };
  ImageTopDownPositioner.prototype.setTop = function (column, value) {
    this.yOffsets[column] = value;
  };
  ImageTopDownPositioner.prototype.increment = function (column, columnWidth, imageHeight) {
    if (columnWidth == 1 || column + 1 === this.yOffsets.length) {
      this.yOffsets[column] += imageHeight + this.paddingPixels;
    } else if (columnWidth == 2) {
      var maxOffset = Math.max(this.yOffsets[column], this.yOffsets[column + 1]);
      this.yOffsets[column + 0] = maxOffset + imageHeight + this.paddingPixels;
      this.yOffsets[column + 1] = maxOffset + imageHeight + this.paddingPixels;
    }
  };
  ImageTopDownPositioner.prototype.next = function (imageHeight, columnWidth, column) {
    if (column === void 0) {
      column = undefined;
    }
    var column = column !== undefined ? column : this.getColumn();
    var _a = this.getPosition(column, columnWidth),
      left = _a[0],
      top = _a[1];
    this.increment(column, columnWidth, imageHeight);
    return [left, top];
  };
  return ImageTopDownPositioner;
}();
var GalleryImage = /** @class */function () {
  function GalleryImage(element) {
    this.containerElement = element;
    this.aspectRatio = parseFloat(element.getAttribute('data-aspect-ratio'));
  }
  GalleryImage.prototype.determineHeight = function (width) {
    return Math.max(1, width) / this.aspectRatio;
  };
  GalleryImage.prototype.isLandscape = function () {
    return this.aspectRatio > 1.0;
  };
  GalleryImage.prototype.isPortrait = function () {
    return !this.isLandscape();
  };
  GalleryImage.prototype.getOrder = function () {
    var orderValue = this.containerElement.getAttribute('data-order');
    if (typeof orderValue === 'string') {
      return parseInt(orderValue);
    }
    return 0;
  };
  return GalleryImage;
}();
var RenderContext = /** @class */function () {
  function RenderContext(renderer, iterator, positioner, columns) {
    this.renderer = renderer;
    this.iterator = iterator;
    this.positioner = positioner;
    this.columns = columns;
  }
  return RenderContext;
}();

// all renderers work on these base concepts:
var Renderer = /** @class */function () {
  function Renderer(renderStrategy, options) {
    this.options = Object.assign({
      galleryContainerElement: null,
      imageContainerElement: null,
      imageMinWidthPixels: 256,
      paddingPixels: 10,
      allowWideColumnLandscapes: false
    }, options);
    this.renderStrategy = renderStrategy;
    this.galleryContainer = this.options.galleryContainerElement;
    this.imageContainer = this.options.imageContainerElement;
    this.lastPlacementOrder = null;
    this.lastColumnCount = null;
  }
  Renderer.prototype.getImageCount = function () {
    return this.imageContainer.children.length;
  };
  Renderer.prototype.getImages = function () {
    return [].slice.call(this.imageContainer.children).map(function (e) {
      return new GalleryImage(e);
    });
  };
  Renderer.prototype.getImageIterator = function () {
    return new ImageIterator(this.getImages());
  };
  Renderer.prototype.getImagePositioner = function (columns) {
    var padding = this.options.paddingPixels;
    var columnSize = this.determineColumnSize(columns);
    return new ImageTopDownPositioner(columns, columnSize, padding);
  };
  Renderer.prototype.determineGalleryWidth = function () {
    var elementStyle = getComputedStyle(this.imageContainer);
    return parseInt(elementStyle.width);
  };
  Renderer.prototype.determineColumns = function () {
    var galleryWidth = this.determineGalleryWidth();
    return Math.floor(galleryWidth / this.options.imageMinWidthPixels);
  };
  Renderer.prototype.determineColumnSize = function (columns) {
    var galleryWidth = this.determineGalleryWidth();
    var padding = this.options.paddingPixels;
    return (galleryWidth - padding * (columns - 1)) / columns;
  };
  Renderer.prototype.determineImageDimensions = function (galleryImage, columns, columnWidth) {
    var columnSize = this.determineColumnSize(columns);
    var imageWidth = columnWidth == 1 ? columnSize : 2 * columnSize + this.options.paddingPixels;
    var imageHeight = galleryImage.determineHeight(imageWidth);
    return [imageWidth, imageHeight];
  };
  Renderer.prototype.render = function () {
    var columns = this.determineColumns();
    if (this.lastPlacementOrder !== null && columns == this.lastColumnCount) {
      this._render(columns, this.lastPlacementOrder);
    } else {
      this.lastPlacementOrder = this._render(columns);
      this.lastColumnCount = columns;
    }
    var images = this.lastPlacementOrder.map(function (e) {
      return e.image;
    });
    this.lastPlacementOrder = null;
    return images;
  };
  Renderer.prototype._render = function (columns, cachedPlacementOrder) {
    if (cachedPlacementOrder === void 0) {
      cachedPlacementOrder = undefined;
    }
    if (cachedPlacementOrder && cachedPlacementOrder.length !== this.getImageCount()) {
      throw new Error('placementOrder does not contain the same amount of images');
    }
    var positioner = this.getImagePositioner(columns);
    var iterator = this.getImageIterator();
    var ctx = new RenderContext(this, iterator, positioner, columns);
    var placementOrder = [];
    var lastYOffset = 0;
    var amountImages = 0;
    for (var k = 0; iterator.hasNext(); k++) {
      var imagePlacement = null;
      if (cachedPlacementOrder !== undefined) {
        imagePlacement = cachedPlacementOrder[k];
        iterator.next(); // make sure we advance here
      } else {
        var column = positioner.getColumn();
        this.renderStrategy.onNextImage(ctx, column, function (galleryImage, columnWidth, chosenColumn) {
          if (chosenColumn === void 0) {
            chosenColumn = column;
          }
          imagePlacement = new ImagePlacement(galleryImage, chosenColumn, columnWidth);
        });
      }
      var galleryImage = imagePlacement.image;
      var columnWidth = imagePlacement.columnWidth;
      var column = imagePlacement.column;
      var _a = this.determineImageDimensions(galleryImage, columns, columnWidth),
        imageWidth = _a[0],
        imageHeight = _a[1];
      var _b = positioner.next(imageHeight, columnWidth, column),
        x = _b[0],
        y = _b[1];
      placementOrder.push(new ImagePlacement(galleryImage, column, columnWidth));
      var element = galleryImage.containerElement;
      element.style.width = imageWidth + 'px';
      element.style.height = imageHeight + 'px';
      element.style.top = y + 'px';
      element.style.left = x + 'px';
      amountImages++;
      var isNextRow = true;
      for (var i = 0; i < positioner.yOffsets.length; i++) {
        if (positioner.yOffsets[i] <= lastYOffset) {
          isNextRow = false;
          break;
        }
      }
      var placements = [];
      for (var i = placementOrder.length - amountImages; i < placementOrder.length; i++) {
        placements.push(placementOrder[i]);
      }
      var isLastRow = !iterator.hasNext();
      if (isNextRow || isLastRow) {
        //  || isLastRow
        this.renderStrategy.onRowCompleted(ctx, placements, lastYOffset, function (yOffset) {
          lastYOffset = yOffset;
        });
        amountImages = 0;
      }
      if (isLastRow) {
        this.renderStrategy.onLastRow(ctx, placements);
      }
    }
    var maxTop = 0;
    for (var i = 0; i < columns; i++) {
      var top = positioner.getTop(i);
      if (top > maxTop) {
        maxTop = top;
      }
    }
    this.galleryContainer.style.padding = this.options.galleryPaddingPixels + 'px';
    this.imageContainer.style.height = maxTop - this.options.paddingPixels + 'px';
    this.imageContainer.setAttribute('data-columns', columns.toString());
    return placementOrder;
  };
  return Renderer;
}();

// renders images of a column in such a way
// that those in the same row all have the same height,
// making it appear like this is a row-oriented renderer
// (against what the comment says in RenderStrategy.js).
// images will look more organized and less chaotic
// (unlike MixedRenderStrategy).
var RowRenderStrategy = /** @class */function () {
  function RowRenderStrategy() {}
  RowRenderStrategy.prototype.onNextImage = function (ctx, column, callback) {
    var galleryImage = null;
    var columnWidth = 1;
    if (ctx.columns > 1 && column == ctx.columns - 1) {
      // always pick the next portrait in the last column
      // since we always want landscape photos to be wide.
      if (ctx.iterator.peekPortrait() === null) {
        console.log('x', ctx.iterator.peek());
      }
      var portraitPeek = ctx.iterator.peekPortrait();
      if (!portraitPeek || portraitPeek.getOrder() > ctx.iterator.peek().getOrder()) {
        galleryImage = ctx.iterator.next();
      } else {
        galleryImage = ctx.iterator.nextPortrait();
      }
    } else {
      // otherwise just pick the next photo
      galleryImage = ctx.iterator.next();
    }
    if (ctx.renderer.options.allowWideColumnLandscapes && galleryImage.isLandscape() && ctx.columns > 1) {
      columnWidth = 2;
    }
    var chosenColumn = column;
    /*if (galleryImage.containerElement.classList.contains('month-card')) {
      if (ctx.columns > 1 && column == ctx.columns - 1) {
        // chosenColumn = 0;
        // columnWidth = 1;
      }
    }*/
    callback(galleryImage, columnWidth, chosenColumn);
  };
  RowRenderStrategy.prototype.onRowCompleted = function (ctx, placementOrder, yOffset, callback) {
    // formula to determine each photo's height:
    // h=W/(a1+a2+...+an) with W=width of n images next to each other
    // and ai=aspect ratio of a row's image,
    // that height needs to be adapted to the gallery width after.
    var sumAspectRatios = 0;
    var numIncludePadding = 0;
    var totalColumnWidth = 0;
    for (var _i = 0, placementOrder_1 = placementOrder; _i < placementOrder_1.length; _i++) {
      var placement = placementOrder_1[_i];
      sumAspectRatios += placement.image.aspectRatio;
      numIncludePadding += placement.columnWidth == 2 ? 1 : 0;
      totalColumnWidth += placement.columnWidth;
    }
    // make sure we don't add too much padding
    // in case this row is the last row, each column is filled
    // and another column is "added" because the last one is a landscape photo
    // which is two columns wide (thus adding another).
    numIncludePadding -= Math.max(0, totalColumnWidth - ctx.columns);
    var galleryWidth = ctx.renderer.determineGalleryWidth();
    var rowHeight = (galleryWidth - (ctx.columns - 1 - numIncludePadding) * ctx.renderer.options.paddingPixels) / sumAspectRatios;
    if (ctx.columns == 1 && placementOrder[0].image.containerElement.classList.contains('is-text')) {
      rowHeight = 100;
    }
    yOffset += rowHeight + ctx.renderer.options.paddingPixels;
    for (var i = 0; i < ctx.columns; i++) {
      ctx.positioner.setTop(i, yOffset);
    }
    var leftSum = 0;
    for (var _a = 0, placementOrder_2 = placementOrder; _a < placementOrder_2.length; _a++) {
      var placement = placementOrder_2[_a];
      var aspectRatio = placement.image.aspectRatio;
      var rowWidth = aspectRatio * rowHeight;
      if (ctx.columns == 1) {
        rowWidth = galleryWidth;
      }
      placement.image.containerElement.style.height = rowHeight + 'px';
      placement.image.containerElement.style.width = rowWidth + 'px';
      placement.image.containerElement.style.left = leftSum + 'px';
      leftSum += rowWidth + ctx.renderer.options.paddingPixels;
    }
    callback(yOffset, rowHeight);
  };
  RowRenderStrategy.prototype.onLastRow = function (ctx, placementOrder) {
    var minHeight = Infinity;
    var maxHeight = 0;
    for (var _i = 0, placementOrder_3 = placementOrder; _i < placementOrder_3.length; _i++) {
      var placement = placementOrder_3[_i];
      var height = parseFloat(getComputedStyle(placement.image.containerElement).height);
      minHeight = Math.min(height, minHeight);
      maxHeight = Math.max(height, maxHeight);
    }
    // make sure columns aren't too large, especially on the last row
    var columnSize = ctx.renderer.determineColumnSize(ctx.columns);
    for (var _a = 0, placementOrder_4 = placementOrder; _a < placementOrder_4.length; _a++) {
      var placement = placementOrder_4[_a];
      var actualMaxHeight = columnSize * placement.columnWidth / placement.image.aspectRatio;
      minHeight = Math.min(minHeight, actualMaxHeight);
    }
    var subtractLeft = 0;
    for (var _b = 0, placementOrder_5 = placementOrder; _b < placementOrder_5.length; _b++) {
      var placement = placementOrder_5[_b];
      var oldWidth = parseFloat(placement.image.containerElement.style.width);
      var newWidth = minHeight * placement.image.aspectRatio;
      placement.image.containerElement.style.height = minHeight + 'px';
      placement.image.containerElement.style.width = newWidth + 'px';
      var currentLeft = parseFloat(placement.image.containerElement.style.left);
      placement.image.containerElement.style.left = currentLeft - subtractLeft + 'px';
      subtractLeft += Math.max(0, oldWidth - newWidth);
    }
    for (var i = 0; i < ctx.columns; i++) {
      ctx.positioner.setTop(i, ctx.positioner.getTop(i) - maxHeight + minHeight);
    }
  };
  return RowRenderStrategy;
}();
var styling = function () {
  var documentStyle = getComputedStyle(document.documentElement);
  return {
    padding: parseFloat(documentStyle.getPropertyValue('--gallery-padding')),
    borderWidth: parseFloat(documentStyle.getPropertyValue('--gallery-image-border-width'))
  };
}();
function showApp() {
  document.querySelector('#app').classList.remove('blurred');
}
function showAppImmediately() {
  var appElement = document.querySelector('#app');
  var mainElement = appElement.querySelector('#main');
  mainElement.style.transition = 'filter 0s';
  appElement.classList.remove('blurred');
}
// make sure the gallery looks the same on every screen,
// otherwise the individual photos would be much smaller
// on 1440p or 4K monitors.
function normalizedWidthPixels(pixels) {
  var baselineWidth = 1920;
  if (window.screen.width > window.screen.height) {
    return pixels * window.screen.width / baselineWidth;
  }
  return pixels;
}
var Animator = /** @class */function () {
  function Animator(options) {
    this.isAnimating = false;
    this.startTime = null;
    this.animationDurationMillis = options.animationDurationMillis;
    this.easingFunc = options.easingFunc || null;
    // TODO: call this on window resize
    this.onRedraw = options.onRedraw || null;
    this.onAnimationFrame = options.onAnimationFrame;
    this.onFinished = options.onFinished || null;
  }
  Animator.prototype.start = function () {
    if (!this.isAnimating) {
      if (this.onRedraw) {
        this.onRedraw();
      }
      window.requestAnimationFrame(this._render.bind(this));
      this.isAnimating = true;
    }
  };
  Animator.prototype._render = function (time) {
    this.startTime = this.startTime || time;
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
    } else {
      this.isAnimating = false;
      if (this.onFinished) {
        this.onFinished();
      }
    }
  };
  return Animator;
}();

// ease in/out/in-out mathematical helper functions
function easeOutQuart(x) {
  return 1 - Math.pow(1 - x, 4);
}
var navigation = {
  init: init,
  onLeft: onLeft,
  onCenter: onCenter,
  onClose: onClose,
  onRight: onRight,
  showLeft: showLeft,
  showRight: showRight,
  getCurrentLiveText: getCurrentLiveText,
  setLiveText: setLiveText
};
var noop = function noop() {};
var callbacks = {
  left: {
    cb: noop
  },
  center: {
    cb: noop
  },
  right: {
    cb: noop
  },
  close: {
    cb: noop
  }
};
var navigation$1 = document.querySelector('#navigation');
// var liveTextElement: HTMLElement = document.querySelector('.live-title-content')
function init() {
  var menuLinks = document.querySelectorAll('a.button');
  menuLinks.forEach(function (element) {
    element.addEventListener('mousedown', function (e) {
      if (e.buttons !== 1) return;
      this.classList.add('mouse-down');
    });
    element.addEventListener('mouseup', function (e) {
      this.classList.remove('mouse-down');
    });
    element.addEventListener('click', function (e) {
      this.classList.remove('mouse-down');
    });
  });
  function registerButton(element, callbackObject) {
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
      if (element.classList.contains('invisible')) return;
      if (e.buttons !== 1) return;
      callbackObject.cb();
    });
    element.addEventListener('mousedown', function (e) {
      e.preventDefault();
      if (element.classList.contains('invisible')) return;
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

    element.addEventListener('keydown', function (e) {
      //clearTimeouts();
      if (element.classList.contains('invisible')) return;
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

  var buttons = [[navigation$1.querySelector('.action-left'), callbacks.left], [navigation$1.querySelector('.action-center'), callbacks.center], [navigation$1.querySelector('.action-right'), callbacks.right], [document.querySelector('.action-close'), callbacks.close]];
  buttons.forEach(function (args) {
    var element = args[0],
      callbackObject = args[1];
    registerButton(element, callbackObject);
  });
}
function onLeft(cb) {
  callbacks.left.cb = cb;
}
function onCenter(cb) {
  callbacks.center.cb = cb;
}
function onRight(cb) {
  callbacks.right.cb = cb;
}
function onClose(cb) {
  callbacks.close.cb = cb;
}
var currentLiveText = "";
var nextLiveArgs = null;
var isAnimating = false;
function getCurrentLiveText() {
  return currentLiveText;
}
function setLiveText(text, animateDown, _onAnimationFrame, onAnimationDone) {
  if (animateDown === void 0) {
    animateDown = true;
  }
  if (_onAnimationFrame === void 0) {
    _onAnimationFrame = function onAnimationFrame() {};
  }
  if (onAnimationDone === void 0) {
    onAnimationDone = function onAnimationDone() {};
  }
  if (!animateDown) {
    document.querySelector('.live-title-content').innerText = text;
    currentLiveText = text;
    return;
  }
  if (currentLiveText === text) {
    return;
  }
  if (isAnimating) {
    nextLiveArgs = [text, animateDown, _onAnimationFrame, onAnimationDone];
    return;
  }
  currentLiveText = text;
  var menuElement = document.querySelector('.menu.center');
  var animationHeight = menuElement.clientHeight * 1.5;
  var firstLiveTextElement = document.querySelector('.live-title-content');
  var secondLiveTextElement = firstLiveTextElement.cloneNode(true);
  firstLiveTextElement.classList.add('animating');
  secondLiveTextElement.classList.add('animating');
  if (animateDown) {
    firstLiveTextElement.before(secondLiveTextElement);
    secondLiveTextElement.style.marginTop = -animationHeight + 'px';
    secondLiveTextElement.innerText = text;
  } else {
    firstLiveTextElement.after(secondLiveTextElement);
    secondLiveTextElement.style.marginTop = animationHeight + 'px';
    firstLiveTextElement.innerText = text;
  }
  var animation = new Animator({
    animationDurationMillis: 500,
    easingFunc: easeOutQuart,
    onAnimationFrame: function onAnimationFrame(progress) {
      if (!animateDown) {
        progress = 1 - progress;
      }
      secondLiveTextElement.style.marginTop = (1 - progress) * -animationHeight + 'px';
      firstLiveTextElement.style.marginTop = progress * animationHeight + 'px';
      _onAnimationFrame(progress);
    },
    onFinished: function onFinished() {
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
function showLeft(visible) {
  if (visible === void 0) {
    visible = true;
  }
  var element = navigation$1.querySelector('.action-left');
  if (visible) {
    element.classList.remove('invisible');
    element.tabIndex = 0;
  } else {
    element.classList.add('invisible');
    element.tabIndex = -1;
  }
}
function showRight(visible) {
  if (visible === void 0) {
    visible = true;
  }
  var element = navigation$1.querySelector('.action-right');
  if (visible) {
    element.classList.remove('invisible');
    element.tabIndex = 0;
  } else {
    element.classList.add('invisible');
    element.tabIndex = -1;
  }
}
var scrolling = {
  init: init$1,
  isCancelMouseClick: isCancelMouseClick
};
var config$1 = {
  onScrollUpdateFrequencyMillis: 250,
  scrollIntoViewPaddingPixels: 0 + 10 // 10
};

var onScrollListeners = [];
var lastOnScrollUpdate = 0;
function addScrollListener(listener) {
  onScrollListeners.push(listener);
}
function triggerOnScrollListeners(y, height, targetDistance) {
  for (var _i = 0, onScrollListeners_1 = onScrollListeners; _i < onScrollListeners_1.length; _i++) {
    var listener = onScrollListeners_1[_i];
    listener(y, height, targetDistance);
  }
}
var maxScrollStepPixels = 150; // 120
var scrollDuration = 1000;
var scrollComparisonEpsilon = 0.001;
var scrollRootElement = document.querySelector('#app');
var scrollElement = document.querySelector('#main');
var pageScrollEasingFunc = easeOutQuart; // easeInOutCirc;
// var pageScrollEasingFuncInverse = easeOutQuintInverse;
var currentScrollPosition = 0;
var currentScrollTarget = currentScrollPosition;
var handlePageScroll = null;
var handlePageResize = null;
// state variables during smooth scrolling
// reset these if scrolling is finished
var isScrolling = false;
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
  var targetY = rect.y - awayFromTop - config$1.scrollIntoViewPaddingPixels; // - rootY - awayFromTop;
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
function getKeyboardFocusableElements(element) {
  if (element === void 0) {
    element = document.documentElement;
  }
  return Array.from(element.querySelectorAll('a, button, input, textarea, select, details,[tabindex]:not([tabindex="-1"])')).filter(function (el) {
    return !el.hasAttribute('disabled');
  });
}
var doCancelMouseClick = false;
function isCancelMouseClick() {
  return doCancelMouseClick;
}
function init$1() {
  var appElement = document.querySelector('#app');
  var mainElement = document.querySelector('#main');
  var isMouseDown = false;
  var wasWindowBlur = false;
  var wasWindowBlurThenFocus = false;
  document.addEventListener('mousedown', function () {
    isMouseDown = true;
  });
  document.addEventListener('mousemove', function () {
    isMouseDown = false;
  });
  document.addEventListener('mouseup', function () {
    isMouseDown = false;
  });
  window.addEventListener('blur', function () {
    wasWindowBlur = true;
  });
  window.addEventListener('focus', function () {
    wasWindowBlurThenFocus = wasWindowBlur;
    wasWindowBlur = false;
    this.setTimeout(function () {
      wasWindowBlurThenFocus = false;
    }, 1 / 60);
  });
  var focusableElements = getKeyboardFocusableElements();
  for (var _i = 0, focusableElements_1 = focusableElements; _i < focusableElements_1.length; _i++) {
    var element = focusableElements_1[_i];
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
  var getContentHeight = function getContentHeight() {
    return scrollElement.clientHeight + parseInt(getComputedStyle(scrollRootElement).paddingTop) + parseInt(getComputedStyle(scrollRootElement).paddingBottom);
  };
  var getPageHeight = function getPageHeight() {
    return scrollRootElement.clientHeight;
  };
  var getMaxScroll = function getMaxScroll() {
    return getContentHeight() - getPageHeight();
  };
  var limitScrollValue = function limitScrollValue(value) {
    return Math.max(0, Math.min(value, getMaxScroll()));
  };
  var isAboutEqual = function isAboutEqual(a, b) {
    return Math.abs(a - b) < scrollComparisonEpsilon;
  };
  var setScrollOffset = function setScrollOffset(offset) {
    currentScrollPosition = offset;
    var offsetString = offset.toFixed(18);
    scrollElement.style.transform = "translateY(-".concat(offsetString, "px)");
  };
  // runs continuously
  var updateScroll = function updateScroll(timestamp) {
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
    var newOffset = startScrollPosition + (currentScrollTarget - startScrollPosition) * pageScrollEasingFunc(timeElapsed / scrollDuration);
    // console.log(timeElapsed / scrollDuration, pageScrollEasingFunc(timeElapsed / scrollDuration), pageScrollEasingFuncInverse(pageScrollEasingFunc(timeElapsed / scrollDuration)));
    // scroll to the calculated offset
    var prettyMuchThere = isAboutEqual(newOffset, currentScrollTarget);
    setScrollOffset(prettyMuchThere ? currentScrollTarget : newOffset);
    var targetDistance = currentScrollTarget - currentScrollPosition;
    var now = Date.now();
    if (lastOnScrollUpdate + config$1.onScrollUpdateFrequencyMillis < now) {
      triggerOnScrollListeners(currentScrollPosition, getMaxScroll(), targetDistance);
      lastOnScrollUpdate = now;
    }
    // continue scrolling if there is more to scroll
    if (!prettyMuchThere && timeElapsed <= scrollDuration) {
      window.requestAnimationFrame(updateScroll);
    } else {
      isScrolling = false;
      startScrollPosition = undefined;
      startTime = undefined;
      // trigger them at the end of the scroll as well
      triggerOnScrollListeners(currentScrollPosition, getMaxScroll(), targetDistance);
    }
  };
  handlePageScroll = function handlePageScroll(deltaY, limitScroll) {
    if (limitScroll === void 0) {
      limitScroll = true;
    }
    // update the scroll target
    // flip sign, as scrolling down gives a negative delta
    var direction = Math.sign(deltaY);
    var stepPixels = Math.abs(deltaY);
    if (limitScroll) stepPixels = Math.min(maxScrollStepPixels, stepPixels); // Math.abs(deltaY); // Math.min(maxScrollStepPixels, Math.abs(deltaY) * 2);
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
    isScrolling = true;
    return true;
  };
  // add a little bit of delay to do less processing than necessary
  // resizing quickly doesn't need an instant response
  var resizeHandlerDelay = 10;
  var resizeTimeout = null;
  var onResize = function onResize(e) {
    currentScrollTarget = limitScrollValue(currentScrollTarget);
    setScrollOffset(currentScrollTarget);
  };
  handlePageResize = function handlePageResize(e) {
    if (resizeTimeout != null) {
      clearTimeout(resizeTimeout);
      resizeTimeout = null;
    }
    resizeTimeout = setTimeout(function () {
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

  var resizeHandlers = [handlePageResize];
  var maxUpdatesPerSecond = 20;
  var lastUpdate = null;
  var accumulatedDeltaY = 0;
  var lastDeltaY = 0;
  var nextTimeout = null;
  var handleScrollEvent = function handleScrollEvent(deltaY) {
    if (appElement.classList.contains('blurred')) {
      return;
    }
    var handleScroll = function handleScroll() {
      // e.preventDefault();
      for (var _i = 0, scrollHandlers_1 = scrollHandlers; _i < scrollHandlers_1.length; _i++) {
        var scrollHandler = scrollHandlers_1[_i];
        var hasScrolled = scrollHandler(accumulatedDeltaY);
        if (hasScrolled !== true && hasScrolled !== false) {
          console.warn('a scroll handler must return a boolean value');
        }
        if (hasScrolled) {
          break;
        }
      }
      accumulatedDeltaY = 0;
    };
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
      var delay = 1000 / maxUpdatesPerSecond;
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
  var handleDragStart = function handleDragStart(x, y) {
    lastMouseDownCoords = [x, y];
  };
  mainElement.addEventListener('mousedown', function (e) {
    if (e.buttons === 1) {
      handleDragStart(e.clientX, e.clientY);
    }
  });
  mainElement.addEventListener('touchstart', function (e) {
    if (e.touches.length == 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  });
  var getSquaredTravelDistance = function getSquaredTravelDistance(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return dx * dx + dy * dy;
  };
  var isSquaredDistanceSmaller = function isSquaredDistanceSmaller(x1, y1, x2, y2, targetDistance) {
    var distanceSquared = getSquaredTravelDistance(x1, y1, x2, y2);
    var targetDistanceSquared = targetDistance * targetDistance;
    return targetDistanceSquared < distanceSquared;
  };
  var handleDragEnd = function handleDragEnd(x, y) {
    if (lastMouseDownCoords == null) {
      return;
    }
    lastMouseUpCoords = [x, y];
    var downX = lastMouseDownCoords[0],
      downY = lastMouseDownCoords[1];
    var upX = lastMouseUpCoords[0],
      upY = lastMouseUpCoords[1];
    if (isSquaredDistanceSmaller(downX, downY, upX, upY, distancePixelsThresholdCancelClick)) {
      doCancelMouseClick = true;
    }
  };
  mainElement.addEventListener('mouseup', function (e) {
    handleDragEnd(e.clientX, e.clientY);
  });
  mainElement.addEventListener('touchend', function (e) {
    if (e.touches.length == 1) {
      handleDragEnd(e.touches[0].clientX, e.touches[0].clientY);
    }
    resetDrag();
  });
  var handleDragMove = function handleDragMove(x, y, isTouch) {
    if (isTouch === void 0) {
      isTouch = false;
    }
    if (lastMouseDownCoords === null) {
      return;
    }
    if (lastMouseMoveCoords === null) {
      lastMouseMoveCoords = lastMouseDownCoords;
    }
    var downX = lastMouseMoveCoords[0],
      downY = lastMouseMoveCoords[1];
    var _a = [x, y],
      x = _a[0],
      y = _a[1];
    var deltaY = -1 * (y - downY);
    if (Math.abs(deltaY) === 0) {
      return;
    }
    if (isTouch) {
      deltaY *= dragDeltaMultiplierTouch;
    } else {
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
  mainElement.addEventListener('mousemove', function (e) {
    handleDragMove(e.clientX, e.clientY);
  });
  mainElement.addEventListener('touchmove', function (e) {
    if (e.touches.length == 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY, true);
    }
  });
  var resetDrag = function resetDrag() {
    lastMouseDownCoords = null;
    lastMouseUpCoords = null;
    lastMouseMoveCoords = null;
    doCancelMouseClick = false;
    document.getElementById('app').classList.remove('default-cursor');
  };
  mainElement.addEventListener('click', function (e) {
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
  mainElement.addEventListener('wheel', function (e) {
    handleScrollEvent(e.deltaY);
  });
  window.addEventListener('resize', function (e) {
    for (var _i = 0, resizeHandlers_1 = resizeHandlers; _i < resizeHandlers_1.length; _i++) {
      var resizeHandler = resizeHandlers_1[_i];
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

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}
var gallery = {
  init: init$2
};
var galleryManager = new GalleryManager();
var config$2 = {
  imageMinWidthPixels: 300,
  hideNavigationArrowIfScrollLessThan: 16.0,
  monthCardAspectRatio: 2 / 3,
  rowVisiblePercentage: 1 / 2,
  scrollToOffsetTopPaddingPixels: 10,
  scrollToOffsetTopPixels: function () {
    return document.querySelector('#navigation').clientHeight;
  }()
};
function isGalleryVisible() {
  return !document.querySelector('#app').classList.contains('viewer');
}
function determineCurrentKey(minIndex) {
  var galleryElement = document.querySelector('.gallery');
  var images = galleryElement.querySelectorAll('.image-container');
  var targetElement = null;
  var elements = Array.from(images);
  for (var _i = 0, elements_1 = elements; _i < elements_1.length; _i++) {
    var element = elements_1[_i];
    var rect = element.getBoundingClientRect();
    var yValue = rect.y;
    if (yValue + rect.height * config$2.rowVisiblePercentage - config$2.scrollToOffsetTopPixels > 0) {
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
  }
  if (targetElement === null) {
    if (elements.length == 0) {
      return null;
    }
    targetElement = elements[elements.length - 1];
  }
  return [targetElement, targetElement.getAttribute('data-key')];
}
function selectorForKey(key, additionalSelector) {
  if (additionalSelector === void 0) {
    additionalSelector = '';
  }
  return ".image-container".concat(additionalSelector, "[data-key=\"").concat(key, "\"]");
}
function getTextForKey(key) {
  var month = toTitleCase(key);
  var keyImages = document.querySelectorAll(selectorForKey(key, ':not(.month-card)'));
  var numberOfPhotos = keyImages.length;
  return "".concat(month, " \u2013 ").concat(numberOfPhotos, " photo").concat(numberOfPhotos === 1 ? '' : 's');
}
// find's the first element that has the same key, a previous key or the next key.
// if direction == 0: find's the first sibling element with the same key.
// if direction < 0: find's the first sibling element with a key
//  that is different from the starting element's key going backward.
// if direction > 0: same as before, just going forward.
function firstKeyElement(startElement, direction) {
  direction = Math.sign(direction);
  var nextSibling = function nextSibling(e) {
    return direction <= 0 ? e.previousElementSibling : e.nextElementSibling;
  };
  var doReturn = false;
  var element = startElement;
  while (nextSibling(element) != null) {
    var sibling = nextSibling(element);
    if (sibling.getAttribute('data-key') != element.getAttribute('data-key')) {
      switch (direction) {
        case 0:
          return element;
        case 1:
          return sibling;
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
function indexOfElementInParent(element) {
  return Array.from(element.parentElement.children).indexOf(element);
}
var lastNavigationElement = null;
var lastArrowVisibleState = [false, false];
var lastScrolledElement = null;
var isScrollFinished = true;
function updateNavigation(preventArrowsVisible) {
  if (preventArrowsVisible === void 0) {
    preventArrowsVisible = false;
  }
  if (!isGalleryVisible()) return;
  var minIndex = 0;
  if (lastScrolledElement !== null) {
    minIndex = indexOfElementInParent(lastScrolledElement);
  }
  var _a = determineCurrentKey(minIndex),
    element = _a[0],
    key = _a[1];
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
    navigation.setLiveText(getTextForKey(key), animateDown, function () {
      if (isGalleryVisible()) {
        navigation.showLeft(false);
        navigation.showRight(false);
      }
    }, function () {
      if (isGalleryVisible()) {
        var showLeft$$1 = lastArrowVisibleState[0],
          showRight$$1 = lastArrowVisibleState[1];
        navigation.showLeft(showLeft$$1);
        navigation.showRight(showRight$$1);
      }
    });
  } else {
    navigation.setLiveText(getTextForKey(key), animateDown);
  }
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
  var showLeft$$1 = lastArrowVisibleState[0],
    showRight$$1 = lastArrowVisibleState[1];
  navigation.showLeft(showLeft$$1);
  navigation.showRight(showRight$$1);
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
  });
}
function init$2() {
  renderGalleries();
  updateNavigation(true);
  var previousDirection = null;
  addScrollListener(function (y, height, targetDistance) {
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
      } else if (targetDistance < 0 && rect.y > rect.height / 2) {
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
    if (y < config$2.hideNavigationArrowIfScrollLessThan) {
      navigation.showLeft(false);
    }
    if (y > height - config$2.hideNavigationArrowIfScrollLessThan) {
      navigation.showRight(false);
    }
  });
  window.addEventListener('resize', function () {
    updateNavigation();
  });
}
function finalizeImageOrder(galleryElement) {
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
  galleryManager.registerRendererFactory(function (galleryElement) {
    var galleryContainer = galleryElement.parentElement;
    if (!galleryContainer.classList.contains('gallery-container')) {
      throw new Error('gallery parent must be a gallery-container');
    }
    // TODO
    // get this from the element's data attribute
    var renderStrategy = new RowRenderStrategy();
    var imageMinWidthPixels = config$2.imageMinWidthPixels; // 300
    var allowWideColumnLandscapes = true;
    return new Renderer(renderStrategy, {
      galleryContainerElement: galleryContainer,
      imageContainerElement: galleryElement,
      imageMinWidthPixels: normalizedWidthPixels(imageMinWidthPixels),
      paddingPixels: styling.padding,
      galleryPaddingPixels: styling.padding - styling.borderWidth,
      allowWideColumnLandscapes: allowWideColumnLandscapes
    });
  });
  galleryManager.registerImageLoader(function (image, isLast, cb) {
    // check if the first row is loaded (this is the image of a next row)
    // and show the app if that is the case
    var imageContainer = image.parentElement;
    var top = parseFloat(getComputedStyle(imageContainer).top);
    if (top > 0) {
      showApp();
    }
    var loadNext = function loadNext() {
      if (isLast) {
        // make sure to show the app if this was the last image
        showApp();
      }
      cb();
    };
    image.addEventListener('load', function (e) {
      this.parentElement.classList.remove('not-loaded');
      loadNext();
    });
    image.addEventListener('error', function (e) {
      loadNext();
    });
    // console.log(image, image.getAttribute('data-src'));
    image.src = image.getAttribute('data-src');
  });
  var galleries = document.querySelectorAll('.gallery');
  // first add an element before each image which depicts its month
  for (var _i = 0, _a = Array.from(galleries); _i < _a.length; _i++) {
    var galleryElement = _a[_i];
    // createMonthCards(galleryElement);
    finalizeImageOrder(galleryElement);
  }
  if (galleries.length > 0) galleryManager.renderAll(galleries);else
    // show the app immediately in case there are no galleries
    showAppImmediately();
}

// source: http://detectmobilebrowsers.com/
function isMobile() {
  var a = navigator.userAgent || navigator.vendor || window['opera'];
  return /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4));
}
var viewer = {
  init: init$3
};
var config$3 = {
  animationSpeedMillis: 150,
  animationNextMoveDistanceMultiplier: 0.1
};
function initialViewerState() {
  return {
    visible: false,
    imageElement: null,
    viewerElement: null
  };
}
var viewerState = initialViewerState();
function init$3() {
  var viewerElement = document.querySelector('#viewer');
  var viewerContentElement = viewerElement.querySelector('.viewer-content');
  var resizeListeners = {};
  var resizeListenerKey = 0;
  window.addEventListener('resize', function () {
    for (var _i = 0, _a = Object.entries(resizeListeners); _i < _a.length; _i++) {
      var _b = _a[_i],
        _ = _b[0],
        callback = _b[1];
      var fn = callback;
      fn();
    }
  });
  function addImageToViewer(fromImageContainer) {
    /*
    <div class="viewer-image">
      <div class="viewer-image-container">
        <img src="/media/large/10463/P1013642.jpg">
      </div>
    </div>
    */
    var imageElement = fromImageContainer.querySelector('img');
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
      var lastChild = children.item(children.length - 1);
      zIndex = parseInt(getComputedStyle(lastChild).zIndex) - 1;
    }
    div1.style.zIndex = zIndex.toString();
    viewerContentElement.append(div1);
    updateViewerLiveTitle(fromImageContainer);
    return div1;
  }
  function animateImage(element, targetElement, direction) {
    if (direction === void 0) {
      direction = 1;
    }
    var imageContainer = element.querySelector('.viewer-image-container');
    var imageElement = element.querySelector('img');
    var targetWidth = targetElement.querySelector('img').getBoundingClientRect().width;
    var resizeKey = resizeListenerKey++;
    var easingFunc = easeOutQuart;
    element.classList.add('animating');
    if (direction > 0) {
      element.style.left = 0 .toString();
    } else {
      element.style.right = 0 .toString();
    }
    var animation = new Animator({
      animationDurationMillis: (direction < 1 ? 2 : 1) * config$3.animationSpeedMillis,
      easingFunc: easingFunc,
      onRedraw: function onRedraw() {
        var parent = element.parentElement;
        var parentWidth = parent.clientWidth;
        var maxWidth = Math.max(imageElement.clientWidth, targetWidth);
        var elementWidth = maxWidth + 2 * styling.borderWidth;
        var elementOffset = (parentWidth - maxWidth) / 2 - styling.borderWidth;
        element.style.width = elementWidth + 'px';
        if (direction > 0) {
          element.style.left = elementOffset + 'px';
          imageContainer.style.marginLeft = -1 * elementOffset + 'px';
        }
      },
      onAnimationFrame: function onAnimationFrame(progress, linearProgress) {
        // var moveProgress = easingFunc(Math.min(1, linearProgress * 1.0));
        var maxWidth = Math.max(imageElement.clientWidth, targetWidth);
        var targetImage = targetElement.querySelector('img');
        if (direction > 0) {
          element.style.width = (1 - progress) * maxWidth + 'px';
          targetImage.style.marginRight = -1 * (1 - progress) * maxWidth * config$3.animationNextMoveDistanceMultiplier + 'px';
        }
        if (direction < 0) {
          var borderWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--viewer-image-border-width'));
          var contentWidth = viewerContentElement.getBoundingClientRect().width; //- 2 * borderWidth;
          var thatWidth = (1 - progress) * contentWidth;
          element.style.width = thatWidth + 'px';
          imageContainer.style.marginLeft = -(contentWidth - thatWidth) + 'px';
          targetImage.style.marginRight = -Math.sign(direction) * (1 - progress) * thatWidth * config$3.animationNextMoveDistanceMultiplier / 2 + 'px';
        }
      },
      onFinished: function onFinished() {
        // element.classList.remove('animating');
        element.parentElement.removeChild(element);
        delete resizeListeners[resizeKey];
        if (targetElement && targetElement.parentElement.children.length === 1) {
          targetElement.style.zIndex = 0 .toString();
        }
      }
    });
    // setTimeout(() => animation.start(), 500)
    resizeListeners[resizeKey] = function onResize() {
      animation.onRedraw();
    };
    animation.start();
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
  function preloadViewerImageFrom(imageContainerElement) {
    var img = document.createElement('img');
    img.onload = function () {
      // console.log('preloaded');
    };
    img.src = imageContainerElement.querySelector('img').getAttribute('data-viewer-src');
  }
  function clearViewer() {
    for (var _i = 0, _a = Array.from(viewerContentElement.children); _i < _a.length; _i++) {
      var element = _a[_i];
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
  function updateViewerLiveTitle(imageContainer) {
    var children = Array.from(document.querySelector('#gallery .gallery').children).filter(function (x) {
      return x.getAttribute('data-order') == imageContainer.getAttribute('data-order');
    });
    navigation.setLiveText(toTitleCase(imageContainer.getAttribute('data-key')) + " \u2012 " + (children.indexOf(imageContainer) + 1) + ' of ' + children.length, false);
  }
  function showViewer(imageContainer) {
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
  function nextImage() {
    if (!viewerState.imageElement) return null;
    return viewerState.imageElement.nextElementSibling || null;
  }
  function previousImage() {
    if (!viewerState.imageElement) return null;
    return viewerState.imageElement.previousElementSibling || null;
  }
  function hasNextImage() {
    return !!nextImage();
  }
  function hasPreviousImage() {
    return !!previousImage();
  }
  function showPreviousImage() {
    if (!hasPreviousImage()) return;
    var currentImage = viewerState.imageElement;
    var currentViewerElement = viewerState.viewerElement;
    var nextImageElement = currentImage.previousElementSibling;
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
    var nextImageElement = currentImage.nextElementSibling;
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
  for (var _i = 0, _a = Array.from(galleries); _i < _a.length; _i++) {
    var gallery = _a[_i];
    var imageContainers = gallery.querySelectorAll('.image-container');
    for (var _b = 0, _c = Array.from(imageContainers); _b < _c.length; _b++) {
      var imageContainer = _c[_b];
      imageContainer.addEventListener('click', function (e) {
        e.preventDefault();
        if (!scrolling.isCancelMouseClick()) {
          showViewer(this);
        }
      });
      imageContainer.addEventListener('dragstart', function (e) {
        e.preventDefault();
      });
    }
  }
  window.addEventListener('keydown', function (e) {
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
  document.addEventListener('wheel', function (e) {
    if (e.deltaY < 0) {
      showPreviousImage();
    } else {
      showNextImage();
    }
  });
}
navigation.init();
gallery.init();
viewer.init();
if (!isMobile()) {
  scrolling.init();
} else {
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