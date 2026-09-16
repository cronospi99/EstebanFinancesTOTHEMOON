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
2. Aplica las migraciones de [`supabase/migrations/`](supabase/migrations) —con
   `supabase link` y `supabase db push`, o pegando los archivos en orden en el
   **SQL Editor**. Crean las tablas, activan **Row Level Security** y añaden un
   *trigger* que rellena `user_id` desde la sesión.
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

### Cambios de esquema

El esquema vive en [`supabase/migrations/`](supabase/migrations), un archivo por
cambio y ordenados por su marca de tiempo. Con el proyecto conectado a GitHub,
Supabase aplica en cada push a la rama de producción los que aún no estén
aplicados: no hay que abrir el SQL Editor.

Para añadir uno:

```bash
supabase migration new nombre_del_cambio   # crea el archivo con su timestamp
# … escribe el SQL dentro …
supabase db push                           # opcional: aplicarlo ya, sin esperar al push
```

Sin la CLI a mano vale con crear el archivo a mano siguiendo el mismo patrón,
`<AAAAMMDDHHMMSS>_nombre.sql`. Dos reglas que este proyecto sí necesita:

- **Nunca se edita una migración ya aplicada.** El corrector es una migración
  nueva; cambiar la vieja deja la base de producción y la del siguiente que
  clone el repo en estados distintos.
- **Cada tabla nueva nace con RLS.** Sin `enable row level security` y su
  política `own rows`, la llave anónima —que va en el navegador— puede leer las
  filas de cualquiera. Copia el bloque de `settings` en la migración inicial:
  es el más corto y ya trae también el trigger que rellena `user_id`.

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
│  ├─ gastos/             Gastos y categorías
│  ├─ cuentas/            Cuentas, tarjetas y deudas
│  ├─ salud/              Liquidez, 50/30/20, anomalías y sueldo pasivo
│  ├─ suscripciones/      Lo que se cobra solo
│  ├─ inversiones/        Portafolio
│  └─ ajustes/            Conexión, recordatorios, datos y declaración
├─ login/                 Enlace mágico (sin barra inferior)
├─ auth/callback/         Intercambio de código por sesión
└─ api/
   ├─ quotes/ history/    Proxy de mercado (servidor)
   ├─ fx/ trm/            Tasa de mercado y TRM oficial
   ├─ quick-add/          Ingesta desde atajos de iOS y SMS
   ├─ ocr/                Lectura de la foto de una factura
   └─ push/               Alta de avisos y recordatorios diarios

components/
├─ layout/                Shell, barra inferior, bloqueo, cola, recordatorios
├─ quick-add/             Sheet, teclado numérico, foto de factura
├─ dashboard/             Patrimonio, cuentas, anillos de presupuesto
├─ salud/                 Liquidez, 50/30/20, anomalías, FIRE, dólar
├─ expenses/              Dona, lista de movimientos
├─ accounts/              Cuentas, ciclo de tarjeta y recomendador
├─ investments/           Fila de posición
├─ debts/                 Deudas personales: lo que debes y lo que te deben
├─ subscriptions/         Lo que se cobra solo: baraja, resumen y alta
├─ settings/              Avisos, biometría, atajos, datos, DIAN
└─ ui/                    Card, Sheet, Segmented, CategoryIcon

lib/
├─ store.tsx              Estado + selectores derivados
├─ liquidez.ts            Proyección de saldo a 30/60/90 días
├─ tarjetas.ts            Corte, fecha límite y días de financiación
├─ salud.ts               Reparto 50/30/20 e indicadores
├─ anomalias.ts           Duplicados, gastos fantasma, subidas de precio
├─ fire.ts                Sueldo pasivo e independencia financiera
├─ dian.ts                UVT, topes de declaración y tarifas
├─ datos.ts               Exportar CSV, respaldo JSON, importar extractos
├─ parseo.ts              Leer un SMS del banco o una factura
├─ cola.ts                Cola de escrituras en IndexedDB
├─ avisos.ts              Qué recordar y cuándo
├─ webpush.ts             Cifrado RFC 8291 y firma VAPID
├─ canales.ts             Correo (Resend) y SMS (Twilio)
├─ biometria.ts           Cerrojo con WebAuthn
├─ deudas.ts              Saldo e intereses de un préstamo entre personas
├─ suscripciones.ts       Próximo cobro, coste mensual y anual, catálogo
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
el ticker, y **el ticker delante del nombre**: es con lo que se busca, se
compara y se opera, y antes había que deducirlo del logotipo.

El mismo archivo lleva los **nombres oficiales de mercado**, 242 instrumentos
(VOO → «Vanguard S&P 500 ETF»), que se resuelven sin red: la búsqueda de nombres
depende de una API que puede estar caída, y entonces la posición se quedaba
llamándose como su ticker. La tabla cubre **todos** los tickers con gestora en
el mapa: si un símbolo tiene logotipo, tiene nombre — tenerlo a medias sacaba
filas con el logotipo de Vanguard y el nombre «VBR».

El mapa vive en [`lib/issuers.ts`](lib/issuers.ts) y es explícito, sin reglas
por prefijo: «empieza por AV → Avantis» le pondría el logotipo de una gestora a
AVGO, que es Broadcom — y por el mismo motivo GDXY no cuelga de VanEck, que es
quien emite el GDX que ese fondo usa por debajo, sino de YieldMax, que es quien
lo emite. Lo que no está en el mapa —acciones sueltas, cripto— sigue mostrando
su ticker en la insignia, que ahí es justo la información útil.

---

## Deudas personales

En **Cuentas**, debajo de las cuentas: los bordes de dónde está tu dinero —el
que ya no es tuyo aunque lo tengas en la mano, y el que es tuyo aunque lo tenga
otro—. De cada deuda se guarda con quién es, cuánto fue, en qué moneda, desde
cuándo corre y, si lo pactaron, qué interés.

Va aparte de las cuentas de crédito porque el dato de partida es otro: una
tarjeta tiene cupo, corte y cuotas; un préstamo entre personas tiene un nombre
propio y un historial de abonos.

**Va en los dos sentidos.** Prestar pasa tanto como que le presten a uno, y
antes solo cabía la mitad: quien le había prestado a un amigo terminaba
anotándolo como deuda propia con una nota que decía «al revés», y el saldo
salía del lado equivocado en todas partes. Un préstamo a favor es un campo
(`direction`) y no otra tabla porque lo demás es idéntico —un nombre, un monto,
una fecha, una tasa opcional, un historial de abonos—; lo único que cambia es
hacia dónde va el dinero.

Eso sí cambia tres cosas. Los **rótulos**, que leídos al revés no dicen nada:
«¿quién te debe?» en vez de «¿a quién le debes?», «te pagó» en vez de «le
pagaste». El **signo del movimiento**: cobrar un préstamo entra a la cuenta y
prestar otro poco sale de ella, con categorías propias —«Préstamo a alguien» y
«Préstamo devuelto»— porque ninguna de las dos es un gasto ni un ingreso
corriente, es plata que va y vuelve. Y el **sentido queda fijo en cuanto hay un
abono**: cambiarlo después daría la vuelta a lo que significa cada movimiento ya
registrado, y esos no se pueden reescribir sin tocar saldos que ya se dieron por
buenos.

Los dos lados **no se suman en una cifra**. Que un amigo te deba dos millones no
paga el millón que le debes a tu mamá, y un neto escondería justo lo que uno
viene a mirar: a quién hay que pagarle y a quién hay que cobrarle. La lista se
divide en «Debo» y «Me deben», cada uno con su total.

**Los abonos son filas, no un campo.** Con interés, *cuándo* pagaste cambia
cuánto debes hoy, así que un total suelto no permitiría calcularlo. Y sin
interés sigue siendo lo que uno quiere ver: qué le has ido dando y en qué
fechas.

**El interés corre sobre el saldo pendiente**, no sobre el monto original. Si
te prestaron un millón al 2 % mensual y ya devolviste la mitad, el mes
siguiente el interés se calcula sobre lo que queda: cobrarlo sobre el millón
entero haría que pagar no sirviera de nada. El cálculo recorre el tiempo por
tramos —acumula hasta cada abono, lo resta, y sigue— en `lib/deudas.ts`.

La tasa se teclea mensual, que es como se pacta por aquí, y se guarda efectiva
anual como las de las cuentas. El formulario enseña la equivalencia, porque un
2 % mensual no es un 24 % anual sino un 26,8 %.

**Ni el saldo pendiente ni lo que se debe en tarjetas se descuentan del
patrimonio**, y es a propósito. Son dos
preguntas distintas —cuánto tienes y cuánto debes— y restarlas mezcla el dinero
que está en las cuentas con una obligación que se irá pagando desde esas mismas
cuentas: cada abono ya baja el saldo de la cuenta de la que sale, así que
descontarlo además del total lo contaría dos veces por el camino. La deuda se
enseña en su propio bloque, en el resumen bajo el patrimonio y en Cuentas.

**Lo que te deben tampoco se suma**, por el reflejo del mismo motivo: la plata
que prestaste salió de una cuenta cuyo saldo ya lo acusó, y volver a contarla
como activo la contaría dos veces. Va en su propio bloque, al lado del otro.

---

## Suscripciones

Pantalla propia, en **Suscripciones**, y no una categoría de gastos más, porque
la pregunta es otra. Un gasto se mira hacia atrás —en qué se me fue— y una
suscripción hacia adelante: qué me van a cobrar, cuándo, y cuánto suma todo
esto al año. Esa última cifra es la que sorprende y la que ninguna lista de
movimientos enseña: nueve cobros pequeños que nadie recuerda haber aceptado y
que juntos valen más que el arriendo de una semana.

**La fecha del próximo cobro no se guarda, se calcula.** De cada suscripción se
guarda un ancla —un día en el que cobraron— y el ciclo; la siguiente fecha sale
de los dos. Un «próximo cobro» guardado caduca en cuanto pasa: quien no abre la
app en dos meses volvería a una pantalla anunciando cobros de julio. Así sigue
saliendo bien dentro de un año y sin que nadie la mantenga. El cálculo recorta a
fin de mes como lo hacen los bancos —un cobro del 31 cae el 30 en un mes de 30—
pero siempre desde el ancla original, así que el mes siguiente vuelve al 31.

**El importe que se pide es el del ciclo**, lo que dice el recibo, y el promedio
mensual lo calcula la app: 219.000 al año son 18.250 al mes, y esa es la cuenta
que nadie hace. Es lo que permite comparar una anual con una mensual y con lo
que uno gana.

**El cobro se anota solo, y se confirma con un toque.** El día que toca, la app
crea el gasto en la cuenta de la suscripción y lo marca como sin confirmar.
Cuenta en el saldo desde el primer momento —el cobro pasa igual lo apunte
alguien o no, y un saldo que ignora lo que el banco ya se llevó no sirve para
decidir nada— y arriba de la pantalla queda esperando un «Sí» que diga que
llegó. Si no llegó, se borra y el saldo vuelve. En la lista de movimientos lleva
su distintivo de «sin confirmar» hasta que alguien lo diga.

Corre al abrir la app y no en un servidor, porque no hay servidor: esto vive en
el teléfono. Eso se nota —los cobros aparecen cuando uno entra, no a
medianoche— y obliga a dos defensas contra anotar dos veces lo mismo: el ancla
se adelanta en cuanto se anota, y antes de crear nada se comprueba que no exista
ya un movimiento de esa suscripción ese mismo día, que es lo que salva el caso
de dos teléfonos con la misma cuenta. Quien vuelve tras meses fuera recupera los
cobros que se perdió, hasta un tope de doce por suscripción: anotar cincuenta y
dos de golpe no es recuperar el historial, es llenar la pantalla de ruido.

**El plan del celular pregunta por la operadora.** Es la suscripción que todo el
mundo tiene y la única que nadie llama suscripción. La ficha de «plan de
celular» no rellena un nombre genérico: abre la lista de operadoras —Claro,
Movistar, Tigo, WOM, Virgin, ETB y las demás— y lo que se guarda es la marca,
con su logotipo y su color. El recibo lo manda Claro, no «Celular», y dentro de
un año lo que uno recuerda es de quién era la línea.

**Las pruebas y las compartidas tienen su propia cuenta.** Una prueba gratis no
suma al gasto, pero sí a «podrías ahorrar»: es lo que te quitas de encima si la
cancelas antes de que empiece a cobrar, que es el agujero clásico. Y una
compartida se paga entera desde tu cuenta aunque de tu bolsillo salga solo una
parte: la diferencia sale en «te deben».

**Dos formas según el ancho, no dos tamaños.** En el móvil las tarjetas van
apiladas como una baraja, solapándose, y se despliegan al tocarlas: así caben
siete en una pantalla. A partir de `lg` la píldora de la fecha baja a su propio
renglón y el detalle va siempre abierto, con el resumen fijo en un carril al
lado. El plegado va con `grid-template-rows` y `visibility`, no con altura ni
con `display`: es lo que permite que la misma marca esté cerrada en el móvil y
abierta en el escritorio sin preguntarle a JavaScript por el ancho de la ventana
—que es lo que provoca el parpadeo al hidratar— y deja el detalle fuera del
recorrido del tabulador mientras está cerrado.

**Cada servicio con su logotipo.** En una lista de nueve, el logotipo es lo que
se reconoce antes de leer, igual que en la bandeja de aplicaciones del teléfono.
Van en `public/services` como siluetas blancas con transparencia sobre una
baldosa oscura: cuatro kilobytes cada una, se ven igual en los dos temas y
ninguna marca choca con el color de su propia tarjeta. Lo que no está en el
catálogo cae al monograma, sobre la misma baldosa, porque «el parqueadero» no va
a estar en ningún catálogo y un hueco vacío se leería como una imagen que no
cargó.

Se llega desde **Gastos**, arriba del todo, con un acceso que enseña lo que
suman al mes y cuál es el próximo cobro; la barra de abajo ya va llena con seis
destinos y el botón de captura, y un séptimo dejaría las etiquetas en un tamaño
que no se lee. En escritorio tiene además su sitio en la barra lateral. En el
resumen no está a propósito: es una pantalla de llegada y ya lleva bastante.

Ese acceso **se enseña siempre, también sin ninguna suscripción registrada**.
Antes se escondía cuando la lista estaba vacía, y eso dejaba la función entera
inalcanzable en el teléfono: no se puede anotar la primera si la única puerta
aparece cuando ya hay una. El vacío es justo cuando más falta hace la puerta,
porque es cuando nadie sabe que la pantalla existe.

---

## Transferir a efectivo

Sacar plata del cajero es de lo más corriente que hay, y sin una cuenta de
efectivo creada a mano no había a dónde mandarla: el retiro terminaba anotado
como un gasto, que no lo es —el dinero sigue siendo tuyo, solo cambió de sitio—.

La hoja de **Transferir** ofrece siempre «Efectivo» como destino, el primero de
la tira. Si no existe la cuenta, se crea al confirmar y no al tocar la opción:
tocarla es mirar, no decidir, y una cuenta creada por mirar se queda para
siempre si se cierra la hoja. Hay una por moneda —los dólares en efectivo no
son los mismos pesos en efectivo— y no se ofrece cuando ya existe: entonces
aparece como una cuenta más.

---

## Zona horaria

En **Ajustes → Zona horaria**. Se detecta sola la del teléfono y se puede fijar
a mano: un viaje del que no se quiere que se muevan las cuentas, un teléfono con
la zona mal puesta, o quien prefiere cuadrar con su banco.

No es un adorno. Todo lo que aquí es «un día» —el día de un gasto, el resumen
de hoy, los límites de una semana o de un mes— depende de dónde esté quien la
usa. Sin fijarlo, **un gasto de las once de la noche en Bogotá se registraba
con la fecha del día siguiente**: `toISOString()` pasa a UTC antes de recortar
el día, y a esa hora en UTC ya es mañana. El formulario traía puesta la fecha
de mañana, la etiqueta decía «Hoy» tan tranquila, y el movimiento se guardaba
de verdad un día adelante.

Los rangos de período se llevan en días sueltos («2026-09-14») y se comparan
como texto, no como instantes: preguntar «¿qué día es este gasto para él?» es
la única forma de que uno de las once de la noche caiga donde debe. Y el
instante que se guarda es el real —se parte de ahora y se desplaza por días
enteros—, no uno reconstruido con las piezas de la fecha, que guardaba la hora
local como si fuera UTC y la dejaba corrida cinco horas para siempre.

---

## Apariencia

Oscuro, claro o lo que diga el teléfono, en **Ajustes → Apariencia**. Tres
opciones y no un interruptor: «automático» es lo que quiere quien tiene el
móvil programado para cambiar al anochecer, y con dos posiciones esa gente
tiene que entrar aquí dos veces al día.

Los dos temas viven en variables CSS (`app/globals.css`) y Tailwind las lee por
nombre, así que un color se cambia en un sitio y le sigue la app entera. Los
rellenos, que antes eran ciento cuarenta `bg-white/[0.05]` sueltos, pasaron a
cuatro niveles con nombre —`bg-fill-1` a `bg-fill-4`—: un blanco al 5 % sobre
fondo claro no se ve, y eran ciento cuarenta sitios donde el modo claro se
habría roto uno a uno.

El tema se aplica con un guion en línea antes del primer pintado, no en un
efecto de React: un efecto corre después de pintar, y con el tema claro
guardado la app abría en negro y saltaba a blanco un instante después. Ese
fogonazo es lo único que delata que esto es una web.

---

## Pagar la tarjeta

En **Cuentas → Pagar tarjeta**. Por dentro es una transferencia —el dinero sale
de una cuenta y entra en la tarjeta, que pasa a deber menos— pero merecía su
propia hoja: en la de transferir, la tarjeta era un destino más entre diez, con
su saldo en negativo y sin decir cuánto hay que pagar.

Aquí arriba está lo que se debe, debajo con qué se paga, y dos atajos: el total
o una cuota. **No cuenta como gasto**: el gasto ocurrió al pasar la tarjeta, y
anotarlo otra vez al pagar el extracto lo contaría dos veces en el mes.

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

**Requiere que las migraciones estén aplicadas** para crear la tabla `trades`.
Sin ella la app sigue funcionando, pero sin historial.

---

## Salud financiera

Una pantalla que responde a las preguntas que un saldo, por sí solo, no
responde. Se llega desde el resumen —la barra de abajo ya va llena con seis
destinos y el botón de captura— y desde la lateral en escritorio.

### Liquidez proyectada a 30, 60 y 90 días

La pregunta es «¿puedo hacer este gasto hoy sin quedarme sin dinero a fin de
mes?», y el saldo no la contesta: ahora casi siempre hay. Lo que no dice el
saldo es que el día 3 se va el arriendo, el 5 corta la tarjeta, el 8 cobran
cuatro suscripciones y el 15 hay que abonarle a alguien.

La línea junta seis cosas que ya están en la app:

```
  saldo líquido de hoy          cuentas, ahorros y efectivo
+ ingresos recurrentes          sueldo, arriendos, clientes fijos
− suscripciones                 lo que se cobra solo
− cuotas de tarjeta             lo ya facturado, en su fecha límite
− abonos de deudas con plazo    lo pactado con personas
− gasto corriente estimado      la mediana diaria de los últimos 60 días
```

La cifra grande no es el saldo de hoy ni el del final del tramo: es **el punto
más bajo**. El final puede acabar bien después de haber pasado por cero, y el
de hoy es justo el que engaña.

El último sumando es el único que no ocurrió: es una estimación, se puede
apagar con un toque y la tarjeta dice cuánto está aplicando. Sin él la
proyección es inútil y además peligrosa —una línea que solo baja los días de
cobro termina el mes en máximos y le diría a cualquiera que puede gastar lo que
quiera—, pero nadie deja de comer entre quincena y quincena. Se usa la mediana
y no la media: la nevera que se compró hace un mes no es el martes típico.

Debajo hay un simulador. Se escribe una cifra y la app dice «sí», «sí, pero
queda justo» o «te quedarías corto», con el día crítico y lo que quedaría. El
colchón mínimo no es cero: quedarse exactamente en cero el peor día significa
que cualquier imprevisto pasa a ser un sobregiro, así que por debajo de una
semana de gasto corriente la respuesta es «justo» —que no es un no, es un sí
con la cifra delante—.

### Necesidades, deseos y ahorro (50/30/20)

Las categorías se reparten solas en los tres grupos. Tres decisiones que no son
obvias y conviene tener escritas:

- **Mercado es necesidad, restaurantes es deseo.** Comer hay que comer; comer
  fuera es una elección, y es la que más se desmadra sin que nadie se dé cuenta.
- **Las cuotas de tarjeta y de préstamo son necesidad.** No porque comprar a
  cuotas lo fuera, sino porque a estas alturas ya no se puede no pagarlas.
- **Lo que prestas a alguien es ahorro, no gasto.** Sale de la cuenta pero sigue
  siendo tuyo.

El ahorro incluye **lo que sencillamente no se gastó**. Sin eso, quien vive muy
por debajo de sus medios pero deja el dinero quieto en la cuenta aparecería con
un 0 % de ahorro y un aviso rojo, que es exactamente al revés de lo que está
haciendo.

Los casos de frontera son reales y personales —el gimnasio es salud para quien
va y un recibo olvidado para quien no—, así que cualquier categoría se puede
mover de grupo. Se guarda en el dispositivo: es una preferencia de lectura, y
ninguna cifra de dinero depende de ella.

El retiro en cajero queda fuera del reparto y la tarjeta lo dice. Sacar plata no
es gastarla, y contarla duplicaría todo lo que luego se pague en efectivo.

### Cinco indicadores y un puntaje

Colchón de emergencia, tasa de ahorro, carga de deuda, peso de lo prescindible y
peso de lo recurrente. Los cinco se enseñan por separado además de en el total,
porque un 62 sobre 100 no dice qué arreglar y «cubres 1,2 meses de gastos» sí.
El colchón y el ahorro pesan más que el resto: el primero decide si un imprevisto
es un mal rato o una deuda, y el segundo es lo único que construye el primero.

### Anomalías y gastos fantasma

Lo que uno no pregunta porque no sabe que hay algo que preguntar:

| Detector | Qué busca | Cuánta historia necesita |
|---|---|---|
| Duplicados | Mismo importe **exacto**, misma cuenta, ≤ 4 días | 35 días |
| Categoría disparada | ≥ 35 % y ≥ $40.000 sobre la semana típica | 4 semanas con gasto |
| Gasto fantasma | Mismo comercio y monto 3 meses seguidos, sin estar en suscripciones | 3 cobros en 3 meses |
| Subida de precio | Una suscripción que cobra ≥ 8 % más que la vez anterior | 2 cobros |
| Gasto atípico | Un movimiento 4× la mediana de su categoría | 8 movimientos previos |

Dos reglas de diseño, porque un detector que se equivoca mucho se ignora entero:
**nada se marca sin una cifra que lo sostenga** («un 68 % más que tu semana
típica, $140.000 de diferencia», no «gastaste más en comida»), y **cada
detector se calla hasta tener historia suficiente**.

El importe de un duplicado tiene que coincidir al peso. Con tolerancia, dos
cafés del mismo sitio en la misma semana salían marcados, y un aviso falso al
día enseña a ignorar todos los avisos.

Cada aviso se descarta con un toque. Sin eso, el duplicado que sí era real se
queda en la pantalla para siempre y en tres semanas nadie lee la tarjeta.

### Sueldo pasivo (FIRE)

El indicador que manda es **cuánto de tus gastos del mes paga ya tu dinero**, no
«te faltan 23,4 años». El primero se comprueba, sube cuando aportas y convierte
una meta lejana en una barra que se mueve; el segundo depende de rendimientos
que nadie conoce y da una precisión que no existe, así que va debajo, en gris y
con sus supuestos al lado.

Se enseñan dos cifras juntas a propósito: la **estimada** (el capital por la tasa
de retiro seguro) y la **realmente cobrada** en dividendos y rendimientos de los
últimos doce meses. Un fondo de acumulación no reparte nada y sale en cero
aunque el portafolio crezca; enseñar solo esa diría que no rinde, y enseñar solo
la estimada escondería que todavía no entra un peso.

La tasa del 4 % viene del estudio Trinity, hecho sobre carteras en dólares. En
pesos conviene ser más conservador, y lo que se pide es el rendimiento **real**
—ya descontada la inflación—: un CDT al 11 % con inflación del 6 % no renta un
11 %, renta un 5 % escaso.

---

## Tarjetas de crédito: corte y fecha límite

Dos fechas que todo el mundo confunde y que deciden cuánto dinero gratis te
presta el banco.

El **corte** es el día en que la tarjeta cierra el período: todo lo comprado
hasta ese día entra en el extracto que están a punto de emitir. La **fecha
límite de pago** es el día en que hay que pagar ese extracto, entre quince y
veinte días después. En el corte no hay que hacer nada; en el límite sí.

De ahí sale la única jugada que de verdad da dinero con una tarjeta: **comprar el
día después del corte**. Esa compra no entra en el extracto que acaba de cerrar
sino en el siguiente, que se paga un mes y medio más tarde. Comprar la víspera
es lo contrario: entra en el extracto que cierra mañana y se paga en dos semanas.

```
Tarjeta que corta el 15 y se paga el 5:

  compra el 14 de septiembre  →  extracto del 15 sep  →  paga el 5 oct   (21 días)
  compra el 16 de septiembre  →  extracto del 15 oct  →  paga el 5 nov   (50 días)
```

Con la misma tarjeta y la misma compra. El **recomendador** ordena las tarjetas
por días de financiación y no por cupo disponible, que es lo que uno miraría sin
pensar: el cupo dice si la compra cabe, los días dicen cuánto tiempo el dinero
sigue en tu cuenta en vez de en la del banco. Aparece en la pantalla de Salud y,
en compacto, dentro del registro rápido —justo donde se elige con qué se paga—.

Las descartadas se enseñan igual, atenuadas y con el motivo. Esconderlas dejaría
a alguien mirando la pantalla con la tarjeta en la mano sin entender por qué no
aparece.

El cálculo da por hecho que la compra se paga entera el día del límite. Diferir a
cuotas tiene una tasa detrás: ahí ya no es dinero gratis, y la app lo dice.

Los avisos de las dos fechas van con colores distintos y el de pago manda cuando
caen cerca: el límite es una tarea con consecuencias y el corte es información
que abre una oportunidad. Mezclarlos es lo que hace que la gente los confunda.

---

## TRM y el dólar

La app usa dos tasas y **no son la misma**, aunque las dos den «pesos por dólar»:

- **`/api/fx`** — el precio de mercado. Lo que vale un dólar ahora mismo en el
  mundo. Sirve para pintar el patrimonio al instante.
- **`/api/trm`** — la Tasa Representativa del Mercado, que calcula la
  Superintendencia Financiera con las operaciones del día hábil anterior. Es la
  que manda para lo que tiene consecuencias: declarar ante la DIAN, cuadrar con
  el banco cuando llega la factura de una compra en dólares, valorar un
  portafolio en un informe.

Se separan por décimas de por ciento, pero no son intercambiables, y usar la de
mercado donde toca la oficial es la clase de error que solo aparece meses después
al cuadrar con un extracto. La fuente es el conjunto `32sa-8pi3` de
[datos.gov.co](https://www.datos.gov.co/), abierto y sin llave. Si no responde se
cae al precio de mercado y **se dice que es una aproximación**.

Detalle que no es intuitivo: la TRM tiene vigencia de un día completo y se
publica con un día de desfase. Un sábado devuelve la del viernes, y eso es
correcto.

### La tasa se guarda con el movimiento

Todo movimiento en dólares guarda la TRM del día en que se registró. Esa es toda
la diferencia entre «esto costó» y «esto costaría hoy». Sin el dato, una compra
de US$100 de enero se revalorizaba sola cada vez que el dólar se movía: el gasto
de un mes ya cerrado cambiaba de cifra al abrir la app, y la diferencia en cambio
—que es un resultado real del patrimonio— quedaba invisible porque estaba
repartida entre todos los movimientos.

Con la tasa guardada, la pantalla de Salud puede decir cuánto de tu patrimonio
depende del dólar, cuánto cambia por cada peso que se mueva, qué pasa con una
subida o bajada del 5 %, y **cuánto te ha dado o quitado el dólar** sobre lo que
ya está registrado.

---

## Registrar un gasto sin abrir la app

Cuatro caminos, todos por el mismo intérprete (`lib/parseo.ts`), así que mejorar
el reconocimiento del Éxito o de Terpel los arregla todos a la vez.

### Atajos de iOS y webhooks

En *Ajustes → Atajos y automatizaciones* se crea un token. Dos formas de usarlo:

```
GET  /api/quick-add?token=…&amount=15000&category=food&account=Nequi

POST /api/quick-add
     Authorization: Bearer …
     Content-Type: text/plain

     Bancolombia le informa compra por $47.900 en EXITO ENVIGADO…
```

El `GET` existe porque un atajo de iOS manda una URL y nada más. Es menos
elegante que un `POST` y es lo que hace que esto se use. El `POST` con texto
plano es el que lee el SMS entero: de ahí salen el monto, el comercio, la
categoría y el banco.

**Cómo se autoriza.** No hay sesión: un atajo no tiene cookies. La escritura la
hace una función de Postgres `security definer` que comprueba el token antes de
tocar nada, y el token se guarda **cifrado con SHA-256**, nunca en claro. Este
servidor nunca ve la llave de servicio de Supabase. El token solo puede
**insertar un movimiento**: ni leer saldos, ni borrar, ni ver nada de la cuenta.
Si se filtra, lo peor que pasa es que alguien anote gastos falsos, y se revoca de
un toque.

Se enseña una sola vez, al crearlo. Del hash no se vuelve atrás; es el mismo
trato que hacen GitHub y Stripe con sus llaves.

### Foto de la factura

Un botón de cámara en el registro rápido. Antes de subir nada intenta reconocer
el texto **en el propio teléfono** con `TextDetector` (Chrome de Android): ahí la
foto no sale del dispositivo y responde en menos de un segundo. Donde eso no
existe —iPhone, escritorio— se reduce a 1.600 px y se manda al servidor, que la
pasa por Google Vision o por OCR.space, el primero que esté configurado.

Rellena el formulario y **no guarda**: el botón queda a un toque pero la última
palabra la tiene quien mira. Un OCR sobre papel térmico se equivoca lo suficiente
como para que guardar a ciegas sea mala idea.

La foto no se guarda en ningún momento. Una factura lleva el comercio, la fecha,
la hora y a veces los últimos dígitos de la tarjeta.

### Dictado

El que ya estaba: «cuarenta y cinco mil en comida».

---

## Trabajar sin señal

El caso dura treinta segundos y pasa todas las semanas: sales del parqueadero de
un centro comercial y registras lo que acabas de pagar. No hay señal.

Toda escritura que no consigue salir se guarda en **IndexedDB** y se reenvía, en
orden, en cuanto vuelve la red. Un indicador flotante dice cuántas cosas esperan
—en condiciones normales, ninguna— y se puede tocar para reintentar ya.

**Se intercepta en el `fetch` del cliente de Supabase, no en cada mutación.** La
alternativa era envolver las cuarenta y cinco escrituras del store una a una:
habría funcionado y habría sido frágil para siempre, porque cada escritura nueva
nace fuera de la cola hasta que alguien se acuerde de meterla, y nadie se
acuerda. Además así se guarda la petición exacta que iba a salir, y reproducirla
es literalmente volver a mandarla.

Detalles que importan:

- **El token no se guarda.** La cabecera `Authorization` lleva un JWT que caduca
  en una hora; se quita al encolar y se vuelve a poner, recién sacado de la
  sesión, justo antes de reenviar.
- **Se para en el primer fallo recuperable.** Las escrituras tienen orden entre
  sí —se crea una cuenta y después se le ajusta el saldo— y adelantar una por
  encima de otra que falló deja los datos en un estado que no ocurrió nunca.
- **Un 409 se da por bueno.** Significa que la petición sí llegó y lo que se
  perdió fue la respuesta.
- **Un 4xx no se reintenta pero tampoco se borra.** Es un movimiento del usuario
  y tiene derecho a verlo.
- Donde existe **Background Sync** (Chrome, Edge) el sistema despierta al service
  worker aunque la pestaña esté cerrada. En iPhone no existe, así que la cola se
  vacía al volver a la app —peor, pero cubre el caso—.

---

## Recordatorios

Un aviso la víspera sirve; el mismo aviso dentro de la app, no: el día que se te
olvida pagar la tarjeta es justamente un día en que no la abriste.

Se avisa de cobros de suscripción, cortes y pagos de tarjeta, deudas con plazo y
**pruebas gratis que están por terminar** —este último con tres días, porque es
el único que sirve para no gastar y cancelar el mismo día ya no sirve de nada—.

El criterio de qué merece un aviso: **solo lo que se puede arreglar el día
anterior**. Que la tarjeta corte mañana se puede aprovechar; que el patrimonio
haya bajado un 2 % no se arregla con nada. Una app que manda notificaciones que
no llevan a ninguna acción se silencia entera, y con ella las que sí importaban.

Tres canales, todos opcionales:

| Canal | Requiere | Llega con la app cerrada |
|---|---|---|
| Web Push | `VAPID_*` | Sí, con `CRON_SECRET` y el cron diario |
| Correo | `RESEND_API_KEY` | Sí |
| SMS | `TWILIO_*` | Sí, solo lo urgente |
| Local | Nada | No: solo con la app abierta |

El cifrado del Web Push (RFC 8291) y la firma VAPID (RFC 8292) están escritos a
mano sobre `node:crypto`, sin la biblioteca `web-push`. Node ya trae ECDH sobre
P-256, HKDF y AES-128-GCM; lo que queda es encadenarlos en el orden que dice la
especificación. Y una dependencia que firma y cifra es una dependencia que, el
día que se comprometa, tiene en la mano las llaves y el contenido de todos los
avisos.

En iPhone los avisos web **solo funcionan con la app instalada** en la pantalla
de inicio. La app lo detecta y lo explica, en vez de enseñar un botón que no va a
hacer nada.

---

## Bloqueo con Face ID, Touch ID o huella

Un cerrojo con WebAuthn para cuando la app vuelve de segundo plano. Qué es y qué
no es, porque la diferencia importa:

- **Lo que hace:** si alguien coge tu teléfono desbloqueado y abre la app, se
  encuentra una pantalla que pide tu cara o tu huella. Ese es el riesgo real de
  una app de finanzas en un móvil que se deja en una mesa.
- **Lo que no hace:** proteger los datos de alguien que controle el dispositivo.
  La comprobación ocurre en el navegador y no la verifica ningún servidor.
  Quien guarda la puerta de verdad es Supabase: sin sesión válida no devuelve una
  sola fila.

No se guarda ninguna huella ni ninguna imagen. La clave vive en el chip seguro
del teléfono —el Secure Enclave en iPhone— y de aquí solo sale un identificador
público. Se puede elegir cada cuánto volver a pedirla; «a los 15 minutos»
significa quince minutos **fuera** de la app, no usándola.

---

## Exportar, respaldar e importar

Tres cosas que parecen la misma:

- **CSV** para *mirar*: abrirlo en Excel, mandárselo al contador. Pierde
  información —bolsillos, asignaciones, el enlace entre un abono y su
  movimiento— y por eso **no vale como respaldo**.
- **JSON** para *volver*: lo trae todo y se restaura entero. Un archivo que solo
  se puede descargar y nunca devolver no es un respaldo, es un recuerdo.
- **Importar** para *traer* el extracto que descarga el banco.

El CSV se escribe con punto y coma, con BOM y con coma decimal sin separador de
miles. Las tres cosas salieron de archivos que se abrían mal: con comas, Excel en
español mete «45» y «900» en dos columnas; sin BOM, «Suscripción» sale
«SuscripciÃ³n»; con punto de miles, «1.250.000» se convierte en 1,25.

La **restauración** escribe con `upsert` sobre el id y no borrando antes: si la
escritura se corta a la mitad, borrar primero habría dejado la cuenta vacía, que
es exactamente el desastre del que un respaldo debería proteger.

### Importar un extracto bancario

Tres pasos, y el del medio es el que hace que funcione: elegir el archivo, decir
qué columna es cuál, y revisar antes de escribir.

El paso del mapeo existe porque no hay dos bancos que exporten igual —uno manda
el monto con signo en una columna, otro parte débitos y créditos en dos, unos
escriben `12/09/2026` y otros `20260912`— y casi todos meten tres o cuatro líneas
de logo antes de la cabecera de verdad. La app detecta el separador, busca dónde
empieza la tabla, propone el mapeo por el nombre de las columnas y deja
corregirlo. Adivinar sin preguntar significa importar seiscientos movimientos con
el signo al revés y descubrirlo tres días después.

Volver a importar el mismo archivo no duplica nada: cada fila lleva una
referencia construida con la cuenta, la fecha, el importe y la descripción.

---

## Declaración de renta (DIAN)

*Ajustes → Declaración de renta* responde a la pregunta de cada agosto: **¿me toca
declarar?** Y si toca, deja el desglose listo para sentarse a hacerlo.

Todo el sistema tributario colombiano se expresa en **UVT**, que la DIAN fija cada
año por resolución:

| Año gravable | UVT | Norma |
|---|---|---|
| 2026 | $52.374 | Resolución DIAN 000238 del 15-dic-2025 |
| 2025 | $49.799 | Resolución DIAN 000193 de 2024 |
| 2024 | $47.065 | Resolución DIAN 000187 de 2023 |
| 2023 | $42.412 | Resolución DIAN 001264 de 2022 |

**Cuál se usa: la del año gravable, no la del año en que se declara.** La
declaración que se presenta en 2026 es la del año gravable 2025 y va con la UVT
de 2025. Confundirlas es el error más común y mueve los topes un 5 % largo, justo
en el margen donde está la gente que duda.

Basta superar **uno** de estos cinco para quedar obligado (cifras del AG 2025):

| Tope | UVT | En pesos |
|---|---|---|
| Patrimonio bruto al 31 de diciembre | 4.500 | $224.095.500 |
| Ingresos brutos | 1.400 | $69.718.600 |
| Consumos con tarjeta de crédito | 1.400 | $69.718.600 |
| Compras y consumos totales | 1.400 | $69.718.600 |
| Consignaciones, depósitos e inversiones | 1.400 | $69.718.600 |

Y también quien fue responsable de IVA en cualquier momento del año.

Los cinco se enseñan siempre, no solo el que dispara: el valor está en ver lo
cerca que se anda de los otros. Quien va por el 90 % del tope de consignaciones en
septiembre sabe que el año que viene le toca, y eso es accionable hoy.

Dos que sorprenden: **«bruto» significa sin restar deudas** —un apartamento
hipotecado cuenta por su valor completo— y **pasarte plata de una cuenta tuya a
otra también consigna**.

También se listan los beneficios de la cédula general con su tope: renta exenta
del 25 % (790 UVT), dependientes (72 UVT cada uno, hasta cuatro), 1 % de compras
con factura electrónica (240 UVT), intereses de vivienda (1.200 UVT), medicina
prepagada (192 UVT) y aportes voluntarios (30 % del ingreso, hasta 3.800 UVT). El
conjunto no puede pasar del 40 % de los ingresos netos ni de 1.340 UVT —salvo
dependientes y factura electrónica, que quedan **fuera** de ese límite—.

**Lo que esto no hace, y está escrito en la pantalla:** no calcula el impuesto
definitivo. Faltan datos que la app no tiene por qué conocer —seguridad social,
retenciones practicadas, dependientes, qué parte del patrimonio es la casa,
ganancias ocasionales— y una cifra de impuesto a medias es peor que ninguna
porque se cree. Y las cifras salen de lo registrado aquí: la DIAN cruza lo que
reportan bancos, empleadores y comercios, así que lo que no se anotó no aparece.

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
- [ ] **`VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` para los avisos.** Se generan
      con un comando de Node, sin instalar nada (ver `.env.example`). Sin ellas
      los recordatorios salen igual, pero solo con la app abierta — que es
      justo cuando no hacen falta.
- [ ] **`CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` para el aviso de la
      víspera.** El trabajo diario está declarado en `vercel.json` y llama a
      `/api/push/recordatorios`. Es el único sitio de la app que usa la llave de
      servicio, y el porqué está escrito en la cabecera de esa ruta: a las ocho
      de la mañana no hay ninguna sesión y hay que mirar los datos de todas las
      cuentas. Sin estas dos variables la ruta está apagada y no pasa nada más.
- [ ] **`GOOGLE_VISION_API_KEY` u `OCR_SPACE_API_KEY` para leer facturas.** Solo
      hacen falta donde el navegador no sabe reconocer texto por su cuenta —o
      sea, en iPhone y en escritorio—. Sin ninguna, el botón de la cámara lo
      dice en vez de fallar.
- [ ] **Aplicar las migraciones nuevas.** `supabase db push` con las cinco de
      `20260917*`: la TRM y el origen de cada movimiento, el ciclo de las
      tarjetas, los ingresos recurrentes, la ingesta rápida y los avisos. Sin
      ellas la app arranca igual pero cada pantalla nueva avisa de que su tabla
      no existe.
- [ ] **Volver a desplegar tras añadirlas.** Vercel congela las variables en el
      build. *Ajustes → Datos de mercado* confirma si el servidor las ve, y el
      pie de esa pantalla dice qué commit está sirviendo la app.

### Código

- [ ] **Sin tiempo real en la cola.** La cola reenvía en cuanto vuelve la red,
      pero si el mismo movimiento se editó en otro dispositivo mientras tanto,
      gana el último que llegue. Con dos teléfonos y un movimiento editado a la
      vez en los dos, uno de los dos cambios se pierde sin avisar.
- [ ] **Los errores de escritura siguen siendo mudos** fuera de la cola. Un
      fallo de red ya se recupera solo, pero si Supabase rechaza una escritura
      por otra razón —una restricción, un permiso— solo lo dicen las deudas y
      las suscripciones; el resto lo traga en silencio.
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

- [x] **Registrar sin señal ya no pierde nada.** Toda escritura que no consigue
      salir se guarda en IndexedDB y se reenvía, en orden, en cuanto vuelve la
      red. Se intercepta en el `fetch` del cliente de Supabase y no en cada
      mutación, así que cubre las cuarenta y cinco escrituras de hoy y las que
      se añadan mañana. Ver `lib/cola.ts`.
- [x] **El cifrado de los avisos está probado de extremo a extremo.** El cuerpo
      que produce `lib/webpush.ts` se descifra con la clave del navegador
      simulado y la firma VAPID se valida contra su llave pública. Sin esa
      comprobación, un error en la derivación de claves produce un aviso que el
      servicio de push acepta y el navegador descarta en silencio.
- [x] **Las fechas de los ciclos no se corren.** Un ingreso del 31 de enero cae
      el 28 en febrero y vuelve al 31 en marzo, en vez de quedarse en el 28
      para siempre. Cada fecha se cuenta desde el ancla, nunca encadenando una
      sobre la anterior.
- [x] El esquema cubre todo lo que el cliente escribe: bolsillos
      (`pockets` jsonb), cupo y cuotas de las tarjetas, `goals`, y la
      restricción única `budgets_user_id_category_id_key` que necesita el
      upsert de presupuestos. RLS activo en las cinco tablas.
- [x] **Las tarjetas de crédito no caducan.** Nada en el código las borra ni
      las reinicia; lo que las hacía «vencer» era la carga: cuando la consulta
      al servidor fallaba, la app se pasaba a Modo Demo, pintaba las cuentas de
      ejemplo y a partir de ahí guardaba solo en el teléfono, sin llegar nunca
      a Supabase. Corregido: la copia local se escribe siempre y bajo la clave
      del usuario, y una lectura fallida conserva la sesión y avisa en pantalla.
