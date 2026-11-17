alter table public.website_workers add constraint website_workers_availability_check check (availability in ('متاحة','تم الحجز','غير متاحة','مؤرشفة')); alter table public.website_workers add constraint website_workers_publication_check check (publication in ('مسودة','منشورة'));

