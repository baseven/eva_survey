import frappe
import secrets

from datetime import datetime
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
def publish_survey(survey_template_id, title, description, start_date, end_date, is_anonymous):
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
		instance.is_anonymous = frappe.parse_json(is_anonymous) if isinstance(is_anonymous, str) else is_anonymous

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
	Проверяет доступность и отсутствие повторного прохождения для неанонимных опросов.
	"""
	instance = frappe.get_all(
		"Eva Survey Instance",
		filters={"unique_link": slug},
		fields=["name", "title", "description", "start_date", "end_date", "is_anonymous"]
	)

	if not instance:
		return {"success": False, "error": "Опрос не найден."}

	instance = instance[0]

	# Проверка активности по дате
	now_dt = datetime.strptime(now(), "%Y-%m-%d %H:%M:%S.%f")
	start_dt = instance.start_date
	end_dt = instance.end_date

	if start_dt and now_dt < start_dt:
		return {"success": False, "error": "Опрос ещё не начался."}
	if end_dt and now_dt > end_dt:
		return {"success": False, "error": "Опрос уже завершён."}

	# Проверка, не пройден ли уже (только для неанонимных опросов)
	if not instance.is_anonymous and frappe.session.user != "Guest":
		exists = frappe.db.exists("Eva Survey Response", {"survey_instance": instance.name, "respondent": frappe.session.user})
		if exists:
			return {"success": False, "error": "Вы уже проходили этот опрос."}

	# Загружаем вопросы
	questions = frappe.get_all(
		"Eva Survey Question",
		filters={"parent": instance.name},
		fields=["name", "idx", "question_text", "question_type", "options", "is_required"],
		order_by="idx asc"
	)

	return {
		"success": True,
		"title": instance.title,
		"description": instance.description,
		"is_anonymous": instance.is_anonymous,
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
		fields=["name", "is_anonymous", "start_date", "end_date"]
	)

	if not instance:
		frappe.throw(_("Опрос не найден."), title="Ошибка")

	instance = instance[0]

	now_dt = datetime.strptime(now(), "%Y-%m-%d %H:%M:%S.%f")
	start_dt = instance.start_date
	end_dt = instance.end_date
	if start_dt and now_dt < start_dt:
		frappe.throw(_("Опрос ещё не начался."), title="Опрос недоступен")
	if end_dt and now_dt > end_dt:
		frappe.throw(_("Опрос уже завершён."), title="Опрос недоступен")


	# 2. Проверка, не отправлял ли пользователь уже ответы
	user = None if frappe.session.user == "Guest" or instance.is_anonymous else frappe.session.user
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
