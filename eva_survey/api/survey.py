import frappe
from frappe.exceptions import AuthenticationError, DoesNotExistError, ValidationError
from frappe.utils import now


def _get_surveys(filters, fields, order_by="modified desc"):
    """
    Вспомогательная функция: обёртка над frappe.get_all
    :param filters: dict — фильтры для get_all
    :param fields: list — список полей для возврата
    :param order_by: str — сортировка
    """
    return frappe.get_all(
        "Eva Survey Item",
        filters=filters,
        fields=fields,
        order_by=order_by
    )


@frappe.whitelist(allow_guest=True)
def get_surveys_list():
    """
    Возвращает все активные опросы.

    - Гости (Guest) видят только анонимные опросы.
    - Залогиненные видят все (и анонимные, и неанонимные).
    """
    filters = {"is_active": 1}
    if frappe.session.user == "Guest":
        filters["is_anonymous"] = 1

    fields = ["name", "title", "is_anonymous"]
    return _get_surveys(filters, fields)



@frappe.whitelist(allow_guest=True)
def get_survey(survey_name):
    """
    Возвращает опрос и его вопросы по имени.

    Гости видят только анонимные опросы (is_anonymous=1),
    залогиненные — любые.
    """
    try:
        doc = frappe.get_doc("Eva Survey Item", survey_name)
    except DoesNotExistError:
        raise ValidationError(f"Опрос «{survey_name}» не найден")

    if not doc.is_active:
        raise ValidationError(f"Опрос «{doc.title}» закрыт или неактивен")

    if doc.is_anonymous == 0 and frappe.session.user == "Guest":
        raise AuthenticationError("Пожалуйста, войдите, чтобы пройти этот опрос")

    questions = [
        {
            "name": q.name,
            "text": q.question_text,
            "type": q.question_type,
            "options": q.options or "",
            "required": q.is_required,
            "idx": q.idx
        }
        for q in doc.questions
    ]

    return {
        "name": doc.name,
        "title": doc.title,
        "description": getattr(doc, "description", ""),
        "is_anonymous": doc.is_anonymous,
        "questions": sorted(questions, key=lambda x: x["idx"])
    }


@frappe.whitelist(allow_guest=True)
def submit_response(survey_name, answers):
    """
    Сохраняет ответы респондента.

    - Гости могут отвечать только на анонимные опросы (is_anonymous=1).
    - Залогиненные могут отвечать на любые активные опросы.
    - Для не-анонимных опросов respondent = frappe.session.user.
    - Проверяем, что опрос активен.
    """
    try:
        survey = frappe.get_doc("Eva Survey Item", survey_name)
    except DoesNotExistError:
        raise ValidationError(f"Опрос «{survey_name}» не найден")

    if not survey.is_active:
        raise ValidationError(f"Опрос «{survey.title}» закрыт или неактивен")

    user = frappe.session.user
    if survey.is_anonymous == 0 and user == "Guest":
        raise AuthenticationError("Пожалуйста, войдите, чтобы пройти этот опрос")

    # Создать запись ответа
    resp_doc = frappe.new_doc("Eva Survey Response")
    resp_doc.survey = survey_name
    resp_doc.respondent = None if survey.is_anonymous else user
    resp_doc.submission_time = now()

    # Прилепить дочерние ответы
    try:
        parsed = frappe.parse_json(answers)
    except Exception:
        raise ValidationError("Невалидный JSON в answers")

    if not isinstance(parsed, list) or not parsed:
        raise ValidationError("Нужно передать непустой список ответов")

    for ans in parsed:
        # минимальная валидация
        if "question" not in ans:
            raise ValidationError("Неверный формат ответа: нет поля question")
        resp_doc.append("answers", {
            "question": ans["question"],
            "answer_text": ans.get("answer_text", ""),
            "selected_options": ans.get("selected_options", []),
            "scale_value": ans.get("scale_value"),
            "answer_date": ans.get("answer_date")
        })
    resp_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {"name": resp_doc.name}
