# 624 Siteworks — Automated Lead, Spec-Site & Stripe Checkout Pipeline

This workspace (`f:\624 SITEWORKS\My Sites\624siteworks.com`) contains both your main agency website (`index.html`), your client checkout portal (`claim.html`), and the complete **624 Siteworks Automated Lead & Spec-Site Pipeline**.

---

## 📁 Folder Structure Explained

Everything lives inside your `624siteworks.com` folder so that shared web files (`claim.html` and `assets/preview-banner.js`) are automatically hosted on `https://624siteworks.com`:

```text
f:\624 SITEWORKS\My Sites\624siteworks.com\
├── index.html                    # Main 624 Siteworks website ("Start Your Build" -> Google Form)
├── claim.html                    # Client payment page (One-time build + optional $89/mo care plan)
├── assets/
│   └── preview-banner.js         # Floating bottom bar injected into client preview sites
├── google-apps-script/
│   └── Code.gs                   # Google Sheets "🚀 624 Lead Engine" automation script
├── scripts/
│   ├── 624deploy.ps1             # 1-Click Cloudflare Pages deploy script (Windows PowerShell)
│   └── 624deploy.sh              # 1-Click Cloudflare Pages deploy script (macOS / zsh)
└── README.md                     # Setup & daily workflow guide
```

> **Where do individual client preview sites go?**
> Keep building each client's preview site in its own subfolder inside `f:\624 SITEWORKS\Client Sites\<ClientName>`. When a preview site is ready to deploy, run `624deploy.ps1` against that client folder!

---

## 💳 Part 1: Setting Up Stripe Payment Links (Build Fee + Monthly Care Plan)

Because `624siteworks.com` is a fast static site, **Stripe Payment Links** let you collect a **one-time build fee (`$595` / `$995` / `$1,695`) AND a recurring `$89/mo` subscription** in a single checkout with zero backend servers to maintain.

### Step 1: Create Your Products in Stripe
1. Log in to your [Stripe Dashboard → Products](https://dashboard.stripe.com/products).
2. Create these 4 products:
   - **Starter Website Build** — `$595.00` (**One-off**)
   - **Pro Website Build** — `$995.00` (**One-off**)
   - **Premium Website Build** — `$1,695.00` (**One-off**)
   - **"Peace of Mind" Hosting & Care Plan** — `$89.00` (**Recurring / Monthly**)
   - *(Optional)* **Professional Brand Photography Add-On** — `$495.00` (**One-off**)

### Step 2: Create the Payment Links in Stripe
Go to [Stripe Dashboard → Payment Links → + New](https://dashboard.stripe.com/payment-links) and create:

1. **Starter + $89/mo Care Plan** (`starterWithCarePlan`):
   - Select **"Peace of Mind" Hosting & Care Plan ($89/mo)** as the main item.
   - Click **"+ Add product"** and select **Starter Website Build ($595 one-time)**. *(Stripe automatically charges `$595 + $89` today, and `$89/mo` going forward!)*
   - *(Optional)* Under **Optional items**, add **Professional Brand Photography ($495)** so clients can check a box at checkout to add photography.
2. **Starter Build Only** (`starterBuildOnly`):
   - Select **Starter Website Build ($595 one-time)**.
3. **Pro + $89/mo Care Plan** (`proWithCarePlan`):
   - Select **"Peace of Mind" Hosting & Care Plan ($89/mo)** + **Pro Website Build ($995 one-time)**.
4. **Pro Build Only** (`proBuildOnly`):
   - Select **Pro Website Build ($995 one-time)**.
5. **Premium Build** (`premiumBuild`):
   - Select **Premium Website Build ($1,695 one-time)**.
6. **Standalone Care Plan** (`standaloneCarePlan`):
   - Select **"Peace of Mind" Hosting & Care Plan ($89/mo)**.

### Step 3: Paste Your URLs into `claim.html`
Open [`claim.html`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/claim.html) and replace the `https://buy.stripe.com/REPLACE_...` placeholders inside `STRIPE_PAYMENT_LINKS` near the top of the file.

When you send a preview client a link like:
`https://624siteworks.com/claim.html?business=Fox+Valley+Roofing&preview=https://fox-valley-roofing.pages.dev`
*(or when they click the floating banner at the bottom of their preview site)*, `claim.html` automatically greets them by business name and passes their business name to Stripe!

---

## 📊 Part 2: Google Sheet Setup & Column Q `ARRAYFORMULA`

### Step 1: Add the Google Apps Script (`Code.gs`)
1. Open your **624 Siteworks Client Intake Responses** Google Sheet.
2. Click **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with the full code from [`google-apps-script/Code.gs`](file:///f:/624%20SITEWORKS/My%20Sites/624siteworks.com/google-apps-script/Code.gs) and click **Save (💾)**.
4. Reload your Google Sheet. A new menu **`🚀 624 Lead Engine`** will appear at the top.
5. Click **`🚀 624 Lead Engine → 🛠️ Initialize / Repair "Prospect Pipeline" Tab`** to automatically create the `Prospect Pipeline` tab with all 21 columns (`A–U`), status dropdowns, and the Column Q `ARRAYFORMULA`.
6. Click **`🚀 624 Lead Engine → 🔑 Configure API Keys`** and paste your **Outscraper API Key** and **Google Gemini API Key**.

### Column Q `ARRAYFORMULA` (Reference)
If you ever want to paste the Column Q formula manually into cell **`Q1`** (row 1 header cell of Column Q) on either your `Prospect Pipeline` tab or your Google Form intake tab, paste this into **`Q1`** and make sure `Q2:Q` below it are empty:

```excel
=ARRAYFORMULA(IF(ROW(A:A)=1, "Generated AI Prompt", IF(B:B="", "", "Build a high-converting, blazing-fast 4-page static Tailwind CSS website (index.html, services.html, about.html, contact.html) for " & B:B & ". " & CHAR(10) & CHAR(10) & "BUSINESS PROFILE:" & CHAR(10) & "- Business Name: " & B:B & CHAR(10) & "- Target Service Area: " & C:C & CHAR(10) & "- Phone Number: " & D:D & CHAR(10) & "- Email Address: " & N:N & CHAR(10) & "- Operating Hours: " & O:O & CHAR(10) & "- Existing Domain / Reference: " & M:M & CHAR(10) & "- Logo URL: " & L:L & CHAR(10) & "- Brand Colors & Vibe: " & E:E & CHAR(10) & "- Primary Trust Badge / Subheadline: " & P:P & " (" & S:S & ")" & CHAR(10) & CHAR(10) & "CORE SERVICES TO FEATURE:" & CHAR(10) & "1. " & F:F & ": " & G:G & CHAR(10) & "2. " & H:H & ": " & I:I & CHAR(10) & "3. " & J:J & ": " & K:K & CHAR(10) & CHAR(10) & "TECHNICAL REQUIREMENTS:" & CHAR(10) & "- Pure static HTML5 + Tailwind CSS via CDN, mobile-first sticky header with click-to-call phone button (" & D:D & "), local SEO schema markup, and clear lead-capture forms." & CHAR(10) & "- Include the 624 Siteworks floating concept banner right before </body> on every page: <script src=""https://624siteworks.com/assets/preview-banner.js"" data-business=""" & B:B & """ defer></script>")))
```

---

## 🚀 Part 3: Daily 4-Gate Workflow

1. **Gate 1 — Scrape Local Leads (`1. Scraped`)**
   - In Google Sheets, click **`🚀 624 Lead Engine → 1️⃣ Gate 1: Scrape Local Leads (Outscraper)`**.
   - Enter a trade & city (e.g., `"Roofing contractor, Appleton, WI"`).
   - The script pulls Google Maps results with `5+` reviews, crawls their websites for missing emails, and logs them as `1. Scraped`.
2. **Human Review → `Approve Research`**
   - Scan the new rows. For businesses you want to target, change Column R (`Lead Status`) to **`Approve Research`**.
3. **Gate 2 — AI Enrichment (`2. Prompt Ready`)**
   - Click **`🚀 624 Lead Engine → 2️⃣ Gate 2: Enrich Approved Leads (Gemini AI)`**.
   - Gemini 2.5 Flash populates their trade colors/vibe, 3 core services with local SEO copy, and trust badge, then flips status to **`2. Prompt Ready`**.
4. **Gate 3 — Build in Antigravity IDE & 1-Click Deploy to `.pages.dev`**
   - Copy the generated prompt from **Column Q** and paste it into Antigravity IDE inside a new client folder (e.g., `f:\624 SITEWORKS\Client Sites\FoxValleyRoofing`).
   - Once you like the local build, deploy it with 1 command in PowerShell:
     ```powershell
     & "f:\624 SITEWORKS\My Sites\624siteworks.com\scripts\624deploy.ps1" "Fox Valley Roofing" "f:\624 SITEWORKS\Client Sites\FoxValleyRoofing"
     ```
     *(Or `cd` into the client folder first and run `& "f:\624 SITEWORKS\My Sites\624siteworks.com\scripts\624deploy.ps1"`)*
   - The root `https://<slug>.pages.dev` URL is automatically copied to your clipboard!
   - Paste that URL into **Column T (`Spec Preview URL`)** and set **Column R (`Lead Status`)** to **`Ready to Email`**.
5. **Gate 4 — Generate HTML Gmail Drafts (`5. Draft Created`)**
   - Click **`🚀 624 Lead Engine → 4️⃣ Gate 4: Create Gmail Drafts for Previews`**.
   - The script captures a `1200x800` desktop screenshot of the live `.pages.dev` site and creates a ready-to-send HTML draft in your Gmail with the clickable preview image and your personalized `claim.html` payment link.

