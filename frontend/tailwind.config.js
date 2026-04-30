/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Usando Inter como fonte padrão
          colors: {
          // Adicione estas cores, baseadas no manual
          'prefeitura-azul': 'rgb(23, 138, 219)', // Cor principal sólida [cite: 29]
          'prefeitura-verde': 'rgb(43, 180, 70)', // Cor secundária [cite: 32, 48, 43]
          'prefeitura-laranja': 'rgb(244, 147, 27)', // Cor secundária [cite: 36, 44]
          // Você pode adicionar os tons de degradê também se desejar
          'prefeitura-azul-degrade-inicio': 'rgb(23, 138, 219)',
          'prefeitura-azul-degrade-fim': 'rgb(21, 61, 183)',
          },
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar'),
  ],
}