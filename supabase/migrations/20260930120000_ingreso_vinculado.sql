-- ===========================================================================
--  Qué movimiento es el pago de qué ingreso recurrente
-- ===========================================================================
--  Hasta ahora la app adivinaba si la quincena ya estaba anotada: buscaba un
--  ingreso del mismo importe exacto en la misma cuenta en los últimos días.
--  Fallaba por los dos lados. Si el sueldo llegaba con otra cifra —una hora
--  extra, un descuento— no lo reconocía, se volvía a tocar «Ya me pagaron» y
--  la quincena quedaba anotada dos veces. Y cualquier otro ingreso que
--  coincidiera en cifra la daba por pagada.
--
--  Ahora el movimiento dice de qué ingreso es, igual que un cobro dice de qué
--  suscripción es (`subscription_id`). Sirve tanto para el que anota la app
--  al confirmar como para uno que ya estaba registrado desde el botón de
--  captura y se vincula después.
--
--  Si el ingreso recurrente se borra, sus movimientos se quedan —el dinero sí
--  llegó— y solo pierden el vínculo.
-- ===========================================================================

alter table public.transactions
  add column if not exists recurring_income_id uuid
    references public.recurring_incomes (id) on delete set null;

create index if not exists transactions_recurring_income_idx
  on public.transactions (recurring_income_id)
  where recurring_income_id is not null;

notify pgrst, 'reload schema';
