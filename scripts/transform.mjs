import StyleDictionary from "style-dictionary";
import { camelCase } from "change-case";
import fs from "fs-extra";
import config from "../config/android.compose.json" assert { type: "json" };
import { transformTypes } from "style-dictionary/enums";

// Custom token name: lightBlue2700 or darkRed400
StyleDictionary.registerTransform({
  name: "android/color-name",
  type: transformTypes.name,
  filter: (token) => token.type === "color",
  transform: (token) => {
    const theme = token.attributes?.theme || "";
    const colorFamily = token.attributes?.item || "";
    const level = token.attributes?.subitem || "";
    const themePrefix = theme === "light" ? "light" : "dark";
    const capitalizedFamily =
      colorFamily.charAt(0).toUpperCase() + colorFamily.slice(1);
    return `${themePrefix}${capitalizedFamily}${level}`;
  },
});

// Compose-compatible hex color (preserves 8 digits)
StyleDictionary.registerFormat({
  name: "android/composeColor",
  format: ({ dictionary }) => {
    const properties = dictionary.allTokens || [];
    return [
      "import androidx.compose.ui.graphics.Color\n",
      ...properties.map((token) => {
        const name = token.name.replace(/[-.]/g, "_");
        const hex = token.value.replace("#", "").substring(0, 8).toUpperCase();
        return `internal val ${name} = Color(0x${hex})`;
      }),
    ].join("\n");
  },
});

// Preprocess: Inject theme and structured attributes
function injectThemeAttributes(filePath) {
  const data = fs.readJsonSync(filePath);
  const themed = { ...data };

  for (const themeName of ["light", "dark"]) {
    const primitives = data.colors?.[themeName]?.primitives;
    if (primitives) {
      Object.keys(primitives).forEach((colorFamily) => {
        const levels = primitives[colorFamily];
        Object.keys(levels).forEach((level) => {
          const token = levels[level];
          if (token?.type === "color") {
            token["attributes"] = {
              ...(token["attributes"] || {}),
              theme: themeName,
              type: themeName,
              category: "color",
              item: colorFamily,
              subitem: level,
            };
          }
        });
      });
    }
  }

  const tempPath = "./tokens/_temp.colors.json";
  fs.outputJsonSync(tempPath, { colors: themed.colors }, { spaces: 2 });
  return tempPath;
}

// Inject theme + build
const input = injectThemeAttributes("./tokens/colors.json");
config.source = [input];

const sd = new StyleDictionary(config);
await sd.buildAllPlatforms();
