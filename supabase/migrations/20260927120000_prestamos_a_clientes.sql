-- ===========================================================================
--  Préstamos a clientes, y funciones que se desbloquean con un código
-- ===========================================================================
--  Dos cosas que van juntas porque la primera es la primera que necesita la
--  segunda: prestar plata con interés mensual fijo no es para todos los que
--  usan la app, así que se enciende por usuario.
--
--  El candado vive en la base de datos y no en la pantalla. Esconder un botón
--  no protege nada —cualquiera puede escribir la dirección de la página, o
--  hablarle a la API con su propio token—, así que las políticas de las
--  tablas de préstamos exigen que el usuario tenga la función desbloqueada.
--  Sin ella, leer devuelve cero filas y escribir se rechaza.
-- ===========================================================================

-- ---- Qué tiene desbloqueado cada usuario ------------------------------------
create table if not exists public.funciones_desbloqueadas (
  user_id         uuid not null references auth.users (id) on delete cascade,
  funcion         text not null check (funcion in ('prestamos')),
  desbloqueada_el timestamptz not null default now(),
  primary key (user_id, funcion)
);

alter table public.funciones_desbloqueadas enable row level security;
-- Cada uno ve lo suyo. No hay política de escritura a propósito: nadie se
-- desbloquea una función insertando la fila, solo con un código válido (la
-- función de abajo) o porque el dueño se la da desde el panel de Supabase.
drop policy if exists "ver las propias" on public.funciones_desbloqueadas;
create policy "ver las propias" on public.funciones_desbloqueadas for select
  using (auth.uid() = user_id);

-- ---- Los códigos --------------------------------------------------------------
-- Se guarda el hash y no el código: quien lea la tabla no se lleva códigos
-- utilizables. Sin políticas: RLS encendida y ninguna regla es «nadie», así
-- que desde la app no se puede ni listar.
create table if not exists public.codigos_desbloqueo (
  codigo_hash text primary key,
  funcion     text not null check (funcion in ('prestamos')),
  usos_max    int not null default 1 check (usos_max > 0),
  usos        int not null default 0 check (usos >= 0),
  activo      boolean not null default true,
  nota        text,
  creado_el   timestamptz not null default now()
);
alter table public.codigos_desbloqueo enable row level security;

-- Un código se escribe como se quiera —«abcd-ef12-3456», con espacios, en
-- minúsculas— y vale igual: se normaliza antes de calcular el hash.
create or replace function public.normalizar_codigo(p_codigo text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- ¿Tiene el usuario de la sesión esta función? La usan las políticas de las
-- tablas: con `security definer` para poder mirar la tabla de desbloqueos
-- aunque cambien sus políticas.
create or replace function public.tiene_funcion(p_funcion text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.funciones_desbloqueadas
    where user_id = auth.uid() and funcion = p_funcion
  )
$$;

-- Canjear un código. Un solo mensaje de error para «no existe», «ya se gastó»
-- y «está apagado»: distinguirlos le diría a quien prueba códigos al azar
-- cuándo ha acertado uno.
create or replace function public.desbloquear_funcion(p_codigo text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user    uuid := auth.uid();
  v_codigo  text := public.normalizar_codigo(p_codigo);
  v_funcion text;
begin
  if v_user is null then
    raise exception 'hace falta iniciar sesión' using errcode = '28000';
  end if;
  if length(v_codigo) < 8 then
    raise exception 'código inválido' using errcode = '22023';
  end if;

  select funcion into v_funcion
  from public.codigos_desbloqueo
  where codigo_hash = encode(extensions.digest(v_codigo, 'sha256'), 'hex')
    and activo and usos < usos_max
  for update;

  if v_funcion is null then
    raise exception 'código inválido' using errcode = '22023';
  end if;

  -- Quien ya la tiene no gasta un uso del código: volver a meterlo por error
  -- no puede dejar a la siguiente persona sin su desbloqueo.
  if exists (select 1 from public.funciones_desbloqueadas where user_id = v_user and funcion = v_funcion) then
    return v_funcion;
  end if;

  update public.codigos_desbloqueo
  set usos = usos + 1
  where codigo_hash = encode(extensions.digest(v_codigo, 'sha256'), 'hex');

  insert into public.funciones_desbloqueadas (user_id, funcion) values (v_user, v_funcion);
  return v_funcion;
end;
$$;

revoke all on function public.desbloquear_funcion(text) from public, anon;
grant execute on function public.desbloquear_funcion(text) to authenticated;

-- Crear un código, para el dueño de la app. Se ejecuta desde el SQL Editor de
-- Supabase y devuelve el código en claro UNA vez —solo se guarda su hash—:
--
--   select public.crear_codigo_desbloqueo('prestamos', 1, 'para Juan');
--
-- Doce caracteres al azar dan 2^48 combinaciones: probar códigos a ciegas no
-- es un camino.
create or replace function public.crear_codigo_desbloqueo(
  p_funcion text default 'prestamos',
  p_usos    int  default 1,
  p_nota    text default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_codigo text := upper(encode(extensions.gen_random_bytes(6), 'hex'));
begin
  insert into public.codigos_desbloqueo (codigo_hash, funcion, usos_max, nota)
  values (encode(extensions.digest(v_codigo, 'sha256'), 'hex'), p_funcion, p_usos, p_nota);
  return substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4) || '-' || substr(v_codigo, 9, 4);
end;
$$;

-- Solo desde el panel: ni la llave anónima ni un usuario con sesión pueden
-- fabricarse códigos.
revoke all on function public.crear_codigo_desbloqueo(text, int, text) from public, anon, authenticated;

-- ---- Los préstamos ------------------------------------------------------------
create table if not exists public.prestamos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  espacio      text not null default 'personal' check (espacio in ('personal', 'negocio')),
  cliente      text not null check (length(trim(cliente)) > 0),
  telefono     text,
  monto        numeric(16,2) not null check (monto > 0),
  -- En % mensual: 10 es el diez por ciento al mes.
  tasa_mensual numeric(7,3) not null check (tasa_mensual >= 0),
  fecha        date not null,
  nota         text,
  archivado    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.prestamo_pagos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  prestamo_id uuid not null references public.prestamos (id) on delete cascade,
  fecha       date not null,
  -- Un pago se parte en lo que va a intereses y lo que baja el capital. Las
  -- dos a la vez es lo normal el día del corte.
  interes     numeric(16,2) not null default 0 check (interes >= 0),
  capital     numeric(16,2) not null default 0 check (capital >= 0),
  nota        text,
  created_at  timestamptz not null default now(),
  -- Un pago de cero no es un pago.
  check (interes > 0 or capital > 0)
);

create index if not exists prestamos_usuario_idx on public.prestamos (user_id, espacio);
create index if not exists prestamo_pagos_prestamo_idx on public.prestamo_pagos (prestamo_id);

do $$
declare
  t text;
begin
  foreach t in array array['prestamos', 'prestamo_pagos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    -- Suyas Y con la función desbloqueada: ver la nota del principio.
    execute format($p$
      create policy "own rows" on public.%I for all
        using (auth.uid() = user_id and public.tiene_funcion('prestamos'))
        with check (auth.uid() = user_id and public.tiene_funcion('prestamos'))
    $p$, t);
    execute format('drop trigger if exists set_user_id_trg on public.%I', t);
    execute format(
      'create trigger set_user_id_trg before insert on public.%I for each row execute function public.set_user_id()', t);
  end loop;
end $$;

-- Un pago solo puede colgar de un préstamo propio. Sin esto, quien supiera el
-- id del préstamo de otro podría escribirle pagos: no los vería el dueño
-- —son filas del que las escribe—, pero la base quedaría con basura ajena
-- colgando de sus préstamos.
drop policy if exists "own rows" on public.prestamo_pagos;
create policy "own rows" on public.prestamo_pagos for all
  using (auth.uid() = user_id and public.tiene_funcion('prestamos'))
  with check (
    auth.uid() = user_id
    and public.tiene_funcion('prestamos')
    and exists (select 1 from public.prestamos p where p.id = prestamo_id and p.user_id = auth.uid())
  );

notify pgrst, 'reload schema';
