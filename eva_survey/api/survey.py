import frappe
import secrets

from frappe import _
from frappe.exceptions import AuthenticationError, DoesNotExistError, ValidationError
from frappe.utils import now

from eva_survey.utils.access_control import check_user_roles


required_roles = ["System Manager", "Administrator"]


@frappe.whitelist()
def get_survey_templates():
	check_user_roles(required_roles)
	templates = frappe.get_all(
		"Eva Survey Template",
		fields=["name", "title", "description"]
	)
	return templates


@frappe.whitelist()
def publish_survey(survey_template_id, title, description, start_date, end_date, anonymous):
	"""
	Создание экземпляра опроса на основе шаблона и генерация уникальной ссылки.
	"""
	check_user_roles(required_roles)  # Проверяем роль

	try:
		# Проверяем существование шаблона
		survey_template = frappe.get_doc("Eva Survey Template", survey_template_id)

		# Создаем экземпляр опроса
		instance = frappe.new_doc("Eva Survey Instance")
		instance.title = title
		instance.description = description
		instance.start_date = start_date
		instance.end_date = end_date
		instance.anonymous = frappe.parse_json(anonymous) if isinstance(anonymous, str) else anonymous

		# Копируем вопросы из шаблона в экземпляр
		for question in survey_template.questions:
			instance.append("questions", {
				"question_text": question.question_text,
				"question_type": question.question_type,
				"options": question.options,
				"is_required": question.is_required
			})

		# Генерируем уникальный slug для ссылки
		slug = secrets.token_urlsafe(8)
		instance.unique_link = slug

		# Сохраняем экземпляр
		instance.insert(ignore_permissions=True)

		# Добавляем запись в Published Surveys шаблона
		survey_template.append("published_surveys", {
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


@frappe.whitelist(allow_guest=True)
def get_survey(slug):
	"""
	Возвращает данные опубликованного опроса по уникальной ссылке (slug).
	"""
	# Ищем опубликованный опрос по slug
	instance = frappe.get_all(
		"Eva Survey Instance",
		filters={"unique_link": slug},
		fields=["name", "title", "description", "start_date", "end_date", "anonymous"]
	)

	if not instance:
		frappe.throw(_("Опрос не найден."), title="Ошибка")

	instance = instance[0]

	# Проверяем активность по дате
	now = now()
	if instance.start_date and now < instance.start_date:
		frappe.throw(_("Опрос ещё не начался."), title="Опрос недоступен")
	if instance.end_date and now > instance.end_date:
		frappe.throw(_("Опрос уже завершён."), title="Опрос недоступен")

	# Загружаем вопросы опроса
	questions = frappe.get_all(
		"Eva Survey Question",
		filters={"parent": instance.name},
		fields=["name", "idx", "question_text", "question_type", "options", "is_required"],
		order_by="idx asc"
	)

	return {
		"title": instance.title,
		"description": instance.description,
		"anonymous": instance.anonymous,
		"questions": questions
	}


@frappe.whitelist(allow_guest=True)
def submit_survey_response(slug, answers):
	"""
	Обработка и сохранение ответов на опрос.
	"""
	# 1. Проверяем существование и активность опроса
	instance = frappe.get_all(
		"Eva Survey Instance",
		filters={"unique_link": slug},
		fields=["name", "anonymous", "start_date", "end_date"]
	)

	if not instance:
		frappe.throw(_("Опрос не найден."), title="Ошибка")

	instance = instance[0]
	now_dt = now()

	if instance.start_date and now_dt < instance.start_date:
		frappe.throw(_("Опрос ещё не начался."), title="Опрос недоступен")
	if instance.end_date and now_dt > instance.end_date:
		frappe.throw(_("Опрос завершён."), title="Опрос недоступен")

	# 2. Проверка, не отправлял ли пользователь уже ответы
	user = None if frappe.session.user == "Guest" or instance.anonymous else frappe.session.user
	if user:
		exists = frappe.db.exists("Eva Survey Response", {"survey_instance": instance.name, "respondent": user})
		if exists:
			frappe.throw(_("Вы уже проходили этот опрос."), title="Опрос недоступен")

	# 3. Загружаем обязательные вопросы для проверки заполненности
	required_questions = frappe.get_all(
		"Eva Survey Question",
		filters={"parent": instance.name, "is_required": 1},
		fields=["name"]
	)
	required_ids = {q.name for q in required_questions}

	# Проверяем наличие всех обязательных ответов
	provided_ids = {a.get("question_link") for a in frappe.parse_json(answers)}

	missing = required_ids - provided_ids
	if missing:
		frappe.throw(_("Не все обязательные вопросы заполнены."), title="Ошибка валидации")

	# 4. Сохраняем ответы
	response = frappe.new_doc("Eva Survey Response")
	response.survey_instance = instance.name
	response.respondent = user
	response.submission_time = now()

	for answer in frappe.parse_json(answers):
		response.append("answers", {
			"question_link": answer.get("question_link"),
			"question_text": answer.get("question_text"),
			"answer": answer.get("answer")
		})

	response.insert(ignore_permissions=True)
	frappe.db.commit()

	return {"success": True, "message": _("Ваши ответы успешно сохранены.")}
