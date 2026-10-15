"use strict";

(() => {
  const form = document.getElementById("register-form");
  if (!form) return;

  const steps = Array.from(form.querySelectorAll("[data-register-step]"));
  const progressItems = Array.from(document.querySelectorAll("[data-progress-step]"));
  const status = document.getElementById("register-form-status");
  const review = document.getElementById("register-review");
  const fileInput = document.getElementById("avatar-photos");
  const fileStatus = document.getElementById("avatar-file-status");
  const registrationPacket = document.getElementById("registration-packet");
  const submitButton = document.getElementById("register-submit");
  const confirmation = document.getElementById("register-confirmation");
  const shellHead = document.querySelector(".register-shell-head");
  const progress = document.querySelector(".register-progress");
  let currentStep = 0;

  const valueOf = id => document.getElementById(id)?.value.trim() || "";
  const checkedValue = name => {
    return form.querySelector(`[name="${CSS.escape(name)}"]:checked`)?.value || "";
  };

  const slugify = value => {
    const slug = value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return slug || "waiting-for-name";
  };

  const updateRegistrationPacket = () => {
    const displayName = valueOf("display-name");
    const slug = slugify(displayName);
    const nicknameAliases = valueOf("nicknames")
      .split(",")
      .map(alias => alias.trim())
      .filter(Boolean);
    const aliases = [valueOf("tournament-name"), ...nicknameAliases]
      .filter(Boolean)
      .filter((alias, index, values) => {
        const normalized = alias.toLowerCase();
        return normalized !== displayName.toLowerCase()
          && values.findIndex(value => value.toLowerCase() === normalized) === index;
      });
    const packet = {
      schemaVersion:1,
      status:"pending-review",
      source:"TLPT hidden registration page",
      identity:{
        displayName,
        tournamentDirectorName:valueOf("tournament-name"),
        nicknames:valueOf("nicknames"),
        pronunciation:valueOf("pronunciation"),
        pronouns:valueOf("pronouns"),
        invitedBy:valueOf("invited-by"),
        slug,
        aliases,
      },
      contact:{
        email:valueOf("registration-email"),
        phone:valueOf("registration-phone"),
        preferredMethod:checkedValue("Preferred contact method"),
        availability:checkedValue("Usual availability"),
        hostNotes:valueOf("host-notes"),
      },
      avatar:{
        referenceFiles:Array.from(fileInput?.files || []).map(file => ({
          name:file.name,
          size:file.size,
          type:file.type,
        })),
        featuresToPreserve:valueOf("features-preserve"),
        clothingAndColors:valueOf("avatar-clothing"),
        teamsPlacesInterests:valueOf("avatar-interests"),
        propsAndSymbols:valueOf("avatar-props"),
        background:valueOf("avatar-setting"),
        poseAndExpression:valueOf("avatar-expression"),
        mustHaveDetail:valueOf("avatar-must-have"),
        exclusions:valueOf("avatar-avoid"),
      },
      consent:{
        accuracy:checkedValue("Accuracy confirmed") === "Yes",
        publicProfile:checkedValue("Public profile consent") === "Yes",
        aiLikeness:checkedValue("AI likeness consent") === "Yes",
        leagueHumor:checkedValue("League humor acknowledged") === "Yes",
      },
      finalNote:valueOf("final-notes"),
      publicProfileDraft:{
        name:displayName,
        slug,
        image:`images/players/${slug}.jpg`,
        notes:"",
        aliases,
      },
    };
    const slugPreview = document.getElementById("slug-preview");
    if (slugPreview) slugPreview.value = slug;
    if (registrationPacket) registrationPacket.value = JSON.stringify(packet);
  };

  const syncEnhancedSelect = select => {
    select.dispatchEvent(new Event("change", { bubbles:true }));
  };

  const showStep = (index, focusHeading = true) => {
    currentStep = Math.max(0, Math.min(steps.length - 1, index));
    steps.forEach((step, stepIndex) => {
      const active = stepIndex === currentStep;
      step.hidden = !active;
      step.disabled = !active;
      step.querySelectorAll("select").forEach(syncEnhancedSelect);
    });
    progressItems.forEach((item, itemIndex) => {
      item.classList.toggle("is-complete", itemIndex < currentStep);
      if (itemIndex === currentStep) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    if (status) status.textContent = "";
    if (currentStep === steps.length - 1) renderReview();
    if (focusHeading) {
      const heading = steps[currentStep]?.querySelector(".register-step-heading strong");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll:true });
      }
      document.querySelector(".register-shell")?.scrollIntoView({ behavior:"smooth", block:"start" });
    }
  };

  const validateFiles = () => {
    if (!fileInput || !fileStatus) return true;
    const files = Array.from(fileInput.files || []);
    const maximumBytes = 10 * 1024 * 1024;
    const acceptedName = /\.(?:jpe?g|png|webp|heic|heif)$/i;
    const acceptedType = /^image\/(?:jpeg|png|webp|heic|heif)$/i;
    let message = "";

    if (!files.length) {
      message = "Choose at least one clear reference photo.";
    } else if (files.length > 4) {
      message = "Choose no more than four reference photos.";
    } else if (files.some(file => !(acceptedType.test(file.type) || acceptedName.test(file.name)))) {
      message = "Use JPG, PNG, WebP, HEIC, or HEIF photos only.";
    } else if (files.reduce((total, file) => total + file.size, 0) > maximumBytes) {
      message = "The selected photos must total 10 MB or less.";
    }

    fileInput.setCustomValidity(message);
    if (message) {
      fileStatus.textContent = message;
      fileStatus.style.color = "#ffb0b0";
      return false;
    }

    const totalSize = files.reduce((total, file) => total + file.size, 0);
    const sizeInMb = totalSize / (1024 * 1024);
    fileStatus.textContent = `${files.length} photo${files.length === 1 ? "" : "s"} selected • ${sizeInMb < 0.1 ? "under 0.1" : sizeInMb.toFixed(1)} MB total`;
    fileStatus.style.color = "#8df0b8";
    return true;
  };

  const focusInvalidControl = control => {
    if (!control) return;
    if (control.matches("select.site-native-select")) {
      control.nextElementSibling?.querySelector(".site-select-trigger")?.focus();
      return;
    }
    control.focus();
    control.reportValidity?.();
  };

  const validateStep = stepIndex => {
    const step = steps[stepIndex];
    if (!step) return true;
    if (step.contains(fileInput)) validateFiles();
    const invalid = step.querySelector(":invalid");
    if (!invalid) return true;
    if (status) status.textContent = "A required answer is missing or needs attention before you continue.";
    focusInvalidControl(invalid);
    return false;
  };

  const addReviewRow = (list, label, value) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value || "Not provided";
    row.append(term, detail);
    list.append(row);
  };

  const addReviewGroup = (title, rows) => {
    if (!review) return;
    const group = document.createElement("section");
    group.className = "register-review-group";
    const heading = document.createElement("h3");
    const list = document.createElement("dl");
    heading.textContent = title;
    rows.forEach(([label, value]) => addReviewRow(list, label, value));
    group.append(heading, list);
    review.append(group);
  };

  const renderReview = () => {
    if (!review) return;
    updateRegistrationPacket();
    review.replaceChildren();
    const photoNames = Array.from(fileInput?.files || []).map(file => file.name).join(", ");

    addReviewGroup("Identity", [
      ["Display name", valueOf("display-name")],
      ["TD name", valueOf("tournament-name")],
      ["Aliases", valueOf("nicknames")],
      ["Invited by", valueOf("invited-by")],
    ]);
    addReviewGroup("Contact", [
      ["Email", valueOf("registration-email")],
      ["Phone", valueOf("registration-phone")],
      ["Preferred method", checkedValue("Preferred contact method")],
      ["Availability", checkedValue("Usual availability")],
      ["Host notes", valueOf("host-notes")],
    ]);
    addReviewGroup("Avatar brief", [
      ["Reference photos", photoNames],
      ["Features to preserve", valueOf("features-preserve")],
      ["Clothing", valueOf("avatar-clothing")],
      ["Teams & interests", valueOf("avatar-interests")],
      ["Props", valueOf("avatar-props")],
      ["Background", valueOf("avatar-setting")],
      ["Pose", valueOf("avatar-expression")],
      ["Must-have detail", valueOf("avatar-must-have")],
      ["Avoid", valueOf("avatar-avoid")],
    ]);
  };

  form.querySelectorAll("[data-next-step]").forEach(button => {
    button.addEventListener("click", () => {
      if (!validateStep(currentStep)) return;
      showStep(currentStep + 1);
    });
  });

  form.querySelectorAll("[data-prev-step]").forEach(button => {
    button.addEventListener("click", () => showStep(currentStep - 1));
  });

  form.addEventListener("input", updateRegistrationPacket);
  form.addEventListener("change", updateRegistrationPacket);
  fileInput?.addEventListener("change", validateFiles);

  form.addEventListener("submit", event => {
    steps.forEach(step => {
      step.disabled = false;
      step.querySelectorAll("select").forEach(syncEnhancedSelect);
    });
    validateFiles();
    const invalidStepIndex = steps.findIndex(step => step.querySelector(":invalid"));
    if (invalidStepIndex !== -1) {
      event.preventDefault();
      showStep(invalidStepIndex, false);
      if (status) status.textContent = "Please complete the highlighted step before sending your registration.";
      focusInvalidControl(steps[invalidStepIndex].querySelector(":invalid"));
      return;
    }
    updateRegistrationPacket();
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending registration…";
    }
  });

  window.addEventListener("pageshow", () => {
    if (!submitButton) return;
    submitButton.disabled = false;
    submitButton.innerHTML = 'Send Me to the Roster <span aria-hidden="true">♠</span>';
  });

  const query = new URLSearchParams(window.location.search);
  if (query.get("submitted") === "1") {
    form.hidden = true;
    if (shellHead) shellHead.hidden = true;
    if (progress) progress.hidden = true;
    if (status) status.hidden = true;
    if (confirmation) confirmation.hidden = false;
    window.history.replaceState({}, "", window.location.pathname);
  } else {
    updateRegistrationPacket();
    showStep(0, false);
  }
})();
