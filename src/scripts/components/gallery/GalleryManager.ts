import { Renderer } from "./Renderer";
import { GalleryImage } from "./GalleryImage";

type RendererFactory = (galleryElement: HTMLElement) => Renderer
type ImageLoader = (image: HTMLImageElement, isLast: boolean, callback: () => void) => void

export class GalleryManager {
  rendererFactory: RendererFactory
  imageLoader: ImageLoader
  windowLoaded: boolean
  renderers: Renderer[]

  constructor() {
    this.rendererFactory = null;
    this.imageLoader = null;
    var self = this;
    window.addEventListener('load', function () {
      self.windowLoaded = true;
    });
    this.renderers = [];
  }

  registerRendererFactory(factory: RendererFactory) {
    this.rendererFactory = factory;
  }

  registerImageLoader(imageLoader: ImageLoader) {
    this.imageLoader = imageLoader;
  }

  renderAll(galleryElementsList: NodeListOf<HTMLElement>) {
    if (this.rendererFactory === null) {
      throw new Error('missing renderer factory');
    }
    var galleryElements = Array.from(galleryElementsList);
    var self = this;
    var renderCount = 0;
    var renderedImages: GalleryImage[] = [];
    for (var element of galleryElements) {
      var renderer = this.rendererFactory(element);

      // FIXME: this needs to be called twice for some reason
      renderer.render()

      var onLoad = function () {
        self.renderers.push(renderer)

        var images = renderer.render()
        for (var image of images) {
          renderedImages.push(image)
        }

        renderCount += 1
        if (renderCount == galleryElements.length) {
          self._loadImages(renderedImages)
        }

        window.addEventListener('resize', e => {
          renderer.render()
        })
      };

      if (this.windowLoaded) {
        onLoad();
      }
      else {
        window.addEventListener('load', onLoad);
      }
    }
  }

  _loadImages(images: GalleryImage[]) {
    var self = this;
    var loadImage = function (index: number = 0) {
      if (index == images.length)
        return
      var container = images[index].containerElement
      var image = container.querySelector('img')
      var isLast = index == images.length - 1
      self.imageLoader(image, isLast, () => loadImage(index + 1));
    }
    loadImage()
  }
}
