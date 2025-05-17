document.addEventListener("DOMContentLoaded", function () {
    loadSurveyTemplates();
});

function loadSurveyTemplates() {
    const container = document.getElementById("survey_templates_container");
    container.innerHTML = "<p>Загрузка...</p>";

    frappe.call({
        method: "eva_survey.api.admin.get_survey_templates",
        callback: function (r) {
            if (r.message && r.message.length > 0) {
                renderSurveyTemplates(r.message);
            } else {
                container.innerHTML = "<p>Нет доступных шаблонов или доступ ограничен.</p>";
            }
        },
        error: function () {
            container.innerHTML = "<p>Ошибка при загрузке шаблонов.</p>";
        }
    });
}

function renderSurveyTemplates(templates) {
    const container = document.getElementById("survey_templates_container");
    container.innerHTML = "";
    templates.forEach(tpl => {
        const div = document.createElement("div");
        div.className = "card mb-3";
        div.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${tpl.title}</h5>
                <p class="card-text">${tpl.description || "Нет описания"}</p>
                <button class="btn btn-primary" onclick="publishSurvey('${tpl.name}')">Опубликовать</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function publishSurvey(templateName) {
    frappe.msgprint("Здесь будет запуск публикации для: " + templateName);
}
