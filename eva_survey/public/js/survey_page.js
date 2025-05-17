document.addEventListener("DOMContentLoaded", () => {
    loadSurvey(UNIQ_LINK);
});

function loadSurvey(slug) {
    frappe.call({
        method: "eva_survey.api.survey.get_survey",
        args: { slug },
        callback: function (r) {
            if (r.message && r.message.success) {
                renderSurvey(r.message.survey);
            } else {
                showError("Опрос не найден или недоступен.");
            }
        },
        error: function () {
            showError("Произошла ошибка при загрузке опроса.");
        }
    });
}

function renderSurvey(survey) {
    document.getElementById("survey_title").textContent = survey.title;
    document.getElementById("survey_description").textContent = survey.description || "";
    document.getElementById("submit_btn").disabled = false;

    const form = document.getElementById("survey_form");
    form.innerHTML = "<p>Форма опроса будет сгенерирована здесь...</p>";
}

function showError(message) {
    document.getElementById("survey_message").innerHTML = `<div class="alert alert-danger">${message}</div>`;
    document.getElementById("submit_btn").style.display = "none";
}
