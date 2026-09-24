export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment'
export type TxType = 'expense' | 'income' | 'transfer'
export type AssetType = 'stock' | 'etf' | 'crypto' | 'fx' | 'cdt'
export type Currency = 'COP' | 'USD'

/** Bolsillo: subdivisión de una cuenta, como los de Nequi o Lulo. */
export interface Pocket {
  id: string
  name: string
  balance: number
  /** Rendimiento efectivo anual en %, si el bolsillo lo genera. */
  apy?: number
  color?: string
}

export interface Account {
  id: string
  name: string
  institution: string
  type: AccountType
  /** Saldo en la moneda de la cuenta. Los bolsillos suman aparte. */
  balance: number
  currency: Currency
  color: string
  /** Rendimiento efectivo anual en % de la cuenta. */
  apy?: number
  pockets?: Pocket[]
  /** Solo tarjetas de crédito: cupo total aprobado. */
  creditLimit?: number
  /** Solo tarjetas de crédito: cuotas pactadas de la deuda actual. */
  installments?: number
  /** Solo tarjetas de crédito: cuotas ya pagadas. */
  installmentsPaid?: number
  /**
   * Solo tarjetas de crédito: día del mes en que cierra el extracto.
   *
   * Es la fecha que decide en cuál de los dos extractos cae una compra, y con
   * ella cuánto falta para pagarla. Comprar el día después del corte da hasta
   * mes y medio sin intereses; comprar la víspera, dos semanas. Ver
   * `tarjetas.ts`.
   */
  statementDay?: number
  /**
   * Solo tarjetas de crédito: día del mes en que empieza el período, cuando el
   * banco lo imprime y no es el día siguiente al corte.
   *
   * En casi todas las tarjetas sobra: el período cierra el día del corte y
   * empieza el siguiente, así que se deduce. Pero hay bancos que imprimen tres
   * fechas —«inicio del período: 4 de septiembre, fecha de corte: 5 de
   * octubre, fecha de pago: 15 de octubre»— porque el corte no es el fin del
   * período sino el día en que emiten el extracto, un par de días más tarde.
   * Ahí deducir el inicio del corte se equivoca en dos días, y esos dos días
   * son un mes de diferencia en cuándo hay que pagar lo que se compró en
   * ellos. Vacío = se deduce. Ver `tarjetas.ts`.
   */
  periodStartDay?: number
  /**
   * Solo tarjetas de crédito: cuánto del saldo ya venía facturado, dicho por ti.
   *
   * La app sabe repartir el saldo entre lo facturado y lo del ciclo en curso
   * mirando los movimientos registrados, pero eso solo funciona si están todos
   * registrados. Quien anota el saldo de la tarjeta a mano y no cada compra se
   * queda sin ese reparto, y entonces el saldo entero se da por facturado —el
   * lado prudente— y sale un «pago vencido» por plata que en realidad es del
   * ciclo nuevo. Este campo es la salida: decirlo y punto.
   *
   * Va emparejado con `statementBalanceAt` y no vale por sí solo. Ver
   * `deudaPorCiclo`.
   */
  statementBalance?: number
  /**
   * A qué extracto se refiere `statementBalance`: la fecha de ese corte.
   *
   * Es lo que hace que la declaración caduque sola. «No debo nada» es cierto
   * del extracto del 5 de septiembre, no de todos los que vengan: cuando el
   * banco emita el siguiente, esta fecha deja de coincidir con el corte
   * anterior y la app vuelve a deducir el reparto. Sin esto, un «no debo nada»
   * dicho una vez callaría los avisos para siempre, que es peor que el aviso
   * falso que vino a arreglar.
   */
  statementBalanceAt?: string
  /**
   * Solo tarjetas de crédito: día del mes en que vence el pago del extracto.
   *
   * Va aparte del corte porque son dos fechas distintas y confundirlas cuesta
   * dinero: el corte no hay que hacer nada, el límite sí. Suele caer entre 15
   * y 20 días después del corte, ya en el mes siguiente.
   */
  dueDay?: number
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  /**
   * 'transfer' no sale en ningún selector: es la etiqueta interna de los
   * movimientos entre cuentas, que no son ni gasto ni ingreso. Sin ella, la
   * transferencia tendría que colgar de una categoría de gasto y aparecería
   * ofrecida como presupuestable.
   */
  kind: 'expense' | 'income' | 'transfer'
  /** Agrupa en el selector para que la lista larga siga siendo navegable. */
  group: string
  /**
   * El único espacio en el que se ofrece. Vacío = en los dos.
   *
   * «Mecato» no pinta nada en la caja de un negocio, ni «Nómina» en la de una
   * persona. Las que el código usa por su id —suscripciones, préstamos,
   * transferencias— no llevan nada: tienen que existir en los dos.
   */
  espacio?: 'personal' | 'negocio'
  /** Grupo en el que sale dentro del negocio, cuando el de siempre es de casa. */
  grupoNegocio?: string
}

export interface Transaction {
  id: string
  accountId: string
  /** Bolsillo concreto dentro de la cuenta, si aplica. */
  pocketId?: string
  /**
   * Cuenta de destino. Solo en las transferencias, y ahí es obligatoria.
   *
   * Una transferencia es un movimiento con dos puntas y no dos movimientos:
   * guardarla partida en un gasto y un ingreso obliga a mantenerlos
   * sincronizados al editar y al borrar, y basta con que uno se pierda para
   * que aparezca dinero de la nada.
   */
  toAccountId?: string
  /**
   * Bolsillo de destino, dentro de la cuenta a la que llega.
   *
   * Cuando `toAccountId` es la misma cuenta que `accountId`, el movimiento es
   * un reparto interno: de un bolsillo a otro, o entre un bolsillo y el saldo
   * general. El total de la cuenta no cambia y aun así se movió dinero —un
   * bolsillo tiene su propio saldo, y a veces su propio rendimiento—, que es
   * lo que antes había que hacer editando los dos saldos a mano.
   *
   * Vacío significa el saldo general de la cuenta, no «ninguno».
   */
  toPocketId?: string
  categoryId: string
  amount: number
  type: TxType
  description: string
  occurredAt: string
  /** Moneda en la que se registró; por defecto la de la cuenta. */
  currency?: Currency
  /**
   * La suscripción que lo generó, si lo generó una.
   *
   * Es lo que permite saber que un gasto lo puso la app y no una persona, y
   * con ello no volver a ponerlo dos veces por el mismo cobro.
   */
  subscriptionId?: string
  /**
   * Anotado por la app y todavía sin confirmar por su dueño.
   *
   * Cuenta en el saldo desde el primer momento —el cobro de una suscripción va
   * a pasar, y un saldo que ignora lo que ya está cobrado no sirve para
   * decidir nada—, pero se marca hasta que alguien diga que sí llegó. Los dos
   * fallos posibles son distintos: uno se arregla con un toque y el otro, no
   * anotarlo, se arregla cuando el banco ya cobró y nadie se acuerda.
   */
  pending?: boolean
  /**
   * Pesos por dólar el día en que ocurrió. Solo en movimientos en USD.
   *
   * Se guarda la tasa y no se recalcula con la de hoy, y esa es toda la
   * diferencia entre «esto costó» y «esto costaría hoy». Sin el dato, una
   * compra de US$100 de enero se revalorizaba sola cada vez que el dólar se
   * movía: el gasto de un mes cerrado cambiaba de cifra al abrir la app, y la
   * diferencia en cambio —que es un resultado de verdad del patrimonio—
   * quedaba invisible, repartida entre todos los movimientos.
   */
  fxRate?: number
  /**
   * El comercio, tal y como lo dijo el banco o la factura.
   *
   * No se mezcla con `description` a propósito: esa es la nota que escribe una
   * persona, y pisarla con «PAYU*NETFLIX COL» borraría lo único que el usuario
   * había puesto de su parte.
   */
  merchant?: string
  /** Quién lo anotó. Ver `TxSource`. */
  source?: TxSource
  /**
   * El identificador que traía el origen: el del SMS, la referencia del
   * extracto. Es lo que impide que reenviar dos veces el mismo mensaje —o
   * volver a importar el mismo archivo— cobre dos veces.
   */
  externalId?: string
}

/**
 * Quién anotó un movimiento.
 *
 * Importa porque no todos merecen la misma confianza: lo que tecleó una
 * persona está bien, lo que leyó una foto hay que mirarlo. Y porque permite
 * deshacer una importación entera sin llevarse por delante lo registrado a
 * mano, que es lo que uno quiere cuando el mapeo de columnas salió torcido.
 */
export type TxSource = 'manual' | 'voz' | 'foto' | 'sms' | 'atajo' | 'import' | 'suscripcion'

export interface Budget {
  categoryId: string
  amount: number
  /**
   * Tope de gasto en un solo día para esta categoría, si se quiere.
   *
   * Convive con `amount` porque son la misma decisión a dos plazos: «500.000
   * al mes» dice cuánto cabe, «40.000 en un día» impide gastárselo el martes.
   */
  dailyCap?: number
}

/**
 * Dinero de una cuenta asignado a un presupuesto — un bolsillo virtual.
 *
 * Asignar NO mueve dinero: el saldo de la cuenta sigue siendo el del banco.
 * Lo único que cambia es cuánto de ese saldo está libre. Por eso son filas y
 * no un campo del presupuesto: un mismo presupuesto puede fondearse desde
 * varias cuentas, y hay que poder restar de cada una lo que salió de ella.
 *
 * Un importe negativo retira dinero del bolsillo. Se guarda como fila nueva en
 * vez de editar la anterior, así el historial queda entero.
 */
export interface BudgetAllocation {
  id: string
  categoryId: string
  /** Cuenta de origen. Se queda vacía si la cuenta se borra después. */
  accountId?: string
  amount: number
  note?: string
  createdAt: string
}

/** Preferencias que no cuelgan de ninguna entidad. */
export interface Settings {
  /** Tope de gasto diario para todo, sin distinguir categoría. */
  dailyCap?: number
  /**
   * Cuántos días antes avisar de un cobro. `undefined` = no avisar.
   *
   * Un día es lo que hay que poder mover: avisar el mismo día de la fecha
   * límite no deja hacer nada si el dinero está en otra cuenta, y avisar con
   * una semana se olvida igual que no avisar.
   */
  avisoDias?: number
  avisarSuscripciones?: boolean
  avisarTarjetas?: boolean
  avisarDeudas?: boolean
  /** Correo para los avisos. Vacío = el de la sesión. */
  avisoEmail?: string
}

/** Meta de ahorro: un objetivo con importe y, si se quiere, fecha límite. */
export interface Goal {
  id: string
  name: string
  target: number
  saved: number
  currency: Currency
  /** ISO (solo día). Opcional: no toda meta tiene plazo. */
  deadline?: string
  color: string
  /** Bolsillo donde vive el dinero, si está separado en uno. */
  accountId?: string
  pocketId?: string
}

/**
 * De qué lado está el préstamo.
 *
 * `owe` es la deuda de toda la vida: alguien te prestó. `lent` es la misma
 * historia contada al revés —prestaste tú— y necesita ser un campo y no otra
 * tabla porque todo lo demás es idéntico: un nombre, un monto, una fecha, una
 * tasa opcional y un historial de abonos. Lo único que cambia es hacia dónde
 * va el dinero, y por eso cambia el signo del movimiento que se crea al
 * cuadrar y cambia cada rótulo de la pantalla.
 */
export type DebtDirection = 'owe' | 'lent'

/**
 * Préstamo entre personas: lo que le debes a alguien —o lo que alguien te
 * debe— y no a un banco.
 *
 * Va aparte de las cuentas de crédito porque el dato de partida es otro. Una
 * tarjeta tiene cupo, corte y cuotas; un préstamo entre personas tiene con
 * quién es, cuánto fue, desde cuándo y —si lo pactaron— qué interés corre.
 * Meterlo como cuenta en negativo obligaba a inventar una institución y dejaba
 * sin sitio lo único que de verdad se consulta: cuánto se lleva pagado.
 */
export interface Debt {
  id: string
  /** La otra persona: a quién le debes, o quién te debe. */
  person: string
  /**
   * Quién le prestó a quién. Las deudas de antes de que existiera el campo son
   * todas `owe`, que es lo único que se podía registrar entonces.
   */
  direction: DebtDirection
  /** El monto prestado, en la moneda de la deuda. */
  principal: number
  currency: Currency
  /**
   * Interés efectivo anual en %. Sin él la deuda no genera intereses, que es
   * el caso normal entre conocidos.
   *
   * Se guarda anual aunque casi siempre se pacte mensual («el 2 % al mes»)
   * porque es como lo guardan las cuentas y así una tasa significa lo mismo en
   * toda la app. La conversión la hace el formulario.
   */
  rate?: number
  /** Desde cuándo corre la deuda. ISO (solo día). */
  startedAt: string
  /** Cuándo quedó de pagarla, si hay plazo. ISO (solo día). */
  dueDate?: string
  note?: string
  color: string
}

/**
 * Un abono a una deuda, la deba quien la deba.
 *
 * Filas y no un campo `pagado` en la deuda: con interés, *cuándo* se pagó
 * cambia cuánto se debe hoy —cada abono baja el saldo sobre el que corre la
 * tasa—, así que un total suelto no permitiría calcularlo. Y sin interés
 * sigue siendo lo que uno quiere ver: qué se ha ido dando y en qué fechas.
 */
export interface DebtPayment {
  id: string
  debtId: string
  /**
   * Lo que baja la deuda. Negativo la sube: un cargo.
   *
   * Que pueda ir en los dos sentidos es lo que permite cuadrar cuentas de
   * verdad. Entre personas la deuda no solo se paga: también crece porque el
   * otro puso algo más, o se corrige porque alguien se equivocó al apuntar.
   *
   * El signo es siempre respecto al saldo, no respecto a tu bolsillo: en un
   * préstamo que hiciste tú, un positivo es lo que te devolvieron y un
   * negativo es lo que le prestaste de más. Quién recibe la plata lo decide
   * `direction`, no este número.
   */
  amount: number
  occurredAt: string
  note?: string
  /**
   * De dónde salió el dinero, cuando salió de algún sitio.
   *
   * Puede ser una cuenta o una tarjeta —pagarle a alguien con la tarjeta es
   * cambiar de acreedor, no dejar de deber— y al registrarlo se crea el
   * movimiento correspondiente para que el saldo de esa cuenta lo acuse.
   */
  accountId?: string
  /**
   * Un movimiento que ya existía y que se cruza contra la deuda.
   *
   * Es el caso que no cabía de ninguna otra forma: pagaste algo con la tarjeta
   * que en realidad era de la otra persona, ese gasto ya está registrado, y lo
   * que falta es decir que descuenta de lo que le debes. Crear un movimiento
   * nuevo lo cobraría dos veces; aquí solo se enlaza.
   */
  transactionId?: string
}

/** Cómo se saldó un abono. Se deduce de los campos, no se guarda. */
export type FormaDeAbono = 'cuenta' | 'cruce' | 'ajuste'

/*
 * Manda `accountId`, y por eso va primero.
 *
 * Pagar desde una cuenta también deja `transactionId`: el del movimiento que
 * el propio abono creó, que es lo que permite deshacerlo después. Preguntar
 * antes por `transactionId` daba «cruzado con un gasto» a todos los pagos, que
 * es justo lo contrario de lo que pasó. Un cruce es el único caso en que hay
 * movimiento pero no salió dinero de ninguna cuenta por este abono.
 */
export const formaDeAbono = (p: Pick<DebtPayment, 'accountId' | 'transactionId'>): FormaDeAbono =>
  p.accountId ? 'cuenta' : p.transactionId ? 'cruce' : 'ajuste'

/**
 * Cada cuánto se cobra una suscripción.
 *
 * Cerrado a cinco ciclos y no a «cada N días» a propósito: así se cobra de
 * verdad —al mes, al año, y de vez en cuando por trimestre o semestre— y un
 * catálogo cerrado permite decir «un pago anual» en vez de «cada 365 días»,
 * que es como lo diría cualquiera.
 */
export type SubCycle = 'semanal' | 'mensual' | 'trimestral' | 'semestral' | 'anual'

/**
 * Una suscripción: lo que se cobra solo, mes tras mes, sin que nadie decida
 * nada.
 *
 * Va aparte de los gastos normales porque la pregunta es otra. Un gasto se
 * mira hacia atrás —en qué se me fue— y una suscripción hacia adelante: qué me
 * van a cobrar, cuándo, y cuánto suma todo esto al año. Esa última cifra es la
 * que sorprende: nueve cobros pequeños que nadie recuerda haber aceptado y que
 * juntos valen más que el arriendo de una semana.
 *
 * No genera movimientos por su cuenta. La app no corre en un servidor que
 * pueda despertarse el día 19 a cobrar, y un movimiento inventado sin que el
 * banco lo haya cobrado deja el saldo mintiendo. Lo que hay es un botón para
 * registrarlo cuando llega, que además sirve de recordatorio.
 */
export interface Subscription {
  id: string
  /** Cómo se llama el servicio: Netflix, iCloud+, el gimnasio. */
  name: string
  /** Lo que cobran cada ciclo, en su moneda. */
  amount: number
  currency: Currency
  cycle: SubCycle
  /**
   * Un día en el que cobraron —o van a cobrar—. De aquí sale todo lo demás.
   *
   * Se guarda un ancla y no «el próximo cobro» porque el próximo cobro caduca:
   * quien no abre la app en dos meses volvería a una fecha pasada. Con el ancla
   * y el ciclo, la siguiente fecha se calcula siempre, y sigue saliendo bien
   * dentro de un año.
   */
  anchorAt: string
  /** Con qué se paga. Sirve para avisar de la tarjeta que vence. */
  accountId?: string
  /**
   * Si es una prueba gratis, cuándo deja de serlo. ISO (solo día).
   *
   * Es el agujero clásico: la prueba de un mes que nadie cancela y que lleva
   * cobrando desde marzo. Por eso tiene campo propio y su propio filtro.
   */
  trialEndsAt?: string
  /**
   * Entre cuántos se reparte, contándote a ti. 1 o vacío = la pagas tú solo.
   *
   * Lo que sale de tu bolsillo es el importe entre esta cifra; el resto te lo
   * deben. Un plan familiar de cuatro no cuesta lo que dice la factura.
   */
  sharedWith?: number
  /** Cancelada: se conserva por historial, pero ya no cuenta en los totales. */
  cancelled?: boolean
  note?: string
  color: string
}

/**
 * Cada cuánto entra un ingreso recurrente.
 *
 * Es el catálogo de las suscripciones más la quincena, que en Colombia es el
 * ciclo del sueldo y no cabía en ninguno de los otros: «cada 15 días» son 24
 * pagos al año y dos veces al mes son 24 también, pero caen en días
 * distintos, y el 30 y el 15 es como paga casi todo el mundo.
 */
export type IncomeCycle = 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual'

/**
 * Un ingreso que se repite: el sueldo, el arriendo que cobras, el cliente fijo.
 *
 * Es el espejo de una suscripción y comparte su forma a propósito —un ancla,
 * un ciclo, un importe—, pero no es una suscripción de signo cambiado: los
 * totales de «cuánto se me va al mes» se habrían llenado de cifras que entran.
 *
 * Existe por la proyección de liquidez. Sin saber qué entra, un saldo
 * proyectado a 90 días solo puede bajar, y una app que le dice a cualquiera
 * que en tres meses estará en cero no sirve para decidir nada. La quincena del
 * 30 es justo lo que convierte un mes apretado en un mes normal.
 *
 * A diferencia de las suscripciones, no anota movimientos por su cuenta. Los
 * dos errores no son simétricos: un cobro que la app dio por hecho y no
 * ocurrió se corrige con un toque, pero un sueldo que se da por recibido y no
 * llegó deja el saldo mintiendo hacia arriba, que es el lado caro.
 */
export interface RecurringIncome {
  id: string
  name: string
  amount: number
  currency: Currency
  cycle: IncomeCycle
  /** Un día en que entró —o va a entrar—. De aquí sale todo lo demás. */
  anchorAt: string
  /** En qué cuenta cae. Sin ella suma al total pero no se sabe dónde estará. */
  accountId?: string
  /** Se apaga sin borrarse: un contrato que terminó deja de proyectarse. */
  active?: boolean
  note?: string
  color: string

  /*
   * ---- Nómina --------------------------------------------------------------
   * Opcional: un arriendo que cobras o un cliente fijo no tienen nada de esto.
   * Cuando está, `amount` deja de ser un dato suelto y pasa a ser el resultado
   * del cálculo —lo que llega a la cuenta— mientras que `salarioBase` es lo
   * que dice el contrato. El cálculo va de bruto a neto y nunca al revés. Ver
   * `lib/nomina.ts`.
   */

  /** Sueldo mensual pactado, sin recargos ni descuentos. */
  salarioBase?: number
  /** Recibe auxilio de transporte. No cotiza, pero sí entra en la prima. */
  auxilioTransporte?: boolean
  /**
   * Cotiza a salud y pensión como empleado.
   *
   * Falso en una prestación de servicios, donde el aporte lo hace el
   * contratista sobre el 40 % del ingreso y con otras reglas: calcularlo como
   * nómina daría una cifra equivocada, y no calcular nada es mejor que eso.
   */
  cotiza?: boolean
  /** Los turnos de la semana, para los recargos. Ver `Turno` en `nomina.ts`. */
  turnos?: { dia: number; desde: number; hasta: number }[]
  /**
   * Si le toca trabajar los festivos.
   *
   * No es un detalle en Colombia: son dieciocho al año y once caen en lunes.
   * Para quien trabaja los lunes, la respuesta vale casi un turno festivo al
   * mes pagado al noventa por ciento —o un turno menos, si libra—, y no hay
   * manera de adivinarla mirando el horario. Ver `calcularRecargos`.
   */
  trabajaFestivos?: boolean
  /**
   * Si las horas que pasan de la jornada se pagan como extra.
   *
   * Falso por defecto, y es deliberado. Darlas por pagadas al 125 % daba por
   * hecho que el empleador liquida extras todas las semanas, y con un sueldo
   * mensual y un horario largo eso casi nunca es verdad: o hay descansos que
   * no se estaban restando, o sencillamente no se pagan. Suponerlo inventaba
   * ingreso, que es el error que hace daño.
   */
  pagaExtras?: boolean
}

export interface Holding {
  id: string
  symbol: string
  name: string
  /** Admite fracciones: 0,085 BTC o 2,4 acciones. */
  quantity: number
  avgCost: number
  assetType: AssetType
  currency: Currency
  /** Cuenta de inversión a la que pertenece (ARQ, Trii, Insights…). */
  accountId?: string
}

/**
 * Operación de inversión: una compra o una venta concreta.
 *
 * El libro de operaciones es la fuente de verdad; la posición (`Holding`) se
 * recalcula a partir de él. Antes solo se guardaba la posición: al registrar
 * una compra se fundía en el promedio y la operación desaparecía, así que no
 * había historial que consultar ni forma de corregir una cifra mal tecleada
 * sin rehacer la posición entera a mano.
 */
export interface Trade {
  id: string
  symbol: string
  name: string
  side: 'buy' | 'sell'
  /** Admite fracciones, igual que la posición. */
  quantity: number
  /** Precio por unidad de esta operación, en su moneda. */
  price: number
  currency: Currency
  assetType: AssetType
  /** Plataforma donde se hizo (ARQ, Insights, Tyba, Trii). */
  accountId?: string
  occurredAt: string
  /**
   * Marca la operación sintética que representa una posición anterior al libro.
   * Se crea sola la primera vez que se toca un símbolo que ya existía, para que
   * el historial explique la posición completa en vez de arrancar a mitad.
   */
  opening?: boolean
}

export interface Quote {
  symbol: string
  price: number
  previousClose: number
  change: number
  changePercent: number
  currency: string
  stale?: boolean
  /** Proveedor que respondió. Sirve para diagnosticar por qué falta un precio. */
  source?: string
}
