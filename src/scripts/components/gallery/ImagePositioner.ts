export interface ImagePositioner {

  getColumn(): number
  getPosition(column: number, columnWidth: number): [number, number]
  getTotalHeight(): number

  getTop(column: number): number
  setTop(column: number, value: number): void

  increment(column: number, columnWidth: number, imageHeight: number): void
  next(imageHeight: number, columnWidth: number, column: number): [number, number]
}
