document.addEventListener("DOMContentLoaded", function () {
  const surveyListContainer = document.getElementById("survey_templates");
  const publishSection = document.getElementById("survey_publish_section");
  const publishForm = document.getElementById("publish_form");
  const publishMessage = document.getElementById("publish_message");

  let activeTemplateBlock = null;
  const publishHeader = document.createElement("h3");
  publishForm.prepend(publishHeader);

  // Загрузка шаблонов опросов
  frappe.call({
    method: "eva_survey.api.survey.get_survey_templates",
    callback: function (r) {
      if (r.message && r.message.length > 0) {
        surveyListContainer.innerHTML = "";
        r.message.forEach(template => {
          const div = document.createElement("div");
          div.className = "survey-template";
          div.style.border = "1px solid #ddd";
          div.style.padding = "1rem";
          div.style.marginBottom = "1rem";
          div.style.borderRadius = "5px";

          div.innerHTML = `
            <h3>${template.title}</h3>
            <p>${template.description || "Без описания"}</p>
            <button class="btn btn-primary publish-btn" data-id="${template.name}">
              Публиковать этот опрос
            </button>
          `;
          surveyListContainer.appendChild(div);
        });

        // Привязка обработчиков кнопок публикации
        document.querySelectorAll(".publish-btn").forEach(btn => {
          btn.addEventListener("click", function () {
            const templateId = this.getAttribute("data-id");
            const templateTitle = this.closest(".survey-template").querySelector("h3").textContent;

            // Обновление заголовка и скрытых данных формы
            publishForm.dataset.templateId = templateId;
            publishHeader.textContent = `Публикация опроса: ${templateTitle}`;
            publishSection.style.display = "block";
            publishMessage.innerHTML = "";

            // Подсветка активного шаблона
            if (activeTemplateBlock) {
              activeTemplateBlock.style.border = "1px solid #ddd";
            }
            activeTemplateBlock = this.closest(".survey-template");
            activeTemplateBlock.style.border = "2px solid #007bff";
          });
        });
      } else {
        surveyListContainer.innerHTML = "<p>Шаблоны опросов не найдены.</p>";
      }
    },
    error: function () {
      surveyListContainer.innerHTML = "<p>Ошибка загрузки шаблонов опросов.</p>";
    }
  });

  publishForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const templateId = publishForm.dataset.templateId;
    const title = document.getElementById("survey_title").value.trim();
    const startDate = document.getElementById("start_date").value;
    const endDate = document.getElementById("end_date").value;
    const is_anonymous = document.querySelector('input[name="anonymous"]:checked').value;

    if (!templateId) {
      publishMessage.innerHTML = `<div class="alert alert-danger">Шаблон опроса не выбран.</div>`;
      return;
    }

    frappe.call({
      method: "eva_survey.api.survey.publish_survey",
      args: {
        survey_template_id: templateId,
        title: title,
        description: "",
        start_date: startDate,
        end_date: endDate,
        is_anonymous: is_anonymous
      },
      callback: function (r) {
        if (r.message && r.message.success) {
          publishForm.reset();
          publishHeader.textContent = "";
          publishSection.style.display = "none";
          if (activeTemplateBlock) {
            activeTemplateBlock.style.border = "1px solid #ddd";
            activeTemplateBlock = null;
          }

          publishMessage.innerHTML = `<div class="alert alert-success">
            Опрос опубликован! Ссылка для прохождения:
            <a href="${r.message.survey_link}" target="_blank">${r.message.survey_link}</a>
          </div>`;
        } else {
          publishMessage.innerHTML = `<div class="alert alert-danger">
            Ошибка публикации: ${r.message?.error || "Неизвестная ошибка"}
          </div>`;
        }
      },
      error: function () {
        publishMessage.innerHTML = `<div class="alert alert-danger">Произошла ошибка при публикации.</div>`;
      }
    });
  });
});
