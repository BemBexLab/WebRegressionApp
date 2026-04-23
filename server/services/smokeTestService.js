import { launchBrowser } from "./browserService.js";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
};

const PAGE_GOTO_TIMEOUT = Number(process.env.SMOKE_PAGE_GOTO_TIMEOUT_MS) || 30000;
const NETWORK_IDLE_TIMEOUT = Number(process.env.SMOKE_NETWORK_IDLE_TIMEOUT_MS) || 10000;
const POST_LOAD_DELAY = Number(process.env.SMOKE_POST_LOAD_DELAY_MS) || 1200;
const BROKEN_LINK_LIMIT = Math.max(1, Number(process.env.SMOKE_BROKEN_LINK_LIMIT) || 20);
const BROKEN_LINK_TIMEOUT = Number(process.env.SMOKE_BROKEN_LINK_TIMEOUT_MS) || 8000;
const MAX_RECORDED_ITEMS = Math.max(10, Number(process.env.SMOKE_MAX_RECORDED_ITEMS) || 40);

const CHECK_STATUS = {
  PASSED: "Passed",
  WARNING: "Warning",
  FAILED: "Failed",
  SKIPPED: "Skipped"
};

const OVERALL_STATUS = {
  HEALTHY: "Healthy",
  WARNING: "Warning",
  FAILED: "Failed"
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeHref(baseUrl, href) {
  if (!href || typeof href !== "string") {
    return null;
  }

  const trimmed = href.trim();
  if (!trimmed || /^(mailto:|tel:|javascript:|#)/i.test(trimmed)) {
    return null;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function isSameOrigin(baseUrl, targetUrl) {
  try {
    return new URL(baseUrl).origin === new URL(targetUrl).origin;
  } catch {
    return false;
  }
}

function normalizeConsoleMessage(message) {
  if (!message) {
    return "";
  }

  return String(message).replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function limitItems(items, max = MAX_RECORDED_ITEMS) {
  return Array.isArray(items) ? items.slice(0, max) : [];
}

function createEmptyFlowResult() {
  return {
    attempted: false,
    passed: true,
    step: null,
    targetUrl: null,
    details: "Flow test not attempted for this page."
  };
}

function createCheck({
  id,
  label,
  status = CHECK_STATUS.SKIPPED,
  applicable = false,
  summary = "",
  findings = []
}) {
  return {
    id,
    label,
    status,
    applicable,
    summary,
    findings: limitItems(findings, 8)
  };
}

function buildOverallStatus(checks, fallbackFailures = []) {
  const failed = checks.some((check) => check.status === CHECK_STATUS.FAILED) || fallbackFailures.length > 0;
  if (failed) {
    return OVERALL_STATUS.FAILED;
  }

  const warning = checks.some((check) => check.status === CHECK_STATUS.WARNING);
  return warning ? OVERALL_STATUS.WARNING : OVERALL_STATUS.HEALTHY;
}

function summarizeCheckCounts(checks) {
  return checks.reduce(
    (summary, check) => {
      if (check.status === CHECK_STATUS.PASSED) {
        summary.passed += 1;
      } else if (check.status === CHECK_STATUS.WARNING) {
        summary.warning += 1;
      } else if (check.status === CHECK_STATUS.FAILED) {
        summary.failed += 1;
      } else {
        summary.skipped += 1;
      }

      return summary;
    },
    { passed: 0, warning: 0, failed: 0, skipped: 0 }
  );
}

export function createDefaultSmokeResult(pageUrl = "") {
  return {
    pageUrl,
    responseCode: null,
    loadTimeMs: null,
    testedAt: new Date().toISOString(),
    status: OVERALL_STATUS.HEALTHY,
    coreElements: [],
    missingCoreElements: [],
    consoleErrors: [],
    brokenLinks: [],
    form: {
      available: false,
      count: 0,
      interactiveControlCount: 0,
      requiredFieldCount: 0,
      semanticValidationCount: 0,
      formWithSubmitCount: 0
    },
    flow: createEmptyFlowResult(),
    requestFailures: [],
    checks: [],
    checkSummary: {
      passed: 0,
      warning: 0,
      failed: 0,
      skipped: 0
    },
    metrics: {
      internalLinksChecked: 0,
      navLinksChecked: 0,
      buttonTargetsChecked: 0,
      formsDetected: 0,
      authArtifactsDetected: 0,
      searchArtifactsDetected: 0,
      apiFailures: 0,
      cookiesObserved: 0,
      fileInputsDetected: 0,
      downloadLinksDetected: 0
    }
  };
}

async function gotoWithRetry(page, url) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_GOTO_TIMEOUT });
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await delay(800 * attempt);
      }
    }
  }

  throw lastError;
}

async function collectLinkHealth(requestContext, baseUrl, hrefs, limit = BROKEN_LINK_LIMIT) {
  const checked = [];
  const broken = [];
  const seen = new Set();

  for (const href of hrefs) {
    const normalized = normalizeHref(baseUrl, href);
    if (!normalized || !isSameOrigin(baseUrl, normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    if (checked.length >= limit) {
      break;
    }

    try {
      const response = await requestContext.get(normalized, {
        failOnStatusCode: false,
        timeout: BROKEN_LINK_TIMEOUT,
        maxRedirects: 5
      });

      const entry = {
        url: normalized,
        statusCode: response.status()
      };

      checked.push(entry);
      if (response.status() >= 400) {
        broken.push(entry);
      }
    } catch (error) {
      const entry = {
        url: normalized,
        statusCode: null,
        error: error instanceof Error ? error.message : String(error)
      };
      checked.push(entry);
      broken.push(entry);
    }
  }

  return { checked, broken };
}

async function extractPageInventory(page) {
  return page.evaluate(() => {
    const toText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity || "1") === 0
      ) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const unique = (values) => [...new Set(values.filter(Boolean))];
    const anchors = [...document.querySelectorAll("a[href]")];
    const visibleAnchors = anchors.filter(isVisible);
    const headingText = unique(
      [...document.querySelectorAll("h1, h2, h3")]
        .map((element) => toText(element.textContent))
        .filter(Boolean)
    );
    const authMatcher = /(log\s?in|sign\s?in|sign\s?up|register|create account|forgot password|reset password|logout)/i;

    const buttons = [...document.querySelectorAll("button, [role='button'], a[role='button'], a[class*='btn'], a[class*='button']")]
      .filter(isVisible)
      .map((element, index) => {
        const href =
          element.getAttribute("href") ||
          element.getAttribute("data-href") ||
          element.getAttribute("data-url") ||
          "";
        const type = element.getAttribute("type") || "";
        const label = toText(
          element.getAttribute("aria-label") ||
            element.textContent ||
            element.getAttribute("title") ||
            `${element.tagName.toLowerCase()}-${index + 1}`
        );
        const inForm = Boolean(element.closest("form"));
        return {
          label,
          href,
          type,
          disabled:
            element.hasAttribute("disabled") ||
            element.getAttribute("aria-disabled") === "true",
          inForm,
          actionable: Boolean(href) || type === "submit" || inForm
        };
      });

    const forms = [...document.querySelectorAll("form")].map((form, index) => {
      const fields = [...form.querySelectorAll("input, textarea, select")];
      const visibleFields = fields.filter(isVisible);
      const submitControls = [...form.querySelectorAll("button[type='submit'], input[type='submit'], button:not([type]), [role='button']")].filter(isVisible);
      const errorHints = [...form.querySelectorAll("[role='alert'], [aria-live], .error, .errors, .invalid-feedback, .field-error, [data-error]")];
      const semanticValidationCount = visibleFields.filter((field) => {
        const type = (field.getAttribute("type") || "").toLowerCase();
        return ["email", "tel", "url", "number", "date"].includes(type) || Boolean(field.getAttribute("pattern"));
      }).length;
      const mismatchedFieldCount = visibleFields.filter((field) => {
        const meta = toText(
          [
            field.getAttribute("name"),
            field.getAttribute("id"),
            field.getAttribute("placeholder"),
            field.getAttribute("aria-label")
          ]
            .filter(Boolean)
            .join(" ")
        );
        const type = (field.getAttribute("type") || "").toLowerCase();
        const emailLike = /email/i.test(meta) && type !== "email";
        const phoneLike = /(phone|mobile|tel)/i.test(meta) && type !== "tel";
        return emailLike || phoneLike;
      }).length;

      return {
        id: form.getAttribute("id") || `form-${index + 1}`,
        method: (form.getAttribute("method") || "get").toLowerCase(),
        action: form.getAttribute("action") || "",
        fieldCount: visibleFields.length,
        requiredCount: visibleFields.filter((field) => field.required || field.getAttribute("aria-required") === "true").length,
        semanticValidationCount,
        mismatchedFieldCount,
        hasPassword: visibleFields.some((field) => (field.getAttribute("type") || "").toLowerCase() === "password"),
        hasFile: visibleFields.some((field) => (field.getAttribute("type") || "").toLowerCase() === "file"),
        hasSubmit: submitControls.length > 0,
        errorHintCount: errorHints.length
      };
    });

    const breadcrumbRoot =
      document.querySelector("nav[aria-label*='breadcrumb' i]") ||
      document.querySelector("[aria-label*='breadcrumb' i]") ||
      document.querySelector(".breadcrumb") ||
      document.querySelector("[data-breadcrumb]");
    const breadcrumbItems = breadcrumbRoot
      ? [...breadcrumbRoot.querySelectorAll("a, li, span")]
          .map((element) => toText(element.textContent))
          .filter(Boolean)
      : [];

    const authLinks = visibleAnchors
      .map((anchor) => {
        const text = toText(anchor.textContent || anchor.getAttribute("aria-label"));
        const href = anchor.getAttribute("href") || "";
        return { text, href, combined: `${text} ${href}`.trim() };
      })
      .filter((anchor) => authMatcher.test(anchor.combined));

    const searchInputs = [...document.querySelectorAll("input[type='search'], input[name*='search' i], input[placeholder*='search' i], form[role='search'] input")].filter(isVisible);
    const fileInputs = [...document.querySelectorAll("input[type='file']")].filter(isVisible);
    const downloadLinks = visibleAnchors
      .filter((anchor) => {
        const href = anchor.getAttribute("href") || "";
        return anchor.hasAttribute("download") || /\.(pdf|csv|zip|docx?|xlsx?)($|\?)/i.test(href);
      })
      .map((anchor) => anchor.getAttribute("href") || "")
      .filter(Boolean);

    return {
      title: toText(document.title),
      bodyText: toText(document.body?.innerText || "").slice(0, 8000),
      headings: headingText.slice(0, 20),
      coreElements: [
        { name: "title", selector: "title", exists: Boolean(document.querySelector("title")) },
        { name: "main", selector: "main, [role='main']", exists: Boolean(document.querySelector("main, [role='main']")) },
        { name: "header", selector: "header, [role='banner'], nav", exists: Boolean(document.querySelector("header, [role='banner'], nav")) },
        { name: "footer", selector: "footer, [role='contentinfo']", exists: Boolean(document.querySelector("footer, [role='contentinfo']")) }
      ],
      links: unique(visibleAnchors.map((anchor) => anchor.getAttribute("href") || "")),
      navLinks: unique([...document.querySelectorAll("nav a[href], header a[href]")].filter(isVisible).map((anchor) => anchor.getAttribute("href") || "")),
      buttons,
      forms,
      breadcrumb: {
        present: Boolean(breadcrumbRoot),
        itemCount: breadcrumbItems.length,
        items: breadcrumbItems.slice(0, 10)
      },
      search: {
        present: searchInputs.length > 0,
        inputCount: searchInputs.length
      },
      auth: {
        loginLinks: authLinks.filter((anchor) => /(log\s?in|sign\s?in)/i.test(anchor.combined)).map((anchor) => anchor.href),
        signupLinks: authLinks.filter((anchor) => /(sign\s?up|register|create account)/i.test(anchor.combined)).map((anchor) => anchor.href),
        resetLinks: authLinks.filter((anchor) => /(forgot password|reset password)/i.test(anchor.combined)).map((anchor) => anchor.href),
        logoutLinks: authLinks.filter((anchor) => /logout/i.test(anchor.combined)).map((anchor) => anchor.href),
        hasPasswordField: Boolean(document.querySelector("input[type='password']"))
      },
      fileUploads: fileInputs.map((input) => ({
        accept: input.getAttribute("accept") || "",
        multiple: input.hasAttribute("multiple"),
        required: input.required || input.getAttribute("aria-required") === "true"
      })),
      downloadLinks,
      hasRawErrorMarkers:
        /(exception|traceback|stack trace|stacktrace|internal server error|sqlstate|undefined is not a function|cannot read properties of undefined)/i.test(
          toText(document.body?.innerText || "")
        )
    };
  });
}

function buildKeywordFromInventory(inventory) {
  const stopwords = new Set([
    "about",
    "after",
    "before",
    "button",
    "click",
    "contact",
    "features",
    "footer",
    "header",
    "home",
    "login",
    "page",
    "search",
    "their",
    "there",
    "these",
    "those",
    "website",
    "with",
    "your"
  ]);
  const source = `${inventory.title || ""} ${(inventory.headings || []).join(" ")} ${inventory.bodyText || ""}`;
  const words = source.match(/[A-Za-z][A-Za-z-]{3,}/g) || [];
  const candidate = words.find((word) => !stopwords.has(word.toLowerCase()));
  return candidate || "test";
}

async function runRepresentativeFlow(page, pageUrl) {
  const result = createEmptyFlowResult();
  const locator = page
    .locator('a[href*="contact" i], a:has-text("Contact"), a:has-text("Get in touch"), a:has-text("Support")')
    .first();
  const count = await locator.count();
  if (!count) {
    return result;
  }

  const href = await locator.getAttribute("href");
  const targetUrl = normalizeHref(pageUrl, href);
  if (!targetUrl) {
    return {
      attempted: true,
      passed: false,
      step: "Home -> Contact",
      targetUrl: null,
      details: "A contact-style link was found, but its URL could not be resolved."
    };
  }

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: PAGE_GOTO_TIMEOUT });
    await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
    const formCount = await page.locator("form").count();
    const actionCount = await page.locator('button[type="submit"], input[type="submit"], button').count();

    return {
      attempted: true,
      passed: formCount > 0 || actionCount > 0,
      step: "Home -> Contact -> Form visible",
      targetUrl,
      details:
        formCount > 0 || actionCount > 0
          ? "Representative contact flow opened successfully."
          : "Contact page opened, but no form or submit action was detected."
    };
  } catch (error) {
    return {
      attempted: true,
      passed: false,
      step: "Home -> Contact",
      targetUrl,
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

async function assessNavigation(requestContext, pageUrl, inventory) {
  const internalLinks = await collectLinkHealth(requestContext, pageUrl, inventory.links, BROKEN_LINK_LIMIT);
  const navLinks = await collectLinkHealth(requestContext, pageUrl, inventory.navLinks, Math.min(12, BROKEN_LINK_LIMIT));
  const buttonTargets = await collectLinkHealth(
    requestContext,
    pageUrl,
    inventory.buttons.map((button) => button.href).filter(Boolean),
    Math.min(12, BROKEN_LINK_LIMIT)
  );

  const breadcrumbItems = inventory.breadcrumb?.items || [];
  const hasBrokenNavigation =
    internalLinks.broken.length > 0 || navLinks.broken.length > 0 || buttonTargets.broken.length > 0;
  const breadcrumbWarning =
    inventory.breadcrumb?.present &&
    (inventory.breadcrumb.itemCount < 2 || !breadcrumbItems[breadcrumbItems.length - 1]);

  const findings = [];
  if (internalLinks.broken.length > 0) {
    findings.push(`${internalLinks.broken.length} internal link(s) returned 4xx/5xx or no response.`);
  }
  if (navLinks.broken.length > 0) {
    findings.push(`${navLinks.broken.length} navigation link(s) failed health checks.`);
  }
  if (buttonTargets.broken.length > 0) {
    findings.push(`${buttonTargets.broken.length} button target link(s) failed health checks.`);
  }
  if (breadcrumbWarning) {
    findings.push("Breadcrumb markup exists but does not appear complete.");
  }

  return {
    brokenLinks: internalLinks.broken,
    metrics: {
      internalLinksChecked: internalLinks.checked.length,
      navLinksChecked: navLinks.checked.length,
      buttonTargetsChecked: buttonTargets.checked.length
    },
    check: createCheck({
      id: "navigation-links",
      label: "Navigation & Links",
      applicable: true,
      status: hasBrokenNavigation
        ? CHECK_STATUS.FAILED
        : breadcrumbWarning
          ? CHECK_STATUS.WARNING
          : CHECK_STATUS.PASSED,
      summary: `Checked ${internalLinks.checked.length} internal link(s), ${navLinks.checked.length} menu link(s), and ${buttonTargets.checked.length} button target(s).`,
      findings
    })
  };
}

function assessForms(inventory, representativeFlow, searchAuditRan) {
  const forms = inventory.forms || [];
  if (forms.length === 0) {
    return {
      form: {
        available: false,
        count: 0,
        interactiveControlCount: 0,
        requiredFieldCount: 0,
        semanticValidationCount: 0,
        formWithSubmitCount: 0
      },
      check: createCheck({
        id: "forms-inputs",
        label: "Forms & Input Fields",
        status: CHECK_STATUS.SKIPPED,
        summary: "No forms were detected on this page."
      })
    };
  }

  const totalFields = forms.reduce((sum, form) => sum + (form.fieldCount || 0), 0);
  const requiredFieldCount = forms.reduce((sum, form) => sum + (form.requiredCount || 0), 0);
  const semanticValidationCount = forms.reduce((sum, form) => sum + (form.semanticValidationCount || 0), 0);
  const formWithSubmitCount = forms.filter((form) => form.hasSubmit).length;
  const formsWithoutSubmit = forms.filter((form) => !form.hasSubmit);
  const mismatchedFields = forms.reduce((sum, form) => sum + (form.mismatchedFieldCount || 0), 0);
  const formsWithoutErrorHints = forms.filter((form) => form.errorHintCount === 0);

  const findings = [];
  if (formsWithoutSubmit.length > 0) {
    findings.push(`${formsWithoutSubmit.length} form(s) did not expose a visible submit control.`);
  }
  if (mismatchedFields > 0) {
    findings.push(`${mismatchedFields} input(s) looked like email/phone fields without semantic validation types.`);
  }
  if (formsWithoutErrorHints.length === forms.length) {
    findings.push("No inline error containers or live regions were detected near forms.");
  }
  if (!searchAuditRan && representativeFlow.attempted && !representativeFlow.passed) {
    findings.push(`Representative flow did not complete cleanly: ${representativeFlow.details}`);
  }
  if (forms.some((form) => form.method !== "get" && !form.hasPassword && !form.hasFile)) {
    findings.push("State-changing form submission and backend persistence are not auto-verified in generic scans.");
  }

  const failed = formsWithoutSubmit.length > 0;
  const warning =
    !failed &&
    (mismatchedFields > 0 ||
      formsWithoutErrorHints.length === forms.length ||
      forms.some((form) => form.method !== "get" && !form.hasPassword && !form.hasFile));

  return {
    form: {
      available: true,
      count: forms.length,
      interactiveControlCount: totalFields,
      requiredFieldCount,
      semanticValidationCount,
      formWithSubmitCount
    },
    check: createCheck({
      id: "forms-inputs",
      label: "Forms & Input Fields",
      applicable: true,
      status: failed ? CHECK_STATUS.FAILED : warning ? CHECK_STATUS.WARNING : CHECK_STATUS.PASSED,
      summary: `${forms.length} form(s) detected with ${totalFields} field(s), ${requiredFieldCount} required field(s), and ${semanticValidationCount} semantic validation field(s).`,
      findings
    })
  };
}

async function assessAuthentication(context, pageUrl, inventory) {
  const authArtifactsDetected =
    (inventory.auth?.loginLinks?.length || 0) +
    (inventory.auth?.signupLinks?.length || 0) +
    (inventory.auth?.resetLinks?.length || 0) +
    (inventory.auth?.logoutLinks?.length || 0) +
    (inventory.auth?.hasPasswordField ? 1 : 0);

  if (!authArtifactsDetected) {
    return {
      metrics: { authArtifactsDetected: 0 },
      flow: createEmptyFlowResult(),
      check: createCheck({
        id: "authentication",
        label: "Authentication",
        status: CHECK_STATUS.SKIPPED,
        summary: "No login, signup, or password reset surface was detected on this page."
      })
    };
  }

  const findings = [];
  let status = CHECK_STATUS.PASSED;
  let flow = createEmptyFlowResult();
  const authPage = await context.newPage();

  try {
    const loginHref = inventory.auth.hasPasswordField
      ? pageUrl
      : inventory.auth.loginLinks.find((href) => normalizeHref(pageUrl, href));
    const loginUrl = loginHref ? normalizeHref(pageUrl, loginHref) : null;

    if (loginUrl) {
      await gotoWithRetry(authPage, loginUrl);
      await authPage.waitForLoadState("load", { timeout: 12000 }).catch(() => {});

      const passwordField = authPage.locator('input[type="password"]').first();
      const passwordCount = await passwordField.count();
      if (!passwordCount) {
        status = CHECK_STATUS.FAILED;
        findings.push("Auth page loaded but no password field was found.");
      } else {
        const emailField = authPage
          .locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[name*="user" i], input[name*="login" i]')
          .first();
        const textField = authPage
          .locator('input[type="text"], input[name*="user" i], input[name*="login" i], input[placeholder*="email" i]')
          .first();
        const submitControl = authPage
          .locator("form button[type='submit'], form input[type='submit'], button[type='submit'], button:not([type])")
          .first();

        if (await emailField.count()) {
          await emailField.fill("invalid-functional-scan@example.com").catch(() => {});
        } else if (await textField.count()) {
          await textField.fill("invalid-functional-scan").catch(() => {});
        }
        await passwordField.fill("InvalidFunctionalScan!123").catch(() => {});

        const beforeUrl = authPage.url();
        if (await submitControl.count()) {
          await submitControl.click({ timeout: 4000 }).catch(async () => {
            await passwordField.press("Enter").catch(() => {});
          });
        } else {
          await passwordField.press("Enter").catch(() => {});
        }

        await authPage.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
        await authPage.waitForTimeout(600);

        const afterUrl = authPage.url();
        const bodyText = normalizeText(await authPage.locator("body").innerText().catch(() => ""));
        const surfacedError = /(invalid|incorrect|error|required|failed|not match|try again|unauthori)/i.test(bodyText);
        const looksAuthenticated =
          afterUrl !== beforeUrl &&
          /(dashboard|account|profile|logout)/i.test(`${afterUrl} ${bodyText}`);

        flow = {
          attempted: true,
          passed: surfacedError && !looksAuthenticated,
          step: "Invalid login handling",
          targetUrl: loginUrl,
          details: surfacedError
            ? "Invalid credentials produced a user-facing response."
            : looksAuthenticated
              ? "Invalid credentials appeared to navigate into an authenticated area."
              : "Invalid login did not show a clear error message."
        };

        if (looksAuthenticated) {
          status = CHECK_STATUS.FAILED;
          findings.push("Invalid credentials appeared to move into an authenticated flow.");
        } else if (!surfacedError) {
          status = CHECK_STATUS.WARNING;
          findings.push("Invalid login handling did not expose a clear error message.");
        }
      }
    } else {
      status = CHECK_STATUS.WARNING;
      findings.push("Authentication-related links were detected, but a login target could not be resolved.");
    }

    for (const link of inventory.auth.signupLinks.slice(0, 1)) {
      const targetUrl = normalizeHref(pageUrl, link);
      if (!targetUrl) {
        continue;
      }

      const page = await context.newPage();
      try {
        const response = await gotoWithRetry(page, targetUrl);
        if ((response?.status?.() ?? 200) >= 400) {
          status = CHECK_STATUS.FAILED;
          findings.push("Signup page returned an error response.");
        }
      } finally {
        await page.close().catch(() => {});
      }
    }

    for (const link of inventory.auth.resetLinks.slice(0, 1)) {
      const targetUrl = normalizeHref(pageUrl, link);
      if (!targetUrl) {
        continue;
      }

      const page = await context.newPage();
      try {
        const response = await gotoWithRetry(page, targetUrl);
        if ((response?.status?.() ?? 200) >= 400) {
          status = CHECK_STATUS.FAILED;
          findings.push("Password reset page returned an error response.");
        }
      } finally {
        await page.close().catch(() => {});
      }
    }

    findings.push("Session timeout and role-based authorization need site-specific credentials and are not fully auto-verified.");
  } catch (error) {
    status = CHECK_STATUS.FAILED;
    findings.push(error instanceof Error ? error.message : String(error));
  } finally {
    await authPage.close().catch(() => {});
  }

  return {
    metrics: { authArtifactsDetected },
    flow,
    check: createCheck({
      id: "authentication",
      label: "Authentication",
      applicable: true,
      status,
      summary: `Detected ${authArtifactsDetected} authentication artifact(s) and exercised a safe invalid-login check when available.`,
      findings
    })
  };
}

async function assessSearch(context, pageUrl, inventory) {
  if (!inventory.search?.present) {
    return {
      metrics: { searchArtifactsDetected: 0 },
      flow: createEmptyFlowResult(),
      ran: false,
      check: createCheck({
        id: "search",
        label: "Search Functionality",
        status: CHECK_STATUS.SKIPPED,
        summary: "No search form or search-oriented UI was detected on this page."
      })
    };
  }

  const searchPage = await context.newPage();
  const findings = [];
  let flow = createEmptyFlowResult();
  let status = CHECK_STATUS.PASSED;
  let ran = false;

  try {
    await gotoWithRetry(searchPage, pageUrl);
    await searchPage.waitForLoadState("load", { timeout: 12000 }).catch(() => {});
    const searchInput = searchPage
      .locator("input[type='search'], input[name*='search' i], input[placeholder*='search' i], form[role='search'] input")
      .first();

    if (!(await searchInput.count())) {
      return {
        metrics: { searchArtifactsDetected: inventory.search?.inputCount || 0 },
        flow,
        ran: false,
        check: createCheck({
          id: "search",
          label: "Search Functionality",
          applicable: true,
          status: CHECK_STATUS.WARNING,
          summary: "Search-related wording was detected, but no interactive search input could be exercised.",
          findings: ["Search UI appears present in content, but no searchable control was interactable."]
        })
      };
    }

    ran = true;
    const keyword = buildKeywordFromInventory(inventory);
    const partialKeyword = keyword.slice(0, Math.min(keyword.length, 4));
    const submit = async () => {
      await searchInput.press("Enter").catch(async () => {
        const submitButton = searchPage
          .locator("form button[type='submit'], form input[type='submit'], button[type='submit'], button:not([type])")
          .first();
        if (await submitButton.count()) {
          await submitButton.click({ timeout: 4000 }).catch(() => {});
        }
      });
      await searchPage.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
      await searchPage.waitForTimeout(500);
    };

    const beforeUrl = searchPage.url();
    await searchInput.fill(keyword);
    await submit();
    const searchText = normalizeText(await searchPage.locator("body").innerText().catch(() => ""));
    const relevantResults =
      normalizeText(searchPage.url()).includes(normalizeText(keyword)) ||
      searchText.includes(normalizeText(keyword)) ||
      /(results|search|found|matches)/i.test(searchText);

    await searchInput.fill("");
    await submit();
    const emptyText = normalizeText(await searchPage.locator("body").innerText().catch(() => ""));
    const emptyHandled = !/(exception|traceback|stack trace|internal server error)/i.test(emptyText);

    let partialHandled = true;
    if (partialKeyword.length >= 3) {
      await searchInput.fill(partialKeyword);
      await submit();
      const partialText = normalizeText(await searchPage.locator("body").innerText().catch(() => ""));
      partialHandled =
        normalizeText(searchPage.url()).includes(normalizeText(partialKeyword)) ||
        partialText.includes(normalizeText(partialKeyword)) ||
        /(results|search|found|matches)/i.test(partialText);
    }

    if (!relevantResults) {
      status = CHECK_STATUS.WARNING;
      findings.push("Search submitted successfully, but relevant results could not be confidently confirmed.");
    }
    if (!emptyHandled) {
      status = CHECK_STATUS.FAILED;
      findings.push("Empty search handling exposed server-style error text.");
    }
    if (!partialHandled) {
      status = status === CHECK_STATUS.FAILED ? CHECK_STATUS.FAILED : CHECK_STATUS.WARNING;
      findings.push("Partial keyword search did not show clear result handling.");
    }

    flow = {
      attempted: true,
      passed: status !== CHECK_STATUS.FAILED,
      step: "Search query -> results",
      targetUrl: searchPage.url() !== beforeUrl ? searchPage.url() : pageUrl,
      details:
        status === CHECK_STATUS.PASSED
          ? "Search handled keyword, empty, and partial query probes."
          : findings.join(" ")
    };
  } catch (error) {
    status = CHECK_STATUS.FAILED;
    findings.push(error instanceof Error ? error.message : String(error));
  } finally {
    await searchPage.close().catch(() => {});
  }

  return {
    metrics: { searchArtifactsDetected: inventory.search?.inputCount || 1 },
    flow,
    ran,
    check: createCheck({
      id: "search",
      label: "Search Functionality",
      applicable: true,
      status,
      summary: "Exercised a safe keyword, empty-state, and partial-match search probe.",
      findings
    })
  };
}

function assessDataIntegrity(formsCheck, authCheck, searchCheck) {
  const applicable =
    formsCheck.status !== CHECK_STATUS.SKIPPED ||
    authCheck.status !== CHECK_STATUS.SKIPPED ||
    searchCheck.status !== CHECK_STATUS.SKIPPED;

  return createCheck({
    id: "data-integrity",
    label: "Database & Data Integrity",
    applicable,
    status: CHECK_STATUS.SKIPPED,
    summary: applicable
      ? "Generic scans can observe state-changing flows, but they cannot safely prove backend persistence or CRUD integrity without site-specific test data."
      : "No state-changing workflow was detected on this page."
  });
}

function assessUiActions(inventory) {
  const buttons = inventory.buttons || [];
  if (buttons.length === 0) {
    return createCheck({
      id: "ui-actions",
      label: "UI Actions",
      status: CHECK_STATUS.SKIPPED,
      summary: "No prominent button-style interactive elements were detected on this page."
    });
  }

  const disabled = buttons.filter((button) => button.disabled).length;
  const weakTargets = buttons.filter(
    (button) => !button.disabled && !button.actionable && !button.inForm && button.type !== "submit"
  );

  return createCheck({
    id: "ui-actions",
    label: "UI Actions",
    applicable: true,
    status: weakTargets.length > 0 ? CHECK_STATUS.WARNING : CHECK_STATUS.PASSED,
    summary: `Detected ${buttons.length} button-style element(s), ${disabled} disabled control(s), and ${weakTargets.length} element(s) without an obvious target.`,
    findings:
      weakTargets.length > 0
        ? [`${weakTargets.length} interactive element(s) did not expose a clear href, submit behavior, or form ownership.`]
        : []
  });
}

async function assessCookiesAndSessions(context, page, pageUrl, inventory) {
  const initialCookies = await context.cookies(pageUrl).catch(() => []);
  const storageBefore = await page
    .evaluate(() => ({
      localStorageCount: window.localStorage.length,
      sessionStorageCount: window.sessionStorage.length
    }))
    .catch(() => ({ localStorageCount: 0, sessionStorageCount: 0 }));

  await page.reload({ waitUntil: "domcontentloaded", timeout: PAGE_GOTO_TIMEOUT }).catch(() => {});
  await page.waitForLoadState("load", { timeout: 12000 }).catch(() => {});
  const cookiesAfterReload = await context.cookies(pageUrl).catch(() => []);
  const storageAfter = await page
    .evaluate(() => ({
      localStorageCount: window.localStorage.length,
      sessionStorageCount: window.sessionStorage.length
    }))
    .catch(() => ({ localStorageCount: 0, sessionStorageCount: 0 }));

  const observedCookieCount = Math.max(initialCookies.length, cookiesAfterReload.length);
  const applicable =
    observedCookieCount > 0 ||
    storageBefore.localStorageCount > 0 ||
    storageBefore.sessionStorageCount > 0 ||
    inventory.auth?.hasPasswordField;

  if (!applicable) {
    return {
      metrics: { cookiesObserved: 0 },
      check: createCheck({
        id: "cookies-sessions",
        label: "Cookies & Sessions",
        status: CHECK_STATUS.SKIPPED,
        summary: "No cookies or session storage signals were detected for this page."
      })
    };
  }

  const persistenceStable =
    initialCookies.length === cookiesAfterReload.length ||
    Math.abs(initialCookies.length - cookiesAfterReload.length) <= 1;
  const findings = [];
  if (!persistenceStable) {
    findings.push("Cookie count changed materially after a plain reload.");
  }
  findings.push("Session timeout and authenticated logout persistence still require site-specific credentials.");

  return {
    metrics: { cookiesObserved: observedCookieCount },
    check: createCheck({
      id: "cookies-sessions",
      label: "Cookies & Sessions",
      applicable: true,
      status: persistenceStable ? CHECK_STATUS.PASSED : CHECK_STATUS.WARNING,
      summary: `Observed ${observedCookieCount} cookie(s), localStorage ${storageBefore.localStorageCount}->${storageAfter.localStorageCount}, sessionStorage ${storageBefore.sessionStorageCount}->${storageAfter.sessionStorageCount}.`,
      findings
    })
  };
}

function assessErrorHandling(inventory, consoleErrors) {
  const findings = [];
  if (inventory.hasRawErrorMarkers) {
    findings.push("The page body exposed raw exception or server-style error markers.");
  }
  if (consoleErrors.length > 0) {
    findings.push(`${consoleErrors.length} console error(s) were captured during the page run.`);
  }

  return createCheck({
    id: "error-handling",
    label: "Error Handling",
    applicable: true,
    status: inventory.hasRawErrorMarkers ? CHECK_STATUS.FAILED : consoleErrors.length > 0 ? CHECK_STATUS.WARNING : CHECK_STATUS.PASSED,
    summary:
      inventory.hasRawErrorMarkers || consoleErrors.length > 0
        ? "Unexpected error signals were observed during the page run."
        : "No raw server errors or exception markers were exposed to the page.",
    findings
  });
}

function assessApiAndIntegrations(pageUrl, requestFailures, responseFailures) {
  const relevantFailures = [...requestFailures, ...responseFailures];
  const sameOriginFailures = relevantFailures.filter((failure) => isSameOrigin(pageUrl, failure.url));
  const thirdPartyFailures = relevantFailures.filter((failure) => !isSameOrigin(pageUrl, failure.url));
  const findings = [];

  if (sameOriginFailures.length > 0) {
    findings.push(`${sameOriginFailures.length} same-origin request(s) failed or returned 4xx/5xx.`);
  }
  if (thirdPartyFailures.length > 0) {
    findings.push(`${thirdPartyFailures.length} third-party integration request(s) failed or returned 4xx/5xx.`);
  }

  return {
    metrics: { apiFailures: relevantFailures.length },
    requestFailures: limitItems(
      relevantFailures.map((failure) => ({
        url: failure.url,
        error:
          failure.error ||
          `HTTP ${failure.statusCode}${failure.resourceType ? ` (${failure.resourceType})` : ""}`
      })),
      50
    ),
    check: createCheck({
      id: "apis-integrations",
      label: "APIs & Integrations",
      applicable: relevantFailures.length > 0,
      status:
        sameOriginFailures.length > 0
          ? CHECK_STATUS.FAILED
          : thirdPartyFailures.length > 0
            ? CHECK_STATUS.WARNING
            : CHECK_STATUS.PASSED,
      summary:
        relevantFailures.length > 0
          ? `Observed ${relevantFailures.length} failed request(s) across first-party and third-party integrations.`
          : "No failed API or integration requests were observed.",
      findings
    })
  };
}

async function assessCompatibility(browser, url, primaryViewport) {
  const alternateViewport = primaryViewport === "mobile" ? VIEWPORTS.desktop : VIEWPORTS.mobile;
  const context = await browser.newContext({ viewport: alternateViewport });
  const page = await context.newPage();

  try {
    const response = await gotoWithRetry(page, url);
    await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
    const bodyText = normalizeText(await page.locator("body").innerText().catch(() => ""));
    const failed = (response?.status?.() ?? 200) >= 400 || /internal server error|traceback|exception/i.test(bodyText);

    return createCheck({
      id: "compatibility",
      label: "Compatibility",
      applicable: true,
      status: failed ? CHECK_STATUS.FAILED : CHECK_STATUS.PASSED,
      summary: `Ran a secondary ${primaryViewport === "mobile" ? "desktop" : "mobile"} Chromium viewport probe to look for environment-specific breakage.`,
      findings: failed
        ? ["The alternate viewport probe returned an error response or exposed raw error text."]
        : ["Coverage is limited to Chromium and two viewport profiles in this automated pass."]
    });
  } catch (error) {
    return createCheck({
      id: "compatibility",
      label: "Compatibility",
      applicable: true,
      status: CHECK_STATUS.FAILED,
      summary: "Alternate viewport probe could not be completed.",
      findings: [error instanceof Error ? error.message : String(error)]
    });
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

async function assessFileTransfers(requestContext, pageUrl, inventory) {
  const fileInputs = inventory.fileUploads || [];
  const downloadLinks = await collectLinkHealth(
    requestContext,
    pageUrl,
    inventory.downloadLinks || [],
    Math.min(8, BROKEN_LINK_LIMIT)
  );

  if (fileInputs.length === 0 && downloadLinks.checked.length === 0) {
    return {
      metrics: {
        fileInputsDetected: 0,
        downloadLinksDetected: 0
      },
      check: createCheck({
        id: "file-transfers",
        label: "File Uploads / Downloads",
        status: CHECK_STATUS.SKIPPED,
        summary: "No file upload or download surface was detected on this page."
      })
    };
  }

  const findings = [];
  const fileInputsMissingAccept = fileInputs.filter((input) => !input.accept).length;
  if (fileInputsMissingAccept > 0) {
    findings.push(`${fileInputsMissingAccept} file input(s) did not declare accepted file types.`);
  }
  if (downloadLinks.broken.length > 0) {
    findings.push(`${downloadLinks.broken.length} download link(s) returned 4xx/5xx or no response.`);
  }

  const failed = downloadLinks.broken.length > 0;
  const warning = !failed && fileInputsMissingAccept > 0;

  return {
    metrics: {
      fileInputsDetected: fileInputs.length,
      downloadLinksDetected: downloadLinks.checked.length
    },
    check: createCheck({
      id: "file-transfers",
      label: "File Uploads / Downloads",
      applicable: true,
      status: failed ? CHECK_STATUS.FAILED : warning ? CHECK_STATUS.WARNING : CHECK_STATUS.PASSED,
      summary: `Detected ${fileInputs.length} file input(s) and checked ${downloadLinks.checked.length} download link(s).`,
      findings
    })
  };
}

function assessSecurity(pageUrl, inventory, authCheck) {
  const usesHttps = /^https:\/\//i.test(pageUrl);
  const sensitiveSurface =
    inventory.auth?.hasPasswordField || (inventory.fileUploads?.length || 0) > 0 || authCheck.status !== CHECK_STATUS.SKIPPED;
  const findings = [];

  if (!usesHttps && sensitiveSurface) {
    findings.push("Sensitive inputs were exposed over a non-HTTPS URL.");
  }
  findings.push("Restricted-page access, role-based access control, and privileged actions need authenticated site-specific probes.");

  return createCheck({
    id: "security-sanity",
    label: "Security-related Functional Checks",
    applicable: sensitiveSurface,
    status: !usesHttps && sensitiveSurface ? CHECK_STATUS.FAILED : sensitiveSurface ? CHECK_STATUS.WARNING : CHECK_STATUS.SKIPPED,
    summary: sensitiveSurface
      ? "Performed basic transport and auth-surface sanity checks."
      : "No sensitive surface was detected on this page.",
    findings
  });
}

export async function runSmokeTest({
  url,
  viewport = "desktop"
}) {
  const browser = await launchBrowser();
  const result = createDefaultSmokeResult(url);

  try {
    const context = await browser.newContext({
      viewport: VIEWPORTS[viewport] ?? VIEWPORTS.desktop
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const requestFailures = [];
    const responseFailures = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(normalizeConsoleMessage(message.text()));
      }
    });

    page.on("pageerror", (error) => {
      consoleErrors.push(normalizeConsoleMessage(error?.message || error));
    });

    page.on("requestfailed", (request) => {
      requestFailures.push({
        url: request.url(),
        error: request.failure()?.errorText || "Request failed",
        resourceType: request.resourceType()
      });
    });

    page.on("response", (response) => {
      if (response.status() >= 400) {
        responseFailures.push({
          url: response.url(),
          statusCode: response.status(),
          resourceType: response.request().resourceType()
        });
      }
    });

    const start = Date.now();
    const response = await gotoWithRetry(page, url);
    await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(POST_LOAD_DELAY);
    const loadTimeMs = Date.now() - start;

    const inventory = await extractPageInventory(page);
    const representativeFlowPage = await context.newPage();
    let representativeFlow = createEmptyFlowResult();

    try {
      await gotoWithRetry(representativeFlowPage, url);
      await representativeFlowPage.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
      representativeFlow = await runRepresentativeFlow(representativeFlowPage, url);
    } finally {
      await representativeFlowPage.close().catch(() => {});
    }

    const navigation = await assessNavigation(context.request, url, inventory);
    const auth = await assessAuthentication(context, url, inventory);
    const search = await assessSearch(context, url, inventory);
    const forms = assessForms(inventory, representativeFlow, search.ran);
    const cookies = await assessCookiesAndSessions(context, page, url, inventory);
    const api = assessApiAndIntegrations(url, requestFailures, responseFailures);
    const errorHandling = assessErrorHandling(inventory, consoleErrors);
    const compatibility = await assessCompatibility(browser, url, viewport);
    const files = await assessFileTransfers(context.request, url, inventory);
    const dataIntegrity = assessDataIntegrity(forms.check, auth.check, search.check);
    const uiActions = assessUiActions(inventory);
    const security = assessSecurity(url, inventory, auth.check);

    const checks = [
      navigation.check,
      forms.check,
      auth.check,
      search.check,
      dataIntegrity,
      uiActions,
      cookies.check,
      errorHandling,
      api.check,
      compatibility,
      files.check,
      security
    ];

    result.responseCode = response?.status?.() ?? null;
    result.loadTimeMs = loadTimeMs;
    result.coreElements = inventory.coreElements;
    result.missingCoreElements = inventory.coreElements
      .filter((entry) => !entry.exists)
      .map((entry) => entry.name);
    result.consoleErrors = limitItems(consoleErrors, 50);
    result.brokenLinks = navigation.brokenLinks;
    result.form = forms.form;
    result.flow =
      auth.flow.attempted
        ? auth.flow
        : search.flow.attempted
          ? search.flow
          : representativeFlow;
    result.requestFailures = api.requestFailures;
    result.checks = checks;
    result.checkSummary = summarizeCheckCounts(checks);
    result.metrics = {
      internalLinksChecked: navigation.metrics.internalLinksChecked,
      navLinksChecked: navigation.metrics.navLinksChecked,
      buttonTargetsChecked: navigation.metrics.buttonTargetsChecked,
      formsDetected: forms.form.count,
      authArtifactsDetected: auth.metrics.authArtifactsDetected,
      searchArtifactsDetected: search.metrics.searchArtifactsDetected,
      apiFailures: api.metrics.apiFailures,
      cookiesObserved: cookies.metrics.cookiesObserved,
      fileInputsDetected: files.metrics.fileInputsDetected,
      downloadLinksDetected: files.metrics.downloadLinksDetected
    };

    const fallbackFailures = [];
    if (result.responseCode !== null && result.responseCode >= 400) {
      fallbackFailures.push(`HTTP ${result.responseCode}`);
    }
    result.status = buildOverallStatus(checks, fallbackFailures);
    return result;
  } catch (error) {
    result.status = OVERALL_STATUS.FAILED;
    result.consoleErrors = [error instanceof Error ? error.message : String(error)];
    result.checks = [
      createCheck({
        id: "functional-audit",
        label: "Functional Audit",
        applicable: true,
        status: CHECK_STATUS.FAILED,
        summary: "The functional test runner could not complete.",
        findings: result.consoleErrors
      })
    ];
    result.checkSummary = summarizeCheckCounts(result.checks);
    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}
