-- قسم «مسار الاتصال» المستقل: متاح لكل دور يملك «خريطة رحلة الطلب».
update public.roles
  set allowed_pages = array_append(allowed_pages, 'contact-flow')
  where 'sales-training' = any(allowed_pages)
    and not ('contact-flow' = any(allowed_pages));
