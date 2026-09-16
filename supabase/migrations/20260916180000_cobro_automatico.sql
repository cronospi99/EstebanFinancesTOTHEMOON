-- ===========================================================================
--  El cobro de una suscripción se anota solo
-- ===========================================================================
--  Hasta ahora la app no creaba ningún movimiento por su cuenta: el día del
--  cobro ofrecía un botón y ya. Suena prudente y en la práctica no lo es —el
--  cobro pasa igual, lo apunte alguien o no, y un saldo que ignora lo que el
--  banco ya se llevó no sirve para decidir nada—.
--
--  Así que ahora se anota solo el día que toca y se marca como sin confirmar.
--  Cuenta en el saldo desde el primer momento y queda esperando un toque que
--  diga que sí llegó; si no llegó, se borra y el saldo vuelve.
-- ===========================================================================

alter table public.transactions
  -- Qué suscripción lo generó. Es lo que distingue un gasto que puso la app de
  -- uno que puso una persona, y lo que evita anotar dos veces el mismo cobro.
  -- Si la suscripción se borra, el movimiento se queda: el dinero salió.
  add column if not exists subscription_id uuid
    references public.subscriptions (id) on delete set null,
  -- Sin confirmar. Por defecto falso: todo lo que ya existe lo puso una
  -- persona, y eso no hay nada que confirmarlo.
  add column if not exists pending boolean not null default false;

-- Los pendientes se consultan juntos en cada carga para ofrecerlos a confirmar.
create index if not exists transactions_pending_idx
  on public.transactions (user_id, pending)
  where pending;

-- Y los de una suscripción, para no repetir un cobro ya anotado.
create index if not exists transactions_subscription_idx
  on public.transactions (user_id, subscription_id, occurred_at);

-- PostgREST guarda el esquema en memoria: sin este aviso las columnas nuevas
-- no existen para la API hasta que se reinicie.
notify pgrst, 'reload schema';
