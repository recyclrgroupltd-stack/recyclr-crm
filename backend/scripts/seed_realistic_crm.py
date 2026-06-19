import os
import random
import re
import sys
from datetime import timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.contrib.auth import get_user_model
from django.db import connection, transaction
from django.utils import timezone

from communications.models import EmailMessage
from containers.models import Container, ContainerBatch, ContainerMaintenanceEvent
from customers.models import Customer, CustomerActivity, CustomerNote, Site
from documents.models import GeneratedDocument, SignedPackDocument, SigningPack
from hauliers.models import Haulier, HaulierPortalUser, HaulierPortalUserSiteAccess, HaulierRate
from jobs.models import Job
from jobs.utils import _date_matches_service, generate_jobs_for_all_services
from leads.models import Lead
from pricing.models import PriceBookItem
from purchase_orders.models import PurchaseOrder, PurchaseOrderLine, StaffNotification, Supplier
from quotes.models import Quote, QuoteDocument, QuoteLine
from services.models import Service


random.seed(20260614)
today = timezone.localdate()


def money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"))


def slugify(value):
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "", value)
    return value[:34] or "customer"


def pick_staff():
    User = get_user_model()
    staff = list(User.objects.filter(is_active=True).order_by("id"))
    preferred = [user for user in staff if user.username.lower() != "codex"]
    return preferred or staff


def cycle_pick(items, index):
    return items[index % len(items)]


def pricebook_bin_size(bin_size):
    return str(bin_size).replace("L", "")


def reset_sqlite_sequences(model_classes):
    if connection.vendor != "sqlite":
        return
    table_names = [model._meta.db_table for model in model_classes]
    if not table_names:
        return
    placeholders = ",".join(["%s"] * len(table_names))
    with connection.cursor() as cursor:
        cursor.execute(f"DELETE FROM sqlite_sequence WHERE name IN ({placeholders})", table_names)


models_to_clear = [
    # Notifications are generated from operational records, so clear them with the demo data.
    StaffNotification,
    PurchaseOrderLine,
    PurchaseOrder,
    Supplier,
    EmailMessage,
    SignedPackDocument,
    SigningPack,
    GeneratedDocument,
    QuoteDocument,
    QuoteLine,
    Quote,
    Job,
    ContainerMaintenanceEvent,
    Container,
    ContainerBatch,
    Service,
    CustomerActivity,
    CustomerNote,
    Site,
    Customer,
    Lead,
    HaulierPortalUserSiteAccess,
    HaulierPortalUser,
    HaulierRate,
    Haulier,
    PriceBookItem,
]


price_rows = {
    "general": {
        "240L": (9.80, 0.18),
        "360L": (13.25, 0.24),
        "660L": (21.50, 0.32),
        "1100L": (28.75, 0.44),
    },
    "recycling": {
        "240L": (8.25, 0.16),
        "360L": (11.40, 0.21),
        "660L": (24.60, 0.38),
        "1100L": (31.90, 0.52),
    },
    "glass": {
        "240L": (7.95, 0.15),
        "360L": (9.40, 0.18),
        "660L": (15.80, 0.28),
        "1100L": (20.20, 0.36),
    },
    "food": {
        "240L": (11.25, 0.17),
        "360L": (13.75, 0.23),
        "660L": (19.90, 0.31),
        "1100L": (25.10, 0.40),
    },
}

haulier_names = [
    ("Midlands Resource Logistics Ltd", "operations@midlandsresource.co.uk", "0116 496 2140", "Leicester"),
    ("Greenline Collections Ltd", "dispatch@greenlinecollections.co.uk", "0121 588 0341", "Birmingham"),
    ("Northern Circular Services Ltd", "planning@northerncircular.co.uk", "0113 405 1198", "Leeds"),
    ("Severn Waste Transport Ltd", "service@severnwaste.co.uk", "01452 337 885", "Gloucester"),
    ("Trent Valley Environmental Ltd", "jobs@trentvalleyenvironmental.co.uk", "0115 982 6105", "Nottingham"),
]

towns = [
    ("Leicester", "Leicestershire", "LE1"),
    ("Loughborough", "Leicestershire", "LE11"),
    ("Hinckley", "Leicestershire", "LE10"),
    ("Market Harborough", "Leicestershire", "LE16"),
    ("Nottingham", "Nottinghamshire", "NG1"),
    ("Derby", "Derbyshire", "DE1"),
    ("Coventry", "West Midlands", "CV1"),
    ("Birmingham", "West Midlands", "B1"),
    ("Wolverhampton", "West Midlands", "WV1"),
    ("Northampton", "Northamptonshire", "NN1"),
    ("Peterborough", "Cambridgeshire", "PE1"),
    ("Milton Keynes", "Buckinghamshire", "MK9"),
    ("Sheffield", "South Yorkshire", "S1"),
    ("Leeds", "West Yorkshire", "LS1"),
    ("Manchester", "Greater Manchester", "M1"),
    ("Salford", "Greater Manchester", "M5"),
    ("Liverpool", "Merseyside", "L1"),
    ("Bristol", "Bristol", "BS1"),
    ("Gloucester", "Gloucestershire", "GL1"),
    ("Oxford", "Oxfordshire", "OX1"),
]

streets = [
    "Station Road",
    "High Street",
    "Market Street",
    "King Street",
    "Victoria Road",
    "Mill Lane",
    "Canal Street",
    "Abbey Park Road",
    "Freeman Street",
    "Grove Road",
    "Foundry Lane",
    "Queen Street",
    "Bridge Street",
    "Riverside Way",
    "Oakfield Road",
]

contacts = [
    ("Amelia", "Hughes"),
    ("Oliver", "Turner"),
    ("Sophie", "Bennett"),
    ("Daniel", "Ward"),
    ("Grace", "Morgan"),
    ("Harry", "Cooper"),
    ("Maya", "Patel"),
    ("Ethan", "Clark"),
    ("Lily", "Robinson"),
    ("Thomas", "Evans"),
    ("Isla", "Brooks"),
    ("Noah", "Carter"),
    ("Freya", "Mitchell"),
    ("Jack", "Foster"),
    ("Ruby", "Richardson"),
    ("George", "Bailey"),
    ("Ava", "Collins"),
    ("Charlie", "Price"),
    ("Evie", "Morris"),
    ("Leo", "Reed"),
]

prefixes = [
    "Abbey",
    "Alder",
    "Ashbourne",
    "Beacon",
    "Belgrave",
    "Birchwood",
    "Bridgeway",
    "Brookfield",
    "Canal",
    "Castle",
    "Cedar",
    "Central",
    "Charnwood",
    "Clarendon",
    "Cobalt",
    "Crown",
    "Derwent",
    "Eastgate",
    "Elmfield",
    "Fairfield",
    "Fosse",
    "Friars",
    "Granby",
    "Greenacre",
    "Hamilton",
    "Harbour",
    "Hawthorn",
    "Highcross",
    "Humberstone",
    "Ivybridge",
    "Kingfisher",
    "Knighton",
    "Lakeside",
    "Langton",
    "Limehurst",
    "Longford",
    "Marlborough",
    "Meadow",
    "Meridian",
    "Millfield",
    "Newarke",
    "Northgate",
    "Oakham",
    "Orchard",
    "Parkside",
    "Phoenix",
    "Queensway",
    "Riverside",
    "Rosewood",
    "Rutland",
    "Saffron",
    "Silverstone",
    "Soar",
    "Southgate",
    "Spencer",
    "Stamford",
    "Stonebridge",
    "Sycamore",
    "Tanner",
    "Thornfield",
    "Union",
    "Victoria",
    "Vulcan",
    "Watermead",
    "Westbourne",
    "Willow",
    "Woodgate",
    "Wycliffe",
    "York",
    "Aston",
    "Barton",
    "Cavendish",
    "Dane",
    "Eaton",
    "Falcon",
    "Grafton",
    "Hadley",
    "Ingleby",
    "Jubilee",
    "Kingsley",
    "Lansdowne",
    "Marina",
    "Nelson",
    "Osborne",
    "Portland",
    "Quarry",
    "Regent",
    "Sherwood",
    "Trinity",
    "Uppingham",
    "Vale",
    "Waverley",
    "Yardley",
    "Zenith",
    "Arden",
    "Bracken",
    "Cromwell",
    "Dovedale",
    "Elms",
    "Fernleigh",
]

industry_labels = {
    "hotel": "Hotel",
    "restaurant": "Restaurant",
    "cafe": "Cafe",
    "pub": "Public House",
    "supermarket": "Supermarket",
    "retail": "Retail Park",
    "office": "Business Centre",
    "warehouse": "Distribution Hub",
    "care_home": "Care Home",
    "clinic": "Medical Centre",
    "school": "Academy",
    "nursery": "Nursery",
    "garage": "Motor Services",
    "engineering": "Engineering",
    "manufacturing": "Manufacturing",
    "residential": "Apartments",
}

industry_cycle = [
    "hotel",
    "restaurant",
    "cafe",
    "pub",
    "supermarket",
    "retail",
    "office",
    "warehouse",
    "care_home",
    "clinic",
    "school",
    "nursery",
    "garage",
    "engineering",
    "manufacturing",
    "residential",
]

service_profiles = {
    "hotel": [
        ("general", "1100L", 2, 3, ["monday", "wednesday", "friday"]),
        ("mixed_recycling", "1100L", 2, 3, ["tuesday", "thursday", "saturday"]),
        ("glass", "240L", 2, 2, ["tuesday", "friday"]),
        ("food", "240L", 2, 3, ["monday", "wednesday", "friday"]),
    ],
    "restaurant": [
        ("general", "660L", 1, 3, ["monday", "wednesday", "friday"]),
        ("mixed_recycling", "660L", 1, 2, ["tuesday", "friday"]),
        ("glass", "240L", 2, 2, ["tuesday", "saturday"]),
        ("food", "240L", 2, 4, ["monday", "wednesday", "friday", "saturday"]),
    ],
    "cafe": [
        ("general", "660L", 1, 2, ["tuesday", "friday"]),
        ("mixed_recycling", "660L", 1, 2, ["monday", "thursday"]),
        ("food", "240L", 1, 3, ["monday", "wednesday", "friday"]),
    ],
    "pub": [
        ("general", "660L", 1, 2, ["monday", "friday"]),
        ("mixed_recycling", "660L", 1, 1, ["wednesday"]),
        ("glass", "240L", 3, 3, ["monday", "wednesday", "friday"]),
        ("food", "240L", 1, 2, ["tuesday", "friday"]),
    ],
    "supermarket": [
        ("general", "1100L", 3, 4, ["monday", "wednesday", "friday", "saturday"]),
        ("mixed_recycling", "1100L", 3, 4, ["monday", "tuesday", "thursday", "saturday"]),
        ("food", "240L", 4, 5, ["monday", "tuesday", "wednesday", "friday", "saturday"]),
    ],
    "retail": [
        ("general", "1100L", 2, 2, ["tuesday", "friday"]),
        ("mixed_recycling", "1100L", 3, 3, ["monday", "wednesday", "friday"]),
    ],
    "office": [
        ("general", "660L", 1, 1, ["friday"]),
        ("mixed_recycling", "1100L", 2, 2, ["tuesday", "friday"]),
    ],
    "warehouse": [
        ("general", "1100L", 2, 2, ["monday", "thursday"]),
        ("mixed_recycling", "1100L", 3, 3, ["monday", "wednesday", "friday"]),
    ],
    "care_home": [
        ("general", "1100L", 2, 3, ["monday", "wednesday", "friday"]),
        ("mixed_recycling", "660L", 1, 1, ["thursday"]),
        ("food", "240L", 1, 2, ["tuesday", "friday"]),
    ],
    "clinic": [
        ("general", "660L", 1, 2, ["monday", "thursday"]),
        ("mixed_recycling", "660L", 1, 1, ["wednesday"]),
    ],
    "school": [
        ("general", "1100L", 2, 2, ["tuesday", "friday"]),
        ("mixed_recycling", "1100L", 2, 2, ["monday", "thursday"]),
        ("food", "240L", 2, 3, ["monday", "wednesday", "friday"]),
    ],
    "nursery": [
        ("general", "660L", 1, 2, ["tuesday", "friday"]),
        ("mixed_recycling", "660L", 1, 1, ["thursday"]),
    ],
    "garage": [
        ("general", "660L", 1, 1, ["wednesday"]),
        ("mixed_recycling", "660L", 1, 1, ["friday"]),
    ],
    "engineering": [
        ("general", "1100L", 1, 1, ["friday"]),
        ("mixed_recycling", "1100L", 2, 2, ["tuesday", "friday"]),
    ],
    "manufacturing": [
        ("general", "1100L", 2, 2, ["monday", "thursday"]),
        ("mixed_recycling", "1100L", 2, 3, ["monday", "wednesday", "friday"]),
    ],
    "residential": [
        ("general", "1100L", 2, 2, ["monday", "friday"]),
        ("mixed_recycling", "1100L", 2, 2, ["tuesday", "saturday"]),
    ],
}


with transaction.atomic():
    for model in models_to_clear:
        model.objects.all().delete()
    reset_sqlite_sequences(models_to_clear)

    for waste_type, sizes in price_rows.items():
        for bin_size, (lift, rental) in sizes.items():
            PriceBookItem.objects.create(
                waste_type=waste_type,
                bin_size=pricebook_bin_size(bin_size),
                price_per_lift=money(lift),
                rental_per_day=money(rental),
                active=True,
            )

    hauliers = []
    for name, email, phone, town in haulier_names:
        haulier = Haulier.objects.create(
            name=name,
            contact_name="Operations Desk",
            phone=phone,
            email=email,
            notes=f"Active preferred subcontract haulier for scheduled commercial collections around {town}.",
        )
        hauliers.append(haulier)
        for stream in ["general", "mixed_recycling", "glass", "food"]:
            sizes = ["240L"] if stream in {"glass", "food"} else ["660L", "1100L"]
            for size in sizes:
                HaulierRate.objects.create(
                    haulier=haulier,
                    waste_type=stream,
                    bin_size=pricebook_bin_size(size),
                    price_per_lift=money(random.uniform(9.50, 24.50)),
                    weight_limit_kg=random.choice([80, 120, 180, 240]),
                    excess_per_kg=money(random.uniform(0.12, 0.28)),
                    active=True,
                    notes="Commercial scheduled collection rate.",
                )

    staff_pool = pick_staff()
    container_batches = {}

    for index in range(100):
        industry = cycle_pick(industry_cycle, index)
        town, county, postcode_prefix = cycle_pick(towns, index)
        contact_first, contact_last = cycle_pick(contacts, index)
        business_name = f"{prefixes[index]} {industry_labels[industry]}"
        address_number = random.randint(4, 220)
        street = cycle_pick(streets, index + 3)
        postcode = f"{postcode_prefix} {random.randint(1, 9)}{random.choice(['AB', 'DE', 'FG', 'HK', 'LN', 'PQ', 'RS', 'TW'])}"
        account_manager = cycle_pick(staff_pool, index) if staff_pool else None
        email = f"accounts@{slugify(business_name)}.co.uk"
        phone = f"0{random.choice(['116', '121', '115', '1332', '1908', '161'])}{random.randint(100000, 999999)}"
        lead_stream_fields = {}
        for stream, bin_size, bin_count, frequency, _days in service_profiles[industry]:
            if stream == "general":
                prefix = "general_waste"
                price_type = "general"
            elif stream == "mixed_recycling":
                prefix = "recycling"
                price_type = "recycling"
            else:
                prefix = stream
                price_type = stream
            lead_stream_fields.update(
                {
                    f"{prefix}_required": True,
                    f"{prefix}_bin_count": bin_count,
                    f"{prefix}_bin_size": pricebook_bin_size(bin_size),
                    f"{prefix}_collections_per_week": frequency,
                    f"{prefix}_current_provider": "Local provider",
                    f"{prefix}_current_cost": money(
                        PriceBookItem.objects.get(
                            waste_type=price_type,
                            bin_size=pricebook_bin_size(bin_size),
                            active=True,
                        ).price_per_lift
                        * Decimal(bin_count)
                        * Decimal(frequency)
                        * Decimal("4.33")
                        * Decimal("1.10")
                    ),
                }
            )

        lead = Lead.objects.create(
            company_name=business_name,
            who_spoke_to=f"{contact_first} {contact_last}",
            contact_name=f"{contact_first} {contact_last}",
            phone=phone,
            email=email,
            status="won",
            lead_source=random.choice(["referral", "door", "website", "phone", "other"]),
            address_line_1=f"{address_number} {street}",
            town=town,
            county=county,
            postcode=postcode,
            follow_up_date=today - timedelta(days=random.randint(14, 90)),
            notes="Converted commercial lead with agreed ongoing collection service.",
            created_by=account_manager,
            **lead_stream_fields,
        )

        customer = Customer.objects.create(
            business_name=business_name,
            contact_name=f"{contact_first} {contact_last}",
            phone=phone,
            email=email,
            address_line_1=f"{address_number} {street}",
            town=town,
            county=county,
            postcode=postcode,
            status="active",
            account_manager=account_manager,
        )
        lead.converted_customer = customer
        lead.save(update_fields=["converted_customer"])

        site = Site.objects.create(
            customer=customer,
            site_name=f"{business_name} Main Site",
            address_line_1=f"{address_number} {street}",
            town=town,
            county=county,
            postcode=postcode,
        )

        if index % 5 == 0:
            alt_town, alt_county, alt_prefix = cycle_pick(towns, index + 7)
            Site.objects.create(
                customer=customer,
                site_name=f"{business_name} Secondary Site",
                address_line_1=f"{random.randint(8, 180)} {cycle_pick(streets, index + 8)}",
                town=alt_town,
                county=alt_county,
                postcode=f"{alt_prefix} {random.randint(1, 9)}{random.choice(['AX', 'BY', 'CZ', 'DW'])}",
            )

        quote = Quote.objects.create(
            lead=lead,
            customer=customer,
            site=site,
            quote_number=f"Q-2026-{index + 1:04d}",
            title=f"{business_name} Waste Services",
            contact_name=f"{contact_first} {contact_last}",
            email=email,
            address_line_1=site.address_line_1,
            town=site.town,
            county=site.county,
            postcode=site.postcode,
            status="accepted",
            valid_until=today + timedelta(days=random.randint(14, 90)),
        )

        for stream, bin_size, bin_count, frequency, days in service_profiles[industry]:
            price_type = "recycling" if stream == "mixed_recycling" else stream
            item = PriceBookItem.objects.get(waste_type=price_type, bin_size=pricebook_bin_size(bin_size), active=True)
            QuoteLine.objects.create(
                quote=quote,
                waste_type=stream,
                bin_size=pricebook_bin_size(bin_size),
                bin_count=bin_count,
                collections_per_week=frequency,
                price_per_lift=item.price_per_lift,
                rental_per_day=item.rental_per_day,
            )

        pack = SigningPack.objects.create(
            quote=quote,
            customer=customer,
            site=site,
            status="signed",
            signer_name=f"{contact_first} {contact_last}",
            signer_email=email,
            expires_at=timezone.now() + timedelta(days=60),
            signed_name=f"{contact_first} {contact_last}",
            signed_email=email,
            signed_at=timezone.now() - timedelta(days=random.randint(3, 90)),
            acceptance_terms=True,
            acceptance_authority=True,
            acceptance_documents=True,
            created_by=account_manager,
        )

        for doc_type, title in [
            ("service_agreement", "Service Agreement"),
            ("duty_of_care", "Duty of Care / Waste Transfer Note"),
            ("service_schedule", "Service Schedule"),
        ]:
            document = GeneratedDocument.objects.create(
                customer=customer,
                site=site,
                quote=quote,
                document_type=doc_type,
                title=title,
                status="signed",
            )
            pack.documents.add(document)

        for stream, bin_size, bin_count, frequency, days in service_profiles[industry]:
            haulier = cycle_pick(hauliers, index + len(stream))
            service = Service.objects.create(
                customer=customer,
                site=site,
                haulier=haulier,
                waste_type=stream,
                bin_size=pricebook_bin_size(bin_size),
                bin_count=bin_count,
                collections_per_week=frequency,
                collection_days=days,
                schedule_start_date=today - timedelta(days=random.randint(15, 120)),
                status="active",
                lock_required=random.random() < 0.12,
                metal_bin_required=(
                    random.random() < 0.08
                    and stream in {"general", "mixed_recycling"}
                    and pricebook_bin_size(bin_size) in {"660", "1100"}
                ),
                notes="Active contract service generated during onboarding.",
            )

            batch_key = (stream, bin_size)
            if batch_key not in container_batches:
                container_batches[batch_key] = ContainerBatch.objects.create(
                    waste_stream=stream,
                    bin_size=pricebook_bin_size(bin_size),
                    quantity=0,
                    supplier="Container supplier delivery",
                    delivery_date=today - timedelta(days=random.randint(8, 180)),
                    notes="Seeded live stock intake for current operational estate.",
                    created_by=account_manager.get_username() if account_manager else "",
                )
            batch = container_batches[batch_key]
            batch.quantity += bin_count
            batch.save(update_fields=["quantity"])

            for _ in range(bin_count):
                Container.objects.create(
                    batch=batch,
                    waste_stream=stream,
                    bin_size=pricebook_bin_size(bin_size),
                    status="active",
                    site=site,
                    service=service,
                    assigned_at=timezone.now() - timedelta(days=random.randint(7, 120)),
                    delivered_at=timezone.now() - timedelta(days=random.randint(7, 115)),
                    notes="Live customer container assigned to active service.",
                )

        CustomerNote.objects.create(
            customer=customer,
            created_by=account_manager.get_username() if account_manager else "",
            note=random.choice(
                [
                    "Customer prefers email confirmation after schedule changes.",
                    "Site contact asked for collections before lunch where possible.",
                    "Access clear during normal trading hours.",
                    "Account reviewed and service mix is currently suitable.",
                ]
            ),
        )
        CustomerActivity.objects.create(
            customer=customer,
            activity_type="service",
            title="Customer onboarded",
            description="Signed documents received and active services created.",
            created_by=account_manager.get_username() if account_manager else "",
            site=site,
        )

    generate_jobs_for_all_services(window_days=7, include_today=True)

    services = list(Service.objects.filter(status="active"))
    for service in services:
        for days_back in range(1, 15):
            target_date = today - timedelta(days=days_back)
            if not _date_matches_service(service, target_date):
                continue
            status = "failed" if random.random() < 0.045 else "collected"
            Job.objects.get_or_create(
                service=service,
                collection_date=target_date,
                defaults={
                    "customer": service.customer,
                    "site": service.site,
                    "haulier": service.haulier.name if service.haulier else "",
                    "waste_type": service.waste_type,
                    "bin_size": service.bin_size,
                    "bin_quantity": service.bin_count,
                    "status": status,
                    "status_updated_at": timezone.now() - timedelta(days=days_back),
                    "status_updated_by": "Haulier Portal",
                    "status_updated_source": "haulier_portal",
                    "notes": "Historic collection log generated for realistic reporting.",
                },
            )

    today_jobs = list(Job.objects.filter(collection_date=today, status="scheduled").order_by("id"))
    for job in today_jobs[: max(1, len(today_jobs) // 5)]:
        job.status = "collected"
        job.status_updated_at = timezone.now()
        job.status_updated_by = "Operations"
        job.save(update_fields=["status", "status_updated_at", "status_updated_by"])

    containers = list(Container.objects.filter(status="active").order_by("?")[:12])
    for container in containers:
        ContainerMaintenanceEvent.objects.create(
            container=container,
            status=random.choice(["open", "resolved", "in_progress"]),
            title=random.choice(["Wheel check", "Lid inspection", "Clean and label refresh", "Minor repair"]),
            notes="Routine container maintenance record.",
            reported_by=(cycle_pick(staff_pool, random.randint(0, len(staff_pool) - 1)).get_username() if staff_pool else ""),
        )


summary = {
    "customers": Customer.objects.count(),
    "sites": Site.objects.count(),
    "services": Service.objects.count(),
    "containers": Container.objects.count(),
    "jobs_total": Job.objects.count(),
    "jobs_next_7_days": Job.objects.filter(collection_date__gte=today, collection_date__lte=today + timedelta(days=7)).count(),
    "jobs_today": Job.objects.filter(collection_date=today).count(),
    "quotes": Quote.objects.count(),
    "signed_packs": SigningPack.objects.filter(status="signed").count(),
    "hauliers": Haulier.objects.count(),
    "pricebook_items": PriceBookItem.objects.count(),
}

print(summary)
