/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./*.jsx", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#163F87",
          dark: "#133877",
          light: "#3498db",
        },
      },
      fontFamily: {
        sans: ['"PT Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
