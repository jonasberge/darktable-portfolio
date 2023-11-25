// renders images of a column in such a way
// that those in the same row all have the same height,
// making it appear like this is a row-oriented renderer
// (against what the comment says in RenderStrategy.js).
// images will look more organized and less chaotic
// (unlike MixedRenderStrategy).

import { GalleryImage } from "./GalleryImage";
import { ImagePlacement } from "./ImagePlacement";
import { RenderContext } from "./RenderContext";
import { RenderStrategy } from "./RenderStrategy";

export class RowRenderStrategy implements RenderStrategy {

  onNextImage(
    ctx: RenderContext,
    column: number,
    callback: (galleryImage: GalleryImage, columnWidth: number, differentColumn?: number) => void
  ): void {
    var galleryImage: GalleryImage = null;
    var columnWidth = 1;
    if (ctx.columns > 1 && column == ctx.columns - 1) {
      // always pick the next portrait in the last column
      // since we always want landscape photos to be wide.
      if (ctx.iterator.peekPortrait() === null) {
        console.log('x', ctx.iterator.peek());
      }
      var portraitPeek: GalleryImage = ctx.iterator.peekPortrait();
      if (!portraitPeek || portraitPeek.getOrder() > ctx.iterator.peek().getOrder()) {
        galleryImage = ctx.iterator.next();
      } else {
        galleryImage = ctx.iterator.nextPortrait();
      }
    }
    else {
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
  }

  onRowCompleted(
    ctx: RenderContext,
    placementOrder: ImagePlacement[],
    yOffset: number,
    callback: (yOffset: number, rowHeight: number) => void
  ): void {
    // formula to determine each photo's height:
    // h=W/(a1+a2+...+an) with W=width of n images next to each other
    // and ai=aspect ratio of a row's image,
    // that height needs to be adapted to the gallery width after.
    var sumAspectRatios = 0;
    var numIncludePadding = 0;
    var totalColumnWidth = 0;
    for (var placement of placementOrder) {
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
    for (var placement of placementOrder) {
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
  }

  onLastRow(
    ctx: RenderContext,
    placementOrder: ImagePlacement[]
  ): void {
    var minHeight = Infinity;
    var maxHeight = 0;
    for (var placement of placementOrder) {
      var height = parseFloat(getComputedStyle(placement.image.containerElement).height);
      minHeight = Math.min(height, minHeight);
      maxHeight = Math.max(height, maxHeight);
    }
    // make sure columns aren't too large, especially on the last row
    var columnSize = ctx.renderer.determineColumnSize(ctx.columns);
    for (var placement of placementOrder) {
      var actualMaxHeight = columnSize * placement.columnWidth / placement.image.aspectRatio;
      minHeight = Math.min(minHeight, actualMaxHeight);
    }
    var subtractLeft = 0;
    for (var placement of placementOrder) {
      var oldWidth = parseFloat(placement.image.containerElement.style.width);
      var newWidth = minHeight * placement.image.aspectRatio;
      placement.image.containerElement.style.height = minHeight + 'px';
      placement.image.containerElement.style.width = newWidth + 'px';
      var currentLeft = parseFloat(placement.image.containerElement.style.left);
      placement.image.containerElement.style.left = (currentLeft - subtractLeft) + 'px';
      subtractLeft += Math.max(0, oldWidth - newWidth);
    }
    for (var i = 0; i < ctx.columns; i++) {
      ctx.positioner.setTop(i, ctx.positioner.getTop(i) - maxHeight + minHeight);
    }
  }
}
