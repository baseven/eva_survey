import frappe
from frappe import _


def get_context(context):
    uniq_link = frappe.form_dict.uniq_link
    if not uniq_link:
        frappe.throw(_("Ссылка не указана."), frappe.DoesNotExistError)

    survey_instance = frappe.db.get_value("Eva Survey Instance", {"unique_link": uniq_link}, "name")
    if not survey_instance:
        frappe.throw(_("Опрос не найден."), frappe.DoesNotExistError)

    context.instance_name = survey_instance
    context.uniq_link = uniq_link
