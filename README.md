# Monitoreo Web — monitorización de sitios

Dashboard que chequea periódicamente una lista de sitios web (código HTTP y latencia) y muestra su estado en vivo.

Es una sola app **Next.js 16 (App Router, TypeScript)**: el frontend React (sistema de diseño *099 SUPPLY*) y el backend corren en el mismo proceso. No necesita Java, Docker, Kafka, Postgres ni Redis: la base de datos es un archivo **SQLite** (`better-sqlite3`).

```
  ┌───────────────┐  cada 10 s   ┌─────────────┐  resultado  ┌──────────────┐
  │   scheduler   │ ───────────► │   checker   │ ──────────► │ status-store │ ──► SSE (en vivo)
  │               │ sitios venc. │ fetch+tiempo│             │ SQLite + bus │
  └───────┬───────┘              └─────────────┘             └──────┬───────┘
          │                                                         │
  ┌───────┴─────────────────────────────────────────────────────────┴───────┐
  │  API /api/v1/websites  ·  /api/v1/status  ·  /api/auth                  │
  │  Dashboard React: Dashboard · Catálogo · Logs · Login                   │
  └──────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Arranque

Requisitos: Node.js 22 o superior.

```bash
npm install
npm run dev          # desarrollo → http://localhost:3100
```

Producción:

```bash
npm run build
npm start            # → http://localhost:3100
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3100 |
| `npm run build` | Compila para producción |
| `npm start` | Levanta la versión compilada en el puerto 3100 |
| `npm run lint` | ESLint |

El puerto se cambia en `package.json` (flag `-p` de los scripts `dev` y `start`).

Al arrancar, el scheduler hace el primer barrido a los 5 s y después revisa cada 10 s qué sitios toca chequear según su frecuencia.

---

## 2. Usuario administrador

Solo existe **un usuario: el administrador**. No hay registro ni forma de crear otros usuarios, y sin sesión no se puede ver ni el dashboard ni ningún dato de la API.

| Dato | Valor |
|---|---|
| URL de acceso | http://localhost:3100/login |
| Usuario | `admin` |
| Contraseña | La que figura en `ADMIN_PASSWORD` dentro de `.env.local` |

> La contraseña **no se escribe en este README** a propósito: el README se sube al repositorio y `.env.local` no.

### Dónde se configura

Las credenciales viven en el archivo **`.env.local`**, en la raíz del proyecto (está en `.gitignore`; la plantilla es `.env.example`):

| Variable | Qué es |
|---|---|
| `ADMIN_USERNAME` | Usuario del administrador |
| `ADMIN_PASSWORD` | Contraseña del administrador |
| `AUTH_SECRET` | Clave con la que se firma la cookie de sesión (mínimo 32 caracteres) |

**Cambiar usuario o contraseña:** editar `.env.local` y reiniciar el servidor (`npm run dev` o `npm start`).

**Cerrar todas las sesiones abiertas:** cambiar `AUTH_SECRET` y reiniciar. Se puede generar uno nuevo con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**En otra máquina:** copiar `.env.example` a `.env.local` y completar las tres variables. Si falta alguna, nadie puede entrar.

### Cómo funciona la seguridad

- La sesión es una cookie `httpOnly` firmada (HMAC-SHA256) que dura **12 horas**. El botón **Salir** la borra.
- `src/proxy.ts` protege todo salvo `/login`: las páginas sin sesión redirigen a `/login` y la API responde `401`.
- `src/app/page.tsx` vuelve a verificar la sesión antes de mostrar el dashboard.
- Tras **5 intentos fallidos** desde la misma IP, el login se bloquea **15 minutos**.

---

## 3. Base de datos

### Dónde se guarda

Los datos se guardan en un archivo SQLite en la raíz del proyecto:

```
data/monitoring.db
```

(junto a `monitoring.db-wal` y `monitoring.db-shm`, archivos auxiliares de SQLite que no hay que borrar mientras el servidor corre).

- Se crea **sola** la primera vez que arranca la app, con **10 sitios de prueba** (chequeo cada 5 min).
- La ruta se puede cambiar con la variable de entorno `DATABASE_PATH`.
- Está en `.gitignore`: **no se sube al repositorio**.
- Si se borra, se vuelve a crear con los 10 sitios de prueba y **se pierden los sitios agregados a mano** y el historial.
- Para hacer un backup, copiar el archivo con el servidor apagado.
- Se puede abrir con cualquier visor de SQLite (DB Browser for SQLite, TablePlus, DBeaver).

### Tablas

| Tabla | Qué guarda |
|---|---|
| `websites` | Los sitios monitoreados |
| `website_status` | El último resultado de cada sitio |
| `website_history` | Los últimos 50 resultados de cada sitio |
| `status_change_log` | Cambios de estado (código distinto de 200) de las últimas 24 h |

Columnas de `websites`:

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | TEXT (UUID) | Identificador |
| `name` | TEXT | Nombre visible (máx. 120) |
| `url` | TEXT | URL del sitio |
| `login_endpoint` | TEXT | Endpoint que se chequea |
| `check_frequency_seconds` | INTEGER | Cada cuánto se chequea (mín. 10 s) |
| `active` | INTEGER | 1 = se chequea, 0 = pausado |
| `destacado` | TEXT | Nota libre (contacto del dueño, etc., máx. 500) |
| `last_enqueued_at` | TEXT | Último momento en que se lanzó un chequeo |
| `created_at` / `updated_at` | TEXT | Fechas ISO de alta y última edición |

### Agregar un sitio para monitorear

Desde el dashboard: **Nuevo sitio** → completar el formulario → **Guardar**. Se inserta una fila en `websites` y el scheduler lo chequea en los siguientes segundos.

También por API (con sesión iniciada), `POST /api/v1/websites` con este cuerpo:

```json
{
  "name": "Mi app",
  "url": "https://mi-app.com",
  "loginEndpoint": "https://mi-app.com/login",
  "checkFrequencySeconds": 60,
  "active": true,
  "destacado": "Contacto: ..."
}
```

Un sitio se considera **UP** solo si el endpoint responde `200`. Cualquier otro código, un timeout (10 s) o un error de red lo marcan como **DOWN**.

---

## 4. Estructura del proyecto

```
monitoreo-web/
├── .env.local                  # credenciales del admin (NO se sube)
├── .env.example                # plantilla de .env.local
├── data/
│   └── monitoring.db           # base de datos SQLite (NO se sube)
├── package.json                # dependencias y scripts (puerto 3100)
├── next.config.ts              # configuración de Next
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs          # Tailwind v4
├── public/                     # archivos estáticos
├── scripts/
│   └── servicio.sh             # servicio 24/7 (launchd) + Cloudflare Tunnel
└── src/
    ├── proxy.ts                # guardia de sesión: todo cerrado salvo /login
    ├── instrumentation.ts      # arranca el scheduler al iniciar el servidor
    ├── app/
    │   ├── layout.tsx          # HTML base + estilos globales
    │   ├── page.tsx            # "/" → dashboard (verifica sesión)
    │   ├── globals.css         # sistema de diseño 099 SUPPLY
    │   ├── login/page.tsx      # "/login"
    │   └── api/
    │       ├── auth/
    │       │   ├── login/route.ts        # POST iniciar sesión
    │       │   └── logout/route.ts       # POST cerrar sesión
    │       └── v1/
    │           ├── websites/
    │           │   ├── route.ts          # GET lista · POST alta
    │           │   └── [id]/
    │           │       ├── route.ts      # GET · PUT · DELETE
    │           │       └── check/route.ts  # POST chequeo inmediato
    │           └── status/
    │               ├── route.ts          # GET estado de todos
    │               ├── stream/route.ts   # GET SSE en vivo
    │               └── [websiteId]/
    │                   ├── route.ts      # GET estado de uno
    │                   ├── history/route.ts
    │                   └── logs/route.ts
    ├── components/             # vistas React
    │   ├── App.tsx             # contenedor: navegación, datos, modal
    │   ├── ClientApp.tsx       # monta App solo en el navegador
    │   ├── TopNav.tsx          # barra superior (Dashboard/Catálogo, Salir)
    │   ├── LoginForm.tsx
    │   ├── StatusCard.tsx      # card de estado de un sitio
    │   ├── SortableStatusCard.tsx  # card con drag & drop
    │   ├── StatusMark.tsx      # punto verde/rojo
    │   ├── WebsiteTable.tsx    # tabla / lista del catálogo
    │   ├── WebsiteFormModal.tsx  # alta y edición de sitios
    │   ├── SectionHeading.tsx
    │   └── views/
    │       ├── DashboardView.tsx
    │       ├── CatalogView.tsx
    │       └── LogsView.tsx
    ├── styles/                 # estilos de la vista mobile (< 768 px)
    │   ├── mobile-shell.css    # barra superior y resumen
    │   ├── mobile-cards.css    # cards compactas
    │   └── mobile-catalog.css  # catálogo, logs y modal
    └── lib/
        ├── client/             # código del navegador
        │   ├── api.ts          # llamadas a la API
        │   ├── types.ts
        │   ├── httpStatus.ts   # textos y colores por código HTTP
        │   ├── useDashboardData.ts  # datos + SSE + sondeo cada 15 s
        │   ├── useHashRoute.ts # rutas #/, #/catalogo, #/logs/:id
        │   ├── useCardOrder.ts # orden de las cards (localStorage)
        │   ├── useCountUp.ts
        │   └── useInView.ts
        └── server/             # código del servidor
            ├── db.ts           # conexión SQLite, tablas y datos de prueba
            ├── websites.ts     # alta/baja/edición de sitios
            ├── checker.ts      # hace el request y mide latencia
            ├── scheduler.ts    # decide qué chequear y cuándo
            ├── status-store.ts # último estado, historial, logs y bus SSE
            ├── auth.ts         # credenciales y cookie de sesión
            ├── problem.ts      # formato de errores
            └── types.ts
```

Vistas del dashboard (rutas con `#`, dentro de la misma página):

| Ruta | Vista |
|---|---|
| `/login` | Acceso del administrador |
| `/#/` | Dashboard: cards con el estado en vivo (reordenables con drag & drop) |
| `/#/catalogo` | Catálogo: alta, edición y baja de sitios |
| `/#/logs/{id}` | Cambios de estado de un sitio en las últimas 24 h |

---

## 5. API

Todas las rutas (salvo el login) requieren sesión. Los errores usan el formato ProblemDetail (`application/problem+json`, con `title` y `detail`).

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Inicia sesión (`{username, password}`) → 204 + cookie |
| POST | `/api/auth/logout` | Cierra sesión (204) |
| GET | `/api/v1/websites` | Lista los sitios |
| GET | `/api/v1/websites/{id}` | Detalle de un sitio |
| POST | `/api/v1/websites` | Alta (201) |
| PUT | `/api/v1/websites/{id}` | Modificación |
| DELETE | `/api/v1/websites/{id}` | Baja (204) |
| POST | `/api/v1/websites/{id}/check` | Chequeo inmediato (202) |
| GET | `/api/v1/status` | Estado actual de todos los sitios |
| GET | `/api/v1/status/{id}` | Estado de un sitio |
| GET | `/api/v1/status/{id}/history?limit=20` | Historial (máx. 50) |
| GET | `/api/v1/status/{id}/logs` | Cambios de estado de las últimas 24 h |
| GET | `/api/v1/status/stream` | Server-Sent Events (`event: status`) |

---

## 6. Variables de entorno

Se definen en `.env.local`.

| Variable | Obligatoria | Default | Qué hace |
|---|---|---|---|
| `ADMIN_USERNAME` | Sí | — | Usuario del administrador |
| `ADMIN_PASSWORD` | Sí | — | Contraseña del administrador |
| `AUTH_SECRET` | Sí | — | Firma de la cookie de sesión (mín. 32 caracteres) |
| `DATABASE_PATH` | No | `data/monitoring.db` | Ubicación del archivo SQLite |
| `SCHEDULER_ENABLED` | No | `true` | `false` desactiva los chequeos automáticos |
| `SCHEDULER_INITIAL_DELAY_MS` | No | `5000` | Espera antes del primer barrido |
| `SCHEDULER_SWEEP_INTERVAL_MS` | No | `10000` | Intervalo entre barridos |
| `SCHEDULER_MAX_CONCURRENCY` | No | `10` | Chequeos simultáneos |
| `CHECKER_REQUEST_TIMEOUT_MS` | No | `10000` | Timeout de cada chequeo |
| `CHECKER_USER_AGENT` | No | `monitoreo-web-checker/1.0 …` | User-Agent de los chequeos |

---

## 7. Servicio 24/7 en esta Mac + Cloudflare Tunnel

La app corre siempre en segundo plano en esta computadora (launchd de macOS) y se puede abrir desde cualquier lugar con una URL pública de **Cloudflare Tunnel**. Todo gratis y sin cambios en el código.

Son dos servicios que arrancan solos al iniciar sesión y se reinician si se caen:

| Servicio | Qué hace |
|---|---|
| `com.brian.monitoreo-web` | `next start` en `127.0.0.1:3100` (solo localhost) |
| `com.brian.monitoreo-web.tunnel` | `cloudflared` → URL pública `https://….trycloudflare.com` hacia la app |

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run servicio:instalar` | Compila e instala/reinstala ambos servicios |
| `npm run servicio:reiniciar` | Recompila y reinicia la app (**después de cambiar código**) |
| `npm run servicio:estado` | Muestra si están corriendo y la URL pública |
| `npm run servicio:url` | Imprime la URL pública del login |
| `npm run servicio:logs` | Sigue el log de la app |
| `npm run servicio:detener` | Los detiene hasta el próximo inicio de sesión |
| `npm run servicio:desinstalar` | Los quita por completo |

Requisitos: `brew install cloudflared` y `.env.local` con las credenciales. Los archivos de servicio se generan en `~/Library/LaunchAgents/` y los logs quedan en `~/Library/Logs/monitoreo-web/` (`app.log`, `tunnel.log`). Todo lo maneja `scripts/servicio.sh`.

### A tener en cuenta

- **La URL pública cambia** cada vez que se reinicia el túnel (reinicio de la Mac, cierre de sesión, `servicio:instalar`). Consultarla con `npm run servicio:url`. Para una URL fija hace falta un dominio propio en Cloudflare y un *named tunnel*.
- **Reposo:** si la Mac se suspende, la app se pausa y no chequea. Para evitarlo: *Ajustes → Batería / Energía → Evitar el reposo automático cuando la pantalla está apagada* (con el cargador conectado).
- **Solo con sesión iniciada:** arranca al iniciar sesión, no en la pantalla de login de macOS.
- **Stream en vivo:** los túneles rápidos de Cloudflare no soportan SSE, así que por la URL pública el dashboard se actualiza por sondeo cada 15 s. En `http://localhost:3100` sigue en vivo.
- **Seguridad:** la app solo escucha en `127.0.0.1`; desde afuera se entra únicamente por el túnel (HTTPS) y con el login. La cookie de sesión va con `Secure` cuando la petición llega por HTTPS.
- **No correr `npm run dev` a la vez:** usarían la misma base y se duplicarían los chequeos. Para desarrollar: `npm run servicio:detener`, trabajar con `npm run dev` y al terminar `npm run servicio:instalar`.
- Usa `data/monitoring.db`, la misma base de siempre.

> `railway.json` queda como alternativa si en algún momento se despliega en Railway (servicio pago): volumen en `/data`, `DATABASE_PATH=/data/monitoring.db` y las variables de la sección 2.

---

## 8. Diseño

Sistema *099 SUPPLY*: lienzo blanco, un único casi-negro `#101010`, hairlines de 1 px, monoespaciada en mayúsculas con tracking amplio, botones pill, tarjetas de 8 px, cero sombras y cero gradientes. La única licencia cromática es el estado: verde `#1f6f43` (UP) y rojo `#a11212` (DOWN).

En pantallas de menos de 768 px las cards pasan a filas compactas con solo nombre, estado, código HTTP, latencia, tiempo desde el último chequeo y re-chequeo.
