-- ===========================================================================
--  Fecha de corte y fecha límite de pago
-- ===========================================================================
--  Dos fechas que todo el mundo confunde y que deciden cuánto dinero gratis te
--  presta el banco.
--
--  El CORTE es el día en que la tarjeta cierra el período: todo lo que compres
--  hasta ese día entra en el extracto que están a punto de emitirte. El LÍMITE
--  DE PAGO es el día en que hay que pagar ese extracto, unos quince o veinte
--  días después.
--
--  De ahí sale la única jugada que de verdad importa con una tarjeta de
--  crédito: comprar el día DESPUÉS del corte. Esa compra no entra en el
--  extracto que acaba de cerrar, sino en el siguiente, que se paga un mes y
--  medio más tarde. Comprar el día ANTES del corte es lo contrario: entra en
--  el extracto que cierra mañana y hay que pagarla en dos semanas.
--
--  Entre las dos jugadas hay hasta 45 días de financiación sin un peso de
--  interés, con la misma tarjeta y la misma compra. Por eso son dos columnas y
--  no una: con solo el día de pago no se puede responder a «¿con cuál pago
--  hoy?», que es la pregunta que se hace en la fila del supermercado.
--
--  Se guardan como día del mes (1-31) y no como fecha: el ciclo se repite
--  todos los meses y una fecha concreta caducaría al mes siguiente. Los meses
--  cortos se recortan al pintar —un corte el 31 cae el 28 en febrero—, igual
--  que ya se hace con el cobro de las suscripciones.
-- ===========================================================================

alter table public.accounts
  -- Día del mes en que cierra el extracto.
  add column if not exists statement_day int
    check (statement_day is null or (statement_day between 1 and 31)),
  -- Día del mes en que vence el pago de ese extracto. Casi siempre cae en el
  -- mes siguiente al corte, y el cálculo lo resuelve al leer.
  add column if not exists due_day int
    check (due_day is null or (due_day between 1 and 31));

-- PostgREST guarda el esquema en memoria: sin este aviso las columnas nuevas
-- no existen para la API hasta que se reinicie.
notify pgrst, 'reload schema';
