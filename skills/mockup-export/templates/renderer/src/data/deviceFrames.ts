export interface DeviceFrameInfo {
  id: string;
  name: string;
  category: "phone" | "tablet";
  platform: "android" | "ios";
  frameWidth: number;
  frameHeight: number;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  screenRadius: number;
  exportWidth: number;
  exportHeight: number;
  bezelColor: string;
  hasNotch?: boolean;
  notchWidth?: number;
  notchHeight?: number;
  hasDynamicIsland?: boolean;
}

export const deviceFrames: DeviceFrameInfo[] = [
  {
    id: "pixel-9-pro",
    name: "Google Pixel 9 Pro",
    category: "phone",
    platform: "android",
    frameWidth: 290, frameHeight: 620,
    screenX: 10, screenY: 10, screenWidth: 270, screenHeight: 600,
    screenRadius: 28, exportWidth: 1080, exportHeight: 2400,
    bezelColor: "#1a1a1a",
  },
  {
    id: "pixel-8",
    name: "Google Pixel 8",
    category: "phone",
    platform: "android",
    frameWidth: 288, frameHeight: 624,
    screenX: 10, screenY: 12, screenWidth: 268, screenHeight: 600,
    screenRadius: 26, exportWidth: 1080, exportHeight: 2400,
    bezelColor: "#202020",
  },
  {
    id: "samsung-s24-ultra",
    name: "Samsung Galaxy S24 Ultra",
    category: "phone",
    platform: "android",
    frameWidth: 286, frameHeight: 618,
    screenX: 8, screenY: 8, screenWidth: 270, screenHeight: 602,
    screenRadius: 22, exportWidth: 1080, exportHeight: 2340,
    bezelColor: "#0c0c0c",
  },
  {
    id: "samsung-s23",
    name: "Samsung Galaxy S23",
    category: "phone",
    platform: "android",
    frameWidth: 288, frameHeight: 620,
    screenX: 10, screenY: 10, screenWidth: 268, screenHeight: 600,
    screenRadius: 24, exportWidth: 1080, exportHeight: 2340,
    bezelColor: "#111111",
  },
  {
    id: "oneplus-12",
    name: "OnePlus 12",
    category: "phone",
    platform: "android",
    frameWidth: 290, frameHeight: 622,
    screenX: 9, screenY: 9, screenWidth: 272, screenHeight: 604,
    screenRadius: 26, exportWidth: 1080, exportHeight: 2412,
    bezelColor: "#0a0a0a",
  },
  {
    id: "generic-android",
    name: "Generic Android",
    category: "phone",
    platform: "android",
    frameWidth: 286, frameHeight: 616,
    screenX: 11, screenY: 11, screenWidth: 264, screenHeight: 594,
    screenRadius: 20, exportWidth: 1080, exportHeight: 1920,
    bezelColor: "#1e1e1e",
  },
  {
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    category: "phone",
    platform: "ios",
    frameWidth: 290, frameHeight: 628,
    screenX: 8, screenY: 8, screenWidth: 274, screenHeight: 612,
    screenRadius: 32, exportWidth: 1320, exportHeight: 2868,
    bezelColor: "#1a1a1a",
    hasDynamicIsland: true,
  },
  {
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    category: "phone",
    platform: "ios",
    frameWidth: 286, frameHeight: 620,
    screenX: 8, screenY: 8, screenWidth: 270, screenHeight: 604,
    screenRadius: 30, exportWidth: 1206, exportHeight: 2622,
    bezelColor: "#1a1a1a",
    hasDynamicIsland: true,
  },
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    category: "phone",
    platform: "ios",
    frameWidth: 288, frameHeight: 624,
    screenX: 8, screenY: 8, screenWidth: 272, screenHeight: 608,
    screenRadius: 30, exportWidth: 1290, exportHeight: 2796,
    bezelColor: "#2a2a2c",
    hasDynamicIsland: true,
  },
  {
    id: "pixel-tablet",
    name: "Google Pixel Tablet",
    category: "tablet",
    platform: "android",
    frameWidth: 460, frameHeight: 320,
    screenX: 16, screenY: 16, screenWidth: 428, screenHeight: 288,
    screenRadius: 16, exportWidth: 2560, exportHeight: 1600,
    bezelColor: "#1e1e1e",
  },
  {
    id: "samsung-tab-s9",
    name: "Samsung Galaxy Tab S9",
    category: "tablet",
    platform: "android",
    frameWidth: 464, frameHeight: 324,
    screenX: 14, screenY: 14, screenWidth: 436, screenHeight: 296,
    screenRadius: 14, exportWidth: 2560, exportHeight: 1600,
    bezelColor: "#121212",
  },
];

export const getDeviceById = (id: string) =>
  deviceFrames.find((d) => d.id === id) || deviceFrames[0];

export const phoneDevices = deviceFrames.filter((d) => d.category === "phone");
export const tabletDevices = deviceFrames.filter((d) => d.category === "tablet");
