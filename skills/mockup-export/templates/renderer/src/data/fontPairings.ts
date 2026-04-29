export interface FontPairing {
  category: string;
  headlineFont: string;
  headlineWeight: string;
  bodyFont: string;
  bodyWeight: string;
}

export const FONT_PAIRINGS: Record<string, FontPairing> = {
  finance: { category: "Finance", headlineFont: "Inter", headlineWeight: "800", bodyFont: "Source Sans 3", bodyWeight: "400" },
  fitness: { category: "Fitness", headlineFont: "Oswald", headlineWeight: "700", bodyFont: "Roboto", bodyWeight: "400" },
  music: { category: "Music", headlineFont: "Space Grotesk", headlineWeight: "700", bodyFont: "DM Sans", bodyWeight: "400" },
  business: { category: "Business", headlineFont: "Montserrat", headlineWeight: "700", bodyFont: "Open Sans", bodyWeight: "400" },
  lifestyle: { category: "Lifestyle", headlineFont: "Nunito", headlineWeight: "800", bodyFont: "PT Sans", bodyWeight: "400" },
  food: { category: "Food", headlineFont: "Raleway", headlineWeight: "700", bodyFont: "Lato", bodyWeight: "400" },
  travel: { category: "Travel", headlineFont: "Playfair Display", headlineWeight: "700", bodyFont: "Lato", bodyWeight: "400" },
  social: { category: "Social", headlineFont: "Manrope", headlineWeight: "800", bodyFont: "Inter", bodyWeight: "400" },
};

/**
 * All Google Fonts used across pairings — these are loaded via WebFontLoader.
 */
export const GOOGLE_FONTS = [
  "Inter",
  "Montserrat",
  "Oswald",
  "Space Grotesk",
  "DM Sans",
  "Poppins",
  "Playfair Display",
  "Raleway",
  "Nunito",
  "Manrope",
  "Roboto",
  "Open Sans",
  "Lato",
  "Source Sans 3",
  "PT Sans",
];

/**
 * Font weight specs for WebFontLoader loading strings.
 */
export const GOOGLE_FONT_SPECS = [
  "Inter:400,500,600,700,800",
  "Montserrat:400,600,700",
  "Oswald:400,600,700",
  "Space Grotesk:400,500,700",
  "DM Sans:400,500,700",
  "Poppins:400,500,600,700",
  "Playfair Display:400,700,800",
  "Raleway:400,600,700",
  "Nunito:400,700,800",
  "Manrope:400,500,700,800",
  "Roboto:400,500,700",
  "Open Sans:400,600,700",
  "Lato:400,700",
  "Source Sans 3:400,600",
  "PT Sans:400,700",
];
