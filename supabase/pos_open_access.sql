-- ===================== Bazarville — POS without login (open counter page) =====================
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- After this, https://…/pos.html works WITHOUT signing in. It does NOT open the tables: it adds a few
-- narrow functions that can ONLY (a) list/edit POS bills, (b) manage held bills, (c) set a product's
-- colour-wise stock. Products, prices, web orders, customers, settings stay admin-only.
-- WARNING: anyone who knows the pos.html link can use these functions (see/edit POS bills incl. the
-- customer names/phones typed on them, change stock). Keep the link private. To undo, run the
-- "UNDO" block at the bottom.

create or replace function public.pos_get_bills() returns setof public.orders
language sql security definer set search_path = public as $$
  select * from public.orders where source = 'pos' or ref like 'BZP-%' order by created_at desc limit 1000;
$$;

create or replace function public.pos_create_sale(p_ref text, p_name text, p_phone text, p_items jsonb, p_subtotal numeric, p_pay text, p_notes text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare r public.orders;
begin
  insert into public.orders(ref, customer_id, customer_name, customer_phone, customer_email, shipping_address, items, subtotal,
                            status, payment_method, payment_status, notes, source)
  values (p_ref, null, coalesce(nullif(p_name,''), 'Walk-in counter sale'), coalesce(p_phone,''), '', '', p_items, p_subtotal,
          'delivered', coalesce(p_pay,'cash'), 'paid', coalesce(p_notes,''), 'pos')
  returning * into r;
  return r;
end $$;

create or replace function public.pos_update_bill(p_id bigint, p_items jsonb, p_subtotal numeric, p_name text, p_phone text, p_pay text, p_notes text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.orders set items = p_items, subtotal = p_subtotal,
    customer_name = coalesce(nullif(p_name,''), 'Walk-in counter sale'),
    customer_phone = coalesce(p_phone,''), payment_method = coalesce(p_pay, payment_method),
    notes = coalesce(p_notes,''), updated_at = now()
  where id = p_id and (source = 'pos' or ref like 'BZP-%');
  return found;
end $$;

create or replace function public.pos_delete_bill(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.orders where id = p_id and (source = 'pos' or ref like 'BZP-%');
  return found;
end $$;

create or replace function public.pos_holds_list() returns setof public.pos_holds
language sql security definer set search_path = public as $$
  select * from public.pos_holds order by created_at desc limit 200;
$$;
create or replace function public.pos_hold_add(p_label text, p_items jsonb, p_subtotal numeric) returns public.pos_holds
language sql security definer set search_path = public as $$
  insert into public.pos_holds(label, items, subtotal) values (coalesce(p_label,''), p_items, p_subtotal) returning *;
$$;
create or replace function public.pos_hold_delete(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin delete from public.pos_holds where id = p_id; return found; end $$;

create or replace function public.pos_set_stock(p_id bigint, p_stock jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.products set color_images = jsonb_set(coalesce(color_images,'{}'::jsonb), '{_stock}', coalesce(p_stock,'{}'::jsonb), true) where id = p_id;
  begin
    update public.products set color_stock = coalesce(p_stock,'{}'::jsonb) where id = p_id;
  exception when undefined_column then null;
  end;
  return true;
end $$;

grant execute on function public.pos_create_sale(text,text,text,jsonb,numeric,text,text) to anon, authenticated;
grant execute on function public.pos_get_bills() to anon, authenticated;
grant execute on function public.pos_delete_bill(bigint) to anon, authenticated;
grant execute on function public.pos_update_bill(bigint,jsonb,numeric,text,text,text,text) to anon, authenticated;
grant execute on function public.pos_holds_list() to anon, authenticated;
grant execute on function public.pos_hold_add(text,jsonb,numeric) to anon, authenticated;
grant execute on function public.pos_hold_delete(bigint) to anon, authenticated;
grant execute on function public.pos_set_stock(bigint,jsonb) to anon, authenticated;

-- ---- UNDO (run this to close the open counter again) ----
-- revoke execute on function public.pos_create_sale(text,text,text,jsonb,numeric,text,text) from anon;
-- revoke execute on function public.pos_get_bills() from anon;
-- revoke execute on function public.pos_delete_bill(bigint) from anon;
-- revoke execute on function public.pos_update_bill(bigint,jsonb,numeric,text,text,text,text) from anon;
-- revoke execute on function public.pos_holds_list() from anon;
-- revoke execute on function public.pos_hold_add(text,jsonb,numeric) from anon;
-- revoke execute on function public.pos_hold_delete(bigint) from anon;
-- revoke execute on function public.pos_set_stock(bigint,jsonb) from anon;
