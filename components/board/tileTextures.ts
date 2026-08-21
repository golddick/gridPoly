

// import * as THREE from "three";

// const cache = new Map<string, THREE.CanvasTexture>();

// const CREAM = "#FBF6E9";
// const CREAM_SHADOW = "#EDE4CC";
// const INK = "#2A241C";
// const INK_SOFT = "#5A5041";

// function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
//   ctx.beginPath();
//   ctx.moveTo(x + r, y);
//   ctx.arcTo(x + w, y, x + w, y + h, r);
//   ctx.arcTo(x + w, y + h, x, y + h, r);
//   ctx.arcTo(x, y + h, x, y, r);
//   ctx.arcTo(x, y, x + w, y, r);
//   ctx.closePath();
// }

// function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxWidth: number, lineHeight: number) {
//   const words = text.split(" ");
//   const lines: string[] = [];
//   let line = "";
//   for (const word of words) {
//     const test = line ? `${line} ${word}` : word;
//     if (ctx.measureText(test).width > maxWidth && line) {
//       lines.push(line);
//       line = word;
//     } else {
//       line = test;
//     }
//   }
//   if (line) lines.push(line);
//   const startY = cy - ((lines.length - 1) * lineHeight) / 2;
//   lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
// }

// /**
//  * A real Monopoly-card-style tile label: cream card body with a bold
//  * colored header band (the type accent — like the classic property color
//  * strip), dark ink text for the name, and the price/value printed below in
//  * a bordered price tag. Bright and printed-paper-like rather than a dark
//  * glowing panel.
//  */
// export function tileLabelTexture(name: string, subtitle: string, accentColor: string): THREE.CanvasTexture {
//   const key = `card|${name}|${subtitle}|${accentColor}`;
//   const cached = cache.get(key);
//   if (cached) return cached;

//   const size = 256;
//   const canvas = document.createElement("canvas");
//   canvas.width = size;
//   canvas.height = size;
//   const ctx = canvas.getContext("2d")!;

//   // Cream card body with a soft drop shadow edge
//   ctx.fillStyle = CREAM;
//   roundRect(ctx, 6, 6, size - 12, size - 12, 16);
//   ctx.fill();
//   ctx.strokeStyle = "rgba(42,36,28,0.35)";
//   ctx.lineWidth = 3;
//   ctx.stroke();

//   // Colored header band — the classic Monopoly property-color strip
//   ctx.save();
//   roundRect(ctx, 6, 6, size - 12, size * 0.34, 16);
//   ctx.clip();
//   ctx.fillStyle = accentColor;
//   ctx.fillRect(0, 0, size, size * 0.42);
//   ctx.restore();
//   ctx.strokeStyle = "rgba(42,36,28,0.35)";
//   ctx.lineWidth = 2;
//   ctx.beginPath();
//   ctx.moveTo(6, size * 0.4);
//   ctx.lineTo(size - 6, size * 0.4);
//   ctx.stroke();

//   // Name, in dark ink on the cream body below the header
//   ctx.fillStyle = INK;
//   ctx.textAlign = "center";
//   ctx.textBaseline = "middle";
//   ctx.font = "bold 24px Georgia, 'Times New Roman', serif";
//   wrapText(ctx, name, size / 2, size * 0.62, size - 36, 26);

//   // Price tag
//   if (subtitle) {
//     ctx.font = "700 22px system-ui, sans-serif";
//     ctx.fillStyle = INK_SOFT;
//     ctx.fillText(subtitle, size / 2, size * 0.86);
//   }

//   const texture = new THREE.CanvasTexture(canvas);
//   texture.colorSpace = THREE.SRGBColorSpace;
//   texture.anisotropy = 4;
//   texture.needsUpdate = true;
//   cache.set(key, texture);
//   return texture;
// }

// /** Bright corner-tile card (START, JAIL, etc) — cream body, bold ink text, a colored corner flourish. */
// export function cornerLabelTexture(name: string, accentColor = "#B23A2E"): THREE.CanvasTexture {
//   const key = `corner|${name}|${accentColor}`;
//   const cached = cache.get(key);
//   if (cached) return cached;

//   const size = 256;
//   const canvas = document.createElement("canvas");
//   canvas.width = size;
//   canvas.height = size;
//   const ctx = canvas.getContext("2d")!;

//   ctx.fillStyle = CREAM;
//   roundRect(ctx, 6, 6, size - 12, size - 12, 20);
//   ctx.fill();
//   ctx.strokeStyle = accentColor;
//   ctx.lineWidth = 6;
//   roundRect(ctx, 12, 12, size - 24, size - 24, 16);
//   ctx.stroke();

//   ctx.fillStyle = accentColor;
//   ctx.textAlign = "center";
//   ctx.textBaseline = "middle";
//   ctx.font = "bold 26px Georgia, 'Times New Roman', serif";
//   wrapText(ctx, name.toUpperCase(), size / 2, size / 2, size - 40, 30);

//   const texture = new THREE.CanvasTexture(canvas);
//   texture.colorSpace = THREE.SRGBColorSpace;
//   texture.anisotropy = 4;
//   texture.needsUpdate = true;
//   cache.set(key, texture);
//   return texture;
// }

// /** Warm, bright parchment/marble texture for the center hub and base plate — daylight-photographed tabletop, not a dark glowing surface. */
// export function parchmentTexture(): THREE.CanvasTexture {
//   const key = "parchment";
//   const cached = cache.get(key);
//   if (cached) return cached;

//   const size = 256;
//   const canvas = document.createElement("canvas");
//   canvas.width = size;
//   canvas.height = size;
//   const ctx = canvas.getContext("2d")!;

//   ctx.fillStyle = CREAM_SHADOW;
//   ctx.fillRect(0, 0, size, size);
//   ctx.globalAlpha = 0.1;
//   for (let i = 0; i < 50; i++) {
//     ctx.strokeStyle = i % 3 === 0 ? "#C9B87F" : "#D9CFAE";
//     ctx.lineWidth = Math.random() * 1.2 + 0.3;
//     ctx.beginPath();
//     const y = Math.random() * size;
//     ctx.moveTo(0, y);
//     ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 30, size * 0.7, y + (Math.random() - 0.5) * 30, size, y);
//     ctx.stroke();
//   }
//   ctx.globalAlpha = 1;

//   const texture = new THREE.CanvasTexture(canvas);
//   texture.colorSpace = THREE.SRGBColorSpace;
//   texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
//   texture.needsUpdate = true;
//   cache.set(key, texture);
//   return texture;
// }




























import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

const CREAM = "#FBF6E9";
const CREAM_SHADOW = "#EDE4CC";
const INK = "#2A241C";
const INK_SOFT = "#5A5041";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
}

/**
 * A real Monopoly-card-style tile label: cream card body with a bold
 * colored header band (the type accent — like the classic property color
 * strip), dark ink text for the name, and the price/value printed below in
 * a bordered price tag. Bright and printed-paper-like rather than a dark
 * glowing panel.
 */
export function tileLabelTexture(name: string, subtitle: string, accentColor: string): THREE.CanvasTexture {
  const key = `card|${name}|${subtitle}|${accentColor}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Cream card body with a soft drop shadow edge
  ctx.fillStyle = CREAM;
  roundRect(ctx, 6, 6, size - 12, size - 12, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(42,36,28,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Colored header band — the classic Monopoly property-color strip
  ctx.save();
  roundRect(ctx, 6, 6, size - 12, size * 0.34, 16);
  ctx.clip();
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, size, size * 0.42);
  ctx.restore();
  ctx.strokeStyle = "rgba(42,36,28,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, size * 0.4);
  ctx.lineTo(size - 6, size * 0.4);
  ctx.stroke();

  // Name, in dark ink on the cream body below the header
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 24px Georgia, 'Times New Roman', serif";
  wrapText(ctx, name, size / 2, size * 0.62, size - 36, 26);

  // Price tag
  if (subtitle) {
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(subtitle, size / 2, size * 0.86);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

/** Bright corner-tile card (START, JAIL, etc) — cream body, bold ink text, a colored corner flourish. */
export function cornerLabelTexture(name: string, accentColor = "#B23A2E"): THREE.CanvasTexture {
  const key = `corner|${name}|${accentColor}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = CREAM;
  roundRect(ctx, 6, 6, size - 12, size - 12, 20);
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 6;
  roundRect(ctx, 12, 12, size - 24, size - 24, 16);
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 26px Georgia, 'Times New Roman', serif";
  wrapText(ctx, name.toUpperCase(), size / 2, size / 2, size - 40, 30);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

/** Warm, bright parchment/marble texture for the center hub and base plate — daylight-photographed tabletop, not a dark glowing surface. */
export function parchmentTexture(): THREE.CanvasTexture {
  const key = "parchment";
  const cached = cache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = CREAM_SHADOW;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 50; i++) {
    ctx.strokeStyle = i % 3 === 0 ? "#C9B87F" : "#D9CFAE";
    ctx.lineWidth = Math.random() * 1.2 + 0.3;
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 30, size * 0.7, y + (Math.random() - 0.5) * 30, size, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

const TICKER_FONT = "600 60px 'Courier New', monospace";
const TICKER_SEPARATOR = "      •      ";

/**
 * Builds a scrolling LED-ticker texture from whatever message list is
 * passed in — nothing about the content is fixed. Callers decide what
 * shows: live game log entries (the default), market headlines, chat,
 * sponsor text, or any custom string list. Draws the joined message twice
 * back-to-back at its exact measured width, so animating `texture.offset.x`
 * with `wrapS = RepeatWrapping` scrolls it seamlessly with no visible seam.
 */
export function tickerTexture(messages: string[], color = "#F0B94A", background = "#14120F"): THREE.CanvasTexture {
  const text = messages.length > 0 ? messages.join(TICKER_SEPARATOR) + TICKER_SEPARATOR : `Welcome to Gride${TICKER_SEPARATOR}Roll to begin${TICKER_SEPARATOR}`;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = TICKER_FONT;
  const textWidth = Math.max(200, measure.measureText(text).width);

  const height = 128;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(textWidth * 2);
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = TICKER_FONT;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, height / 2);
  ctx.fillText(text, textWidth, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture; // not cached — message lists change at runtime, unlike static tile labels
}