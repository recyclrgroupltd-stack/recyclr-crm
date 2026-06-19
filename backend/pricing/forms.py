from django import forms
from .models import PriceBookItem


class PriceBookItemAdminForm(forms.ModelForm):
    class Meta:
        model = PriceBookItem
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        waste_type = None

        if self.data.get("waste_type"):
            waste_type = self.data.get("waste_type")
        elif self.instance and self.instance.pk:
            waste_type = self.instance.waste_type

        if waste_type in {"glass", "food"}:
            self.fields["bin_size"].choices = [("240", "240L")]