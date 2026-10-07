// Shared SVG geometry keeps public and private file actions visually identical.
export type ActionIcon = {
  paths: readonly string[];
  circles?: readonly { cx: number; cy: number; r: number }[];
  rects?: readonly { x: number; y: number; width: number; height: number; rx: number }[];
};
export const ACTION_ICONS: Record<
  "eye" | "eyeOff" | "download" | "archive" | "downloadEach",
  ActionIcon
> = {
  eye: {
    paths: [
      "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
    ],
    circles: [{ cx: 12, cy: 12, r: 3 }],
  },
  eyeOff: {
    paths: [
      "m2 2 20 20",
      "M10.58 10.587a2 2 0 0 0 2.83 2.828",
      "M9.88 5.09a10.75 10.75 0 0 1 12.058 6.562 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-1.444 2.49M6.61 6.61a10.75 10.75 0 0 0-4.548 5.042 1 1 0 0 0 0 .696 10.75 10.75 0 0 0 14.327 5.041",
    ],
  },
  download: { paths: ["M12 15V3", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5"] },
  archive: {
    paths: ["M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M12 7v3m0 3v2m0 3v3"],
    rects: [{ x: 3, y: 3, width: 18, height: 4, rx: 1 }],
  },
  downloadEach: {
    paths: ["M7 3v11m-3-3 3 3 3-3", "M17 3v11m-3-3 3 3 3-3", "M3 18v3h18v-3"],
  },
};
