function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

function colorsMatch(
  data: Uint8ClampedArray,
  idx: number,
  target: [number, number, number, number],
  tolerance: number
): boolean {
  return (
    Math.abs(data[idx] - target[0]) <= tolerance &&
    Math.abs(data[idx + 1] - target[1]) <= tolerance &&
    Math.abs(data[idx + 2] - target[2]) <= tolerance &&
    Math.abs(data[idx + 3] - target[3]) <= tolerance
  );
}

/**
 * Scanline flood fill applied synchronously to a canvas context.
 */
export function floodFillCanvas(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillHex: string,
  tolerance = 42
): boolean {
  const { width, height } = ctx.canvas;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const startIdx = (sy * width + sx) * 4;

  const target: [number, number, number, number] = [
    data[startIdx],
    data[startIdx + 1],
    data[startIdx + 2],
    data[startIdx + 3],
  ];
  const fill = hexToRgba(fillHex);

  if (
    Math.abs(target[0] - fill[0]) <= 4 &&
    Math.abs(target[1] - fill[1]) <= 4 &&
    Math.abs(target[2] - fill[2]) <= 4 &&
    Math.abs(target[3] - fill[3]) <= 4
  ) {
    return false;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;

    let lx = x;
    while (lx >= 0 && !visited[y * width + lx] && colorsMatch(data, (y * width + lx) * 4, target, tolerance)) {
      lx--;
    }
    lx++;

    let rx = x;
    while (rx < width && !visited[y * width + rx] && colorsMatch(data, (y * width + rx) * 4, target, tolerance)) {
      rx++;
    }
    rx--;

    let spanAbove = false;
    let spanBelow = false;

    for (let cx = lx; cx <= rx; cx++) {
      const pIdx = y * width + cx;
      visited[pIdx] = 1;
      const dIdx = pIdx * 4;
      data[dIdx] = fill[0];
      data[dIdx + 1] = fill[1];
      data[dIdx + 2] = fill[2];
      data[dIdx + 3] = fill[3];

      if (y > 0) {
        const upVisited = visited[(y - 1) * width + cx];
        const upMatch = !upVisited && colorsMatch(data, ((y - 1) * width + cx) * 4, target, tolerance);
        if (!spanAbove && upMatch) {
          stack.push(cx, y - 1);
          spanAbove = true;
        } else if (spanAbove && !upMatch) {
          spanAbove = false;
        }
      }

      if (y < height - 1) {
        const downVisited = visited[(y + 1) * width + cx];
        const downMatch = !downVisited && colorsMatch(data, ((y + 1) * width + cx) * 4, target, tolerance);
        if (!spanBelow && downMatch) {
          stack.push(cx, y + 1);
          spanBelow = true;
        } else if (spanBelow && !downMatch) {
          spanBelow = false;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return true;
}
