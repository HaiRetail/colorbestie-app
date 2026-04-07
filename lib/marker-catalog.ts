export type MarkerSeries = {
  name: string;
  sets: string[];
};

export type MarkerBrand = {
  brand: string;
  series: MarkerSeries[];
};

export type MarkerSelection = {
  brand: string;
  series: string;
  setSize: string;
  extraColors?: string[];
};

// Official-first catalog: brand/line names and set sizes aligned to commonly published manufacturer lines.
export const MARKER_CATALOG: MarkerBrand[] = [
  {
    brand: "Ohuhu",
    series: [
      {
        name: "Honolulu / Honolulu B",
        sets: [
          "24",
          "48",
          "72",
          "96 Pastel",
          "96 Pastel Set",
          "104",
          "120",
          "168",
          "216",
          "320",
          "48 Mid-Tone",
          "48 Pastel",
          "36 Greytone",
          "36 Skintone",
          "24 Skintone",
        ],
      },
      {
        name: "Honolulu B (Brush & Fine)",
        sets: [
          "36 Skin Tone",
          "36 Skintone",
          "48 Mid-Tone",
          "48 Pastel",
          "48 Pastel Sweetness",
          "72",
          "104",
          "104 (Extra colors for 216)",
          "216",
          "344",
        ],
      },
      {
        name: "Bobbie Goods x Ohuhu Honolulu B",
        sets: ["48"],
      },
      { name: "Honolulu B Set (Brush & Fine)", sets: ["36 Skin Tone", "36 Skintone", "216"] },
      { name: "Honolulu (Brush & Chisel)", sets: ["216", "320"] },
      { name: "Oahu (Fine & Chisel)", sets: ["120", "200", "216"] },
      { name: "Oahu (Brush & Chisel)", sets: ["216"] },
      { name: "Honolulu Plus", sets: ["36"] },
      { name: "Kaala", sets: ["24", "60 Illustration Tones"] },
      { name: "Creachick x Ohuhu", sets: ["6"] },
      { name: "Ohuhu Water-Based (Dual Tips)", sets: ["60"] },
    ],
  },
  {
    brand: "Copic",
    series: [
      { name: "Ciao", sets: ["6", "12", "24", "24 Colors", "24 Skin Tone", "36", "72", "72 Set B"] },
      { name: "Sketch", sets: ["12", "12 Skin Tone", "36", "72"] },
      { name: "Classic", sets: ["12", "36", "72"] },
    ],
  },
  {
    brand: "Winsor & Newton",
    series: [
      { name: "ProMarker", sets: ["6", "12", "24", "48", "96"] },
      { name: "ProMarker Brush", sets: ["6", "12", "24", "48"] },
    ],
  },
  {
    brand: "Spectrum Noir",
    series: [
      { name: "Classique", sets: ["6", "12"] },
      { name: "Illustrator", sets: ["6", "12"] },
      { name: "TriBlend", sets: ["6"] },
    ],
  },
  {
    brand: "Prismacolor",
    series: [
      { name: "Premier (Fine & Chisel)", sets: ["10", "12", "24", "48", "72", "156"] },
      { name: "Premier (Brush & Fine)", sets: ["12"] },
    ],
  },
  {
    brand: "Stylefile",
    series: [{ name: "Brush Marker", sets: ["6", "12", "24", "36", "48", "72"] }],
  },
  {
    brand: "Vivid Green",
    series: [
      { name: "Alcohol Markers", sets: ["80", "168"] },
    ],
  },
  {
    brand: "Arrtx",
    series: [
      { name: "OROS (Pastel Colors)", sets: ["66"] },
    ],
  },
  {
    brand: "Nassau Fine Art",
    series: [
      { name: "Alcohol Markers (Dual Tip)", sets: ["168"] },
    ],
  },
  {
    brand: "SHEIN",
    series: [
      { name: "Brush Markers (Acrylic)", sets: ["168"] },
    ],
  },
  {
    brand: "Nicety",
    series: [
      { name: "Acrylic Paint Markers", sets: ["144"] },
    ],
  },
  {
    brand: "DecoTime (Action)",
    series: [
      { name: "Twinmarkers", sets: ["12", "16", "36", "60", "72", "80", "150", "160", "200", "300"] },
      { name: "Aquamarkers", sets: ["120"] },
    ],
  },
  {
    brand: "Mosrac",
    series: [
      { name: "Alcohol Markers", sets: ["120"] },
    ],
  },
  {
    brand: "Chotune",
    series: [
      { name: "Alcohol Markers", sets: ["168", "262"] },
    ],
  },
  {
    brand: "Woodley",
    series: [
      { name: "Alcohol Markers", sets: ["168"] },
    ],
  },
  {
    brand: "Chen Rui",
    series: [
      { name: "Art Markers", sets: ["120"] },
    ],
  },
  {
    brand: "Guangna",
    series: [
      { name: "Acrylic Markers", sets: ["240"] },
    ],
  },
  {
    brand: "Gofun",
    series: [
      { name: "Alcohol Markers (Dual Tip)", sets: ["262"] },
    ],
  },
  {
    brand: "Xieed",
    series: [
      { name: "Alcohol Markers", sets: ["240"] },
    ],
  },
  {
    brand: "Panduro",
    series: [
      { name: "Alcohol Markers", sets: ["168"] },
    ],
  },
];

export const MARKER_SELECTION_KEY = "colorbestie.markerSelection";
