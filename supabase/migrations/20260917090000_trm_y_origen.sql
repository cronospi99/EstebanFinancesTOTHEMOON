-- ===========================================================================
--  La TRM del día, el comercio y de dónde salió cada movimiento
-- ===========================================================================
--  Tres columnas que responden a tres preguntas que hasta ahora no tenían
--  dónde vivir.
--
--  `fx_rate` es la tasa a la que se convirtió un movimiento en dólares el día
--  que ocurrió. Guardarla —y no recalcular con la tasa de hoy— es lo que
--  separa dos cifras que no son la misma: lo que costó y lo que costaría hoy.
--  Sin ella, una compra de US$100 de enero se revaloriza sola cada vez que el
--  dólar se mueve, el histórico de gasto cambia solo, y la diferencia en
--  cambio —que es un resultado real del patrimonio— queda invisible porque
--  está repartida entre todos los movimientos.
--
--  `merchant` es el comercio. Sale de un SMS del banco, de la foto de una
--  factura o de un extracto importado, y no cabía en `description`: esa es la
--  nota que escribe una persona, y pisarla con «PAYU*NETFLIX» perdería lo
--  único que el usuario había escrito.
--
--  `source` dice quién anotó el movimiento. Es lo que permite confiar de
--  distinta manera en cada uno: lo que tecleó una persona está bien, lo que
--  leyó una foto hay que mirarlo. También es lo que hace posible deshacer una
--  importación entera sin llevarse por delante lo registrado a mano.
--
--  `external_id` es el identificador que traía el origen: el id del correo,
--  la referencia del extracto. Con un índice único por usuario, reenviar dos
--  veces el mismo SMS —o volver a importar el mismo CSV— no duplica el gasto.
-- ===========================================================================

alter table public.transactions
  -- Pesos por dólar el día del movimiento. Nula en los movimientos en pesos:
  -- ahí no hay nada que convertir y un 1 sería ruido.
  add column if not exists fx_rate numeric(14,4),
  add column if not exists merchant text,
  -- 'manual' es lo que había antes de esta columna, y por eso es el valor por
  -- defecto: todo lo ya registrado lo tecleó una persona.
  add column if not exists source text not null default 'manual'
    check (source in ('manual','voz','foto','sms','atajo','import','suscripcion')),
  add column if not exists external_id text;

-- Un mismo origen no puede entrar dos veces. Parcial —solo donde hay id—
-- porque lo registrado a mano no trae ninguno y todos serían el mismo null.
create unique index if not exists transactions_external_idx
  on public.transactions (user_id, external_id)
  where external_id is not null;

-- PostgREST guarda el esquema en memoria: sin este aviso las columnas nuevas
-- no existen para la API hasta que se reinicie.
notify pgrst, 'reload schema';
