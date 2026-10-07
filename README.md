# Finanzas

App de finanzas personales para iPhone. Es una **web app instalable** (PWA): se agrega a la pantalla de inicio desde Safari, abre a pantalla completa como cualquier app, funciona sin internet y **guarda todo solo en tu teléfono**. No necesita Mac, App Store ni cuenta de desarrollador, y no tiene servidor, registro, anuncios ni suscripción.

## Qué hace

- **Resumen**: saldo total, ingresos, gastos y porcentaje de ahorro del mes, gastos por categoría, tendencia de 6 meses, próximos pagos y movimientos recientes.
- **Movimientos**: gastos, ingresos y transferencias entre cuentas. Búsqueda en todos los meses, filtros por tipo, categoría y cuenta. Al borrar puedes deshacer.
- **Presupuesto** mensual por categoría, con:
  - cuánto te queda por día hasta fin de mes,
  - una marca de "ritmo" que avisa si vas gastando más rápido de lo que avanza el mes,
  - cuánto de tus ingresos queda sin asignar,
  - presupuesto sugerido a partir de tu promedio de los últimos 3 meses.
- **Cuentas**: efectivo, débito, tarjetas de crédito (como deuda), ahorro e inversión. Patrimonio neto. Puedes corregir el saldo para que cuadre con tu banco.
- **Pagos recurrentes** (renta, sueldo, suscripciones): se registran solos el día que tocan y se suman a tu gasto fijo mensual.
- **Metas de ahorro** con fecha límite. La app calcula cuánto apartar al mes.
- **Categorías** editables (nombre, ícono y color).
- **Respaldo**: guarda un archivo `.json` en Archivos o iCloud Drive y restáuralo en otro teléfono. También puedes exportar tus movimientos a CSV para Excel o Numbers.
- Modo claro y oscuro, 19 monedas y textos en español.

## Instalarla en el iPhone

La app necesita estar publicada en una dirección `https://`. La forma más fácil y gratuita es GitHub Pages.

1. **Publícala** (solo se hace una vez):
   - GitHub Pages es gratis solo en repositorios **públicos**. Tus datos nunca se suben al repositorio, solo el código de la app, así que es seguro hacerlo público: *Settings → General → Danger Zone → Change visibility → Public*.
   - Luego activa Pages en *Settings → Pages → Build and deployment → Source: Deploy from a branch*, elige `main` y la carpeta `/ (root)`, y guarda.
   - En uno o dos minutos la app queda en `https://<tu-usuario>.github.io/finanzas/`.
   - Si prefieres que el repositorio siga privado, puedes conectarlo gratis a [Netlify](https://www.netlify.com/) o [Cloudflare Pages](https://pages.cloudflare.com/). No hace falta configurar compilación: la carpeta a publicar es la raíz del repositorio.
2. **Instálala**: abre esa dirección en **Safari** en tu iPhone, toca el botón **Compartir** y luego **Agregar a inicio**.
3. Ábrela desde el ícono de tu pantalla de inicio. La primera vez te pregunta tu moneda y te deja empezar vacío o probar con datos de ejemplo.

## Tus datos

- Se guardan en el almacenamiento local de la app instalada en tu teléfono. No salen de ahí.
- Si borras la app de la pantalla de inicio o los datos de Safari, se pierden. **Haz respaldos** desde *Más → Ajustes y respaldo → Guardar respaldo*. La app te lo recuerda si pasa más de un mes sin respaldar.
- Lo que registres en Safari y lo que registres en la app instalada son almacenamientos distintos. Usa siempre la app instalada.

## Desarrollo

No necesita compilación: es HTML, CSS y JavaScript (módulos ES) sin dependencias.

```sh
npm start   # sirve la app en http://localhost:8080
npm test    # pruebas de la lógica de cálculo (node --test)
```

| Archivo | Qué contiene |
| --- | --- |
| `index.html`, `manifest.webmanifest`, `icons/` | Entrada de la app y lo necesario para instalarla en iOS |
| `sw.js` | Guarda la app para uso sin internet. **Sube `VERSION`** al publicar cambios y agrega ahí los archivos nuevos |
| `js/calc.js` | Cálculos puros: saldos, resúmenes, presupuesto, recurrentes y metas |
| `js/format.js` | Formato de dinero y fechas, y lectura de montos escritos (`1.234,50` o `1,234.50`) |
| `js/store.js` | Estructura de datos, guardado, respaldo, CSV y datos de ejemplo |
| `js/app.js` | Navegación, acciones y formularios |
| `js/views/`, `js/sheets.js`, `js/ui.js`, `js/charts.js` | Pantallas, formularios, componentes y gráficas |

Los montos se guardan en centavos (enteros) para evitar errores de redondeo.
