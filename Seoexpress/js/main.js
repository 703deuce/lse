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
    if (window.innerWidth > 1024 && mainNav) {
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
  /* Contact form → public app API (Brevo email to info@) */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    var contactEndpoint = 'https://app.localseoexpress.com/api/public/contact';
    var statusEl = document.getElementById('contact-form-status');
    var submitBtn = contactForm.querySelector('button[type="submit"]');

    function setContactStatus(message, tone) {
      if (!statusEl) return;
      statusEl.hidden = !message;
      statusEl.textContent = message || '';
      statusEl.classList.remove('is-error', 'is-success');
      if (tone) statusEl.classList.add(tone === 'error' ? 'is-error' : 'is-success');
    }

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setContactStatus('', null);

      if (!contactForm.reportValidity()) return;

      var fd = new FormData(contactForm);
      var payload = {};
      fd.forEach(function (value, key) {
        payload[key] = typeof value === 'string' ? value.trim() : value;
      });

      var originalLabel = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.textContent = 'Sending…';
      }

      function openMailtoFallback() {
        var subject = encodeURIComponent(
          'Free SEO audit request — ' + (payload.business_name || 'Website inquiry')
        );
        var lines = [
          'Name: ' + (payload.first_name || '') + ' ' + (payload.last_name || ''),
          'Business: ' + (payload.business_name || ''),
          'Email: ' + (payload.email || ''),
          'Phone: ' + (payload.phone || '—'),
          'Website: ' + (payload.website || '—'),
          'Primary service: ' + (payload.primary_service || '—'),
          'Service area: ' + (payload.location || '—'),
          'Locations: ' + (payload.locations || '—'),
          'Wants to improve: ' + (payload.improve || '—'),
          '',
          'Additional information:',
          payload.message || '—'
        ];
        var body = encodeURIComponent(lines.join('\n'));
        window.location.href = 'mailto:info@localseoexpress.com?subject=' + subject + '&body=' + body;
      }

      fetch(contactEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            // API not deployed / Brevo down — still let the visitor reach us.
            openMailtoFallback();
            setContactStatus(
              'Opening your email app so we still get your request…',
              'success'
            );
            return;
          }
          contactForm.reset();
          setContactStatus(
            'Thanks — your request was sent. We normally reply within one business day.',
            'success'
          );
        })
        .catch(function () {
          openMailtoFallback();
          setContactStatus(
            'Opening your email app so we still get your request…',
            'success'
          );
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-busy');
            submitBtn.innerHTML = originalLabel;
          }
        });
    });
  }
})();
