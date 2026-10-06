; (function () {
    "use strict";

    var DEFAULT_API_BASE = "https://backend.swagatsuite.com";
    var LOCAL_API_BASE = "http://localhost:5004";

    function getApiLeadsUrl() {
        var meta = document.querySelector('meta[name="api-base-url"]');
        if (meta && meta.content) {
            return meta.content.replace(/\/$/, "") + "/api/leads";
        }

        var host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
            return LOCAL_API_BASE + "/api/leads";
        }

        return DEFAULT_API_BASE + "/api/leads";
    }

    function getFormPayload(form) {
        var data = new FormData(form);

        return {
            name: String(data.get("name") || "").trim(),
            restaurantName: String(data.get("restaurantName") || "").trim(),
            phone: String(data.get("phone") || "").trim(),
            email: String(data.get("email") || "").trim(),
            source: form.dataset.source || "ibne_landing_page"
        };
    }

    function setMessage(form, text, type) {
        var messageEl = form.querySelector(".lead-form-message");
        if (!messageEl) return;
        messageEl.textContent = text || "";
        messageEl.className = "lead-form-message" + (type ? " " + type : "");
    }

    function parseResponse(res) {
        return res.text().then(function (text) {
            var data = {};
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch (error) {
                    data = {};
                }
            }

            if (!res.ok) {
                throw new Error((data && data.message) || "Submission failed.");
            }

            return data;
        });
    }

    function bindLeadForm(form) {
        var submitBtn = form.querySelector("[type=submit]");
        var defaultLabel = submitBtn ? submitBtn.textContent : "Submit";
        var apiLeadsUrl = getApiLeadsUrl();

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            var payload = getFormPayload(form);

            if (!payload.name || !payload.restaurantName || !payload.phone || !payload.email) {
                setMessage(form, "Please fill all fields.", "error");
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Submitting...";
            }
            setMessage(form, "", "");

            fetch(apiLeadsUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
                .then(parseResponse)
                .then(function () {
                    form.reset();
                    window.location.href = "thank-you.html";
                })
                .catch(function (error) {
                    setMessage(form, error.message || "Could not submit form. Please try again.", "error");
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = defaultLabel;
                    }
                });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        var forms = document.querySelectorAll(".js-lead-form");
        forms.forEach(bindLeadForm);
    });
})();
