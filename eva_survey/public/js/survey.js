document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const surveyName = params.get("survey");
  if (!surveyName) {
    window.location.href = "/start-survey";
    return;
  }

  const titleEl = document.getElementById("survey_title");
  const descEl  = document.getElementById("survey_desc");
  const formEl  = document.getElementById("survey_form");
  const btn     = document.getElementById("submit_btn");

  // Загрузить вопросы
  fetch(`/api/method/eva_survey.api.survey.get_survey?survey_name=${surveyName}`)
    .then(r => r.json())
    .then(r => {
      const sv = r.message;
      titleEl.textContent = sv.title;
      descEl .textContent  = sv.description || "";

      sv.questions.forEach(q => {
        const wrapper = document.createElement("div");
        const label = document.createElement("label");
        label.textContent = q.text + (q.required ? " *" : "");
        wrapper.append(label);

        let input;
        switch (q.type) {
          case "Text":
            input = document.createElement("input");
            input.type = "text";
            break;
          case "Single Choice":
            q.options.split("\n").forEach(opt => {
              const r = document.createElement("input");
              r.type = "radio"; r.name = q.name; r.value = opt;
              wrapper.append(r, opt, document.createElement("br"));
            });
            input = null;
            break;
          case "Multiple Choice":
            q.options.split("\n").forEach(opt => {
              const c = document.createElement("input");
              c.type = "checkbox"; c.name = q.name; c.value = opt;
              wrapper.append(c, opt, document.createElement("br"));
            });
            input = null;
            break;
          case "Scale":
            input = document.createElement("input");
            input.type = "number";
            input.min = 1; input.max = 5;
            break;
          case "Date":
            input = document.createElement("input");
            input.type = "date";
            break;
        }

        if (input) {
          input.name = q.name;
          if (q.required) input.required = true;
          wrapper.append(input);
        }

        formEl.append(wrapper);
      });

      btn.disabled = false;
    })
    .catch(err => {
      titleEl.textContent = "Ошибка загрузки опроса";
      console.error(err);
    });

  // Отправить ответы
  btn.addEventListener("click", () => {
    const fd = new FormData(formEl);
    const answers = [];

    // Собираем ответы
    sv.questions.forEach(q => {
      const entry = { question: q.name };
      if (q.type === "Text" || q.type === "Scale" || q.type === "Date") {
        entry.answer_text = fd.get(q.name) || "";
      } else if (q.type === "Single Choice") {
        entry.selected_options = [fd.get(q.name)].filter(Boolean);
      } else { // Multiple Choice
        entry.selected_options = fd.getAll(q.name);
      }
      answers.push(entry);
    });

    // POST на сервер
    fetch("/api/method/eva_survey.api.submit_response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ survey_name: surveyName, answers })
    })
    .then(r => r.json())
    .then(() => {
      window.location.href = "/thank-you";
    })
    .catch(err => {
      alert("Ошибка отправки");
      console.error(err);
    });
  });
});
