#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const partialFooter = fs.readFileSync(path.join(root, 'partials/site-footer.html'), 'utf8');
const src = fs.readFileSync(path.join(root, 'get-more-google-reviews/index.html'), 'utf8');

const heroEnd = src.indexOf('  </section>\n\n  <section class="smb-section smb-section--soft" id="sms">');
const headAndHero = src.slice(0, heroEnd + '  </section>'.length);

const middleSections = `
  <section class="gmr-trust-strip" id="features">
    <div class="container smb-center">
      <h2 class="smb-h2">Make It Easier for Customers to Review Your Business</h2>
      <p class="smb-lead">Use the tools that fit the way your customers already communicate.</p>
      <div class="gmr-trust-grid">
        <div class="gmr-trust-item"><div class="gmr-trust-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" stroke-width="1.6"/></svg></div><span>SMS review requests</span></div>
        <div class="gmr-trust-item"><div class="gmr-trust-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4V4z" stroke="currentColor" stroke-width="1.6"/><path d="M4 7l8 6 8-6" stroke="currentColor" stroke-width="1.6"/></svg></div><span>Email review requests</span></div>
        <div class="gmr-trust-item"><div class="gmr-trust-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="1.6"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="1.6"/></svg></div><span>Direct Google review links</span></div>
        <div class="gmr-trust-item"><div class="gmr-trust-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 4h7v7H4V4zm9 0h7v7h-7V4z" stroke="currentColor" stroke-width="1.4"/></svg></div><span>Branded QR posters</span></div>
        <div class="gmr-trust-item"><div class="gmr-trust-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/></svg></div><span>Pay &amp; Review pages</span></div>
        <div class="gmr-trust-item"><div class="gmr-trust-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18" stroke="currentColor" stroke-width="1.6"/><path d="M7 14l4-4 3 3 5-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div><span>Review activity tracking</span></div>
      </div>
    </div>
  </section>

  <section class="smb-section">
    <div class="container smb-split">
      <div class="smb-split-copy">
        <h2 class="smb-h2">Happy Customers Often Forget to Leave a Review</h2>
        <p class="smb-lead">You provide great service. Your customer leaves happy. Then the day gets busy, and the review never gets written.</p>
        <p class="smb-lead">Waiting for customers to find your Google profile on their own leaves too much to chance. Local SEO Express gives you a simple process for asking while the experience is still fresh.</p>
        <div class="gmr-callout">Stop hoping customers remember. Give them a direct path to your Google review page.</div>
      </div>
      <div class="gmr-problem-photo" role="img" aria-label="Service professional greeting a satisfied customer"></div>
    </div>
  </section>

  <section class="smb-section smb-section--soft" id="how-it-works">
    <div class="container smb-center">
      <h2 class="smb-h2">How to Get More Google Reviews</h2>
      <p class="smb-lead">Getting more Google reviews starts with making the request simple. Local SEO Express helps you send the right message and removes extra steps for the customer.</p>
      <div class="gmr-steps">
        <div class="gmr-step"><div class="gmr-step-num">1</div><h3>Add Your Google Review Link</h3><p>Connect each business location to its correct Google review page. Customers will be directed to the right listing.</p></div>
        <div class="gmr-step"><div class="gmr-step-num">2</div><h3>Send a Review Request</h3><p>Send the request by text or email. You can customize the message so it sounds like your business.</p></div>
        <div class="gmr-step"><div class="gmr-step-num">3</div><h3>Make Reviewing Easy</h3><p>The customer taps your link and goes directly to Google. They do not need to search for your business or find the review button themselves.</p></div>
        <div class="gmr-step"><div class="gmr-step-num">4</div><h3>Track Your Requests</h3><p>See which requests were sent and which links were clicked. Use that activity to improve when and how you ask.</p></div>
      </div>
      <div class="smb-cta-row" style="margin-top:2rem"><a href="https://app.localseoexpress.com/sign-up" class="btn btn-primary">Send Your First Review Request</a></div>
    </div>
  </section>

  <section class="smb-section">
    <div class="container smb-center">
      <h2 class="smb-h2">Powerful Tools to Get More Reviews</h2>
      <p class="smb-lead">SMS, email, direct links, QR posters, and Pay &amp; Review pages support one result: get more honest Google reviews from real customers.</p>
      <div class="gmr-feature-cards">
        <div class="gmr-feature-card"><div class="gmr-feature-card-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" stroke-width="1.6"/></svg></div><h3>SMS Requests</h3><p>Send Google review requests by text with a direct link.</p><div class="gmr-feature-card-visual">Hi Sarah… <strong>[review link]</strong></div></div>
        <div class="gmr-feature-card"><div class="gmr-feature-card-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4V4z" stroke="currentColor" stroke-width="1.6"/></svg></div><h3>Email Requests</h3><p>Branded emails with a clear Google review button.</p><div class="gmr-feature-card-visual"><strong>How did we do?</strong> Thank you for choosing us…</div></div>
        <div class="gmr-feature-card"><div class="gmr-feature-card-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="1.6"/></svg></div><h3>Review Links</h3><p>One link that opens the review process—no searching.</p><div class="gmr-feature-card-visual">reviews.localseoexpress.com/your-business</div></div>
        <div class="gmr-feature-card"><div class="gmr-feature-card-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4h7v7H4V4zm9 0h7v7h-7V4z" stroke="currentColor" stroke-width="1.4"/></svg></div><h3>QR Posters</h3><p>Branded print-ready posters customers can scan.</p><div class="gmr-feature-card-visual">Scan to leave a Google review ▦</div></div>
        <div class="gmr-feature-card"><div class="gmr-feature-card-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/></svg></div><h3>Pay &amp; Review</h3><p>Payment options plus your Google review link on one page.</p><div class="gmr-feature-card-visual">Venmo · Card · <strong>Leave a Review</strong></div></div>
      </div>
    </div>
  </section>
`;

const smsStart = src.indexOf('<section class="smb-section smb-section--soft" id="sms">');
const mainEnd = src.indexOf('</main>', smsStart);
const bodyMiddle = src.slice(smsStart, mainEnd);

const out = headAndHero + middleSections + '\n\n  ' + bodyMiddle.trim() + '\n</main>\n\n' + partialFooter.trim() + '\n\n<script src="../js/main.js"></script>\n</body>\n</html>\n';

fs.writeFileSync(path.join(root, 'get-more-google-reviews/index.html'), out);
console.log('Rebuilt index.html, lines:', out.split('\n').length);
