-- Dos datos que no se pueden deducir y que cambian la cifra.
--
-- `period_start_day`: el día en que empieza el período de una tarjeta. En casi
-- todas sobra —el período empieza el día después del corte— pero hay bancos
-- que imprimen tres fechas: «inicio del período 4 de septiembre, corte 5 de
-- octubre, pago 15 de octubre». Ahí el corte es el día en que emiten el
-- extracto, no el fin del período, y deducir el inicio del corte se equivoca
-- en dos días. Esos dos días son un mes de diferencia en cuándo vence lo que
-- se compró en ellos. Nulo = se deduce, que es el comportamiento de siempre.
--
-- `trabaja_festivos`: si a quien recibe este ingreso le toca trabajar los
-- festivos. Colombia tiene dieciocho al año y once caen en lunes por la Ley
-- Emiliani, así que para un horario con lunes la respuesta vale casi un turno
-- festivo al mes al noventa por ciento —o uno menos, si libra—. No se puede
-- adivinar mirando el horario.
--
-- `paga_extras`: si las horas que pasan de la jornada se pagan como extra.
-- Por defecto NO, que es lo que pasa casi siempre con un sueldo mensual:
-- suponerlas pagadas al 125 % inventaba ingreso a quien no lo recibe. El
-- descanso de cada turno va dentro del jsonb `turnos`, que ya existe.

alter table public.accounts
  add column if not exists period_start_day smallint
    check (period_start_day is null or (period_start_day between 1 and 31));

alter table public.recurring_incomes
  add column if not exists trabaja_festivos boolean not null default false,
  add column if not exists paga_extras boolean not null default false;

comment on column public.accounts.period_start_day is
  'Día del mes en que empieza el período de facturación. Nulo = statement_day + 1.';
comment on column public.recurring_incomes.trabaja_festivos is
  'Si los turnos que caen en festivo se trabajan. Decide el signo del recargo festivo.';
comment on column public.recurring_incomes.paga_extras is
  'Si las horas sobre la jornada se pagan como extra. Falso por defecto: no suponerlo.';

-- El reparto de la deuda de una tarjeta, dicho a mano.
--
-- La app deduce qué parte del saldo ya está facturada mirando los movimientos
-- registrados, pero quien lleva solo el saldo de la tarjeta no tiene
-- movimientos que mirar: ahí el saldo entero se da por facturado y sale un
-- «pago vencido» por plata que es del ciclo nuevo. `statement_balance` es la
-- salida, y `statement_balance_at` —la fecha del corte al que se refiere— hace
-- que caduque cuando el banco emita el siguiente extracto, en vez de callar
-- los avisos para siempre.

alter table public.accounts
  add column if not exists statement_balance numeric,
  add column if not exists statement_balance_at date;

comment on column public.accounts.statement_balance is
  'Parte del saldo ya facturada, declarada por el usuario. Nulo = se deduce de los movimientos.';
comment on column public.accounts.statement_balance_at is
  'Fecha del corte al que se refiere statement_balance. Fuera de ese ciclo, la declaración caduca.';
