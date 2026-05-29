// Archivo que maneja las peticiones a /api/..., haciendo de intermediario (proxy) entre el navegador y los servicios externos.

// Direcciones base de los servicios externos a los que vamos a llamar:
const SPORTDB_BASE = 'https://api.sportdb.dev';
const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// "handler" es la función principal: se ejecuta cada vez que alguien llama a /api/...
// "req" = request, "res" = response.
export default async function handler(req, res) {
    try {
        // Quitamos el "/api/" del principio de la dirección para quedarnos solo con lo que viene después.
        // Ejemplo: "/api/thesportsdb/searchteams.php?t=Madrid" -> "thesportsdb/searchteams.php?t=Madrid"
        const afterApi = req.url.replace(/^\/api\//, '');

        // Si la petición empieza por "ai/", es para Gemini
        if (afterApi.startsWith('ai/')) {
            // La IA solo se usa enviando datos (POST). Si llega de otra forma, avisamos del error
            if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
            // Generamos el análisis y lo devolvemos
            const analysis = await generateAnalysis(req.body || {});
            return res.status(200).json({ analysis });
        }

        // Si empieza por "thesportsdb/", vamos a esa API
        if (afterApi.startsWith('thesportsdb/')) {
            // Quitamos el "thesportsdb/" para quedarnos con el resto de la dirección
            const rest = afterApi.replace(/^thesportsdb\//, '');
            // Montamos la dirección final metiendo la clave almacenada en el servidor en medio de la URL
            return forward(res, `${THESPORTSDB_BASE}/${process.env.SPORTSDB_KEY}/${rest}`);
        }

        // El resto de peticiones van a SportDB.dev. Aquí la clave va en una cabecera, no en la URL
        return forward(res, `${SPORTDB_BASE}/api/${afterApi}`, {
            'X-API-Key': process.env.SPORT_API_KEY
        });

    } catch (err) {
        console.error('Error en el proxy:', err);
        return res.status(502).json({ error: 'Error en el proxy de datos' });
    }
}

// Función auxiliar: hace la llamada real al servicio externo y nos devuelve su respuesta tal cual.
// "targetUrl" = dirección final a la que llamamos,  "extraHeaders" = cabeceras extra (como la clave).
async function forward(res, targetUrl, extraHeaders = {}) {
    // Juntamos la cabecera básica con las extra
    const upstream = await fetch(targetUrl, {headers: { 'Content-Type': 'application/json', ...extraHeaders } });
    // Leemos la respuesta como texto
    const body = await upstream.text();
    // Copiamos el código de estado (200 = bien, 404 = no encontrado, etc.) que nos dio el servicio
    res.status(upstream.status);
    // Copiamos el tipo de contenido para que el navegador lo entienda igual que el original
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    // Devolvemos la respuesta al navegador
    return res.send(body);
}

// Función que construye el prompt que le mandamos a la IA y llama a Gemini
async function generateAnalysis({ homeTeam, awayTeam, stats = [], league, hasRealStats }) {
    let prompt;
    // Si el partido ya tiene estadísticas reales, pedimos un analisis
    if (hasRealStats) {
        // Convertimos la lista de estadísticas en texto legible.
        const statsText = stats
            .map(s => `- ${s.statName}: ${homeTeam} (${s.homeValue}) vs ${awayTeam} (${s.awayValue})`)
            .join('\n');
        prompt = `Eres un analista deportivo de fútbol de élite, estilo 'Maldini'.
            Analiza el partido: ${homeTeam} (Local) contra ${awayTeam} (Visitante) en: ${league}.
            Estadísticas:
            ${statsText}
            REGLAS:
            1. No repitas las estadísticas como lista; úsalas como argumento. Si las estadisticas están a 0 para ambos, ignóralas y di cómo crees que ha sido el partido según el resultado y el contexto.
            2. Máximo 3 párrafos y 80 palabras. Breve y atractivo.
            3. Indica quién dominó y con qué estilo.
            4. Valora si el resultado es justo según xG/Tiros.
            5. Tono periodístico, profesional y emocionante.
            6. Usa Markdown (negrita) para conceptos clave. Sin títulos grandes.`;
            } else {
                // Si el partido aún no ha empezado (sin estadísticas), pedimos una PREVIA.
                prompt = `Eres un analista deportivo de fútbol de élite, estilo 'Maldini'.
            Haz la previa del partido: ${homeTeam} (Local) contra ${awayTeam} (Visitante) en: ${league}.
            REGLAS:
            1. Máximo 3 párrafos y 80 palabras. Breve y atractivo.
            2. Analiza el nivel y el peso histórico/actual de ambos.
            3. Di qué equipo es favorito y por qué (factor campo).
            4. Pronostica el desarrollo y un resultado final.
            5. Tono periodístico, profesional y emocionante.
            6. Usa Markdown (negrita) para conceptos clave. Sin títulos grandes.`;
            }

    // Llamamos a Gemini, metiendo la clave en la dirección
    const r = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    // Si Gemini responde con error, lanzamos un aviso
    if (!r.ok) throw new Error(`Gemini respondió ${r.status}`);
    // Convertimos la respuesta en datos y sacamos el texto del análisis
    const data = await r.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}