-- ===========================================================================
--  Ingesta rápida: registrar un gasto desde fuera de la app
-- ===========================================================================
--  El caso: llega el SMS del banco —«Compra por $47.900 en EXITO»— y anotarlo
--  cuesta abrir la app, tocar el más, teclear la cifra y elegir categoría. Un
--  atajo de iOS que lea ese SMS y lo mande a una URL lo convierte en un toque,
--  y lo que no cuesta nada sí se hace.
--
--  El problema de diseño es quién escribe. Todo lo demás en esta base cuelga
--  de `auth.uid()`, y un atajo de iOS no tiene sesión: manda una petición
--  suelta desde el teléfono, sin cookies y sin pasar por el navegador.
--
--  Había tres caminos y este es el tercero:
--
--   1. La llave de servicio en el servidor. Salta la seguridad por filas
--      entera. Basta que se filtre una variable de entorno —o que un fallo de
--      la ruta la devuelva en un mensaje de error— para que cualquiera lea y
--      escriba los datos de todos. Para una app que guarda cuánto dinero tiene
--      cada quien, no.
--   2. Una política que deje insertar al anónimo. La llave anónima viaja en el
--      navegador de todo el mundo: sería una tabla abierta.
--   3. Una función `security definer` que exige un token. Es lo que hay aquí.
--      La función es lo único que puede escribir sin sesión, solo hace una
--      cosa, y sin un token válido no hace ni esa.
--
--  El token se guarda cifrado con SHA-256, nunca en claro. Si alguien se
--  llevara la base entera no podría usar ninguno: del hash no se vuelve. A
--  cambio, el token se enseña una sola vez, cuando se crea. Es el mismo trato
--  que hacen GitHub y Stripe con sus llaves, y por el mismo motivo.
-- ===========================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ingest_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 en hexadecimal. Nunca el token.
  token_hash  text not null unique,
  -- Los primeros caracteres, para poder distinguir dos tokens en una lista sin
  -- guardar ninguno entero: «eftm_a1b2…».
  prefijo     text not null default '',
  -- Para qué es: «Atajo de iOS», «Automatización del SMS».
  nombre      text not null default 'Atajo',
  -- Cuándo se usó por última vez. Es lo que delata un token olvidado —o uno
  -- que está usando alguien más.
  last_used_at timestamptz,
  usos        int not null default 0,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists ingest_tokens_user_idx on public.ingest_tokens (user_id, revoked);

alter table public.ingest_tokens enable row level security;

drop policy if exists "own rows" on public.ingest_tokens;
create policy "own rows" on public.ingest_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_user_id_trg on public.ingest_tokens;
create trigger set_user_id_trg
  before insert on public.ingest_tokens
  for each row execute function public.set_user_id();

-- ---------------------------------------------------------------------------
-- La función que escribe
-- ---------------------------------------------------------------------------
--  `security definer` significa que corre con los permisos de quien la creó y
--  no de quien la llama, así que se salta la seguridad por filas. Por eso todo
--  lo que hace está acotado a mano: resuelve el usuario a partir del token,
--  y a partir de ahí no vuelve a mirar ningún identificador que venga de
--  fuera sin comprobar que sea de ese usuario.
--
--  `set search_path` es obligatorio en una función así: sin fijarlo, quien
--  llama podría anteponer un esquema propio y hacer que `digest` o
--  `transactions` apunten a otra cosa.
create or replace function public.ingesta_rapida(
  p_token       text,
  p_amount      numeric,
  p_category    text default 'other',
  p_type        text default 'expense',
  p_description text default '',
  p_merchant    text default null,
  p_currency    text default 'COP',
  -- Nombre de la cuenta o su id. Un atajo de iOS manda «Nequi», no un uuid.
  p_account     text default null,
  p_occurred_at timestamptz default now(),
  p_source      text default 'atajo',
  p_external_id text default null,
  p_fx_rate     numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash    text;
  v_user    uuid;
  v_account uuid;
  v_nombre  text;
  v_id      uuid;
  v_delta   numeric;
  v_existe  uuid;
begin
  if p_token is null or length(p_token) < 20 then
    raise exception 'token inválido' using errcode = '28000';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select user_id into v_user
  from public.ingest_tokens
  where token_hash = v_hash and not revoked;

  -- Un solo mensaje para «no existe» y para «está revocado»: distinguirlos le
  -- diría a quien prueba tokens al azar cuándo ha acertado uno.
  if v_user is null then
    raise exception 'token inválido' using errcode = '28000';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'el monto tiene que ser mayor que cero' using errcode = '22023';
  end if;

  if p_type not in ('expense','income') then
    raise exception 'tipo no admitido' using errcode = '22023';
  end if;

  -- Reenviar dos veces el mismo SMS no cobra dos veces. Se devuelve el
  -- movimiento que ya existía, para que quien llama vea un éxito y no un
  -- error que le haga reintentar.
  if p_external_id is not null then
    select id into v_existe
    from public.transactions
    where user_id = v_user and external_id = p_external_id;
    if v_existe is not null then
      return jsonb_build_object('id', v_existe, 'duplicado', true);
    end if;
  end if;

  -- La cuenta: por id si vino un uuid válido y es de este usuario, si no por
  -- nombre, y si tampoco, la primera cuenta que tenga. Nunca una ajena: todas
  -- las consultas filtran por `user_id`.
  if p_account is not null and p_account <> '' then
    begin
      select id, name into v_account, v_nombre
      from public.accounts
      where user_id = v_user and id = p_account::uuid;
    exception when invalid_text_representation then
      v_account := null;
    end;

    if v_account is null then
      select id, name into v_account, v_nombre
      from public.accounts
      where user_id = v_user
        and (name ilike p_account or institution ilike p_account)
      order by created_at
      limit 1;
    end if;
  end if;

  if v_account is null then
    select id, name into v_account, v_nombre
    from public.accounts
    where user_id = v_user and type <> 'investment'
    order by created_at
    limit 1;
  end if;

  if v_account is null then
    raise exception 'no hay ninguna cuenta donde registrarlo' using errcode = '23503';
  end if;

  insert into public.transactions (
    user_id, account_id, category_id, amount, type, description,
    merchant, occurred_at, currency, source, external_id, fx_rate
  ) values (
    v_user, v_account, coalesce(nullif(p_category, ''), 'other'), p_amount, p_type,
    coalesce(nullif(p_description, ''), coalesce(p_merchant, '')),
    p_merchant, coalesce(p_occurred_at, now()),
    case when p_currency in ('COP','USD') then p_currency else 'COP' end,
    case when p_source in ('manual','voz','foto','sms','atajo','import','suscripcion')
         then p_source else 'atajo' end,
    p_external_id, p_fx_rate
  )
  returning id into v_id;

  -- El saldo vive como cifra en la fila de la cuenta, no como la suma de los
  -- movimientos: insertar la fila no lo mueve por sí solo. Es el mismo paso
  -- que da la app al registrar desde el teléfono; omitirlo aquí dejaría el
  -- gasto anotado y el saldo intacto.
  v_delta := case when p_type = 'income' then p_amount else -p_amount end;
  update public.accounts set balance = balance + v_delta where id = v_account;

  update public.ingest_tokens
  set last_used_at = now(), usos = usos + 1
  where token_hash = v_hash;

  return jsonb_build_object(
    'id', v_id,
    'duplicado', false,
    'cuenta', v_nombre,
    'monto', p_amount,
    'categoria', coalesce(nullif(p_category, ''), 'other')
  );
end;
$$;

-- Quien llama no tiene sesión: es la llave anónima la que ejecuta. La función
-- exige el token, que es lo que de verdad autoriza.
grant execute on function public.ingesta_rapida(
  text, numeric, text, text, text, text, text, text, timestamptz, text, text, numeric
) to anon, authenticated;

notify pgrst, 'reload schema';
