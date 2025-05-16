import frappe
from frappe import _
from frappe.exceptions import PermissionError

def check_user_roles(required_roles):
    """
    Проверяет, что текущий пользователь имеет хотя бы одну из ролей в required_roles.
    Если нет — бросает frappe.throw с сообщением об ошибке.
    """
    user = frappe.session.user
    # frappe.get_roles вернёт список ролей, включая 'All'
    user_roles = set(frappe.get_roles(user))

    # пересечение требуемых и фактических ролей
    if not user_roles.intersection(required_roles):
        frappe.throw(
            _("У вас нет необходимых прав для выполнения этого действия"),
            frappe.PermissionError
        )
    # всё ок
    return True


def check_doc_permission(doctype, ptype="read"):
    """
    Проверяет, что текущий пользователь имеет право ptype ('read','write','create' и т.д.)
    на DocType doctype. Если нет — бросает frappe.throw.
    """
    # frappe.has_permission возвращает False, если доступа нет
    if not frappe.has_permission(doctype, ptype=ptype):
        frappe.throw(
            _("У вас нет необходимых прав для выполнения этого действия"),
            frappe.PermissionError
        )
    return True
