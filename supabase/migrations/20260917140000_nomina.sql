-- ===========================================================================
--  Detalle de nómina en un ingreso recurrente
-- ===========================================================================
--  La cifra que uno dice cuando le preguntan cuánto gana no es la que le
--  entra. Entre una y otra hay dos descuentos obligatorios —salud y pensión,
--  4 % cada uno— y a veces un tercero, y en el otro sentido hay recargos que
--  el contrato no menciona y que en un turno de noche son la diferencia entre
--  llegar y no llegar a fin de mes.
--
--  Hasta ahora un ingreso recurrente solo guardaba `amount`, y quien apuntaba
--  ahí su sueldo bruto tenía la proyección inflada un 8 % todos los meses,
--  siempre hacia arriba. Quien apuntaba el neto tenía la cifra buena pero no
--  podía estimar la prima, que se calcula sobre el bruto.
--
--  Estas columnas guardan el sueldo COMO SE PACTÓ —bruto— y lo que hace falta
--  para derivar el resto. `amount` sigue siendo lo que llega a la cuenta, que
--  es lo que la proyección de liquidez necesita: el cálculo va de bruto a
--  neto, nunca al revés, y `amount` se recalcula al guardar.
--
--  Nada de esto es obligatorio: un arriendo que cobras o un cliente fijo no
--  tienen nómina y dejan todo esto en null, que es como estaba antes.
-- ===========================================================================

alter table public.recurring_incomes
  -- El sueldo pactado al mes, sin recargos ni descuentos. Null = este ingreso
  -- no es una nómina y `amount` es todo lo que hay que saber.
  add column if not exists salario_base numeric(16,2)
    check (salario_base is null or salario_base >= 0),

  -- Si recibe auxilio de transporte. No es salario: no cotiza a salud ni a
  -- pensión, pero sí entra en la base de la prima, que es la trampa clásica.
  add column if not exists auxilio_transporte boolean not null default false,

  -- Si cotiza a salud y pensión como empleado. Un contrato de prestación de
  -- servicios no: ahí el aporte lo hace el contratista con otras reglas, y
  -- calcularlo como nómina daría un número equivocado.
  add column if not exists cotiza boolean not null default true,

  -- El horario, para los recargos: nocturno, dominical y horas extra.
  --
  -- Va como jsonb y no como tabla aparte a propósito. Es una lista corta de
  -- turnos que solo tiene sentido dentro de su ingreso, nunca se consulta por
  -- separado y no se cruza con nada: una tabla con su clave foránea y su
  -- política de seguridad sería más máquina de la que el dato necesita.
  --
  -- Forma: [{"dia":1,"desde":22,"hasta":6}], con dia 0=domingo … 6=sábado y
  -- las horas en decimal del reloj (19.5 = 19:30). `hasta` menor que `desde`
  -- significa que el turno cruza la medianoche.
  add column if not exists turnos jsonb;

comment on column public.recurring_incomes.salario_base is
  'Sueldo mensual pactado, sin recargos ni deducciones. Null si no es nómina.';
comment on column public.recurring_incomes.turnos is
  'Turnos semanales [{dia,desde,hasta}] para calcular recargos. Ver lib/nomina.ts.';

notify pgrst, 'reload schema';
