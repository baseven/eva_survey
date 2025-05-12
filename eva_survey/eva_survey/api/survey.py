import frappe
from frappe.utils import now_datetime

@frappe.whitelist()
def get_surveys():
    """
    Возвращает список всех Eva Survey с базовыми полями.
    """
    return frappe.get_all("Eva Survey",
        fields=[
            "name",
            "title",
            "is_active",
            "is_anonymous"
        ]
    )

@frappe.whitelist()
def get_survey(survey_name):
    """
    Возвращает один опрос (Eva Survey) без вопросов.
    """
    doc = frappe.get_doc("Eva Survey", survey_name)
    return {
        "name": doc.name,
        "title": doc.title,
        "description": doc.description,
        "is_anonymous": doc.is_anonymous,
        "is_active": doc.is_active,
        "start_date": doc.start_date,
        "end_date": doc.end_date
    }
