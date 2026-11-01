(() => {
  const modalId = 'rentalAnnouncementModal';
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'modal fade rental-announcement-modal';
  modal.tabIndex = -1;
  modal.setAttribute('aria-labelledby', 'rentalAnnouncementTitle');
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <button type="button" class="btn-close rental-announcement-close" data-bs-dismiss="modal" aria-label="إغلاق"></button>
        <div class="row g-0">
          <div class="col-md-6 rental-announcement-image-wrap">
            <img src="assets/images/hero-home.png" alt="عاملة منزلية ترتب غرفة معيشة أنيقة" class="rental-announcement-image">
          </div>
          <div class="col-md-6 rental-announcement-copy">
            <span class="rental-announcement-badge"><span aria-hidden="true">✦</span> خدمة جديدة</span>
            <h2 id="rentalAnnouncementTitle">خدمة التأجير الشهري متاحة الآن</h2>
            <p>نوفر لك عمالة منزلية بنظام الإيجار الشهري بعقود نظامية معتمدة، راحة ومرونة والتزام كامل بالأنظمة.</p>
            <a class="btn btn-primary rounded-pill px-4" href="https://alrkayzb2.com/%d8%b7%d9%84%d8%a8%d8%a7%d8%aa-%d8%a7%d9%84%d8%aa%d8%a3%d8%ac%d9%8a%d8%b1/" target="_blank" rel="noopener">استكشف باقات التأجير <span aria-hidden="true">←</span></a>
          </div>
        </div>
      </div>
    </div>`;
  document.body.append(modal);

  let alreadyShown = false;
  try {
    alreadyShown = sessionStorage.getItem('rentalAnnouncementSeen') === '1';
    if (!alreadyShown) sessionStorage.setItem('rentalAnnouncementSeen', '1');
  } catch (_) {}

  if (!alreadyShown) {
    window.addEventListener('load', () => {
      window.setTimeout(() => {
        if (window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(modal).show();
      }, 650);
    }, { once: true });
  }
})();
