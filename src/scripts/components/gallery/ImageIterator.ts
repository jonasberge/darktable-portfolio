// iterates image elements in a custom order utilizing their aspect ratio.
// the caller can decide if they want to continue in the original image order,
// by simply calling next() all the time, or, if necessary,
// they can request the next portrait or landscape image.
// each call to next(), nextPortrait() and nextLandscape()
// returns the first element that comes in the original image order.

import { GalleryImage } from "./GalleryImage";

export class ImageIterator {
  portraitImages: [number, GalleryImage][]
  landscapeImages: [number, GalleryImage][]
  portraitIndex: number
  landscapeIndex: number

  constructor(galleryImages: GalleryImage[]) {
    this.portraitImages = []
    this.landscapeImages = []
    this.portraitIndex = 0
    this.landscapeIndex = 0
    for (var i = 0; i < galleryImages.length; i++) {
      if (galleryImages[i].isLandscape())
        this.landscapeImages.push([i, galleryImages[i]])
      else
        this.portraitImages.push([i, galleryImages[i]])
    }
  }

  hasPortrait(): boolean {
    return this.portraitIndex < this.portraitImages.length
  }

  hasLandscape(): boolean {
    return this.landscapeIndex < this.landscapeImages.length
  }

  hasNext(): boolean {
    return this.hasPortrait() || this.hasLandscape()
  }

  nextPortrait(): GalleryImage {
    if (this.hasPortrait())
      return this.portraitImages[this.portraitIndex++][1]
    return this.next()
  }

  nextLandscape(): GalleryImage {
    if (this.hasLandscape())
      return this.landscapeImages[this.landscapeIndex++][1]
    return this.next()
  }

  peekPortrait(): GalleryImage {
    if (this.hasPortrait())
      return this.portraitImages[this.portraitIndex][1];
    return null;
  }

  peekLandscape(): GalleryImage {
    if (this.hasLandscape())
      return this.landscapeImages[this.portraitIndex][1];
    return null;
  }

  peek(): GalleryImage {
    if (!this.hasNext())
      return null
    var hasPortrait = this.hasPortrait();
    var hasLandscape = this.hasLandscape()
    var [pi, portraitImage] = hasPortrait ?
      this.portraitImages[this.portraitIndex] : [Infinity, null]
    var [li, landscapeImage] = hasLandscape ?
      this.landscapeImages[this.landscapeIndex] : [Infinity, null]
    if (pi < li)
      return portraitImage
    if (li < pi)
      return landscapeImage
    throw Error('this should not happen')
  }

  next(): GalleryImage {
    if (!this.hasNext())
      return null
    var galleryImage = this.peek()
    if (galleryImage.isLandscape())
      this.landscapeIndex++
    else
      this.portraitIndex++
    return galleryImage
  }
}
