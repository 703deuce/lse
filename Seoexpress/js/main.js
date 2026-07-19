(function () {
  'use strict';

  /* Highlight current page in shared nav/footer */
  function getCurrentPageKey() {
    var path = window.location.pathname.replace(/\/$/, '');
    var segment = path.split('/').filter(Boolean).pop();
    if (!segment) return 'home';
    return segment.replace(/\.html$/, '');
  }

  function setActiveNav() {
    var pageKey = getCurrentPageKey();
    document.querySelectorAll('[data-nav="' + pageKey + '"]').forEach(function (el) {
      el.setAttribute('aria-current', 'page');
      if (el.classList.contains('nav-link')) {
        el.classList.add('nav-link--active');
      }
      var dropdown = el.closest('.has-dropdown');
      if (dropdown) {
        var toggle = dropdown.querySelector('.dropdown-toggle');
        if (toggle) toggle.classList.add('nav-link--active');
      }
    });
  }

  setActiveNav();

  var mobileToggle = document.getElementById('mobile-toggle');
  var mainNav = document.getElementById('main-nav');
  var header = document.getElementById('site-header');
  var dropdownItems = document.querySelectorAll('.has-dropdown');

  /* Mobile menu toggle */
  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', function () {
      var isOpen = mainNav.classList.toggle('open');
      mobileToggle.classList.toggle('active', isOpen);
      mobileToggle.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
  }

  /* Dropdown menus */
  dropdownItems.forEach(function (item) {
    var toggle = item.querySelector('.dropdown-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = item.classList.contains('open');

      dropdownItems.forEach(function (other) {
        other.classList.remove('open');
        var otherToggle = other.querySelector('.dropdown-toggle');
        if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* Close dropdowns on outside click */
  document.addEventListener('click', function () {
    dropdownItems.forEach(function (item) {
      item.classList.remove('open');
      var toggle = item.querySelector('.dropdown-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* Close mobile menu on resize */
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768 && mainNav) {
      mainNav.classList.remove('open');
      if (mobileToggle) {
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
      document.body.style.overflow = '';
    }
  });

  /* Sticky header shadow on scroll */
  if (header) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        header.style.boxShadow = '0 2px 12px rgba(15, 23, 42, 0.08)';
      } else {
        header.style.boxShadow = 'none';
      }
    }, { passive: true });
  }

  /* Close mobile nav when clicking a link */
  if (mainNav) {
    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('open');
        if (mobileToggle) {
          mobileToggle.classList.remove('active');
          mobileToggle.setAttribute('aria-expanded', 'false');
        }
        document.body.style.overflow = '';
      });
    });
  }

  /* FAQ accordion */
  document.querySelectorAll('.faq-question').forEach(function (button) {
    button.addEventListener('click', function () {
      var item = button.closest('.faq-item');
      var isOpen = item.classList.contains('open');

      document.querySelectorAll('.faq-item.open').forEach(function (openItem) {
        openItem.classList.remove('open');
        var openBtn = openItem.querySelector('.faq-question');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* See All Services toggle */
  var seeAllBtn = document.getElementById('see-all-services');
  var detailsPanel = document.getElementById('service-details');

  function setDetailsOpen(open) {
    if (!detailsPanel || !seeAllBtn) return;
    detailsPanel.classList.toggle('is-open', open);
    seeAllBtn.textContent = open ? 'Hide Service Details' : 'See All Services';
    seeAllBtn.setAttribute('aria-expanded', open);
  }

  if (seeAllBtn && detailsPanel) {
    seeAllBtn.setAttribute('aria-expanded', 'false');
    seeAllBtn.setAttribute('aria-controls', 'service-details');

    if (window.location.hash === '#service-details') {
      setDetailsOpen(true);
    }

    seeAllBtn.addEventListener('click', function (e) {
      e.preventDefault();
      setDetailsOpen(!detailsPanel.classList.contains('is-open'));
    });
  }

  /* View all FAQs (plumbers page) */
  var faqViewAll = document.getElementById('faq-view-all');
  var industryFaqGrid = document.getElementById('plumber-faq-grid') || document.getElementById('dentist-faq-grid') || document.getElementById('smb-faq-grid') || document.getElementById('citation-faq-grid');

  if (faqViewAll && industryFaqGrid) {
    faqViewAll.addEventListener('click', function (e) {
      e.preventDefault();
      var expanded = industryFaqGrid.classList.toggle('is-expanded');
      faqViewAll.textContent = expanded ? 'Show fewer FAQs' : 'View all FAQs';
    });
  }
  /* Contact form – prevent default until backend is connected */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
    });
  }
})();
