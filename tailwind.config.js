const medusaPreset = require("@medusajs/ui-preset")

module.exports = {
  presets: [medusaPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@medusajs/ui/dist/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
}
