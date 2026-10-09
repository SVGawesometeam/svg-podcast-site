// The contact form, used on the homepage ("Pitch Marina anything") and on
// the About page's Contact section: one markup, one stylesheet, one script.
// It posts to /api/contact as JSON; the server side is api/contact.js and
// the field list and routing live in lib/contact-fields.js.
const { TOPICS, FIELDS } = require("./contact-fields");
const { esc } = require("./html");

function renderFormFields() {
  return FIELDS.map((f) => {
    const id = `f-${f.name}`;
    const req = f.required ? " required" : "";
    const cap = f.max ? ` maxlength="${f.max}"` : "";
    const auto = f.autocomplete ? ` autocomplete="${f.autocomplete}"` : "";
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";

    let control;
    if (f.type === "select") {
      const options = TOPICS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("\n            ");
      control = `<select id="${id}" name="${f.name}"${req}>\n            ${options}\n          </select>`;
    } else if (f.type === "textarea") {
      control = `<textarea id="${id}" name="${f.name}" rows="6"${req}${cap}${ph}></textarea>`;
    } else {
      control = `<input type="${f.type}" id="${id}" name="${f.name}"${req}${cap}${auto}${ph}>`;
    }

    return `        <div class="field field-${f.name}">
          <label for="${id}">${esc(f.label)}</label>
          ${control}
        </div>`;
  }).join("\n");
}

// The form, its success message and the no-JavaScript fallback. The ids are
// fixed (one form per page), so the script below finds them.
function renderContactForm() {
  return `      <form id="pitch-form" class="pitch-form" novalidate>
        <p id="form-error" class="form-error" role="alert" hidden></p>
${renderFormFields()}
        <div class="hp" aria-hidden="true">
          <label for="f-website">Leave this blank</label>
          <input type="text" id="f-website" name="website" tabindex="-1" autocomplete="off">
        </div>
        <input type="hidden" name="rendered" value="">
        <button type="submit" class="btn btn-accent form-submit">Send opportunity</button>
      </form>

      <p id="form-done" class="form-done" role="status" hidden>Thank you &mdash; that&rsquo;s with the team. You&rsquo;ll hear back at the address you gave.</p>

      <noscript>
        <p class="work-dek">This form needs JavaScript. Email <a href="mailto:pr@marinamogilko.co">pr@marinamogilko.co</a> instead and we&rsquo;ll pick it up just the same.</p>
      </noscript>`;
}

const CONTACT_FORM_CSS = `
    .work-dek { color: rgba(23, 21, 17, 0.8); margin-bottom: 2rem; }
    .pitch-form { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem 1.4rem; }
    .field { display: flex; flex-direction: column; gap: 0.4rem; }
    .field-budget, .field-details { grid-column: 1 / -1; }
    .field label {
      font-size: 0.64rem; font-weight: 700; letter-spacing: 0.13em;
      text-transform: uppercase; color: rgba(23, 21, 17, 0.62);
    }
    .field input, .field select, .field textarea {
      font-family: var(--body); font-size: 0.95rem; color: var(--ink);
      background: var(--card); border: 1px solid var(--rule);
      padding: 0.7rem 0.8rem; width: 100%; border-radius: 0;
    }
    .field textarea { resize: vertical; min-height: 8rem; }
    .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--ink); }
    .form-submit { grid-column: 1 / -1; justify-self: start; border: none; cursor: pointer; }
    .form-submit[disabled] { opacity: 0.6; cursor: default; }
    .form-error {
      grid-column: 1 / -1; background: #FDECEC; border-left: 3px solid var(--accent);
      padding: 0.75rem 0.9rem; font-size: 0.9rem;
    }
    .form-done {
      background: var(--card); border-left: 3px solid var(--accent);
      padding: 1rem 1.1rem; font-size: 1rem;
    }
    /* Off-screen rather than display:none — some bots skip hidden fields. */
    .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
    @media (max-width: 900px) {
      .pitch-form { grid-template-columns: 1fr; }
      .field label { font-size: 0.75rem; }
      .field input, .field select, .field textarea { font-size: 16px; }
    }`;

const CONTACT_FORM_SCRIPT = `
  <script>
    (function () {
      var form = document.getElementById('pitch-form');
      if (!form) return;
      var errorBox = document.getElementById('form-error');
      var done = document.getElementById('form-done');
      var button = form.querySelector('button[type="submit"]');
      var label = button.textContent;

      // Stamped on load, not at build time. Baking it into the HTML would make
      // every build produce a different page, and would measure the age of
      // the deploy rather than how long this visitor spent on the page.
      var stamp = form.querySelector('input[name="rendered"]');
      if (stamp) stamp.value = String(Date.now());

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        errorBox.hidden = true;
        button.disabled = true;
        button.textContent = 'Sending…';

        var payload = {};
        new FormData(form).forEach(function (value, key) { payload[key] = value; });

        fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (body) {
              return { ok: res.ok, body: body };
            });
          })
          .then(function (result) {
            if (result.ok) {
              form.hidden = true;
              done.hidden = false;
              done.scrollIntoView({ block: 'center', behavior: 'smooth' });
              return;
            }
            fail(result.body.error || 'Something went wrong. Please try again.');
          })
          .catch(function () {
            fail('Could not reach the server. Please try again, or email pr@marinamogilko.co.');
          });
      });

      // Never clears the form: whatever they typed stays exactly where it is.
      function fail(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        button.disabled = false;
        button.textContent = label;
        errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    })();
  </script>`;

module.exports = { renderFormFields, renderContactForm, CONTACT_FORM_CSS, CONTACT_FORM_SCRIPT };
