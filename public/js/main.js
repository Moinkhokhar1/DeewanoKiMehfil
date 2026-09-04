document.addEventListener('DOMContentLoaded', () => {
  // ---------- Carousel ----------
  document.querySelectorAll('[data-carousel]').forEach(carousel => {
    const track = carousel.querySelector('[data-track]');
    const slides = track ? Array.from(track.children) : [];
    const dots = carousel.querySelectorAll('[data-dot]');
    const prevBtn = carousel.querySelector('[data-prev]');
    const nextBtn = carousel.querySelector('[data-next]');
    let index = 0;

    function goTo(i) {
      if (!slides.length) return;
      index = Math.max(0, Math.min(i, slides.length - 1));
      track.scrollTo({ left: track.clientWidth * index, behavior: 'smooth' });
      dots.forEach((d, di) => d.classList.toggle('active', di === index));
    }

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(index - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(index + 1));
    dots.forEach(dot => {
      dot.addEventListener('click', () => goTo(parseInt(dot.dataset.dot, 10)));
    });

    let scrollTimeout;
    if (track) {
      track.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          const newIndex = Math.round(track.scrollLeft / track.clientWidth);
          index = newIndex;
          dots.forEach((d, di) => d.classList.toggle('active', di === index));
        }, 80);
      });
    }
  });

  // ---------- Admin sidebar toggle (mobile) ----------
  const toggle = document.getElementById('adminMenuToggle');
  const sidebar = document.getElementById('adminSidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
        sidebar.classList.remove('open');
      }
    });
  }
});
