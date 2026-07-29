#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '../get-more-google-reviews/index.html');
let html = fs.readFileSync(file, 'utf8');

// Hero
html = html.replace(
  '<section class="smb-hero gmr-hero">',
  '<section class="smb-hero gmr-hero gmr-section--hero">'
);

// Trust strip
html = html.replace(
  '<section class="gmr-trust-strip" id="features">',
  '<section class="gmr-section gmr-section--white gmr-section--tight" id="features">'
);
html = html.replace(
  '<div class="container smb-center">\n      <h2 class="smb-h2">Make It Easier',
  '<div class="container smb-center gmr-section-head gmr-section-head--center">\n      <p class="gmr-kicker">Review tools</p>\n      <h2 class="smb-h2">Make It Easier'
);

// Problem
html = html.replace(
  '<section class="smb-section">\n    <div class="container smb-split">\n      <div class="smb-split-copy">\n        <h2 class="smb-h2">Happy Customers',
  '<section class="gmr-section gmr-section--mint">\n    <div class="container gmr-layout gmr-layout--5-7">\n      <div class="gmr-layout__copy">\n        <p class="gmr-kicker">The problem</p>\n        <h2 class="smb-h2">Happy Customers'
);
html = html.replace(
  '<div class="gmr-problem-photo" role="img" aria-label="Service professional greeting a satisfied customer"></div>',
  '<div class="gmr-photo-wrap gmr-layout__media"><div class="gmr-problem-photo" role="img" aria-label="Service professional greeting a satisfied customer"></div><div class="gmr-star-badge"><span>★★★★★</span> Happy customers</div></div>'
);

// How it works
html = html.replace(
  '<section class="smb-section smb-section--soft" id="how-it-works">',
  '<section class="gmr-section gmr-section--white" id="how-it-works">'
);
html = html.replace(
  '<div class="container smb-center">\n      <h2 class="smb-h2">How to Get More Google Reviews</h2>',
  '<div class="container smb-center gmr-section-head gmr-section-head--center">\n      <p class="gmr-kicker">Simple process</p>\n      <h2 class="smb-h2">How to Get More Google Reviews</h2>'
);

// Feature grid
html = html.replace(
  '<section class="smb-section">\n    <div class="container smb-center">\n      <h2 class="smb-h2">Powerful Tools',
  '<section class="gmr-section gmr-section--mint">\n    <div class="container smb-center gmr-section-head gmr-section-head--center">\n      <p class="gmr-kicker">All-in-one toolkit</p>\n      <h2 class="smb-h2">Powerful Tools'
);
// Add feature card bars
html = html.replace(
  /<div class="gmr-feature-card"><div class="gmr-feature-card-icon"/g,
  '<div class="gmr-feature-card"><div class="gmr-feature-card__bar"></div><div class="gmr-feature-card__body"><div class="gmr-feature-card-icon"'
);
html = html.replace(
  /<div class="gmr-feature-card-visual">([\s\S]*?)<\/div><\/div>/g,
  (m, inner) => `<div class="gmr-feature-card-visual">${inner}</div></div></div>`
);

// SMS - 7/5 layout
html = html.replace(
  '<section class="smb-section smb-section--soft" id="sms">\n    <div class="container smb-split">\n      <div class="smb-split-copy">',
  '<section class="gmr-section gmr-section--white" id="sms">\n    <div class="container gmr-layout gmr-layout--7-5">\n      <div class="gmr-layout__copy">\n        <p class="gmr-kicker">Text messaging</p>'
);
html = html.replace(
  '<div class="gmr-split-visual">\n        <img src="../images/shot-reviews.png" alt="SMS review request dashboard"',
  '<div class="gmr-layout__media gmr-panel">\n        <img src="../images/shot-reviews.png" alt="SMS review request dashboard"'
);

// Email - flip 5/7
html = html.replace(
  '<section class="smb-section" id="email">\n    <div class="container smb-split smb-split--flip">\n      <div class="gmr-split-visual">',
  '<section class="gmr-section gmr-section--soft" id="email">\n    <div class="container gmr-layout gmr-layout--5-7 gmr-layout--flip">\n      <div class="gmr-layout__media gmr-panel">'
);
html = html.replace(
  '</div>\n      <div class="smb-split-copy">\n        <h2 class="smb-h2">Ask for Google Reviews by Email</h2>',
  '</div>\n      <div class="gmr-layout__copy">\n        <p class="gmr-kicker">Email campaigns</p>\n        <h2 class="smb-h2">Ask for Google Reviews by Email</h2>'
);

// Links - 1/3 + 2/3
html = html.replace(
  '<section class="smb-section smb-section--soft" id="links">\n    <div class="container smb-split">\n      <div class="smb-split-copy">',
  '<section class="gmr-section gmr-section--white" id="links">\n    <div class="container gmr-layout gmr-layout--1-2">\n      <div class="gmr-layout__copy">\n        <p class="gmr-kicker">Direct links</p>'
);
html = html.replace(
  '<div class="gmr-split-visual">\n        <img src="../images/shot-scans.png" alt="Google review link sharing"',
  '<div class="gmr-layout__media gmr-panel">\n        <img src="../images/shot-scans.png" alt="Google review link sharing"'
);

// QR - 2/3 image + 1/3 text
html = html.replace(
  '<section class="smb-section" id="qr">\n    <div class="container smb-split smb-split--flip">\n      <div class="gmr-split-visual">',
  '<section class="gmr-section gmr-section--mint" id="qr">\n    <div class="container gmr-layout gmr-layout--2-1 gmr-layout--flip">\n      <div class="gmr-layout__media gmr-panel">'
);
html = html.replace(
  '</div>\n      <div class="smb-split-copy">\n        <h2 class="smb-h2">Turn Customer Visits',
  '</div>\n      <div class="gmr-layout__copy">\n        <p class="gmr-kicker">QR posters</p>\n        <h2 class="smb-h2">Turn Customer Visits'
);

// Pay & Review - 1/3 text 2/3 image
html = html.replace(
  '<section class="smb-section smb-section--soft" id="pay-review">\n    <div class="container smb-split">\n      <div class="smb-split-copy">',
  '<section class="gmr-section gmr-section--white" id="pay-review">\n    <div class="container gmr-layout gmr-layout--1-3">\n      <div class="gmr-layout__copy">\n        <p class="gmr-kicker">Pay &amp; Review</p>'
);
html = html.replace(
  '<div class="gmr-split-visual">\n        <img src="../images/shot-growth-plan.png"',
  '<div class="gmr-layout__media gmr-panel">\n        <img src="../images/shot-growth-plan.png"'
);

// Workflow horizontal
html = html.replace(
  '<section class="smb-section">\n    <div class="container smb-center">\n      <h2 class="smb-h2">Make Review Requests Part of Every Completed Job</h2>',
  '<section class="gmr-section gmr-section--mint">\n    <div class="container smb-center gmr-section-head gmr-section-head--center">\n      <p class="gmr-kicker">Team workflow</p>\n      <h2 class="smb-h2">Make Review Requests Part of Every Completed Job</h2>'
);
html = html.replace(
  '<div class="gmr-workflow">\n        Complete the service<br>↓<br>Confirm the customer is satisfied<br>↓<br>Send the review request<br>↓<br>Customer taps the direct link<br>↓<br>Customer leaves an honest Google review\n      </div>',
  `<div class="gmr-workflow-row">
        <div class="gmr-workflow-step"><span>1</span> Complete the service</div>
        <span class="gmr-workflow-arrow" aria-hidden="true">→</span>
        <div class="gmr-workflow-step"><span>2</span> Confirm satisfaction</div>
        <span class="gmr-workflow-arrow" aria-hidden="true">→</span>
        <div class="gmr-workflow-step"><span>3</span> Send the request</div>
        <span class="gmr-workflow-arrow" aria-hidden="true">→</span>
        <div class="gmr-workflow-step"><span>4</span> Customer taps link</div>
        <span class="gmr-workflow-arrow" aria-hidden="true">→</span>
        <div class="gmr-workflow-step"><span>5</span> Honest Google review</div>
      </div>`
);

// Benefits with icons
html = html.replace(
  '<section class="smb-section smb-section--soft">\n    <div class="container">\n      <div class="smb-center">\n        <h2 class="smb-h2">More Reviews Start',
  '<section class="gmr-section gmr-section--white">\n    <div class="container">\n      <div class="smb-center gmr-section-head gmr-section-head--center">\n        <p class="gmr-kicker">Why it works</p>\n        <h2 class="smb-h2">More Reviews Start'
);
const benefitIcons = ['⏱', '🔗', '🎨', '👥', '📊', '📍'];
let bi = 0;
html = html.replace(/<div class="gmr-benefit"><h3>/g, () => {
  const icon = benefitIcons[bi++ % benefitIcons.length];
  return `<div class="gmr-benefit"><div class="gmr-benefit-icon" aria-hidden="true">${icon}</div><h3>`;
});

// Build trust - 1/3 + 2/3
html = html.replace(
  '<section class="smb-section">\n    <div class="container smb-split">\n      <div class="smb-split-copy">\n        <h2 class="smb-h2">Build Trust Before',
  '<section class="gmr-section gmr-section--soft">\n    <div class="container gmr-layout gmr-layout--1-3">\n      <div class="gmr-layout__copy">\n        <p class="gmr-kicker">Local visibility</p>\n        <h2 class="smb-h2">Build Trust Before'
);
html = html.replace(
  '<div class="gmr-split-visual">\n        <img src="../images/compare.png"',
  '<div class="gmr-layout__media gmr-panel">\n        <img src="../images/compare.png"'
);

// Compliance
html = html.replace(
  '<section class="smb-section smb-section--soft">\n    <div class="container">\n      <div class="smb-center">\n        <h2 class="smb-h2">Ask for Reviews the Right Way</h2>',
  '<section class="gmr-section gmr-section--mint">\n    <div class="container">\n      <div class="smb-center gmr-section-head gmr-section-head--center">\n        <p class="gmr-kicker">Google policy</p>\n        <h2 class="smb-h2">Ask for Reviews the Right Way</h2>'
);
html = html.replace(
  '<div class="gmr-benefits-grid" style="margin-top:1.5rem">',
  '<div class="gmr-benefits-grid gmr-compliance-grid" style="margin-top:1.5rem">'
);
const compIcons = ['✓', '✗', '!', '⚖', '📱', '★'];
let ci = 0;
html = html.replace(/<div class="gmr-benefit"><h3>Ask real customers/g,
  `<div class="gmr-benefit"><div class="gmr-benefit-icon" aria-hidden="true">${compIcons[0]}</div><h3>Ask real customers`);
html = html.replace(/<div class="gmr-benefit"><h3>Do not buy/g,
  `<div class="gmr-benefit"><div class="gmr-benefit-icon" aria-hidden="true">${compIcons[1]}</div><h3>Do not buy`);
html = html.replace(/<div class="gmr-benefit"><h3>No rewards/g,
  `<div class="gmr-benefit"><div class="gmr-benefit-icon" aria-hidden="true">${compIcons[2]}</div><h3>No rewards`);
html = html.replace(/<div class="gmr-benefit"><h3>Fair opportunity/g,
  `<div class="gmr-benefit"><div class="gmr-benefit-icon" aria-hidden="true">${compIcons[3]}</div><h3>Fair opportunity`);
html = html.replace(/<div class="gmr-benefit"><h3>Respect SMS/g,
  `<div class="gmr-benefit"><div class="gmr-benefit-icon" aria-hidden="true">${compIcons[4]}</div><h3>Respect SMS`);
html = html.replace(/<div class="gmr-benefit"><h3>Honest Google reviews/g,
  `<div class="gmr-benefit"><div class="gmr-benefit-icon" aria-hidden="true">${compIcons[5]}</div><h3>Honest Google reviews`);

// Comparison
html = html.replace(
  '<section class="smb-section">\n    <div class="container smb-center">\n      <h2 class="smb-h2">A Simpler Way',
  '<section class="gmr-section gmr-section--white">\n    <div class="container smb-center gmr-section-head gmr-section-head--center">\n      <p class="gmr-kicker">Before &amp; after</p>\n      <h2 class="smb-h2">A Simpler Way'
);

// Audience
html = html.replace(
  '<section class="smb-section smb-section--soft">\n    <div class="container">\n      <div class="smb-center">\n        <h2 class="smb-h2">Google Review Software',
  '<section class="gmr-section gmr-section--mint">\n    <div class="container">\n      <div class="smb-center gmr-section-head gmr-section-head--center">\n        <p class="gmr-kicker">Built for locals</p>\n        <h2 class="smb-h2">Google Review Software'
);

// Dashboard - 3/1 image heavy
html = html.replace(
  '<section class="smb-section">\n    <div class="container smb-split smb-split--flip">\n      <div class="gmr-split-visual">\n        <img src="../images/grid-hero.png"',
  '<section class="gmr-section gmr-section--white">\n    <div class="container gmr-layout gmr-layout--3-1 gmr-layout--flip">\n      <div class="gmr-layout__media gmr-panel">\n        <img src="../images/grid-hero.png"'
);
html = html.replace(
  '</div>\n      <div class="smb-split-copy">\n        <h2 class="smb-h2">Manage Every Review Request',
  '</div>\n      <div class="gmr-layout__copy gmr-check-card">\n        <p class="gmr-kicker">One dashboard</p>\n        <h2 class="smb-h2">Manage Every Review Request'
);

// Analytics - 1/3 stats + 2/3 image
html = html.replace(
  '<section class="smb-section smb-section--soft">\n    <div class="container smb-split">\n      <div class="smb-split-copy">\n        <h2 class="smb-h2">See How Customers Engage</h2>',
  '<section class="gmr-section gmr-section--soft">\n    <div class="container gmr-layout gmr-layout--1-3">\n      <div class="gmr-layout__copy">\n        <p class="gmr-kicker">Honest analytics</p>\n        <h2 class="smb-h2">See How Customers Engage</h2>'
);
html = html.replace(
  '<p class="gmr-note">A click shows that the customer opened the review link.',
  `<div class="gmr-stats">
          <div class="gmr-stat"><strong>Sent</strong><span>Requests delivered</span></div>
          <div class="gmr-stat"><strong>Opened</strong><span>Link &amp; QR clicks</span></div>
          <div class="gmr-stat"><strong>Scanned</strong><span>Poster QR visits</span></div>
          <div class="gmr-stat"><strong>Tracked</strong><span>Campaign activity</span></div>
        </div>
        <p class="gmr-note">A click shows that the customer opened the review link.`
);
html = html.replace(
  '<div class="gmr-split-visual">\n        <img src="../images/shot-scans.png" alt="Review request analytics"',
  '<div class="gmr-layout__media gmr-panel">\n        <img src="../images/shot-scans.png" alt="Review request analytics"'
);

// AIDA band
html = html.replace(
  '<section class="smb-section">\n    <div class="container smb-center">\n      <h2 class="smb-h2">Turn Great Customer Experiences',
  '<section class="gmr-section gmr-section--band">\n    <div class="container smb-center gmr-section-head gmr-section-head--center">\n      <p class="gmr-kicker" style="color:rgba(255,255,255,.9)">Real results</p>\n      <h2 class="smb-h2">Turn Great Customer Experiences'
);
html = html.replace(
  '<a href="https://app.localseoexpress.com/sign-up" class="btn btn-primary">Start Getting More Google Reviews</a>',
  '<a href="https://app.localseoexpress.com/sign-up" class="smb-btn-white">Start Getting More Google Reviews</a>'
);

// Experience
html = html.replace(
  '<section class="smb-section smb-section--soft" id="reviews">',
  '<section class="gmr-section gmr-section--white" id="reviews">'
);
html = html.replace(
  '<div class="container smb-center">\n      <h2 class="smb-h2">See the Customer Experience</h2>',
  '<div class="container smb-center gmr-section-head gmr-section-head--center">\n      <p class="gmr-kicker">Product demo</p>\n      <h2 class="smb-h2">See the Customer Experience</h2>'
);

fs.writeFileSync(file, html);
console.log('HTML patched');
