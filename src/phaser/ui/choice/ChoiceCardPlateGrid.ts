export type ChoiceCardPlateGridLayout = {
  cols: number;
  rows: number;
  gap: number;
  cellWidth: number;
  imageHeight: number;
  cellHeight: number;
  gridWidth: number;
  gridHeight: number;
};

export function computeChoiceCardPlateGridLayout(params: {
  itemCount: number;
  maxContentWidth: number;
  cardAspect: number;
  colsMax?: number;
  gap?: number;
  minCellWidth?: number;
  maxCellWidth?: number;
  extraCellHeight?: number;
}): ChoiceCardPlateGridLayout {
  const gap = Math.max(0, Number(params.gap ?? 12));
  const colsMax = Math.max(1, Number(params.colsMax ?? 3));
  const itemCount = Math.max(0, Number(params.itemCount ?? 0));
  const cols = Math.max(1, Math.min(colsMax, itemCount || 1));
  const baseCardCell = Math.floor((params.maxContentWidth - gap * (cols - 1)) / cols);
  const cellWidth = Math.max(
    Number(params.minCellWidth ?? 96),
    Math.min(Number(params.maxCellWidth ?? 170), baseCardCell),
  );
  const imageHeight = cellWidth * params.cardAspect;
  const cellHeight = imageHeight + Math.max(0, Number(params.extraCellHeight ?? 36));
  const rows = itemCount > 0 ? Math.ceil(itemCount / cols) : 1;
  const gridWidth = cols * cellWidth + (cols - 1) * gap;
  const gridHeight = rows * cellHeight + Math.max(0, rows - 1) * gap;

  return {
    cols,
    rows,
    gap,
    cellWidth,
    imageHeight,
    cellHeight,
    gridWidth,
    gridHeight,
  };
}

export function forEachChoiceCardPlatePosition(
  count: number,
  layout: ChoiceCardPlateGridLayout,
  origin: { startX: number; startY: number },
  onEach: (params: { index: number; row: number; col: number; x: number; y: number }) => void,
) {
  for (let i = 0; i < count; i += 1) {
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    const x = origin.startX + col * (layout.cellWidth + layout.gap);
    const y = origin.startY + row * (layout.cellHeight + layout.gap);
    onEach({ index: i, row, col, x, y });
  }
}
