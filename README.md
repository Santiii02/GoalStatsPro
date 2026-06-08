# GoalStatsPro

GoalStatsPro es una aplicación web de estadísticas de fútbol centrada en **LALIGA EA SPORTS** y en la **Copa Mundial de la FIFA 2026**. Permite seguir los partidos en tiempo real, consultar clasificaciones, explorar información detallada de equipos y jugadores, y analizar los encuentros con **Míster IA**, un asistente de inteligencia artificial generativa integrado en la plataforma que interpreta las estadísticas del partido y genera crónicas tácticas y pronósticos en lenguaje natural.

Los usuarios registrados pueden guardar sus equipos y jugadores favoritos para acceder a ellos directamente desde la pantalla principal. Los administradores disponen de un panel exclusivo de gestión de usuarios.

🌐 **Aplicación en producción:** https://goal-stats-pro.vercel.app

🎬 **Vídeo de demostración:** https://youtu.be/Eki8yR8rONA

---

## Funcionalidades

- 🔴 **Partidos en vivo** — marcador, eventos (goles, tarjetas y sustituciones), alineaciones y estadísticas actualizadas automáticamente
- 🏆 **Clasificación de LALIGA EA SPORTS** — con zonas de Champions League, Europa League, Conference League y descenso resaltadas en colores
- 📅 **Calendario de partidos** — selector de jornada para consultar resultados pasados y próximos encuentros
- 🌍 **Copa Mundial de la FIFA 2026** — fase de grupos con clasificaciones, fase eliminatoria y partidos
- 📊 **Detalle de partido** — pestañas de Míster IA, Resumen/En vivo, Alineaciones y Estadísticas
- 👕 **Detalle de equipo** — información del club, estadísticas de la temporada, plantilla, historial de partidos e historia
- 👤 **Detalle de jugador** — datos personales, palmarés, historial de traspasos y biografía
- 🔍 **Buscador predictivo** — búsqueda simultánea de equipos y jugadores desde cualquier pantalla
- 🤖 **Míster IA** — análisis táctico post-partido y pronóstico pre-partido generados por Google Gemini 2.5 Flash
- ⭐ **Favoritos** — equipos y jugadores guardados vinculados a la cuenta del usuario
- 🔐 **Autenticación** — registro e inicio de sesión con correo electrónico y contraseña
- 🛠️ **Panel de administración** — gestión y borrado de cuentas de usuario

---

## Tecnologías utilizadas

**Frontend**
- [Angular 21](https://angular.dev) — framework principal
- [TypeScript 5.9](https://www.typescriptlang.org) — lenguaje de programación
- [PrimeNG 17](https://primeng.org) — biblioteca de componentes de interfaz
- [RxJS 7.8](https://rxjs.dev) — programación reactiva y gestión de peticiones asíncronas
- [Chart.js](https://www.chartjs.org) — gráficos de radar en el detalle de partido

**Backend y despliegue**
- [Vercel](https://vercel.com) — despliegue continuo y funciones serverless
- **Node.js (serverless)** — función `api/proxy.js` que actúa como intermediario seguro entre el cliente y las APIs externas, protegiendo las claves de acceso

**Firebase**
- [Firebase Authentication](https://firebase.google.com/docs/auth) — registro e inicio de sesión
- [Cloud Firestore](https://firebase.google.com/docs/firestore) — base de datos NoSQL para perfiles y favoritos

**APIs externas**
- [sportdb.dev](https://sportdb.dev) — datos en tiempo real (clasificaciones, marcadores, eventos y estadísticas)
- [TheSportsDB](https://www.thesportsdb.com) — datos históricos, imágenes de equipos y jugadores
- [Google Gemini 2.5 Flash](https://ai.google.dev/gemini-api) — modelo de lenguaje que alimenta el asistente Míster IA

---

## Instalación en local

### Requisitos previos

- **[Node.js](https://nodejs.org/en/download)** (incluye npm) — necesario para instalar las dependencias y ejecutar Angular
- **[Git](https://git-scm.com)** — para clonar el repositorio

### Pasos

**1. Clonar el repositorio**
```bash
git clone https://github.com/Santiii02/GoalStatsPro.git
cd GoalStatsPro
```

**2. Instalar las dependencias**
```bash
npm install --legacy-peer-deps
```
> Se usa `--legacy-peer-deps` porque el proyecto combina Angular 21 con PrimeNG 17, versiones que npm considera incompatibles entre sí.

**3. Arrancar el servidor de desarrollo**
```bash
npm start
```

**4. Abrir en el navegador:** `http://localhost:4200`

Las llamadas a las APIs externas se redirigen automáticamente al servidor de producción mediante `proxy.conf.json`, por lo que no es necesario configurar ninguna clave de API para el desarrollo local.

---

## Despliegue en Vercel

El despliegue en producción se realiza automáticamente cada vez que se sube un cambio al repositorio de GitHub. Para configurarlo por primera vez:

1. Crear una cuenta en [vercel.com](https://vercel.com) e importar el repositorio.
2. En *Settings → Environment Variables*, añadir las tres claves secretas:

| Variable | Descripción |
|---|---|
| `SPORT_API_KEY` | Clave de acceso a sportdb.dev |
| `SPORTSDB_KEY` | Clave de acceso a TheSportsDB |
| `GEMINI_API_KEY` | Clave de acceso a Google Gemini |

3. A partir de ese momento, cada `git push` a la rama principal despliega automáticamente una nueva versión.

Para una guía completa —incluyendo cómo configurar un proyecto Firebase propio— consulta la **Documentación técnica de programación** en los anexos de la memoria.

---

## Licencia

Este proyecto está publicado bajo la licencia **MIT**. Consulta el fichero [`LICENSE`](LICENSE) para más detalles.

---

## Contacto

Para cualquier consulta sobre la aplicación puedes escribir a: `sir1003@alu.ubu.es`