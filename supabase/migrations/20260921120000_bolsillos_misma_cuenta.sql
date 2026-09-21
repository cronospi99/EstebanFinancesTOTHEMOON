-- ===========================================================================
--  Mover dinero entre bolsillos de una misma cuenta
-- ===========================================================================
--  Los bolsillos ya existían y ya se podía gastar desde uno, pero no había
--  forma de pasar plata de uno a otro: había que editar a mano los dos saldos,
--  que no deja rastro de nada y descuadra la cuenta si se olvida el segundo.
--
--  Es una transferencia con las dos puntas en la misma cuenta, y eso es justo
--  lo que la restricción anterior prohibía: exigía un destino DISTINTO del
--  origen, porque cuando se escribió, el único destino posible era una cuenta.
--  Con bolsillos, «la misma cuenta» sí mueve dinero —de la reserva de las
--  vacaciones al saldo general— y el saldo total no cambia, que es la
--  definición de un traspaso interno.
--
--  Lo que sigue prohibido es el movimiento que no mueve nada: mismo origen y
--  mismo bolsillo en los dos lados. `is distinct from` es lo que hace que
--  funcione con el saldo general, que se guarda como pocket_id nulo: un
--  traspaso de «general» a un bolsillo tiene null a un lado y un id al otro, y
--  con `<>` a secas eso daba null —ni verdadero ni falso— y la restricción
--  dejaba pasar la fila.
-- ===========================================================================

alter table public.transactions drop constraint if exists transactions_transfer_check;
alter table public.transactions add constraint transactions_transfer_check check (
  type <> 'transfer'
  or (
    to_account_id is not null
    and (
      to_account_id is distinct from account_id
      or to_pocket_id is distinct from pocket_id
    )
  )
);

-- PostgREST guarda el esquema en memoria: sin el aviso, la restricción vieja
-- sigue viva para la API hasta que algo la reinicie, y el primer traspaso entre
-- bolsillos falla con un error de restricción que ya no existe en el esquema.
notify pgrst, 'reload schema';
