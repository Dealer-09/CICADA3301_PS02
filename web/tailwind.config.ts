/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        enterWave: {
          "0%": {
            transform: "translateX(-120px) rotate(0deg) scale(0.9)",
            opacity: "0",
          },
          "40%": {
            transform: "translateX(10px) rotate(-8deg) scale(1.05)",
            opacity: "1",
          },
          "60%": {
            transform: "translateX(0px) rotate(10deg)",
          },
          "80%": {
            transform: "rotate(-6deg)",
          },
          "100%": {
            transform: "translateX(0px) rotate(0deg)",
          },
        },
      },
      animation: {
        enterWave: "enterWave 1.2s ease-out forwards",
      },
    },
  },
  plugins: [],
};