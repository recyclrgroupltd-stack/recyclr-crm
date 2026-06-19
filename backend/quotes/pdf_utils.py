from io import BytesIO
from pathlib import Path

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from accounts_api.company_branding import get_company_details, get_company_logo_bytes, get_company_name

try:
    from PIL import Image as PILImage
except ImportError:
    PILImage = None


def _money(value):
    return f"£{float(value):,.2f}"


def _text(value, fallback="-"):
    if value in (None, "", []):
        return fallback
    return str(value)


def _logo_path():
    return Path(settings.BASE_DIR) / "static" / "recyclr" / "recyclerlogoTP.png"


def _prepared_logo_path():
    original = _logo_path()

    if not original.exists():
        return None

    if PILImage is None:
        return str(original)

    try:
        prepared = Path(settings.BASE_DIR) / "static" / "recyclr" / "_pdf_logo_white.png"

        with PILImage.open(original) as img:
            img = img.convert("RGBA")
            white_bg = PILImage.new("RGBA", img.size, (255, 255, 255, 255))
            composited = PILImage.alpha_composite(white_bg, img).convert("RGB")
            composited.save(prepared, format="PNG")

        return str(prepared)
    except Exception:
        return str(original)


def _logo_flowable(company):
    logo_bytes = get_company_logo_bytes(company)
    if logo_bytes:
        try:
            logo = Image(BytesIO(logo_bytes), width=62 * mm, height=26 * mm)
            logo.hAlign = "LEFT"
            return logo
        except Exception:
            pass

    prepared_logo = _prepared_logo_path()
    if prepared_logo:
        logo = Image(prepared_logo, width=62 * mm, height=26 * mm)
        logo.hAlign = "LEFT"
        return logo

    return None


def _line_collection_charge(line):
    return float(line.bin_count) * float(line.collections_per_week) * 4.33 * float(line.price_per_lift)


def _line_rental_month(line):
    return float(line.bin_count) * 30 * float(line.rental_per_day)


def build_quote_pdf(quote):
    buffer = BytesIO()
    company = get_company_details()
    company_name = get_company_name(company)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "QuoteTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#1f4fbf"),
        spaceAfter=6,
    )

    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#6b7280"),
        spaceAfter=8,
    )

    section_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#412a8a"),
        spaceAfter=6,
        spaceBefore=8,
    )

    label_style = ParagraphStyle(
        "Label",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#333333"),
    )

    value_style = ParagraphStyle(
        "Value",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#222222"),
    )

    small_style = ParagraphStyle(
        "Small",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#333333"),
    )

    header_cell_style = ParagraphStyle(
        "HeaderCell",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )

    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#222222"),
    )

    story = []

    logo = _logo_flowable(company)
    if logo:
        logo_box = Table(
            [[logo]],
            colWidths=[74 * mm],
            rowHeights=[30 * mm],
        )
        logo_box.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("BOX", (0, 0), (-1, -1), 0, colors.white),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )

        story.append(logo_box)
        story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("Commercial Waste Quote", title_style))
    story.append(Paragraph(f"Prepared by {company_name} for review and acceptance.", subtitle_style))

    info_left = [
        [Paragraph("Quote Number", label_style), Paragraph(_text(quote.quote_number), value_style)],
        [Paragraph("Quote Title", label_style), Paragraph(_text(quote.title), value_style)],
        [Paragraph("Status", label_style), Paragraph(_text(quote.get_status_display()), value_style)],
    ]

    info_right = [
        [Paragraph("Issue Date", label_style), Paragraph(quote.created_at.strftime("%d/%m/%Y"), value_style)],
        [Paragraph("Valid Until", label_style), Paragraph(_text(quote.valid_until.strftime("%d/%m/%Y") if quote.valid_until else ""), value_style)],
        [Paragraph("Contact Email", label_style), Paragraph(_text(quote.email), value_style)],
    ]

    info_table = Table(
        [
            [
                Table(info_left, colWidths=[32 * mm, 58 * mm]),
                Table(info_right, colWidths=[30 * mm, 50 * mm]),
            ]
        ],
        colWidths=[92 * mm, 80 * mm],
    )
    info_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    story.append(info_table)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1")))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("Customer Details", section_style))

    customer_data = [
        [
            Paragraph("<b>Contact Name</b><br/>" + _text(quote.contact_name), body_style),
            Paragraph("<b>Customer</b><br/>" + _text(quote.customer.business_name if quote.customer else ""), body_style),
            Paragraph("<b>Site</b><br/>" + _text(quote.site.site_name if quote.site else ""), body_style),
        ],
    ]

    customer_table = Table(customer_data, colWidths=[57 * mm, 57 * mm, 58 * mm])
    customer_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#d1d5db")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(customer_table)
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph("Quoted Services", section_style))

    line_rows = [
        [
            Paragraph("<b>Waste Stream</b>", header_cell_style),
            Paragraph("<b>Bin Size</b>", header_cell_style),
            Paragraph("<b>Bins</b>", header_cell_style),
            Paragraph("<b>Collections / Week</b>", header_cell_style),
            Paragraph("<b>Price / Lift</b>", header_cell_style),
            Paragraph("<b>Rental / Day</b>", header_cell_style),
            Paragraph("<b>Monthly Total</b>", header_cell_style),
        ]
    ]

    subtotal_collections = 0.0
    subtotal_rental = 0.0

    all_lines = list(quote.lines.all())

    for line in all_lines:
        collection_charge = _line_collection_charge(line)
        rental_charge = _line_rental_month(line)
        line_total = collection_charge + rental_charge

        subtotal_collections += collection_charge
        subtotal_rental += rental_charge

        line_rows.append(
            [
                Paragraph(_text(line.get_waste_type_display()), small_style),
                Paragraph(_text(line.get_bin_size_display()), small_style),
                Paragraph(_text(line.bin_count), small_style),
                Paragraph(_text(line.collections_per_week), small_style),
                Paragraph(_money(line.price_per_lift), small_style),
                Paragraph(_money(line.rental_per_day), small_style),
                Paragraph(_money(line_total), small_style),
            ]
        )

    if len(all_lines) == 0:
        line_rows.append(
            [
                Paragraph("No quote lines added.", small_style),
                "",
                "",
                "",
                "",
                "",
                "",
            ]
        )

    lines_table = Table(
        line_rows,
        colWidths=[34 * mm, 20 * mm, 12 * mm, 28 * mm, 22 * mm, 22 * mm, 24 * mm],
        repeatRows=1,
    )
    lines_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#412a8a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(lines_table)
    story.append(Spacer(1, 5 * mm))

    total_monthly = subtotal_collections + subtotal_rental

    story.append(Paragraph("Monthly Charges", section_style))

    totals_table = Table(
        [
            ["Collections per Month", _money(subtotal_collections)],
            ["Bin Rental per Month", _money(subtotal_rental)],
            ["Total Monthly Charge", _money(total_monthly)],
        ],
        colWidths=[110 * mm, 40 * mm],
    )
    totals_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                ("BACKGROUND", (0, 0), (-1, -2), colors.HexColor("#f8fafc")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e9f7ef")),
                ("FONTNAME", (0, 0), (-1, -2), "Helvetica"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#166534")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(totals_table)
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph("Notes", section_style))
    story.append(Paragraph(_text(quote.notes, "No customer notes provided."), body_style))
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph("Customer Acceptance", section_style))
    story.append(
        Paragraph(
            "This section should be completed by the customer or authorised representative to confirm acceptance of this quotation.",
            body_style,
        )
    )
    story.append(Spacer(1, 8 * mm))

    acceptance_table = Table(
        [
            ["Authorised Name", ""],
            ["Signature", ""],
            ["Date", ""],
        ],
        colWidths=[40 * mm, 120 * mm],
    )
    acceptance_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#d1d5db")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(acceptance_table)
    story.append(Spacer(1, 8 * mm))

    story.append(
        Paragraph(
            company_name,
            ParagraphStyle(
                "Footer",
                parent=small_style,
                alignment=1,
                textColor=colors.HexColor("#6b7280"),
            ),
        )
    )

    doc.build(story)
    buffer.seek(0)
    return buffer
