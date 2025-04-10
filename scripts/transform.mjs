import StyleDictionary from "style-dictionary";
import { camelCase } from "change-case";
import fs from "fs-extra";
import path from "path";
import config from "../config/android.compose.json" assert { type: "json" };
import { transformTypes } from "style-dictionary/enums";

// Transform token name → camelCase
StyleDictionary.registerTransform({
  name: "android/color-name",
  type: transformTypes.name,
  filter: (token) => token.type === "color",
  transform: (token) => {
    return camelCase(token.path.join("_"));
  },
});


// Compose-compatible hex color (preserves 8 digits like #FFFFFFFF)
StyleDictionary.registerFormat({
  name: "android/composeColor",
  format: ({ dictionary }) => {
    const properties = dictionary.allTokens || [];
    return [
      "import androidx.compose.ui.graphics.Color\n",
      ...properties.map((token) => {
        const name = token.name.replace(/[-.]/g, "_");
        const hex = token.value.replace("#", "").substring(0, 8).toUpperCase();
        return `val ${name} = Color(0x${hex})`;
      }),
    ].join("\n");
  },
});

// Preprocess: Inject 'theme' attribute
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
config.source = [input]; // override config to use the preprocessed file

const sd = new StyleDictionary(config);
await sd.buildAllPlatforms();
