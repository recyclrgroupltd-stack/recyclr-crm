document.addEventListener("DOMContentLoaded", function () {
    const wasteTypeField = document.getElementById("id_waste_type");
    const binSizeField = document.getElementById("id_bin_size");

    if (!wasteTypeField || !binSizeField) {
        return;
    }

    const allOptions = Array.from(binSizeField.options).map(option => ({
        value: option.value,
        text: option.text
    }));

    function setBinOptions() {
        const wasteType = wasteTypeField.value;
        const currentValue = binSizeField.value;

        binSizeField.innerHTML = "";

        let allowedOptions = allOptions;

        if (wasteType === "glass" || wasteType === "food") {
            allowedOptions = allOptions.filter(option => option.value === "" || option.value === "240");
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
        } else {
            binSizeField.value = "";
        }
    }

    wasteTypeField.addEventListener("change", setBinOptions);
    setBinOptions();
});