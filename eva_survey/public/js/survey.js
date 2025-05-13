document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const surveyName = params.get('survey');

    if (!surveyName) {
        redirectToStart();
        return;
    }

    const context = {
        titleEl: document.getElementById('survey_title'),
        descEl: document.getElementById('survey_desc'),
        formEl: document.getElementById('survey_form'),
        btn: document.getElementById('submit_btn'),
        survey: null
    };

    loadSurvey(surveyName)
        .then(sv => {
            context.survey = sv;
            renderSurvey(sv, context);
            context.btn.disabled = false;
            setupSubmitHandler(sv, context, surveyName);
        })
        .catch(err => showError(context, err));
});

/**
 * Redirect to the survey start page if no survey parameter is provided
 */
const redirectToStart = () => {
    window.location.href = '/start-survey';
};

/**
 * Fetch survey data from the server
 * @param {string} name - Survey document name
 * @returns {Promise<object>} - Parsed survey JSON
 */
const loadSurvey = async (name) => {
    const response = await fetch(
        `/api/method/eva_survey.api.survey.get_survey?survey_name=${encodeURIComponent(name)}`
    );
    if (!response.ok) {
        throw new Error('Failed to load survey');
    }
    const data = await response.json();
    return data.message;
};

/**
 * Render survey title, description, and questions
 * @param {object} sv  - Survey object
 * @param {object} ctx - Page context (DOM elements)
 */
const renderSurvey = (sv, ctx) => {
    ctx.titleEl.textContent = sv.title;
    ctx.descEl.textContent = sv.description || '';

    sv.questions.forEach(q => renderQuestion(q, ctx.formEl));
};

/**
 * Render a single question block
 * @param {object} q        - Question object
 * @param {HTMLElement} formEl - Container for questions
 */
const renderQuestion = (q, formEl) => {
    const wrapper = document.createElement('div');
    wrapper.classList.add('form-group');

    const label = document.createElement('label');
    label.textContent = q.text + (q.required ? ' *' : '');
    wrapper.append(label);

    appendQuestionInput(q, wrapper);
    formEl.append(wrapper);
};

/**
 * Append input(s) based on question type
 * @param {object} q         - Question object
 * @param {HTMLElement} container - Wrapper element
 */
const appendQuestionInput = (q, container) => {
    if (['Text', 'Scale', 'Date'].includes(q.type)) {
        appendBasicInput(q, container);
    } else if (q.type === 'Single Choice') {
        appendChoiceInputs(q, container, 'radio');
    } else if (q.type === 'Multiple Choice') {
        appendChoiceInputs(q, container, 'checkbox');
    } else {
        console.warn(`Unknown question type: ${q.type}`);
    }
};

/**
 * Append a basic input (text, number, date)
 */
const appendBasicInput = (q, container) => {
    const input = document.createElement('input');
    input.type = q.type === 'Text' ? 'text' : q.type === 'Scale' ? 'number' : 'date';
    input.name = q.name;
    input.className = 'form-control';

    if (q.required) {
        input.required = true;
    }
    if (q.type === 'Scale') {
        input.min = 1;
        input.max = 5;
    }

    container.append(input);
};

/**
 * Append choice inputs (radio or checkbox)
 */
const appendChoiceInputs = (q, container, type) => {
    q.options.split('\n').forEach((opt, idx) => {
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

        div.append(input, ' ', label);
        container.append(div);
    });
};

/**
 * Set up the submit button to collect and send answers
 */
const setupSubmitHandler = (sv, ctx, surveyName) => {
    ctx.btn.addEventListener('click', () => {
        const answers = collectAnswers(sv, ctx.formEl);
        submitAnswers(surveyName, answers)
            .then(() => showThankYou(ctx))
            .catch(() => frappe.msgprint({
                title: 'Ошибка',
                message: 'Не удалось отправить ответы.',
                indicator: 'red'
            }));
    });
};

/**
 * Collect answers from the form into structured objects
 */
const collectAnswers = (sv, formEl) => {
    const fd = new FormData(formEl);
    return sv.questions.map(q => {
        const ans = {
            question_link: q.name,
            question_text: q.text,
            idx: q.idx
        };

        if (q.type === 'Text')           ans.answer_text = fd.get(q.name) || '';
        else if (q.type === 'Scale')     ans.scale_value = parseInt(fd.get(q.name) || 0, 10);
        else if (q.type === 'Date')      ans.date_value = fd.get(q.name) || null;
        else if (q.type === 'Single Choice') ans.selected_options = fd.get(q.name) ? [fd.get(q.name)] : [];
        else if (q.type === 'Multiple Choice') ans.selected_options = fd.getAll(q.name);

        return ans;
    });
};

/**
 * Submit answers to the backend via frappe.call
 */
const submitAnswers = (surveyName, answers) => new Promise((resolve, reject) => {
    frappe.call({
        method: 'eva_survey.api.survey.submit_response',
        args: { survey_name: surveyName, answers },
        freeze: true,
        freeze_message: 'Отправка ответов...',
        callback: resolve,
        error: reject
    });
});

/**
 * Display a thank-you panel on the page
 */
const showThankYou = (ctx) => {
    ctx.formEl.style.display = 'none';
    ctx.btn.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'panel panel-default';
    panel.innerHTML = `
        <div class="panel-body text-center">
            <h3>Спасибо!</h3>
            <p>Ваши ответы успешно сохранены.</p>
        </div>`;

    const container = document.querySelector('.panel').parentNode;
    container.append(panel);
};

/**
 * Display an error message if survey loading fails
 */
const showError = (ctx, err) => {
    ctx.titleEl.textContent = 'Ошибка загрузки опроса';
    console.error(err);
};
