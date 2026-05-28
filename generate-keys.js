// Este script se ejecuta antes de la compilación para generar un archivo de claves a partir de las variables de entorno de Vercel
const fs = require('fs');

const dir = './src/app/keys';

// Nos aseguramos de que la carpeta exista en Vercel
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Plantilla del archivo de claves que inyecta las variables de entorno de Vercel
// Si no encuentra la variable (ej. en local), intentará dejarlo en blanco o usar el tuyo existente
const keysContent = `
export const SPORT_API_KEY = '${process.env.SPORT_API_KEY || ''}';
export const GEMINI_API_KEY = '${process.env.GEMINI_API_KEY || ''}';
export const FIREBASE_KEY = '${process.env.FIREBASE_KEY || ''}';
`;

// Sobrescribimos o creamos el archivo
fs.writeFileSync(dir + '/keys.ts', keysContent.trim());

console.log('✅ Archivo keys.ts generado correctamente para la compilación.');