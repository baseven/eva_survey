// Entry point: initialize survey page
document.addEventListener("DOMContentLoaded", () => {
  const params     = new URLSearchParams(window.location.search);
  const surveyName = params.get("survey");
  if (!surveyName) return redirectToStart();

  const context = {
    titleEl: document.getElementById("survey_title"),
    descEl:  document.getElementById("survey_desc"),
    formEl:  document.getElementById("survey_form"),
    btn:     document.getElementById("submit_btn"),
    survey:  null
  };

  loadSurvey(surveyName, context)
    .then(sv => {
      context.survey = sv;
      renderSurvey(sv, context);
      context.btn.disabled = false;
      setupSubmitHandler(sv, context, surveyName);
    })
    .catch(err => showError(context, err));
});

/**
 * Redirects user back to start-survey if no survey param is found
 */
function redirectToStart() {
  window.location.href = "/start-survey";
}

/**
 * Fetch survey data from server
 * @param {string} name - survey name
 * @param {object} ctx - context with DOM elements
 * @returns {Promise<object>} survey object
 */
function loadSurvey(name, ctx) {
  return fetch(`/api/method/eva_survey.api.survey.get_survey?survey_name=${encodeURIComponent(name)}`)
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(data => data.message);
}

/**
 * Render survey title, description and questions into the form
 * @param {object} sv  - survey data
 * @param {object} ctx - context with DOM elements
 */
function renderSurvey(sv, ctx) {
  ctx.titleEl.textContent = sv.title;
  ctx.descEl.textContent  = sv.description || "";

  sv.questions.forEach(q => {
    const wrapper = document.createElement("div");
    const label   = document.createElement("label");
    label.textContent = q.text + (q.required ? " *" : "");
    wrapper.append(label);
    appendQuestionInput(q, wrapper);
    ctx.formEl.append(wrapper);
  });
}

/**
 * Create and append appropriate input(s) based on question type
 * @param {object} q - question object
 * @param {HTMLElement} container - wrapper element
 */
function appendQuestionInput(q, container) {
  let inp;
  switch (q.type) {
    case "Text":
      inp = createInput(q, "text");
      break;
    case "Scale":
      inp = createInput(q, "number");
      inp.min = 1; inp.max = 5;
      break;
    case "Date":
      inp = createInput(q, "date");
      break;
  }

  if (inp) {
    container.append(inp);
  } else if (q.type === "Single Choice" || q.type === "Multiple Choice") {
    q.options.split("\n").forEach(opt => {
      const choice = document.createElement("input");
      choice.type  = q.type === "Single Choice" ? "radio" : "checkbox";
      choice.name  = q.name;
      choice.value = opt;
      container.append(choice, opt, document.createElement("br"));
    });
  }
}

/**
 * Helper to create a basic input element
 * @param {object} q     - question object
 * @param {string} type  - input type attribute
 * @returns {HTMLInputElement}
 */
function createInput(q, type) {
  const inp = document.createElement("input");
  inp.type = type;
  inp.name = q.name;
  if (q.required) inp.required = true;
  return inp;
}

/**
 * Set up handler for submit button
 * @param {object} sv         - survey data
 * @param {object} ctx        - context with DOM elements
 * @param {string} surveyName - survey name param
 */
function setupSubmitHandler(sv, ctx, surveyName) {
  ctx.btn.addEventListener("click", () => {
    const answers = collectAnswers(sv, ctx.formEl);
    submitAnswers(surveyName, answers)
      .then(() => showThankYou(ctx))
      .catch(err => frappe.msgprint({
        title: "Ошибка",
        message: "Не удалось отправить ответы.",
        indicator: "red"
      }));
  });
}

/**
 * Collect answers from the form into structured objects
 * @param {object} sv     - survey data
 * @param {HTMLFormElement} formEl
 * @returns {Array<object>} answers array
 */
function collectAnswers(sv, formEl) {
  const fd = new FormData(formEl);
  return sv.questions.map((q, idx) => {
    const ans = { question_link: q.name, question_text: q.text, idx: q.idx };
    if (q.type === "Text") ans.answer_text = fd.get(q.name) || "";
    else if (q.type === "Scale") ans.scale_value = parseInt(fd.get(q.name) || 0, 10);
    else if (q.type === "Date") ans.date_value = fd.get(q.name) || null;
    else if (q.type === "Single Choice") ans.selected_options = fd.get(q.name) ? [fd.get(q.name)] : [];
    else if (q.type === "Multiple Choice") ans.selected_options = fd.getAll(q.name);
    return ans;
  });
}

/**
 * Send answers to server via frappe.call
 * @param {string} surveyName
 * @param {Array<object>} answers
 * @returns {Promise}
 */
function submitAnswers(surveyName, answers) {
  return new Promise((resolve, reject) => {
    frappe.call({
      method: "eva_survey.api.survey.submit_response",
      args: { survey_name: surveyName, answers },
      freeze: true,
      freeze_message: "Отправка ответов...",
      callback: resolve,
      error: reject
    });
  });
}

/**
 * Replace form UI with a thank-you message
 * @param {object} ctx - context with DOM elements
 */
function showThankYou(ctx) {
  ctx.formEl.style.display = "none";
  ctx.btn.style.display    = "none";
  const thanks = document.createElement("div");
  thanks.className = "thank-you-message";
  thanks.innerHTML = `<h2>Спасибо!</h2><p>Ваши ответы успешно сохранены.</p>`;
  document.querySelector(".page_content").appendChild(thanks);
}

/**
 * Display an error if survey loading failed
 * @param {object} ctx
 * @param {Error} err
 */
function showError(ctx, err) {
  ctx.titleEl.textContent = "Ошибка загрузки опроса";
  console.error(err);
}
