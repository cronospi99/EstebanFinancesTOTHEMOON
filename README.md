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
| Framework       | Next.js 15 (App Router)         | Los *route handlers* permiten el proxy de cotizaciones — los proveedores no envían cabeceras CORS y sus llaves no deben llegar al cliente |
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

Tres fuentes en cadena, elegidas por su cupo gratuito:

| Fuente | Cubre | Cupo gratuito | Llave |
|---|---|---|---|
| **Coinbase** | pares cripto | sin límite práctico | no |
| **Finnhub** | acciones y ETF | 60 llamadas/minuto | `FINNHUB_API_KEY` |
| **Twelve Data** | respaldo | 8/minuto, 800/día | `TWELVE_DATA_API_KEY` |

El cupo es el criterio, no un detalle. Una cartera de diez posiciones pide diez
precios por refresco: con Finnhub eso es la sexta parte del minuto, y con
Twelve Data por delante las dos últimas volvían siempre con `429` y el
portafolio no se podía valorar entero ni una vez.

Caché en memoria de 5 minutos. Si un proveedor falla, se devuelve el último
precio conocido marcado como `stale`.

### Las que se quitaron

- **Yahoo Finance** — devuelve `429` a las IP de los centros de datos. Funciona
  en local y nunca en el despliegue, que es la peor combinación posible.
- **Stooq** — contesta `200` con una página HTML en vez del CSV.
- **Alpha Vantage** — 25 llamadas al día. Con diez posiciones son dos refrescos
  y medio.

Las tres gastaban plazo en cada consulta y llenaban el aviso de la app de ruido
que no se podía accionar.

La interfaz **nunca inventa un rendimiento**: sin cotización real muestra
«Valorado al costo · sin datos de mercado» y las posiciones aparecen a precio de
compra, en gris, no como una ganancia del 0 %. Si falta un precio, *Ajustes →
Datos de mercado* dice qué llaves ve el servidor y qué proveedor respondió.

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
   | `FINNHUB_API_KEY` | precios en vivo (ver abajo) |
   | `TWELVE_DATA_API_KEY` | histórico del gráfico |

4. Deploy. Obtienes una URL HTTPS que abre en cualquier lugar.

> **Añadir una variable no basta: hay que volver a desplegar.** Vercel congela
> las variables de entorno en el momento del build, así que el despliegue que
> ya estaba en línea sigue sin verlas por mucho que las guardes en el panel.
> Es el motivo habitual de «puse la llave y no cambió nada»: *Deployments → …
> → Redeploy*. Para comprobar si llegó, **Ajustes → Datos de mercado** dice
> qué llaves ve el servidor y qué proveedor está poniendo los precios.

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

## Escritorio y móvil

La misma app en los dos sitios, decidido con CSS y no leyendo el user-agent:
a partir de 1024 px de ancho aparece una **barra lateral** con la navegación y
el botón de registrar, el contenido se centra en una columna más ancha, el
resumen pasa a dos columnas y las hojas dejan de estar pegadas abajo para salir
como diálogos centrados. Por debajo de ese ancho, la app de siempre: barra
inferior, botón flotante y hojas desde el borde.

Decidirlo por ancho y no por dispositivo tiene dos ventajas concretas: no hay
parpadeo al hidratar —el servidor no tiene que adivinar qué pantalla hay al
otro lado— y una ventana estrecha en un portátil recibe la interfaz de móvil,
que es la que cabe.

---

## Iconos de las gestoras

Las posiciones muestran el logotipo de la gestora del fondo (Vanguard, iShares,
State Street, Schwab, J.P. Morgan, VanEck, Avantis) en vez de una caja gris con
el ticker. El mismo archivo lleva los **nombres oficiales** de los instrumentos habituales
(VOO → «Vanguard S&P 500 ETF»), que se resuelven sin red: la búsqueda de nombres
depende de una API que puede estar caída, y entonces la posición se quedaba
llamándose como su ticker. El mapa vive en [`lib/issuers.ts`](lib/issuers.ts) y
es explícito, sin reglas por prefijo: «empieza por AV → Avantis» le pondría el logotipo de una
gestora a AVGO, que es Broadcom. Lo que no está en el mapa —acciones sueltas,
cripto— sigue mostrando su ticker, que ahí es justo la información útil.

---

## Rendimiento histórico

La pestaña de Inversiones lleva una tarjeta con el valor del portafolio a lo
largo del tiempo y los mismos rangos que el patrimonio: 1D, 5D, 1S, 1M, 3M, 6M,
1A y 5A.

La serie se reconstruye hacia atrás desde lo único que se sabe con certeza —las
posiciones de hoy— deshaciendo las operaciones del libro, y cada cantidad se
multiplica por el cierre de mercado de ese día (`/api/history`). El porcentaje
**descuenta las aportaciones del período**: sin eso, meter dinero se leería como
haber ganado, que es la forma más fácil de engañarse con una cartera.

Dos aproximaciones, dichas para que no se lean como exactitud: la tasa de
cambio es la de hoy en toda la serie (no se guarda el histórico de la divisa), y
un símbolo sin cierres se valora a su coste promedio y se avisa en pantalla.

---

## Historial de inversiones

Cada compra y cada venta se guardan como una **operación**, y la posición
—cantidad y coste promedio— se calcula a partir de ellas. Por eso editar una
operación de hace tres meses recalcula el promedio bien sin tocar nada más.

La pestaña **Historial** de Inversiones las agrupa por símbolo, con la posición
que resulta de cada grupo en la cabecera. Tocar una operación la abre para
corregirla o borrarla.

Las posiciones que ya existían antes del libro se incorporan solas: la primera
vez que registras algo sobre ellas se crea una operación de **«posición
inicial»** con su cantidad y su coste promedio, para que el historial explique
la posición completa y no arranque a mitad.

> Una posición con operaciones ya no se edita a mano: sus cifras salen del
> libro y cualquier cambio directo se perdería en el siguiente recálculo. La
> app lo dice y remite al historial.

**Requiere volver a ejecutar [`supabase/schema.sql`](supabase/schema.sql)** para
crear la tabla `trades`. Es idempotente: se puede correr entero sobre una base
ya creada. Sin ella la app sigue funcionando, pero sin historial.

---

## Pendientes

Lo que falta, en orden de lo que más duele.

### Configuración (fuera del código)

- [ ] **Supabase → Authentication → URL Configuration.** *Site URL* y *Redirect
      URLs* con el dominio de Vercel (`https://tu-app.vercel.app/auth/callback`).
      Sin esto el enlace mágico redirige a `localhost` y no se puede entrar
      desde el teléfono.
- [ ] **Variables de entorno en Vercel:** `NEXT_PUBLIC_SUPABASE_URL` y
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Sin ellas el despliegue queda en Modo
      Demo y **público**: cualquiera con el enlace entra.
- [ ] **`FINNHUB_API_KEY` para que haya precios.** Ninguna fuente sin llave
      funciona desde un centro de datos. La llave gratuita de
      [finnhub.io](https://finnhub.io) da 60 llamadas por minuto y cubre
      acciones y ETF estadounidenses. Sin ella la app funciona, pero el
      portafolio se queda «valorado al costo».
- [ ] **`TWELVE_DATA_API_KEY` para el gráfico de rendimiento.** Las velas
      históricas de Finnhub son de pago, así que el histórico sale de
      [twelvedata.com](https://twelvedata.com). Sus 8 llamadas por minuto
      bastan porque las series se guardan seis horas. Sin ella hay precios pero
      no gráfico.
- [ ] **Volver a desplegar tras añadirlas.** Vercel congela las variables en el
      build. *Ajustes → Datos de mercado* confirma si el servidor las ve, y el
      pie de esa pantalla dice qué commit está sirviendo la app.

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
