document.addEventListener("DOMContentLoaded", () => {
    loadSurvey(UNIQ_LINK);
});

function loadSurvey(slug) {
    frappe.call({
        method: "eva_survey.api.survey.get_survey",
        args: { slug },
        callback: function (r) {
            if (r.message?.success) {
                renderSurvey(r.message, r.message.questions, slug);
            } else {
                showError(r.message?.error || "Опрос не найден или недоступен.");
            }
        },
        error: function () {
            showError("Произошла ошибка при загрузке опроса.");
        }
    });
}


function renderSurvey(survey, questions, slug) {
    document.getElementById("survey_title").textContent = survey.title;
    document.getElementById("survey_description").textContent = survey.description || "";

    const form = document.getElementById("survey_form");
    form.innerHTML = "";
    questions.forEach((q, idx) => {
        renderQuestion(q, form);

        if (idx < questions.length - 1) {
            const hr = document.createElement("hr");
            hr.className = "my-4";
            form.append(hr);
        }
    });

    document.getElementById("submit_btn").disabled = false;
    setupSubmitHandler(slug, questions);
}

function renderQuestion(q, formEl) {
    const wrapper = document.createElement('div');
    wrapper.className = "form-group border border-secondary p-3 rounded mb-4";

    const label = document.createElement('label');
    label.textContent = q.question_text + (q.is_required ? ' *' : '');
    wrapper.appendChild(label);

    appendQuestionInput(q, wrapper);
    formEl.appendChild(wrapper);
}

function appendQuestionInput(q, container) {
    if (["Text", "Scale", "Percentage"].includes(q.question_type)) {
        appendBasicInput(q, container);
    } else if (q.question_type === "Single Choice") {
        appendChoiceInputs(q, container, 'radio');
    } else if (q.question_type === "Multiple Choice") {
        appendChoiceInputs(q, container, 'checkbox');
    } else {
        console.warn(`Неизвестный тип вопроса: ${q.question_type}`);
    }
}

function appendBasicInput(q, container) {
    const input = document.createElement('input');
    input.type = q.question_type === 'Text' ? 'text' : 'number';
    input.name = q.name;
    input.className = 'form-control';
    if (q.is_required) input.required = true;

    if (q.question_type === 'Scale') {
        input.min = 0;
        input.max = 10;
    } else if (q.question_type === 'Percentage') {
        input.min = 0;
        input.max = 100;
    }

    container.appendChild(input);
}

function appendChoiceInputs(q, container, type) {
    (q.options || "").split('\n').forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'form-check';

        const input = document.createElement('input');
        input.type = type;
        input.name = q.name;
        input.value = opt;
        input.id = `${q.name}_${idx}`;
        input.className = 'form-check-input';

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.className = 'form-check-label';
        label.textContent = opt;

        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    });
}

function setupSubmitHandler(slug, questions) {
    const btn = document.getElementById("submit_btn");
    btn.addEventListener("click", () => {
        const answers = collectAnswers(questions);

        const missing = questions.filter(q => q.is_required && !answers.some(a => a.question_link === q.name && a.answer));
        if (missing.length > 0) {
            frappe.msgprint({
                title: "Ошибка валидации",
                message: "Пожалуйста, ответьте на все обязательные вопросы.",
                indicator: "red"
            });
            return;
        }

        submitAnswers(slug, answers)
            .then(() => showThankYou())
            .catch(() => showError("Не удалось отправить ответы."));
    });
}

function collectAnswers(questions) {
    const fd = new FormData(document.getElementById("survey_form"));
    return questions.map(q => ({
        question_link: q.name,
        question_text: q.question_text,
        answer: fd.getAll(q.name).join(", ") || ""
    }));
}

function submitAnswers(slug, answers) {
    return frappe.call({
        method: "eva_survey.api.survey.submit_survey_response",
        args: { slug, answers },
        freeze: true,
        freeze_message: "Отправка ответов...",
    });
}

function showThankYou() {
    document.getElementById("survey_form").innerHTML = "<p>Спасибо за участие в опросе!</p>";
    document.getElementById("submit_btn").style.display = "none";
}

function showError(message) {
    document.getElementById("survey_message").innerHTML = `<div class="alert alert-danger">${message}</div>`;
    document.getElementById("submit_btn").style.display = "none";
}
