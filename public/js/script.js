// Mobile nav toggle
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      links.classList.toggle("open-mobile");
      links.style.display = links.style.display === "flex" ? "none" : "flex";
    });
  }

  // Contact / enquiry form handler
  const form = document.getElementById("enquiry-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msgBox = document.getElementById("form-message");
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;

      // Using FormData (not form.name / form.email directly) because
      // "name" collides with the built-in HTMLFormElement.name property
      // and would silently read the wrong value.
      const fd = new FormData(form);
      const payload = {
        name: (fd.get("name") || "").trim(),
        email: (fd.get("email") || "").trim(),
        phone: (fd.get("phone") || "").trim(),
        address: (fd.get("address") || "").trim(),
        propertyType: fd.get("propertyType") || "",
        electricityBill: fd.get("electricityBill") || "",
        message: (fd.get("message") || "").trim(),
        page: window.location.pathname.split("/").pop() || "index.html",
      };

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
      msgBox.className = "form-message";
      msgBox.textContent = "";

      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.success) {
          msgBox.textContent = "Thank you! Our team will contact you shortly.";
          msgBox.classList.add("success");
          form.reset();
        } else {
          msgBox.textContent = data.error || "Something went wrong. Please try again.";
          msgBox.classList.add("error");
        }
      } catch (err) {
        msgBox.textContent = "Could not submit. Please check your connection and try again.";
        msgBox.classList.add("error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
});
