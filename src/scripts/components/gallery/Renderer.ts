// all renderers work on these base concepts:
// - their rendering is column-oriented
// - they attempt to maximize the amount of columns
//   while keeping each image's above a certain minimum threshold
// - the padding between photos must be consistent i.e. no empty areas
// - the images are added to the gallery from top to bottom
// - the renderer does its best to preserve the order of the photos
// - not every renderer can guarantee the same order of photos though
// - it is assumed that the photos in the gallery aren't ever updated
//   during the lifetime of the gallery

import { ImageIterator } from "./ImageIterator";
import { ImagePlacement } from "./ImagePlacement";
import { ImageTopDownPositioner } from "./ImageTopDownPositioner";
import { GalleryImage } from "./GalleryImage"
import { RenderStrategy } from "./RenderStrategy";
import { RenderContext } from "./RenderContext";
import { RenderOptions } from "./RenderOptions";

export class Renderer {
  renderStrategy: RenderStrategy
  galleryContainer: HTMLElement
  imageContainer: HTMLElement
  lastPlacementOrder: ImagePlacement[]
  lastColumnCount: number
  options: RenderOptions

  constructor(renderStrategy: RenderStrategy, options: RenderOptions) {
    this.options = Object.assign({
      galleryContainerElement: null,
      imageContainerElement: null,
      imageMinWidthPixels: 256,
      paddingPixels: 10,
      allowWideColumnLandscapes: false,
    }, options);
    this.renderStrategy = renderStrategy;
    this.galleryContainer = this.options.galleryContainerElement;
    this.imageContainer = this.options.imageContainerElement;
    this.lastPlacementOrder = null;
    this.lastColumnCount = null;
  }

  getImageCount(): number {
    return this.imageContainer.children.length;
  }

  getImages(): GalleryImage[] {
    return [].slice.call(this.imageContainer.children)
      .map((e: HTMLElement) => new GalleryImage(e))
  }

  getImageIterator(): ImageIterator {
    return new ImageIterator(this.getImages());
  }

  getImagePositioner(columns: number): ImageTopDownPositioner {
    var padding = this.options.paddingPixels;
    var columnSize = this.determineColumnSize(columns);
    return new ImageTopDownPositioner(columns, columnSize, padding);
  }

  determineGalleryWidth(): number {
    var elementStyle = getComputedStyle(this.imageContainer);
    return parseInt(elementStyle.width);
  }

  determineColumns(): number {
    var galleryWidth = this.determineGalleryWidth();
    return Math.floor(galleryWidth / this.options.imageMinWidthPixels);
  }

  determineColumnSize(columns: number): number {
    var galleryWidth = this.determineGalleryWidth();
    var padding = this.options.paddingPixels;
    return (galleryWidth - padding * (columns - 1)) / columns;
  }

  determineImageDimensions(
    galleryImage: GalleryImage,
    columns: number,
    columnWidth: number
  ): [number, number] {
    var columnSize = this.determineColumnSize(columns);
    var imageWidth = columnWidth == 1
      ? columnSize
      : 2 * columnSize + this.options.paddingPixels;
    var imageHeight = galleryImage.determineHeight(imageWidth);
    return [imageWidth, imageHeight];
  }

  render(): GalleryImage[] {
    var columns = this.determineColumns();

    if (this.lastPlacementOrder !== null && columns == this.lastColumnCount) {
      this._render(columns, this.lastPlacementOrder);
    }
    else {
      this.lastPlacementOrder = this._render(columns);
      this.lastColumnCount = columns;
    }

    var images = this.lastPlacementOrder.map((e: ImagePlacement) => e.image);
    this.lastPlacementOrder = null;

    return images
  }

  _render(
    columns: number,
    cachedPlacementOrder: ImagePlacement[] = undefined
  ): ImagePlacement[] {
    if (cachedPlacementOrder && cachedPlacementOrder.length !== this.getImageCount()) {
      throw new Error('placementOrder does not contain the same amount of images');
    }

    var positioner = this.getImagePositioner(columns);
    var iterator = this.getImageIterator();
    var ctx = new RenderContext(this, iterator, positioner, columns);

    var placementOrder: ImagePlacement[] = [];

    var lastYOffset = 0;
    var amountImages = 0;

    for (var k = 0; iterator.hasNext(); k++) {

      var imagePlacement: ImagePlacement = null;

      if (cachedPlacementOrder !== undefined) {
        imagePlacement = cachedPlacementOrder[k];
        iterator.next(); // make sure we advance here
      }
      else {
        var column = positioner.getColumn();

        this.renderStrategy.onNextImage(ctx, column, function (galleryImage, columnWidth, chosenColumn = column) {
          imagePlacement = new ImagePlacement(galleryImage, chosenColumn, columnWidth);
        });
      }

      var galleryImage = imagePlacement.image;
      var columnWidth = imagePlacement.columnWidth;
      var column = imagePlacement.column;

      var [imageWidth, imageHeight] = this.determineImageDimensions(galleryImage, columns, columnWidth);

      var [x, y] = positioner.next(imageHeight, columnWidth, column);
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
      var placements: ImagePlacement[] = [];
      for (var i = placementOrder.length - amountImages; i < placementOrder.length; i++) {
        placements.push(placementOrder[i]);
      }

      var isLastRow = !iterator.hasNext();
      if (isNextRow || isLastRow) { //  || isLastRow
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

    this.imageContainer.setAttribute('data-columns', (columns).toString());

    return placementOrder;
  }
}
