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

`middleware.ts` completa el cuadro: refresca el token en cada petición —sin eso
la sesión caduca y el móvil te expulsa— y redirige a `/login` a quien no tenga
sesión. En Modo Demo no hace nada, para que la app siga usable sin configurar.

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

## Acceder desde el teléfono

### Opción rápida: misma red Wi-Fi

Sin desplegar nada, para probar en el móvil mientras desarrollas:

```bash
npm run dev -- -H 0.0.0.0
```

Abre `http://<IP-de-tu-computador>:3000` en el teléfono. Solo funciona en tu red
y con el computador encendido. Sin HTTPS la PWA **no** es instalable.

### Uso real: desplegar en Vercel

El repositorio **puede seguir siendo privado**: Vercel despliega repos privados
en el plan gratuito.

1. [vercel.com/new](https://vercel.com/new) → importa el repositorio.
2. Next.js se detecta solo; no hay que tocar la configuración de build.
3. En **Environment Variables** añade lo mismo que tienes en `.env.local`:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | tu URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu llave anónima |
   | `ALPHA_VANTAGE_API_KEY` | opcional |

4. Deploy. Obtienes una URL HTTPS que abre en cualquier lugar.

Después, en Supabase → **Authentication → URL Configuration**, añade tu dominio
de Vercel a *Site URL* y a *Redirect URLs* (`https://tu-app.vercel.app/auth/callback`),
o el enlace mágico redirigirá a `localhost` y no podrás entrar desde el móvil.

> **Sobre la privacidad al desplegar.** Con las llaves de Supabase configuradas,
> `middleware.ts` exige sesión en todas las rutas: quien abra la URL sin haber
> iniciado sesión solo ve `/login`. Sin llaves, la app queda en Modo Demo y es
> pública para cualquiera que tenga el enlace — no despliegues así si no quieres
> que se pueda entrar.

---

## Instalar como app

En iPhone: Safari → **Compartir** → *Añadir a pantalla de inicio*.
Arranca en pantalla completa, con icono propio y sin barra del navegador.

> **Tras desplegar una corrección, borra el icono y vuelve a añadirlo.** Una app
> instalada arrastra su propio service worker y su propia caché; sin reinstalar
> puede seguir corriendo la versión vieja durante días.

---

## Pendientes

Lo que falta, en orden de lo que más duele.

### Configuración (fuera del código)

- [ ] **Supabase → Authentication → URL Configuration.** *Site URL* y *Redirect
      URLs* con el dominio de Vercel (`https://tu-app.vercel.app/auth/callback`).
      Sin esto el enlace mágico redirige a `localhost` y no se puede entrar
      desde el teléfono.
- [ ] **Variables de entorno en Vercel:** `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` y, si se quiere respaldo de precios,
      `ALPHA_VANTAGE_API_KEY`. Sin las dos primeras el despliegue queda en Modo
      Demo y **público**: cualquiera con el enlace entra.

### Código

- [ ] **Cola de escrituras.** Con sesión iniciada el estado deja de guardarse en
      el dispositivo (`store.tsx`: `if (!ready || synced) return`) y cada
      escritura sale directa a Supabase. Si esa petición falla —sin red, plazo
      agotado— el movimiento solo existe en memoria y se pierde al recargar.
      Falta una cola persistente que reintente al recuperar la conexión.
- [ ] **Los errores de escritura siguen siendo mudos.** Una lectura fallida ya
      se ve (aviso «Sin conexión con el servidor» con reintento), pero ninguna
      escritura comprueba el error que devuelve Supabase: si un gasto no llega
      al servidor, nadie se entera.
- [ ] **Sin tiempo real.** El esquema ya publica `transactions` y `accounts` en
      `supabase_realtime`, pero nadie se suscribe. Hoy los datos se releen al
      volver a primer plano (como mucho una vez por minuto), que cubre el caso
      normal pero no muestra al instante lo que se registra en otro dispositivo.
- [ ] **El atajo `/?quick=1` no hace nada.** Está declarado en `shortcuts` del
      manifiesto (mantener pulsado el icono → «Registro rápido»), pero nadie lee
      el parámetro, así que abre el resumen como siempre.
- [ ] **`uid()` cae a un id que no es UUID** cuando `crypto.randomUUID` no
      existe —solo fuera de HTTPS—, y las columnas `id` son `uuid`: ese insert
      falla. Solo afecta a las pruebas por IP en la red local.
- [ ] **Sin `loading.tsx`.** Al cambiar de pestaña con la red lenta no hay
      ninguna señal de que algo está pasando.
- [ ] **Sin pruebas.** Ni de los selectores del store (patrimonio, series,
      rendimiento), que es donde un error se convierte en una cifra falsa.

### Verificado

- [x] `supabase/schema.sql` cubre todo lo que el cliente escribe: bolsillos
      (`pockets` jsonb), cupo y cuotas de las tarjetas, `goals`, y la
      restricción única `budgets_user_id_category_id_key` que necesita el
      upsert de presupuestos. RLS activo en las cinco tablas.
- [x] **Las tarjetas de crédito no caducan.** Nada en el código las borra ni
      las reinicia; lo que las hacía «vencer» era la carga: cuando la consulta
      al servidor fallaba, la app se pasaba a Modo Demo, pintaba las cuentas de
      ejemplo y a partir de ahí guardaba solo en el teléfono, sin llegar nunca
      a Supabase. Corregido: la copia local se escribe siempre y bajo la clave
      del usuario, y una lectura fallida conserva la sesión y avisa en pantalla.
