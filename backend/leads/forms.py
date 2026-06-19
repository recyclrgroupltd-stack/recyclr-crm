from django import forms
from .models import Lead


class LeadAdminForm(forms.ModelForm):
    class Meta:
        model = Lead
        fields = "__all__"

    def clean(self):
        cleaned_data = super().clean()

        if cleaned_data.get("lead_source") == "other" and not cleaned_data.get("lead_source_other"):
            self.add_error("lead_source_other", "Please enter the other lead source.")

        return cleaned_data