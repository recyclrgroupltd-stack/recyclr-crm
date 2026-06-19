document.addEventListener("DOMContentLoaded", function () {
    const customerField = document.getElementById("id_customer");
    const siteField = document.getElementById("id_site");
    const wasteTypeField = document.getElementById("id_waste_type");
    const binSizeField = document.getElementById("id_bin_size");
    const binCountField = document.getElementById("id_bin_count");
    const collectionsField = document.getElementById("id_collections_per_week");
    const metalBinField = document.getElementById("id_metal_bin_required");

    if (!customerField || !siteField || !wasteTypeField || !binSizeField || !binCountField || !collectionsField || !metalBinField) {
        return;
    }

    const priceScriptTag = document.getElementById("service-price-map");
    const siteScriptTag = document.getElementById("service-site-map");

    let priceMap = {};
    let siteMap = {};

    if (priceScriptTag) {
        try {
            priceMap = JSON.parse(priceScriptTag.textContent);
        } catch (error) {
            console.error("Could not parse service-price-map JSON", error);
        }
    }

    if (siteScriptTag) {
        try {
            siteMap = JSON.parse(siteScriptTag.textContent);
        } catch (error) {
            console.error("Could not parse service-site-map JSON", error);
        }
    }

    const originalBinOptions = Array.from(binSizeField.options).map(option => ({
        value: option.value,
        text: option.text,
    }));

    function setReadonlyValue(fieldName, value) {
        const row = document.querySelector(".field-" + fieldName);
        if (!row) return;

        const readonlyEl = row.querySelector(".readonly");
        if (readonlyEl) {
            readonlyEl.textContent = Number(value).toFixed(2);
        }
    }

    function filterSites() {
        const customerId = customerField.value;
        const currentSite = siteField.value;

        siteField.innerHTML = "";

        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.text = "---------";
        siteField.appendChild(emptyOption);

        if (!customerId || !siteMap[customerId]) {
            siteField.value = "";
            return;
        }

        siteMap[customerId].forEach(site => {
            const option = document.createElement("option");
            option.value = site.id;
            option.text = site.name;
            siteField.appendChild(option);
        });

        const stillExists = siteMap[customerId].some(site => String(site.id) === String(currentSite));
        if (stillExists) {
            siteField.value = currentSite;
        } else {
            siteField.value = "";
        }
    }

    function filterBinSizes() {
        const waste = wasteTypeField.value;
        const currentValue = binSizeField.value;

        binSizeField.innerHTML = "";

        let allowedOptions = originalBinOptions;

        if (waste === "food" || waste === "glass") {
            allowedOptions = originalBinOptions.filter(option => option.value === "240");
        }

        allowedOptions.forEach(option => {
            const newOption = document.createElement("option");
            newOption.value = option.value;
            newOption.text = option.text;
            binSizeField.appendChild(newOption);
        });

        const stillExists = allowedOptions.some(option => option.value === currentValue);
        if (stillExists) {
            binSizeField.value = currentValue;
        } else if (allowedOptions.length > 0) {
            binSizeField.value = allowedOptions[0].value;
        }
    }

    function handleMetalBins() {
        const waste = wasteTypeField.value;
        const size = binSizeField.value;

        const allowedWaste = waste === "general" || waste === "mixed_recycling";
        const allowedSize = size === "660" || size === "1100";

        const row = document.querySelector(".field-metal_bin_required");

        if (allowedWaste && allowedSize) {
            metalBinField.disabled = false;
            if (row) {
                row.style.display = "";
            }
        } else {
            metalBinField.checked = false;
            metalBinField.disabled = true;
            if (row) {
                row.style.display = "none";
            }
        }
    }

    function calculate() {
        const waste = wasteTypeField.value;
        const size = binSizeField.value;
        const bins = parseInt(binCountField.value || "0", 10);
        const collections = parseInt(collectionsField.value || "0", 10);

        const key = `${waste}|${size}`;
        const price = parseFloat(priceMap[key] || "0");
        const monthly = price * bins * collections * 4.33;

        setReadonlyValue("price_per_lift", price);
        setReadonlyValue("monthly_value", monthly);
    }

    customerField.addEventListener("change", filterSites);

    wasteTypeField.addEventListener("change", function () {
        filterBinSizes();
        handleMetalBins();
        calculate();
    });

    binSizeField.addEventListener("change", function () {
        handleMetalBins();
        calculate();
    });

    binCountField.addEventListener("input", calculate);
    binCountField.addEventListener("change", calculate);
    collectionsField.addEventListener("input", calculate);
    collectionsField.addEventListener("change", calculate);

    filterSites();
    filterBinSizes();
    handleMetalBins();
    calculate();
});