-- ===========================================================================
--  Préstamos en cuotas fijas
-- ===========================================================================
--  Además del préstamo de solo intereses, el de cuotas: 1.000.000 al 10 % a
--  5 meses son 1.500.000, en 5 cuotas de 300.000. El interés va siempre sobre
--  lo prestado, por eso basta guardar en cuántas cuotas se pactó: el plan
--  entero sale de eso, del monto, la tasa y la fecha (ver lib/prestamos.ts).
--
--  Sin número de cuotas, el préstamo sigue siendo de solo intereses: los que
--  ya existen no cambian.
-- ===========================================================================

alter table public.prestamos
  add column if not exists cuotas int check (cuotas is null or cuotas between 1 and 360);

notify pgrst, 'reload schema';
