# Tracking de Iniciativas S&OP · Megalabs

## 🚀 Publicarla en un link público (recomendado — sin VPN, sin carpetas compartidas)

Esta es la forma correcta de que todo el equipo entre por un mismo link, sin depender de
OneDrive, unidades de red ni VPN. Lleva 3 minutos:

1. Entrá a **https://render.com** y creá una cuenta gratis (podés usar tu login de GitHub).
2. Click en **New + → Blueprint**, elegí este repositorio (`arianavinzon-blip/Discontinuados`,
   rama `claude/sharepoint-initiatives-app-agve3v`) — Render va a detectar solo el archivo
   `render.yaml` de acá y va a proponer crear el servicio ya configurado.
3. Click en **Deploy Blueprint**. En 2-3 minutos te da un link tipo
   `https://tracking-iniciativas-sop.onrender.com` — ese es el que compartís con el equipo.
   Nadie necesita usuario ni contraseña para entrar.
4. La base ya arranca con tus **20 iniciativas reales** (las del archivo que me pasaste el
   07/08), no con los datos de demo.

**Importante sobre el costo — sé transparente con esto**: el `render.yaml` usa el plan
**"starter"** (pago, ronda los USD 7-8/mes) en vez del gratuito, **a propósito**: el plan
gratis de Render borra todo lo guardado en disco cada vez que el servicio se reinicia (y se
reinicia solo tras 15 minutos sin uso) — con datos reales del equipo, eso significa perder
carga de trabajo sin aviso. El plan starter con disco persistente evita ese riesgo. Si
preferís arrancar gratis para probarla unos días antes de pagar nada, cambiá `plan: starter`
por `plan: free` y sacá el bloque `disk:` en `render.yaml` — funciona igual, pero con el
riesgo de perder datos en cada reinicio; no lo dejaría así para uso real del equipo.

## Alternativa sin costo ni cuenta en ningún lado

Si por ahora preferís no pagar ni crear cuentas externas, usá la **versión sin servidor**:
el archivo `tracking-iniciativas-sin-servidor.html` se abre con doble clic y guarda la base
en un archivo JSON dentro de una carpeta compartida. Tiene las limitaciones que ya venimos
viendo (depende de que todos estén en la misma red/VPN, de OneDrive, de que no se dupliquen
archivos). Ver sección "Versión sin servidor" más abajo.

Torre de Control de Iniciativas Estratégicas del equipo S&OP Global, convertida de demo HTML a **aplicación multiusuario** con:

- **Frontend**: mismo diseño exacto de la demo (`public/index.html`), con la fecha del día real.
- **Backend**: API REST en Node.js puro, sin dependencias externas (`server.js`).
- **Base de datos**: archivo `data/iniciativas.json` en el servidor, creado automáticamente con las 17 iniciativas iniciales (`seed/iniciativas-iniciales.json`).
- **Sincronización en vivo**: si una persona crea, edita, cambia de estado o elimina una iniciativa, todos los demás lo ven **automáticamente, sin recargar la página** (Server-Sent Events).

## Requisitos

Solo **Node.js 18 o superior** (https://nodejs.org — versión LTS). Nada más: sin `npm install`, sin base de datos externa.

## Cómo arrancarla

```bash
node server.js
```

(En Windows también podés hacer doble clic en `iniciar.bat`.)

Después abrí **http://localhost:3000** en el navegador. La primera vez se crea la base con las 17 iniciativas iniciales.

## Cómo la usan varias personas a la vez

Todos deben apuntar al **mismo servidor** (una sola computadora corre `node server.js`; el resto solo abre el navegador):

1. **Prueba rápida en tu propia máquina**: abrí dos navegadores (o una ventana normal y una de incógnito) en `http://localhost:3000`. Cambiá el estado de una iniciativa en uno y mirá cómo se actualiza el otro solo.
2. **En la red de la oficina (LAN/VPN)**: averiguá tu IP local (`ipconfig` en Windows → "Dirección IPv4", ej. `192.168.1.50`) y compartí el link `http://192.168.1.50:3000`. Requisitos: tu máquina encendida con el servidor corriendo, y que el firewall de Windows permita Node.js en red privada (lo pregunta la primera vez).
3. **Uso permanente para todo el equipo**: pedir a TI un pequeño servidor interno (o máquina virtual) con Node.js donde dejar corriendo `node server.js` como servicio, y compartir esa URL interna. Alternativamente, desplegar en un servicio en la nube (Render, Railway, Azure App Service) si TI lo autoriza.

## Estructura

```
server.js                     → backend: API REST + eventos en vivo + persistencia
public/index.html             → frontend (diseño original intacto)
public/vendor/chart.umd.min.js→ Chart.js 4.4.1 local (no depende de CDN externos)
seed/iniciativas-iniciales.json → las 17 iniciativas semilla
data/iniciativas.json         → base de datos (se crea sola; no se versiona en git)
iniciar.bat                   → arranque con doble clic en Windows
```

## API (por si se quiere integrar con otra herramienta)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/iniciativas` | Lista completa |
| POST | `/api/iniciativas` | Crear (requiere `titulo` y `estado`) |
| PUT | `/api/iniciativas/:id` | Editar |
| DELETE | `/api/iniciativas/:id` | Eliminar |
| POST | `/api/import` | Importar `{mode: "replace"|"append", initiatives: [...]}` |
| POST | `/api/restore` | Restaurar las 17 iniciativas iniciales |
| GET | `/api/events` | Stream de eventos en vivo (SSE) |

## Respaldo

- El botón **Compartir → Exportar** descarga un JSON de respaldo con todas las iniciativas.
- El archivo `data/iniciativas.json` del servidor es la base: copiarlo alcanza como backup.

## Versión sin servidor (sin Node, sin TI)

`tracking-iniciativas-sin-servidor.html` es un único archivo autónomo pensado para equipos sin servidor propio:

1. **Poné dos archivos en una carpeta compartida** que todo el equipo tenga sincronizada (OneDrive, Teams o unidad de red): el HTML de la app y la base de datos JSON.
2. Cada persona abre el HTML **con doble clic en Microsoft Edge o Google Chrome**.
3. La primera vez, tocá **"Crear base nueva"** (se crea `base-tracking-iniciativas.json` con las 17 iniciativas — guardalo en la carpeta compartida) o **"Conectar base compartida"** para elegir la base que ya existe.
4. Desde ahí:
   - Todo lo que se crea, edita o elimina **se guarda directo en ese archivo JSON**.
   - **Al abrir la aplicación se cargan las modificaciones que hicieron los demás** (OneDrive sincroniza el archivo).
   - Con la app abierta, los cambios ajenos se leen automáticamente cada 5 segundos.
   - El navegador recuerda la base: en próximas aperturas, a lo sumo pide **un clic en "Reconectar base"** (es una medida de seguridad del navegador, no un error).

**Limitaciones honestas de esta modalidad**: requiere Edge o Chrome (no Firefox); y si dos personas editan exactamente al mismo tiempo estando sin conexión, OneDrive puede generar una "copia en conflicto" y vale la última versión guardada. Para el uso normal (cada uno actualiza en distintos momentos del día) funciona perfecto.

## Notas

- La fecha "hoy" para semáforos y días restantes es la **fecha real del día** (ya no está fija en 06-jul-2026).
- Los cambios simultáneos de varias personas se aceptan todos; si dos personas editan la **misma** iniciativa a la vez, vale la última que guarda, y ambas ven el resultado final al instante.
- El Roadmap muestra el horizonte Julio–Diciembre 2026, igual que la demo.
