-- ===========================================================================
--  Dos espacios: finanzas personales y finanzas del negocio
-- ===========================================================================
--  Quien tiene un negocio pequeño suele llevarlo con la misma cabeza —y a
--  veces con la misma app— que su dinero personal, y mezclarlos es el error
--  clásico: el patrimonio sale inflado con la caja de la empresa, el
--  presupuesto del mercado compite con la nómina, y la declaración de renta de
--  la persona suma consignaciones que eran del negocio.
--
--  Cada fila dice ahora a qué espacio pertenece. Todo lo que ya existía es
--  personal —era lo único que se podía registrar—, así que el valor por
--  defecto lo deja donde estaba sin tocar ni una fila a mano.
--
--  Los ajustes (`settings`) no se parten: son las preferencias de avisos de
--  la persona, que recibe los recordatorios de los dos espacios en el mismo
--  teléfono. Tampoco los tokens de atajos ni las suscripciones push.
-- ===========================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'transactions', 'holdings', 'budgets', 'goals', 'trades',
    'budget_allocations', 'debts', 'debt_payments', 'subscriptions', 'recurring_incomes'
  ] loop
    execute format(
      'alter table public.%I add column if not exists espacio text not null default ''personal''', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_espacio_check');
    execute format(
      'alter table public.%I add constraint %I check (espacio in (''personal'', ''negocio''))',
      t, t || '_espacio_check');
    -- Cada carga pide un espacio de un usuario: es la consulta que hay que
    -- servir rápido.
    execute format(
      'create index if not exists %I on public.%I (user_id, espacio)', t || '_espacio_idx', t);
  end loop;
end $$;

-- Un presupuesto por categoría Y espacio. «Transporte» puede tener un tope en
-- casa y otro en la empresa, y con la clave de antes el segundo pisaba al
-- primero al guardarse.
alter table public.budgets drop constraint if exists budgets_user_id_category_id_key;
alter table public.budgets drop constraint if exists budgets_user_id_espacio_category_id_key;
alter table public.budgets
  add constraint budgets_user_id_espacio_category_id_key unique (user_id, espacio, category_id);

-- Un movimiento vive donde vive su cuenta.
--
-- La app ya lo manda bien, pero hay una puerta que no pasa por la app: la
-- ingesta por SMS y atajos (`ingesta_rapida`) elige la cuenta por su nombre y
-- no sabe nada de espacios. Sin esto, un gasto que entra por SMS en la cuenta
-- del negocio se quedaba «personal» y no aparecía en ninguno de los dos
-- lados: en el negocio por el espacio, y en lo personal porque su cuenta no
-- está ahí.
create or replace function public.espacio_de_la_cuenta()
returns trigger
language plpgsql
as $$
declare
  v_espacio text;
begin
  select a.espacio into v_espacio
  from public.accounts a
  where a.id = new.account_id;
  -- Con una variable y no directo sobre `new.espacio`: un `select into` que
  -- no encuentra fila deja el destino en nulo, y eso pisaría lo que venía.
  if v_espacio is not null then
    new.espacio := v_espacio;
  end if;
  return new;
end;
$$;

drop trigger if exists espacio_de_la_cuenta_trg on public.transactions;
create trigger espacio_de_la_cuenta_trg
  before insert or update of account_id on public.transactions
  for each row execute function public.espacio_de_la_cuenta();

notify pgrst, 'reload schema';
