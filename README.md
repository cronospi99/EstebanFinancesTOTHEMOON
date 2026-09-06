# Finanzas

Web App personal y privada de finanzas — gastos, cuentas e inversiones.
Mobile-first, instalable como PWA, con estética tipo Apple (SF / Wallet / Salud).

---

## Arranque rápido

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. **No necesitas configurar nada para empezar:** la app
arranca en **Modo Demo** con datos de ejemplo guardados en el navegador.

> Para verla como se diseñó: abre las DevTools → modo dispositivo → iPhone.

---

## Stack

| Capa            | Elección                        | Por qué |
|-----------------|---------------------------------|---------|
| Framework       | Next.js 15 (App Router)         | Los *route handlers* permiten el proxy de cotizaciones — Yahoo Finance no envía cabeceras CORS y la llave de Alpha Vantage no debe llegar al cliente |
| Estilos         | Tailwind CSS 3                  | Tokens del sistema de color de iOS en `tailwind.config.ts` |
| Animación       | Framer Motion                   | Curva `cubic-bezier(0.32, 0.72, 0, 1)` — la de iOS |
| Iconos          | Lucide                          | Trazo consistente con SF Symbols |
| Gráficos        | Recharts                        | Área y dona sin ejes ni grid |
| Datos / Auth    | Supabase                        | Postgres + RLS + enlace mágico |

---

## Conectar Supabase (persistencia real)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql).
   Crea las tablas, activa **Row Level Security** y añade un *trigger* que rellena
   `user_id` desde la sesión.
3. Copia las llaves:

   ```bash
   cp .env.example .env.local
   ```

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```

4. Reinicia `npm run dev` y entra por `/login` (enlace mágico al correo).

Con RLS activo, la llave anónima **no** puede leer filas de otro usuario: la
privacidad la garantiza la base de datos, no el cliente.

---

## Cotizaciones

`GET /api/quotes?symbols=AAPL,VOO,BTC-USD,COP=X`

- Fuente principal: **Yahoo Finance** (sin llave).
- Respaldo opcional: **Alpha Vantage**, solo si defines `ALPHA_VANTAGE_API_KEY`.
- Caché en memoria de 60 s.
- Si un proveedor falla, devuelve el último precio conocido marcado como `stale`.

La interfaz **nunca inventa un rendimiento**: sin cotización real muestra
«Valorado al costo · sin datos de mercado» y las posiciones aparecen a precio de
compra, en gris, no como una ganancia del 0 %.

> Nota: si tu red bloquea `query1.finance.yahoo.com`, verás ese estado. Es el
> comportamiento esperado, no un fallo.

---

## Estructura

```
app/
├─ (app)/                 Pestañas con barra inferior
│  ├─ page.tsx            Dashboard
│  ├─ gastos/             Gastos, categorías y cuentas
│  ├─ inversiones/        Portafolio
│  └─ ajustes/            Estado de conexión y datos
├─ login/                 Enlace mágico (sin barra inferior)
├─ auth/callback/         Intercambio de código por sesión
└─ api/quotes/            Proxy de mercado (servidor)

components/
├─ layout/                Shell, barra inferior, encabezados
├─ quick-add/             Sheet + teclado numérico
├─ dashboard/             Patrimonio, cuentas, anillos de presupuesto
├─ expenses/              Dona, lista de movimientos
├─ investments/           Fila de posición
└─ ui/                    Card, Sheet, Segmented, CategoryIcon

lib/
├─ store.tsx              Estado + selectores derivados
├─ format.ts              Moneda COP, fechas, números tabulares
├─ use-quotes.ts          Sondeo de precios
└─ supabase/              Clientes navegador y servidor
```

---

## Decisiones de diseño

**Negro real (`#000000`).** En pantallas OLED el píxel se apaga: el contraste es
absoluto y las tarjetas de cristal flotan de verdad.

**Números tabulares en todas las cifras.** La clase `.tnum` fija el ancho de cada
dígito; sin ella las columnas «bailan» al actualizarse.

**Pesos sin decimales.** `$ 45.900` se lee más rápido que `$ 45.900,00` en una
lista larga. Los centavos solo aparecen en activos en USD.

**Tecla `000`.** En pesos casi todo se mide en miles: registrar 45.000 son tres
pulsaciones. Con categoría y cuenta preseleccionadas, un gasto se registra en
5 toques — abrir, tres dígitos, guardar.

**El gráfico de patrimonio no parte de cero.** El dominio se ajusta al rango real;
con eje desde 0 una variación del 2 % se vería como una línea plana.

---

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run start      # servir el build
npm run typecheck  # TypeScript sin emitir
```

## Instalar como app

En iPhone: Safari → **Compartir** → *Añadir a pantalla de inicio*.
Arranca en pantalla completa, con icono propio y sin barra del navegador.
