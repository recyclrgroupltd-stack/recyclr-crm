document.addEventListener("DOMContentLoaded", function () {
    const leadSource = document.getElementById("id_lead_source");
    const leadSourceOtherField = document.getElementById("id_lead_source_other");

    function getRow(field) {
        if (!field) return null;
        return field.closest(".form-row") || field.closest(".fieldBox") || field.parentElement;
    }

    const leadSourceOtherRow = getRow(leadSourceOtherField);

    const wasteSections = [
        {
            checkbox: "id_general_waste_required",
            fields: [
                "id_general_waste_bin_count",
                "id_general_waste_bin_size",
                "id_general_waste_collections_per_week",
                "id_general_waste_lock_required",
                "id_general_waste_metal_bin_required",
                "id_general_waste_current_provider",
                "id_general_waste_current_cost",
                "id_general_waste_contract_end_date",
                "id_general_waste_is_broker"
            ]
        },
        {
            checkbox: "id_recycling_required",
            fields: [
                "id_recycling_bin_count",
                "id_recycling_bin_size",
                "id_recycling_collections_per_week",
                "id_recycling_lock_required",
                "id_recycling_metal_bin_required",
                "id_recycling_current_provider",
                "id_recycling_current_cost",
                "id_recycling_contract_end_date",
                "id_recycling_is_broker"
            ]
        },
        {
            checkbox: "id_glass_required",
            fields: [
                "id_glass_bin_count",
                "id_glass_bin_size",
                "id_glass_collections_per_week",
                "id_glass_lock_required",
                "id_glass_metal_bin_required",
                "id_glass_current_provider",
                "id_glass_current_cost",
                "id_glass_contract_end_date",
                "id_glass_is_broker"
            ]
        },
        {
            checkbox: "id_food_required",
            fields: [
                "id_food_bin_count",
                "id_food_bin_size",
                "id_food_collections_per_week",
                "id_food_lock_required",
                "id_food_metal_bin_required",
                "id_food_current_provider",
                "id_food_current_cost",
                "id_food_contract_end_date",
                "id_food_is_broker"
            ]
        }
    ];

    function toggleLeadSourceOther() {
        if (!leadSource || !leadSourceOtherRow) return;

        if (leadSource.value === "other") {
            leadSourceOtherRow.style.display = "";
        } else {
            leadSourceOtherRow.style.display = "none";
            if (leadSourceOtherField) {
                leadSourceOtherField.value = "";
            }
        }
    }

    function toggleWasteSection(section) {
        const checkbox = document.getElementById(section.checkbox);
        if (!checkbox) return;

        const enabled = checkbox.checked;

        section.fields.forEach(function (fieldId) {
            const field = document.getElementById(fieldId);
            if (!field) return;

            field.disabled = !enabled;

            if (!enabled) {
                field.style.backgroundColor = "#2f2f2f";
                field.style.opacity = "0.6";
            } else {
                field.style.backgroundColor = "";
                field.style.opacity = "1";
            }
        });
    }

    if (leadSource) {
        leadSource.addEventListener("change", toggleLeadSourceOther);
        toggleLeadSourceOther();
    }

    wasteSections.forEach(function (section) {
        const checkbox = document.getElementById(section.checkbox);
        if (!checkbox) return;

        checkbox.addEventListener("change", function () {
            toggleWasteSection(section);
        });

        toggleWasteSection(section);
    });
});