import { ImageIterator } from "./ImageIterator";
import { ImagePositioner } from "./ImagePositioner";
import { Renderer } from "./Renderer";

export class RenderContext {
  renderer: Renderer
  iterator: ImageIterator
  positioner: ImagePositioner
  columns: number

  constructor(
    renderer: Renderer,
    iterator: ImageIterator,
    positioner: ImagePositioner,
    columns: number
  ) {
    this.renderer = renderer;
    this.iterator = iterator;
    this.positioner = positioner;
    this.columns = columns;
  }
}
