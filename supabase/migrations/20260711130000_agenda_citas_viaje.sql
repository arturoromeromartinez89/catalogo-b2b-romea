-- Agenda: citas (con hora) y categoria "viaje".
-- Cambios aditivos sobre agenda_tasks, sin tocar RLS ni datos existentes:
--   * item_type: 'task' (tarea) | 'appointment' (cita, se pinta verde y lleva hora)
--   * start_time: hora de la cita (null para tareas)
--   * category acepta 'viaje' ademas de comercial/administrativo
--   * las categorias comercial y viaje pueden llevar cliente

alter table public.agenda_tasks
  add column if not exists item_type text not null default 'task';

alter table public.agenda_tasks
  drop constraint if exists agenda_tasks_item_type_check;
alter table public.agenda_tasks
  add constraint agenda_tasks_item_type_check
  check (item_type in ('task', 'appointment'));

alter table public.agenda_tasks
  add column if not exists start_time time;

alter table public.agenda_tasks
  drop constraint if exists agenda_tasks_category_check;
alter table public.agenda_tasks
  add constraint agenda_tasks_category_check
  check (category in ('comercial', 'administrativo', 'viaje'));

alter table public.agenda_tasks
  drop constraint if exists agenda_client_only_comercial;
alter table public.agenda_tasks
  add constraint agenda_client_only_comercial
  check (category in ('comercial', 'viaje') or client_id is null);

notify pgrst, 'reload schema';
