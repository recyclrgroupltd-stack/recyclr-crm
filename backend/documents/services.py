from __future__ import annotations

import base64
from decimal import Decimal, InvalidOperation
from io import BytesIO

from django.core.files.base import ContentFile

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from accounts_api.company_branding import get_company_name
from accounts_api.models import CompanyDetails
from documents.models import GeneratedDocument


PURPLE = colors.HexColor("#6D28D9")
LIGHT_PURPLE = colors.HexColor("#F3E8FF")
BORDER = colors.HexColor("#D1D5DB")
TEXT = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")


EWC_CODE_MAP = {
    "general": "20 03 01",
    "mixed_recycling": "15 01 06",
    "glass": "15 01 07",
    "food": "20 01 08",
}


def _safe_text(value, fallback=""):
    if value is None:
        return fallback
    return str(value)


def _safe_decimal(value, fallback="0.00"):
    try:
        if value in (None, ""):
            return Decimal(fallback)
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(fallback)


def _money(value):
    return f"£{_safe_decimal(value):.2f}"


def _site_address_lines(site, quote):
    lines = []
    for value in [
        getattr(site, "address_line_1", "") or getattr(quote, "address_line_1", ""),
        getattr(site, "address_line_2", "") or getattr(quote, "address_line_2", ""),
        getattr(site, "town", "") or getattr(quote, "town", ""),
        getattr(site, "county", "") or getattr(quote, "county", ""),
        getattr(site, "postcode", "") or getattr(quote, "postcode", ""),
    ]:
        text = _safe_text(value).strip()
        if text:
            lines.append(text)
    return lines


def _customer_name(customer, quote):
    if getattr(customer, "business_name", ""):
        return customer.business_name
    if getattr(quote, "lead", None) and getattr(quote.lead, "company_name", ""):
        return quote.lead.company_name
    if getattr(quote, "title", ""):
        return quote.title
    return "Customer"


def _contact_name(customer, quote):
    return getattr(customer, "contact_name", "") or getattr(quote, "contact_name", "") or ""


def _email(customer, quote):
    return getattr(customer, "email", "") or getattr(quote, "email", "") or ""


def _phone(customer):
    return getattr(customer, "phone", "") or ""


def _sic_code(quote):
    return getattr(quote, "sic_code", "") or getattr(getattr(quote, "lead", None), "sic_code", "") or ""


def _service_lines(quote):
    return list(quote.lines.all().order_by("sort_order", "id"))


def _waste_types_text(lines):
    values = []
    for line in lines:
        try:
            label = line.get_waste_type_display()
        except Exception:
            label = _safe_text(getattr(line, "waste_type", ""))
        if label and label not in values:
            values.append(label)
    return ", ".join(values)


def _ewc_codes_text(lines):
    values = []
    for line in lines:
        waste_type = _safe_text(getattr(line, "waste_type", "")).strip()
        code = EWC_CODE_MAP.get(waste_type)
        if code and code not in values:
            values.append(code)
    return ", ".join(values)


def _container_types_text(lines):
    values = []
    for line in lines:
        try:
            size_label = line.get_bin_size_display()
        except Exception:
            size_label = f"{_safe_text(getattr(line, 'bin_size', ''))}L"
        count = getattr(line, "bin_count", 1) or 1
        values.append(f"{count} x {size_label}")
    return ", ".join(values)


def _signature_image(company):
    data = getattr(company, "legal_signature_data", "") or ""
    if not data.startswith("data:image"):
        return None

    try:
        _, encoded = data.split(",", 1)
        raw = base64.b64decode(encoded)
        return Image(BytesIO(raw), width=72 * mm, height=24 * mm)
    except Exception:
        return None


def _logo_image(company):
    data = getattr(company, "company_logo_data", "") or ""
    if not data.startswith("data:image"):
        return None

    try:
        _, encoded = data.split(",", 1)
        raw = base64.b64decode(encoded)
        return Image(BytesIO(raw), width=38 * mm, height=18 * mm)
    except Exception:
        return None


def _styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="DocTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=TEXT,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.white,
            backColor=PURPLE,
            borderPadding=(7, 7, 7),
            spaceBefore=10,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=TEXT,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=MUTED,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Label",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=TEXT,
            spaceAfter=2,
        )
    )
    return styles


def _header(elements, company, title, subtitle=""):
    styles = _styles()
    logo = _logo_image(company)
    title_block = [
        Paragraph(get_company_name(company), styles["DocTitle"]),
    ]
    if subtitle:
        title_block.append(Paragraph(subtitle, styles["Small"]))

    if logo:
        table = Table([[logo, title_block]], colWidths=[45 * mm, 125 * mm])
    else:
        table = Table([[title_block]], colWidths=[170 * mm])

    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(title, styles["DocTitle"]))
    elements.append(Spacer(1, 4))


def _field_table(rows, widths=None):
    data = []
    styles = _styles()
    for label, value in rows:
        data.append(
            [
                Paragraph(f"<b>{label}</b>", styles["Body"]),
                Paragraph(_safe_text(value) or "__________________________", styles["Body"]),
            ]
        )
    table = Table(data, colWidths=widths or [48 * mm, 122 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, -1), LIGHT_PURPLE),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def _signature_table(company, customer_title="Signed for and on behalf of the Customer:", include_position=False):
    styles = _styles()
    sig = _signature_image(company)
    company_name = get_company_name(company)

    left_content = [
        Paragraph(f"Signed for and on behalf of {company_name}:", styles["Body"]),
        Paragraph(
            f"Name: {_safe_text(getattr(company, 'legal_signatory_name', 'Jamie Gallagher')) or 'Jamie Gallagher'}",
            styles["Body"],
        ),
    ]
    if sig:
        left_content.append(Paragraph("Signature:", styles["Body"]))
        left_content.append(Spacer(1, 2))
        left_content.append(sig)
        left_content.append(Spacer(1, 4))
    else:
        left_content.append(
            Paragraph('<font size="12">Signature: (Pre-signed / digital signature)</font>', styles["Body"])
        )
    left_content.append(Paragraph("Date: __________________________", styles["Body"]))

    right_content = [Paragraph(customer_title, styles["Body"])]
    right_content.append(Paragraph("Name: __________________________", styles["Body"]))
    if include_position:
        right_content.append(Paragraph("Position: _______________________", styles["Body"]))
    right_content.append(Paragraph("Signature: ______________________", styles["Body"]))
    right_content.append(Paragraph("Date: __________________________", styles["Body"]))

    table = Table([[left_content, right_content]], colWidths=[85 * mm, 85 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.75, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def _company_details_lines(company):
    company_name = get_company_name(company)
    registered_lines = [
        _safe_text(getattr(company, "registered_address_line_1", "")),
        _safe_text(getattr(company, "registered_address_line_2", "")),
        _safe_text(getattr(company, "registered_town", "")),
        _safe_text(getattr(company, "registered_county", "")),
        _safe_text(getattr(company, "registered_postcode", "")),
    ]
    registered = "<br/>".join([line for line in registered_lines if line]) or "[REGISTERED ADDRESS TO BE INSERTED]"
    return [
        company_name,
        f"(Company Number: {_safe_text(getattr(company, 'company_number', '')) or '[TO BE INSERTED]'})",
        "Registered Office:",
        registered,
        "Trading Address:",
        "Same as Registered Office",
        "Email:",
        _safe_text(getattr(company, "main_email", "")) or "info@recyclrgroup.co.uk",
        "Telephone:",
        _safe_text(getattr(company, "phone_number", "")) or "07511050688",
        "Website:",
        _safe_text(getattr(company, "website", "")) or "www.recyclrgroup.co.uk",
        "Waste Broker Registration:",
        _safe_text(getattr(company, "waste_broker_registration", "")) or "[TO BE INSERTED]",
    ]


def _build_service_agreement(company, customer, site, quote):
    styles = _styles()
    company_name = get_company_name(company)
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    elements = []

    _header(elements, company, "SERVICE AGREEMENT")

    elements.append(Paragraph("Company Details", styles["Section"]))
    for item in _company_details_lines(company):
        elements.append(Paragraph(item, styles["Body"]))

    elements.append(Paragraph("Definitions", styles["Section"]))
    definitions = [
        "In this agreement, the following terms shall have the meanings set out below:",
        f"“We”, “Us”, “Our” refers to {company_name}",
        "“Customer”, “You” refers to the business or individual receiving services",
        f"“Party” / “Parties” refers to the Customer and {company_name} collectively or individually",
        "“Services” refers to the waste collection, disposal, and related services provided",
        "“Containers” refers to any bins, skips, or equipment supplied by us",
        "“Collection” refers to the scheduled removal of waste from the customer’s premises",
        "“Agreement” refers to this contract, including any associated quotation, service schedule, or order confirmation",
        "“Contract Term” refers to the initial and any renewed period of this agreement",
        "“Contamination” refers to incorrect or mixed waste placed in a container",
        "“Hazardous Waste” refers to any waste that is dangerous, toxic, or not permitted under standard waste regulations",
        "“L” refers to litres, being the capacity of the container",
        "“Access” refers to safe, unobstructed entry to the site and containers, suitable for collection vehicles and personnel",
        "“Notice” refers to formal communication given in accordance with the Communication section of this agreement",
        "“Reasonably” means taking fair and practical steps in line with normal industry standards and operational conditions",
        "“Normal Wear and Tear” refers to deterioration resulting from standard and reasonable use of containers. Further detail is set out in the Containers & Equipment section of this agreement",
    ]
    for item in definitions:
        elements.append(Paragraph(item, styles["Body"]))

    sections = {
        "Services": [
            "Services will be provided as agreed and outlined in the relevant quotation, service schedule, or order confirmation.",
        ],
        "Pricing & Payment Terms": [
            "Invoices are payable within 10 days of the invoice date.",
            "Bin rental charges apply as outlined in the Service Schedule.",
            "Overweight charges may apply at a rate of £0.25 per kilogram above the agreed weight allowance.",
            "Where a collection cannot be completed due to lack of access, bins not being presented, or other customer-related issues, the collection may still be charged.",
            "A delivery charge may apply for containers and will typically be equivalent to the standard collection (lift) charge per container delivered.",
        ],
        "Contract Term": [
            "This agreement shall commence on the service start date and continue for an initial period of 12 months.",
            "Following the initial term, the agreement will automatically renew for successive 12-month periods unless terminated by either party.",
            "Either party may terminate this agreement by providing no less than 60 days’ written notice prior to the end of the current term.",
        ],
        "Service Rules": [
            "We reserve the right to adjust pricing with no less than 30 days’ notice due to operational or market changes.",
            "Only agreed waste types may be placed in the containers. The disposal of hazardous or prohibited waste is strictly forbidden.",
            "Where contamination or incorrect waste is presented, we reserve the right to:",
            "• Refuse collection, and/or",
            "• Apply additional charges for handling, transport, or disposal",
        ],
        "Collection Terms": [
            "We will make reasonable efforts to complete all scheduled collections. In the event of a missed collection, we will aim to reattempt within 48 hours where reasonably possible.",
            "Collection schedules may change due to operational requirements. Notice will be provided where possible.",
            "Collection times are not guaranteed.",
        ],
        "Access & Customer Responsibilities": [
            "The customer is responsible for ensuring safe and unobstructed access at all times.",
            "Containers must be presented at the agreed collection point on the scheduled day.",
            "Where access is not available or containers are not presented correctly, the collection may still be charged.",
            "The customer is responsible for ensuring the site is safe for collection.",
        ],
        "Containers & Equipment": [
            f"All containers remain the property of {company_name}.",
            "Containers may be repositioned on-site for operational use where reasonable. However, the customer must notify us of any change to the agreed collection location to ensure successful collection.",
            "The customer must not apply stickers, markings, or alterations to the containers.",
            "The customer is responsible for loss, theft, or damage beyond normal wear and tear.",
            "Damage includes (but is not limited to):",
            "• Fire or heat damage",
            "• Impact damage (e.g. from vehicles)",
            "• Misuse or overloading",
            "• Deliberate damage or vandalism",
            "Normal wear and tear includes, but is not limited to, minor scuffs, scratches, and cosmetic damage resulting from standard use and will not be charged.",
        ],
        "Termination & Suspension": [
            "This agreement may be terminated by either party in accordance with the notice period outlined above.",
            "If the customer terminates this agreement before the end of the contract term, or is in breach resulting in termination, the remaining contract value for the unexpired term shall become immediately due and payable.",
            "We reserve the right to suspend or terminate services with immediate effect where:",
            "• Payments are overdue",
            "• The customer is in breach of this agreement",
            "• There is a risk to health and safety",
            "Services may be suspended until outstanding balances are cleared.",
        ],
        "Legal": [
            "This agreement is governed by the laws of England and Wales.",
            "Our liability is limited to the extent permitted by law. We are not liable for indirect or consequential losses.",
        ],
        "Communication": [
            "We may communicate via email, telephone, post, or messaging services.",
            "Formal notices under this agreement may be served via email or post and will be sent to the contact details provided in this agreement.",
        ],
    }

    for title, body_lines in sections.items():
        elements.append(Paragraph(title, styles["Section"]))
        for item in body_lines:
            elements.append(Paragraph(item, styles["Body"]))

    elements.append(Paragraph("Signatures", styles["Section"]))
    elements.append(KeepTogether([_signature_table(company)]))
    doc.build(elements)
    buffer.seek(0)
    return buffer


def _build_duty_of_care(company, customer, site, quote):
    styles = _styles()
    company_name = get_company_name(company)
    lines = _service_lines(quote)
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    elements = []

    _header(elements, company, "DUTY OF CARE / WASTE TRANSFER NOTE (SEASON TICKET)")
    elements.append(Paragraph("Waste Transfer Note (Season Ticket)", styles["Body"]))
    elements.append(Paragraph("Valid for a period of 12 months", styles["Body"]))

    elements.append(Paragraph("Transferor (Waste Producer / Customer)", styles["Section"]))
    address_lines = _site_address_lines(site, quote)
    elements.append(
        _field_table(
            [
                ("Company Name", _customer_name(customer, quote)),
                ("Address", ", ".join(address_lines[:-1]) if len(address_lines) > 1 else ", ".join(address_lines)),
                ("Postcode", address_lines[-1] if address_lines else getattr(quote, "postcode", "")),
                ("Contact Name", _contact_name(customer, quote)),
                ("Telephone", _phone(customer)),
                ("Email", _email(customer, quote)),
                ("SIC Code", _sic_code(quote)),
            ]
        )
    )
    elements.append(Spacer(1, 8))

    registered_lines = [
        _safe_text(getattr(company, "registered_address_line_1", "")),
        _safe_text(getattr(company, "registered_address_line_2", "")),
        _safe_text(getattr(company, "registered_town", "")),
        _safe_text(getattr(company, "registered_county", "")),
        _safe_text(getattr(company, "registered_postcode", "")),
    ]
    registered = "<br/>".join([line for line in registered_lines if line]) or "[REGISTERED ADDRESS TO BE INSERTED]"

    elements.append(Paragraph("Transferee (Waste Broker)", styles["Section"]))
    for item in [
        company_name,
        f"(Company Number: {_safe_text(getattr(company, 'company_number', '')) or '[TO BE INSERTED]'})",
        "Registered Office:",
        registered,
        "Email:",
        _safe_text(getattr(company, "main_email", "")) or "info@recyclrgroup.co.uk",
        "Telephone:",
        _safe_text(getattr(company, "phone_number", "")) or "07511050688",
        "Waste Broker Registration Number:",
        _safe_text(getattr(company, "waste_broker_registration", "")) or "[TO BE INSERTED]",
    ]:
        elements.append(Paragraph(item, styles["Body"]))

    description_block = [
        Paragraph("Description of Waste", styles["Section"]),
        Paragraph("The waste covered by this agreement is described as follows:", styles["Body"]),
        Paragraph("Waste Type(s):", styles["Body"]),
        Paragraph(_waste_types_text(lines) or "[TO BE AUTO-FILLED FROM CRM]", styles["Body"]),
        Paragraph("European Waste Catalogue (EWC) Code(s):", styles["Body"]),
        Paragraph(_ewc_codes_text(lines) or "[TO BE AUTO-FILLED FROM CRM]", styles["Body"]),
        Paragraph("Description:", styles["Body"]),
        Paragraph("Commercial waste arising from the customer’s business activities.", styles["Body"]),
        Paragraph("Container Type(s):", styles["Body"]),
        Paragraph(_container_types_text(lines) or "[TO BE AUTO-FILLED FROM CRM]", styles["Body"]),
    ]
    elements.append(KeepTogether(description_block))

    elements.append(Paragraph("Transfer Details", styles["Section"]))
    for item in [
        "The waste will be collected on a regular basis in accordance with the agreed service schedule.",
        "This Waste Transfer Note is a Season Ticket covering multiple collections over a period of 12 months from the date of signature.",
    ]:
        elements.append(Paragraph(item, styles["Body"]))

    elements.append(Paragraph("Declaration", styles["Section"]))
    for item in [
        "The customer confirms that:",
        "• The waste described is produced by their business",
        "• The waste is described accurately and correctly",
        "• No hazardous or prohibited waste is included unless specifically agreed",
        "• They have taken all reasonable steps to apply the waste hierarchy",
        f"{company_name} confirms that:",
        "• It is registered as a waste broker",
        "• It will arrange for the waste to be transferred to an authorised person",
        "• All reasonable steps will be taken to ensure compliance with applicable waste regulations",
    ]:
        elements.append(Paragraph(item, styles["Body"]))

    elements.append(Paragraph("Signatures", styles["Section"]))
    elements.append(KeepTogether([_signature_table(company, customer_title="Transferor (Customer)", include_position=True)]))
    doc.build(elements)
    buffer.seek(0)
    return buffer


def _build_service_schedule(company, customer, site, quote):
    styles = _styles()
    company_name = get_company_name(company)
    lines = _service_lines(quote)
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    elements = []

    _header(elements, company, "SERVICE SCHEDULE / QUOTE")

    elements.append(Paragraph("Customer Details", styles["Section"]))
    address_lines = _site_address_lines(site, quote)
    elements.append(
        _field_table(
            [
                ("Company Name", _customer_name(customer, quote)),
                ("Site Address", ", ".join(address_lines[:-1]) if len(address_lines) > 1 else ", ".join(address_lines)),
                ("Postcode", address_lines[-1] if address_lines else getattr(quote, "postcode", "")),
                ("Contact Name", _contact_name(customer, quote)),
                ("Email", _email(customer, quote)),
                ("Telephone", _phone(customer)),
            ]
        )
    )
    elements.append(Spacer(1, 8))

    elements.append(Paragraph("Service Summary", styles["Section"]))
    elements.append(
        Paragraph(
            f"This document outlines the agreed waste management services to be provided by {company_name} at the above site.",
            styles["Body"],
        )
    )
    elements.append(
        Paragraph(
            f"All services are provided in accordance with the {company_name} Service Agreement.",
            styles["Body"],
        )
    )
    elements.append(Spacer(1, 4))

    elements.append(Paragraph("Service Breakdown", styles["Section"]))
    service_table = [["Waste Type", "Bin Size", "Frequency", "Lift Price", "Monthly Cost"]]
    for line in lines:
        try:
            waste_label = line.get_waste_type_display()
        except Exception:
            waste_label = _safe_text(getattr(line, "waste_type", ""))
        try:
            bin_size_label = line.get_bin_size_display()
        except Exception:
            bin_size_label = f"{_safe_text(getattr(line, 'bin_size', ''))}L"
        service_table.append(
            [
                waste_label,
                bin_size_label,
                f"{getattr(line, 'collections_per_week', 0)}x per week",
                _money(getattr(line, "price_per_lift", 0)),
                _money(getattr(line, "collection_charge_per_month", 0)),
            ]
        )
    service_breakdown = Table(service_table, colWidths=[48 * mm, 28 * mm, 32 * mm, 30 * mm, 32 * mm])
    service_breakdown.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    elements.append(service_breakdown)
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("(Auto-generated from CRM)", styles["Small"]))

    elements.append(Paragraph("Bin Rental", styles["Section"]))
    rental_table = [["Bin Size", "Quantity", "Daily Rate", "Monthly Cost"]]
    for line in lines:
        try:
            bin_size_label = line.get_bin_size_display()
        except Exception:
            bin_size_label = f"{_safe_text(getattr(line, 'bin_size', ''))}L"
        rental_table.append(
            [
                bin_size_label,
                _safe_text(getattr(line, "bin_count", 1)),
                _money(getattr(line, "rental_per_day", 0)),
                _money(getattr(line, "bin_rental_per_month", 0)),
            ]
        )
    rentals = Table(rental_table, colWidths=[42 * mm, 35 * mm, 40 * mm, 45 * mm])
    rentals.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ]
        )
    )
    elements.append(rentals)
    elements.append(Spacer(1, 8))

    elements.append(Paragraph("Delivery Charges", styles["Section"]))
    elements.append(Paragraph("A delivery charge applies per container and is calculated as follows:", styles["Body"]))
    delivery_table = [["Bin Size", "Quantity", "Charge per Bin", "Total"]]
    delivery_total = Decimal("0.00")
    for line in lines:
        try:
            bin_size_label = line.get_bin_size_display()
        except Exception:
            bin_size_label = f"{_safe_text(getattr(line, 'bin_size', ''))}L"
        charge_per_bin = _safe_decimal(getattr(line, "price_per_lift", 0))
        qty = _safe_decimal(getattr(line, "bin_count", 1))
        total = charge_per_bin * qty
        delivery_total += total
        delivery_table.append(
            [
                bin_size_label,
                _safe_text(getattr(line, "bin_count", 1)),
                _money(charge_per_bin),
                _money(total),
            ]
        )
    deliveries = Table(delivery_table, colWidths=[42 * mm, 35 * mm, 45 * mm, 40 * mm])
    deliveries.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ]
        )
    )
    elements.append(deliveries)
    elements.append(Spacer(1, 8))

    total_first_invoice = _safe_decimal(getattr(quote, "total_per_month", 0)) + delivery_total

    elements.append(Paragraph("Summary", styles["Section"]))
    summary_table = [
        ["Description", "Amount"],
        ["Monthly Service Cost (based on agreed service frequency)", _money(getattr(quote, "total_per_month", 0))],
        ["One-off Delivery Charges", _money(delivery_total)],
        ["Total First Invoice (incl. delivery)", _money(total_first_invoice)],
    ]
    summary = Table(summary_table, colWidths=[110 * mm, 60 * mm])
    summary.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 1), (0, -1), LIGHT_PURPLE),
            ]
        )
    )
    elements.append(summary)
    elements.append(Spacer(1, 8))

    elements.append(Paragraph("Important Information", styles["Section"]))
    for item in [
        "• Prices are subject to change with 30 days’ notice",
        "• Charges apply for missed collections due to access or bins not being presented",
        "• Overweight charges may apply where applicable",
        f"• Services are subject to the {company_name} Service Agreement",
    ]:
        elements.append(Paragraph(item, styles["Body"]))

    elements.append(Paragraph("Contract Summary", styles["Section"]))
    contract_start_text = "__________________________"
    if getattr(quote, "contract_start_date", None):
        contract_start_text = quote.contract_start_date.strftime("%d %B %Y")

    service_start_dates = [getattr(line, "schedule_start_date", None) for line in lines if getattr(line, "schedule_start_date", None)]
    service_start_text = "__________________________"
    if service_start_dates:
        service_start_text = min(service_start_dates).strftime("%d %B %Y")

    for item in [
        "• Contract Term: 12 months",
        "• Renewal: Automatic",
        "• Notice Period: 60 days",
        "• Payment Terms: 10 days",
        f"• Contract Start Date: {contract_start_text}",
        f"• Service Start Date: {service_start_text}",
    ]:
        elements.append(Paragraph(item, styles["Body"]))

    elements.append(Paragraph("Acceptance", styles["Section"]))
    elements.append(
        Paragraph(
            f"By signing below, you confirm acceptance of the services, pricing, and terms outlined in this document and the {company_name} Service Agreement.",
            styles["Body"],
        )
    )
    elements.append(KeepTogether([_signature_table(company, customer_title="Customer")]))
    doc.build(elements)
    buffer.seek(0)
    return buffer


def _create_document(*, customer, site, quote, document_type, title, buffer):
    instance = GeneratedDocument.objects.create(
        customer=customer,
        site=site,
        quote=quote,
        document_type=document_type,
        title=title,
        status="generated",
    )
    filename = f"{document_type}-{quote.id}.pdf"
    instance.file.save(filename, ContentFile(buffer.getvalue()), save=True)
    return instance


def create_generated_documents_for_quote(*, customer, site, quote):
    company = CompanyDetails.get_solo()

    service_agreement = _build_service_agreement(company, customer, site, quote)
    duty_of_care = _build_duty_of_care(company, customer, site, quote)
    service_schedule = _build_service_schedule(company, customer, site, quote)

    return [
        _create_document(
            customer=customer,
            site=site,
            quote=quote,
            document_type="service_agreement",
            title="Service Agreement",
            buffer=service_agreement,
        ),
        _create_document(
            customer=customer,
            site=site,
            quote=quote,
            document_type="duty_of_care",
            title="Duty of Care / Waste Transfer Note",
            buffer=duty_of_care,
        ),
        _create_document(
            customer=customer,
            site=site,
            quote=quote,
            document_type="service_schedule",
            title="Service Schedule",
            buffer=service_schedule,
        ),
    ]
