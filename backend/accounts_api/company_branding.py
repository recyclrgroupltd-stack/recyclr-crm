import base64
from html import escape as html_escape

from .models import CompanyDetails


DEFAULT_COMPANY_NAME = "Recyclr Group Ltd"


def get_company_details():
    return CompanyDetails.get_solo()


def get_company_name(company=None):
    company = company or get_company_details()
    name = (getattr(company, "company_name", "") or "").strip()
    return name or DEFAULT_COMPANY_NAME


def get_company_email(company=None):
    company = company or get_company_details()
    return (getattr(company, "main_email", "") or "").strip()


def get_company_phone(company=None):
    company = company or get_company_details()
    return (getattr(company, "phone_number", "") or "").strip()


def get_company_logo_data(company=None):
    company = company or get_company_details()
    logo = (getattr(company, "company_logo_data", "") or "").strip()
    if logo.startswith("data:image/") and "," in logo:
        return logo
    return ""


def get_company_logo_url(company=None):
    return "/api/auth/company-logo/" if get_company_logo_data(company) else ""


def get_company_logo_bytes(company=None):
    logo = get_company_logo_data(company)
    if not logo:
        return None
    try:
        return base64.b64decode(logo.split(",", 1)[1])
    except (ValueError, TypeError):
        return None


def company_logo_or_name_html(company=None, width=180, light=False):
    company = company or get_company_details()
    name = html_escape(get_company_name(company))
    logo = get_company_logo_data(company)
    if logo:
        return (
            f'<img src="{html_escape(logo, quote=True)}" alt="{name}" '
            f'style="display:block;max-width:{int(width)}px;height:auto;">'
        )
    color = "#ffffff" if light else "#241b4b"
    return f'<div style="font-size:28px;font-weight:700;color:{color};">{name}</div>'
