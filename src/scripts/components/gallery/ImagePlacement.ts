import { GalleryImage } from "./GalleryImage";

export class ImagePlacement {
  image: GalleryImage
  column: number
  columnWidth: number

  constructor(image: GalleryImage, column: number, columnWidth: number) {
    this.image = image
    this.column = column
    this.columnWidth = columnWidth
  }
}
