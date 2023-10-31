import { GalleryImage } from "./GalleryImage";
import { ImagePlacement } from "./ImagePlacement";
import { RenderContext } from "./RenderContext";

export interface RenderStrategy {

  onNextImage(
    ctx: RenderContext,
    column: number,
    callback: (galleryImage: GalleryImage, columnWidth: number, differentColumn?: number) => void
  ): void

  onRowCompleted(
    ctx: RenderContext,
    placementOrder: ImagePlacement[],
    yOffset: number,
    callback: (yOffset: number, rowHeight: number) => void
  ): void

  onLastRow(
    ctx: RenderContext,
    placementOrder: ImagePlacement[]
  ): void
}
