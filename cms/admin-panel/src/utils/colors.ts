export const isHexColor = (color: any): color is string => {
  if (typeof color !== "string") return false;
  return /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};

export const hexColorToRgb = (hex: string) => {
  if (hex.length !== 3 && hex.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  if (hex.length === 3) {
    const r = parseInt(`${hex[0]}${hex[0]}`, 16);
    const g = parseInt(`${hex[1]}${hex[1]}`, 16);
    const b = parseInt(`${hex[2]}${hex[2]}`, 16);
    return [r, g, b];
  } else {
    const r = parseInt(`${hex[0]}${hex[1]}`, 16);
    const g = parseInt(`${hex[2]}${hex[3]}`, 16);
    const b = parseInt(`${hex[4]}${hex[5]}`, 16);
    return [r, g, b];
  }
};

export const getColorName = (
  color: string,
  colors: Uint8Array,
  names: string[]
) => {
  const [r, g, b] = hexColorToRgb(color);

  let min = Infinity;
  let final = 0;

  for (let i = 0; i < colors.length; i += 3) {
    const r1 = colors[i];
    const g1 = colors[i + 1];
    const b1 = colors[i + 2];
    const distance = Math.sqrt(
      Math.pow(r - r1, 2) + Math.pow(g - g1, 2) + Math.pow(b - b1, 2)
    );
    if (distance < min) {
      min = distance;
      final = i / 3;
    }
  }

  return names[final];
};
