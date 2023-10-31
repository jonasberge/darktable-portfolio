export class GalleryImage {
  containerElement: HTMLElement
  aspectRatio: number

  constructor(element: HTMLElement) {
    this.containerElement = element
    this.aspectRatio = parseFloat(element.getAttribute('data-aspect-ratio'))
  }

  determineHeight(width: number): number {
    return Math.max(1, width) / this.aspectRatio
  }

  isLandscape(): boolean {
    return this.aspectRatio > 1.0
  }

  isPortrait(): boolean {
    return !this.isLandscape()
  }

  getOrder(): number {
    var orderValue = this.containerElement.getAttribute('data-order');
    if (typeof orderValue === 'string') {
      return parseInt(orderValue);
    }
    return 0;
  }
}
