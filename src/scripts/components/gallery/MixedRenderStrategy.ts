// renders images in a mixed fashion,
// containing portrait as well as landscape photos,
// while giving the option to make landscapes two columns wide.
// inherently looks "chaotic" but allows both landscapes and portraits
// to be mixed together while acceptably preserving their order.
// towards the bottom of the gallery there will be less and less
// landscape photos that are two columns wide,
// especially if the aspect ratios of photos vary widely.

import { GalleryImage } from "./GalleryImage";
import { ImagePlacement } from "./ImagePlacement";
import { RenderContext } from "./RenderContext";
import { RenderStrategy } from "./RenderStrategy";

export class MixedRenderStrategy implements RenderStrategy {

  onNextImage(
    ctx: RenderContext,
    column: number,
    callback: (galleryImage: GalleryImage, columnWidth: number, differentColumn?: number) => void
  ): void {
    var galleryImage = null;
    var columnWidth = 1;
    galleryImage = ctx.iterator.next();
    if (ctx.renderer.options.allowWideColumnLandscapes &&
        galleryImage.isLandscape() && column < ctx.columns - 1 &&
        Math.abs(ctx.positioner.getTop(column) - ctx.positioner.getTop(column + 1)) < 1) {
      columnWidth = 2;
    }
    callback(galleryImage, columnWidth);
  }

  onRowCompleted(
    ctx: RenderContext,
    placementOrder: ImagePlacement[],
    yOffset: number,
    callback: (yOffset: number, rowHeight: number) => void
  ): void {}

  onLastRow(
    ctx: RenderContext,
    placementOrder: ImagePlacement[]
  ): void {}
}
