-- ===========================================================================
--  Préstamos a favor: la deuda contada al revés
-- ===========================================================================
--  Hasta ahora una deuda solo podía ir en un sentido —alguien te prestó— y la
--  mitad que falta pasa igual de seguido: prestaste tú. Quien lo intentaba
--  terminaba anotándolo como una deuda propia con una nota que decía «al
--  revés», y el saldo salía del lado equivocado en todas partes.
--
--  Va como columna y no como tabla aparte porque lo demás es idéntico: un
--  nombre, un monto, una fecha, una tasa opcional y un historial de abonos.
--  Lo único que cambia es hacia dónde va el dinero.
-- ===========================================================================

alter table public.debts
  -- 'owe'  = te prestaron, tú debes.
  -- 'lent' = prestaste tú, te deben.
  -- Por defecto 'owe': es lo único que se podía registrar antes de esta
  -- migración, así que lo ya guardado queda dicho tal como se registró.
  add column if not exists direction text not null default 'owe'
    check (direction in ('owe','lent'));

-- Las dos listas se leen por separado —lo que debes y lo que te deben— y cada
-- pantalla pide una sola.
create index if not exists debts_user_direction_idx
  on public.debts (user_id, direction);

-- PostgREST guarda el esquema en memoria: sin este aviso la columna no existe
-- para la API hasta que se reinicie, y el primer préstamo que la use falla con
-- un «column not found» que no se parece en nada a la causa.
notify pgrst, 'reload schema';
