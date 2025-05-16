import frappe
import secrets

from frappe.exceptions import AuthenticationError, DoesNotExistError, ValidationError
from frappe.utils import now

from eva_survey.utils.access_control import check_user_roles



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

	- Гости могут отвечать только на анонимные опросы.
	- Для приватных опросов respondent = frappe.session.user.
	- Опрос должен быть активен.
	"""
	# 1. Загрузка и проверка опроса
	survey = _get_survey_doc(survey_name)
	_validate_access(survey)

	# 2. Создание родительского документа ответа
	resp = _create_response_doc(survey)

	# 3. Парсинг и проверка payload
	parsed_answers = _parse_answers(answers)

	# 4. Добавление каждого ответа
	for ans in parsed_answers:
		_append_answer(resp, survey.name, ans)

	# 5. Сохранение и подтверждение
	resp.insert(ignore_permissions=True)
	frappe.db.commit()
	return {"name": resp.name}


def _get_survey_doc(name):
	"""
	Загружает документ опроса или кидает ValidationError.
	"""
	try:
		return frappe.get_doc("Eva Survey Item", name)
	except DoesNotExistError:
		raise ValidationError(f"Опрос «{name}» не найден")


def _validate_access(survey):
	"""
	Проверяет, что опрос активен и доступен для текущего пользователя.
	"""
	if not survey.is_active:
		raise ValidationError(f"Опрос «{survey.title}» неактивен")
	if survey.is_anonymous == 0 and frappe.session.user == "Guest":
		raise AuthenticationError("Пожалуйста, войдите, чтобы пройти опрос")


def _create_response_doc(survey):
	"""
	Создаёт и вставляет родительский документ Eva Survey Response.
	"""
	resp = frappe.new_doc("Eva Survey Response")
	resp.survey          = survey.name
	resp.respondent      = None if survey.is_anonymous else frappe.session.user
	resp.submission_time = now()
	return resp


def _parse_answers(raw):
	"""
	Парсит JSON answers и проверяет, что это непустой список.
	"""
	try:
		parsed = frappe.parse_json(raw)
	except Exception:
		raise ValidationError("Невалидный JSON в answers")
	if not isinstance(parsed, list) or not parsed:
		raise ValidationError("Нужно передать непустой список ответов")
	return parsed


def _append_answer(resp, survey_name, ans):
	"""
	Добавляет одну запись Eva Survey Answer в resp.answers.
	"""
	# Проверка основных полей
	q_link = ans.get("question_link")
	q_text = ans.get("question_text")
	idx    = ans.get("idx")
	if not q_link or not q_text or idx is None:
		raise ValidationError(
			"Каждый ответ должен содержать question_link, question_text и idx"
		)

	# Подготовка значений полей
	answer_text      = ans.get("answer_text", "")
	selected = ans.get("selected_options", [])
	if isinstance(selected, list):
		selected = ",".join(selected)
	scale_value = ans.get("scale_value")
	date_value  = ans.get("date_value")

	# Добавляем в дочерний список
	resp.append("answers", {
		"idx":               idx,
		"question_link":     q_link,
		"question_text":     q_text,
		"answer_text":       answer_text,
		"selected_options":  selected,
		"scale_value":       scale_value,
		"date_value":        date_value
	})



@frappe.whitelist()
def publish_survey(survey_template_id, title, description, start_date, end_date, anonymous):
	"""
	Создание экземпляра опроса на основе шаблона и генерация уникальной ссылки.
	"""
	check_user_roles(["Survey Manager"])  # Проверяем роль

	try:
		# 1. Проверяем существование шаблона
		survey_template = frappe.get_doc("Eva Survey Template", survey_template_id)

		# 2. Создаём экземпляр опроса на основе шаблона
		instance = frappe.new_doc("Eva Survey Instance")
		instance.title = title
		instance.description = description
		instance.start_date = start_date
		instance.end_date = end_date
		instance.anonymous = frappe.parse_json(anonymous) if isinstance(anonymous, str) else anonymous

		# Копируем вопросы
		for question in survey_template.questions:
			instance.append("questions", {
				"idx": question.idx,
				"question_text": question.question_text,
				"question_type": question.question_type,
				"options": question.options,
				"is_required": question.is_required
			})

		# Генерируем уникальную ссылку
		slug = secrets.token_urlsafe(8)
		instance.unique_link = slug

		# Сохраняем экземпляр
		instance.insert(ignore_permissions=True)

		# Добавляем ссылку в Published Surveys шаблона
		survey_template.append("published_surveys", {
			"survey_title": title,
			"survey_link": f"/survey/{slug}",
			"survey_instance": instance.name
		})
		survey_template.save(ignore_permissions=True)

		frappe.db.commit()

		return {
			"success": True,
			"survey_link": f"/survey/{slug}",
			"instance_id": instance.name
		}

	except Exception as e:
		frappe.logger().error(f"Ошибка при публикации опроса: {str(e)}")
		return {"success": False, "error": str(e)}
