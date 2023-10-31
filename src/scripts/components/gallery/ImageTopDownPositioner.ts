import { ImagePositioner } from "./ImagePositioner";

export class ImageTopDownPositioner implements ImagePositioner {
  columns: number
  columnSize: number
  paddingPixels: number;
  yOffsets: number[];

  constructor(columns: number, columnSize: number, paddingPixels: number) {
    this.columns = columns;
    this.columnSize = columnSize;
    this.paddingPixels = paddingPixels;
    this.yOffsets = [];
    for (var i = 0; i < this.columns; i++)
      this.yOffsets.push(0);
  }

  getColumn(): number {
    var minColumn = 0;
    var minOffset = Infinity;
    for (var i = 0; i < this.columns; i++) {
      var yOffset = this.yOffsets[i];
      if (yOffset < minOffset) {
        minOffset = yOffset;
        minColumn = i;
      }
    }
    return minColumn;
  }

  getPosition(column: number, columnWidth: number): [number, number] {
    return [
      column * (this.columnSize + this.paddingPixels), // x/left
      columnWidth == 1 // y/top
        ? this.yOffsets[column]
        : Math.max(
            this.yOffsets[column],
            column + 1 < this.yOffsets.length
              ? this.yOffsets[column + 1]
              : 0
          ),
    ];
  }

  getTotalHeight(): number {
    return Math.max(0, Math.max(...this.yOffsets)) + this.paddingPixels;
  }

  getTop(column: number): number {
    return this.yOffsets[column];
  }

  setTop(column: number, value: number): void {
    this.yOffsets[column] = value;
  }

  increment(
    column: number,
    columnWidth: number,
    imageHeight: number
  ): void {
    if (columnWidth == 1 || column + 1 === this.yOffsets.length) {
      this.yOffsets[column] += imageHeight + this.paddingPixels;
    }
    else if (columnWidth == 2) {
      var maxOffset = Math.max(this.yOffsets[column], this.yOffsets[column + 1]);
      this.yOffsets[column + 0] = maxOffset + imageHeight + this.paddingPixels;
      this.yOffsets[column + 1] = maxOffset + imageHeight + this.paddingPixels;
    }
  }

  next(
    imageHeight: number,
    columnWidth: number,
    column: number = undefined
  ): [number, number] {
    var column = column !== undefined ? column : this.getColumn();
    var [left, top] = this.getPosition(column, columnWidth);
    this.increment(column, columnWidth, imageHeight);
    return [left, top];
  }
}
