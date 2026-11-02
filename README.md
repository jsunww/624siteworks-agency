# 624 Siteworks — Automated Lead, Spec-Site & Stripe Checkout Pipeline

This workspace (`f:\624 SITEWORKS\My Sites\624siteworks.com`) contains your main agency website (`index.html`), your client checkout portal (`claim.html`), and the complete **624 Siteworks Automated Lead & Spec-Site Pipeline**.

---

## 📁 Folder Structure

```text
f:\624 SITEWORKS\My Sites\624siteworks.com\
├── index.html                    # Main 624 Siteworks website ("Start Your Build" -> Google Form)
├── claim.html                    # Client payment page (One-time build + optional $89/mo care plan)
├── 624deploy.ps1                 # 1-Click Cloudflare Pages deploy script (Windows PowerShell)
├── 624deploy.sh                  # 1-Click Cloudflare Pages deploy script (macOS / zsh)
├── assets/
│   └── preview-banner.js         # Floating bottom bar injected into client preview sites
├── google-apps-script/
│   └── Code.gs                   # Google Sheets "🚀 624 Lead Engine" automation script
└── README.md                     # Complete setup & daily workflow guide
```

---

## 🆓 Free-Tier Alternative to Outscraper (No Credit Card Required)

**Yes!** [**Serper.dev**](https://serper.dev) gives you **2,500 free Google Maps / Places searches** immediately upon signup with **no credit card or billing info required**.

1. Go to [https://serper.dev](https://serper.dev) and sign up with your Google account (no credit card asked).
2. Click **API Key** on the left sidebar and copy your key.
3. [`google-apps-script/Code.gs`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/google-apps-script/Code.gs) has been updated to support **Serper.dev** natively!
   - When you click **`🚀 624 Lead Engine → 🔑 Configure API Keys`** in your Google Sheet, paste your **Serper API Key** into the first prompt (and just leave Outscraper blank).
   - Serper fetches the Google Maps listing (name, phone, website, rating, review count, hours, trade type, thumbnail), and our built-in website crawler (`crawlWebsiteForContactInfo_`) automatically visits `/`, `/contact`, `/contact-us`, and `/about` on each business's website to extract their email address and Facebook page for free.

---

## 💳 Complete Click-by-Click Stripe Setup Guide

Below is every exact click and setting needed in your [Stripe Dashboard](https://dashboard.stripe.com) to configure your 5 products and 6 Payment Links for [`claim.html`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/claim.html).

### Part A: Create Your 5 Products in Stripe

Log in to [https://dashboard.stripe.com/products](https://dashboard.stripe.com/products) and click **`+ Add product`** (top-right button) for each of the 5 items below:

#### Product 1: Starter Website Build ($595 One-Off)
1. Click **`+ Add product`**.
2. **Name:** `Starter Website Build`
3. **Description:** `Custom 4-page mobile-optimized static website build (Home + up to 3 additional pages), lead capture form, and local SEO setup.`
4. **Pricing model:** Leave on `Flat rate`.
5. Select **`One-off`** (NOT Recurring).
6. **Amount:** `$595.00` (`USD`).
7. Click **`Add product`** (bottom right).

#### Product 2: Pro Website Build ($995 One-Off)
1. Click **`+ Add product`**.
2. **Name:** `Pro Website Build`
3. **Description:** `Custom website build (Home + up to 6 additional pages), advanced local SEO & JSON-LD schema, and Lighthouse performance tuning.`
4. Select **`One-off`**.
5. **Amount:** `$995.00` (`USD`).
6. Click **`Add product`**.

#### Product 3: Premium Website Build ($1,695 One-Off)
1. Click **`+ Add product`**.
2. **Name:** `Premium Website Build`
3. **Description:** `Up to 10 custom pages, on-site drone & team photography, Google Business Profile setup, and 6 months of the Peace of Mind Plan included.`
4. Select **`One-off`**.
5. **Amount:** `$1,695.00` (`USD`).
6. Click **`Add product`**.

#### Product 4: "Peace of Mind" Monthly Care Plan ($89/mo Recurring)
1. Click **`+ Add product`**.
2. **Name:** `"Peace of Mind" Website Hosting & Care Plan`
3. **Description:** `Global CDN hosting, enterprise SSL security, domain management, and minor monthly content updates.`
4. Select **`Recurring`**.
5. **Amount:** `$89.00` (`USD`).
6. **Billing period:** `Monthly`.
7. Click **`Add product`**.

#### Product 5: Professional Brand Photography Add-On ($495 One-Off)
1. Click **`+ Add product`**.
2. **Name:** `Professional Brand Photography Add-On`
3. **Description:** `Up to 2 hours on-site in Northeast WI, 15–25 edited high-res photos, team headshots & action shots with full usage rights.`
4. Select **`One-off`**.
5. **Amount:** `$495.00` (`USD`).
6. Click **`Add product`**.

---

### Part B: Create Your 6 Payment Links in Stripe

Now go to [https://dashboard.stripe.com/payment-links](https://dashboard.stripe.com/payment-links) and click **`+ New`** (top-right) for each of the 6 links below.

#### Link 1: `starterWithCarePlan` ($595 Build + $89/mo Subscription)
1. Click **`+ New`** payment link.
2. Under **Select type**, leave it on **`Products or subscriptions`**.
3. Under **Product**:
   - Search and select **`Starter Website Build ($595.00)`** (`Qty: 1`).
   - Click **`+ Add another product`** right below it, and select **`"Peace of Mind" Website Hosting & Care Plan ($89.00 / month)`** (`Qty: 1`).
   - *(Stripe automatically combines them: the client pays `$684.00` today for the build + first month, and then `$89.00/month` starting month 2!)*
4. *(Optional Upsell)* Expand **`Optional items`** → click **`+ Add optional product`** → select **`Professional Brand Photography Add-On ($495.00)`**. This gives the client a 1-click checkbox right on the checkout page to add photography!
5. Under **Options**:
   - Check **`Collect customers' phone numbers`** (so you always have their direct cell for the kickoff call).
   - Check **`Limit to 1 subscription per customer`** (if shown).
6. Click the **`After payment`** tab at the top of the preview pane:
   - Select **`Show confirmation page`**.
   - Check **`Replace default with custom message`** and enter:
     `Thank you! Jason from 624 Siteworks will reach out within 1 business day to schedule your customization & domain launch call.`
7. Click **`Create link`** (top right), click **`Copy`**, and paste that URL into `starterWithCarePlan` in [`claim.html`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/claim.html#L49-L66).

#### Link 2: `starterBuildOnly` ($595 Build Only — No Monthly Plan)
1. Click **`+ New`** payment link.
2. Under **Product**, select **`Starter Website Build ($595.00)`**.
3. *(Optional)* Under **`Optional items`**, add **`Professional Brand Photography Add-On ($495.00)`**.
4. Under **Options**, check **`Collect customers' phone numbers`**.
5. Under **`After payment`**, set the same custom confirmation message.
6. Click **`Create link`**, copy the URL, and paste it into `starterBuildOnly` in [`claim.html`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/claim.html#L49-L66).

#### Link 3: `proWithCarePlan` ($995 Build + $89/mo Subscription)
1. Click **`+ New`** payment link.
2. Under **Product**:
   - Select **`Pro Website Build ($995.00)`**.
   - Click **`+ Add another product`** and select **`"Peace of Mind" Website Hosting & Care Plan ($89.00 / month)`**.
3. *(Optional)* Under **`Optional items`**, add **`Professional Brand Photography Add-On ($495.00)`**.
4. Check **`Collect customers' phone numbers`** and set your custom confirmation message under **`After payment`**.
5. Click **`Create link`**, copy the URL, and paste it into `proWithCarePlan` in [`claim.html`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/claim.html#L49-L66).

#### Link 4: `proBuildOnly` ($995 Build Only — No Monthly Plan)
1. Click **`+ New`** payment link.
2. Under **Product**, select **`Pro Website Build ($995.00)`**.
3. *(Optional)* Under **`Optional items`**, add **`Professional Brand Photography Add-On ($495.00)`**.
4. Check **`Collect customers' phone numbers`** and set your confirmation message.
5. Click **`Create link`**, copy the URL, and paste it into `proBuildOnly` in [`claim.html`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/claim.html#L49-L66).

#### Link 5: `premiumBuild` ($1,695 Build — Includes Photography & 6 Mos Care)
1. Click **`+ New`** payment link.
2. Under **Product**, select **`Premium Website Build ($1,695.00)`**.
3. Check **`Collect customers' phone numbers`** and set your confirmation message.
4. Click **`Create link`**, copy the URL, and paste it into `premiumBuild` in [`claim.html`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/claim.html#L49-L66).

#### Link 6: `standaloneCarePlan` ($89/mo Standalone Subscription)
1. Click **`+ New`** payment link.
2. Under **Product**, select **`"Peace of Mind" Website Hosting & Care Plan ($89.00 / month)`**.
3. Check **`Collect customers' phone numbers`**.
4. Click **`Create link`**, copy the URL, and paste it into `standaloneCarePlan` in [`claim.html`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/claim.html#L49-L66).


---

## 📊 Part 2: Updated Column Q `ARRAYFORMULA` (With Full SEO, WCAG Accessibility & AI/Voice Search)

Running **`🚀 624 Lead Engine → Initialize / Repair "Prospect Pipeline" Tab`** in Google Sheets automatically installs this formula into **`Q1`**. If you also want to paste it into your Google Form intake tab (`Q1`), use:

```excel
=ARRAYFORMULA(IF(ROW(A:A)=1, "Generated AI Prompt", IF(B:B="", "", "Build a high-converting, blazing-fast 4-page static Tailwind CSS website (index.html, services.html, about.html, contact.html) plus llms.txt, sitemap.xml, and robots.txt for " & B:B & ". " & CHAR(10) & CHAR(10) & "BUSINESS PROFILE:" & CHAR(10) & "- Business Name: " & B:B & CHAR(10) & "- Target Service Area: " & C:C & CHAR(10) & "- Phone Number: " & D:D & CHAR(10) & "- Email Address: " & IF(N:N="", "info@" & LOWER(REGEXREPLACE(B:B, "[^a-zA-Z0-9]", "")) & ".com", N:N) & CHAR(10) & "- Operating Hours: " & O:O & CHAR(10) & "- Existing Domain / Reference: " & M:M & CHAR(10) & "- Current Web/SEO Weaknesses to Fix: " & V:V & CHAR(10) & "- Logo URL: " & L:L & CHAR(10) & "- Brand Colors & Vibe: " & IF(E:E="", "Auto-select a bold, trustworthy contractor color palette and modern industrial vibe tailored to their trade", E:E) & CHAR(10) & "- Primary Trust Badge / Subheadline: " & IF(P:P="", S:S & " - Trusted Local Fox Valley Contractor", P:P & " (" & S:S & ")") & CHAR(10) & CHAR(10) & "CORE SERVICES TO FEATURE:" & CHAR(10) & IF(F:F="", "Auto-generate their top 3 highest-margin core services based on their trade (" & S:S & ") with persuasive Fox Valley / Appleton local SEO copy.", "1. " & F:F & ": " & G:G & CHAR(10) & "2. " & H:H & ": " & I:I & CHAR(10) & "3. " & J:J & ": " & K:K) & CHAR(10) & CHAR(10) & "MANDATORY TECHNICAL, SEO, ACCESSIBILITY & AI/VOICE SEARCH REQUIREMENTS:" & CHAR(10) & "1. Mobile-First Conversion Design: Pure static HTML5 + Tailwind CSS via CDN, sticky header with click-to-call phone button (" & D:D & "), and accessible lead-capture forms." & CHAR(10) & "2. Full Technical & Local SEO: Unique keyword-rich <title> and <meta name=""description""> on all 4 pages, canonical tags, Open Graph (og:*), Twitter Cards, local geo meta tags (geo.region=""US-WI"", geo.placename), sitemap.xml, robots.txt, and rich JSON-LD @graph (LocalBusiness/HomeAndConstructionBusiness, OfferCatalog/Service, BreadcrumbList)." & CHAR(10) & "3. WCAG 2.1 AA Accessibility Compliance: Include a Skip-to-Main-Content link, semantic HTML5 landmarks (<header>, <nav>, <main>, <footer>), explicit <label for> and aria-required on all form fields, aria-expanded/aria-controls on mobile menu buttons, visible keyboard focus rings, descriptive image alt text, and >= 4.5:1 color contrast ratios." & CHAR(10) & "4. AI Search (GEO/AEO) & Voice Search Optimization: Include a direct-answer summary paragraph (#ai-summary), a natural-language conversational FAQ section (#voice-faq) with matching FAQPage and SpeakableSpecification JSON-LD schema, and generate an llms.txt structured Markdown fact sheet in the root directory for AI search engines (ChatGPT, Perplexity, Google AI Overviews, Siri/Alexa)." & CHAR(10) & "5. 624 Siteworks Preview Banner: Copy preview-banner.js into assets/preview-banner.js and include right before </body> on every page: <script src=""assets/preview-banner.js"" data-business=""" & B:B & """ defer></script>")))
```
