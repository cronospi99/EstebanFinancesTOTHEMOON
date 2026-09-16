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
├─ debts/                 Deudas personales: lo que debes y lo que te deben
├─ subscriptions/        Lo que se cobra solo: baraja, resumen y alta
└─ ui/                    Card, Sheet, Segmented, CategoryIcon

lib/
├─ store.tsx              Estado + selectores derivados
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
