-- ===========================================================================
--  Suscripciones a los avisos del navegador (Web Push)
-- ===========================================================================
--  Un recordatorio la víspera sirve; el mismo aviso dentro de la app, no: el
--  día que se te olvida pagar la tarjeta es justamente un día en que no la
--  abriste. Por eso el aviso tiene que salir del sistema operativo, y para eso
--  hace falta que alguien de fuera pueda despertar al teléfono.
--
--  Cada dispositivo produce un `endpoint` distinto —una URL del servicio de
--  push de Apple, Google o Mozilla— con dos llaves que cifran el contenido. Se
--  guardan aquí porque son de la cuenta, no del navegador: quien entra en el
--  móvil y en el portátil espera el aviso en los dos.
--
--  El endpoint es único en toda la tabla y no por usuario: si un teléfono
--  cambia de dueño —o alguien cierra sesión y entra con otra cuenta— el
--  registro tiene que pasar de un usuario al otro, no duplicarse y mandar los
--  avisos de dos personas al mismo sitio.
-- ===========================================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  -- Las dos llaves que exige el cifrado del Web Push. Sin ellas el servicio
  -- acepta la petición y el navegador descarta el mensaje sin enseñarlo.
  p256dh      text not null,
  auth        text not null,
  -- Para reconocer el dispositivo en la lista: «iPhone», «Chrome en el PC».
  dispositivo text not null default '',
  -- Cuándo falló por última vez. Un endpoint caducado responde 410 para
  -- siempre; marcarlo permite dejar de intentarlo sin borrarlo al primer fallo
  -- de red, que es pasajero y se recupera solo.
  failed_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own rows" on public.push_subscriptions;
create policy "own rows" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_user_id_trg on public.push_subscriptions;
create trigger set_user_id_trg
  before insert on public.push_subscriptions
  for each row execute function public.set_user_id();

-- ---------------------------------------------------------------------------
-- Lo que ya se avisó
-- ---------------------------------------------------------------------------
--  Sin esto, el trabajo diario que manda los recordatorios avisaría del mismo
--  cobro cada vez que corriera, y basta con reintentarlo una vez para que a
--  alguien le lleguen dos notificaciones idénticas —que es la forma más rápida
--  de que las desactive—.
--
--  El identificador del aviso lleva dentro la fecha del hecho («sub:<id>:
--  2026-10-08»), así que el recordatorio del mes siguiente es otro distinto y
--  vuelve a salir solo. No hay que limpiar nada para que funcione; la limpieza
--  de abajo es solo para que la tabla no crezca sin fin.
create table if not exists public.avisos_enviados (
  user_id    uuid not null references auth.users (id) on delete cascade,
  aviso_id   text not null,
  canal      text not null default 'push',
  enviado_el timestamptz not null default now(),
  primary key (user_id, aviso_id, canal)
);

create index if not exists avisos_enviados_fecha_idx on public.avisos_enviados (enviado_el);

alter table public.avisos_enviados enable row level security;

drop policy if exists "own rows" on public.avisos_enviados;
create policy "own rows" on public.avisos_enviados
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Qué avisos quiere cada quien
-- ---------------------------------------------------------------------------
--  Van en `settings` y no en su propia tabla porque son preferencias sueltas
--  de una sola fila por usuario, igual que el tope de gasto diario.
alter table public.settings
  -- Cuántos días antes avisar. 0 = el mismo día, null = no avisar.
  add column if not exists aviso_dias int
    check (aviso_dias is null or (aviso_dias between 0 and 15)),
  -- Qué se avisa. Cada uno se puede apagar por su lado: quien no tiene
  -- tarjeta no quiere saber nada de cortes.
  add column if not exists avisar_suscripciones boolean not null default true,
  add column if not exists avisar_tarjetas boolean not null default true,
  add column if not exists avisar_deudas boolean not null default true,
  -- Correo alternativo para los avisos. Vacío = el de la sesión.
  add column if not exists aviso_email text;

notify pgrst, 'reload schema';
