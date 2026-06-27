import mimetypes
import posixpath

from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils import timezone


class DatabaseFileStorage(Storage):
    """
    Small-project durable media storage.

    Render's filesystem is temporary, so staff uploads and generated PDFs cannot
    safely live on disk. This stores the file bytes in the hosted database until
    we move to object storage such as S3/R2.
    """

    def _normalise_name(self, name):
        return posixpath.normpath(str(name or "").replace("\\", "/")).lstrip("/")

    def get_available_name(self, name, max_length=None):
        name = self._normalise_name(name)
        if max_length and len(name) > max_length:
            name = name[:max_length]

        if not self.exists(name):
            return name

        directory, filename = posixpath.split(name)
        stem, dot, extension = filename.partition(".")
        counter = 1
        while True:
            suffix = f"_{counter}"
            candidate_name = f"{stem}{suffix}{dot}{extension}" if dot else f"{stem}{suffix}"
            candidate = posixpath.join(directory, candidate_name) if directory else candidate_name
            if max_length and len(candidate) > max_length:
                trim_by = len(candidate) - max_length
                trimmed_stem = stem[:-trim_by] if trim_by < len(stem) else stem[:1]
                candidate_name = f"{trimmed_stem}{suffix}{dot}{extension}" if dot else f"{trimmed_stem}{suffix}"
                candidate = posixpath.join(directory, candidate_name) if directory else candidate_name
            if not self.exists(candidate):
                return candidate
            counter += 1

    def _open(self, name, mode="rb"):
        from .models import StoredFile

        stored = StoredFile.objects.get(name=self._normalise_name(name))
        return ContentFile(bytes(stored.content), name=stored.name)

    def _save(self, name, content):
        from .models import StoredFile

        name = self._normalise_name(name)
        if hasattr(content, "seek"):
            content.seek(0)
        raw = content.read()
        if isinstance(raw, str):
            raw = raw.encode("utf-8")

        content_type = getattr(content, "content_type", "") or mimetypes.guess_type(name)[0] or "application/octet-stream"
        StoredFile.objects.update_or_create(
            name=name,
            defaults={
                "content": raw,
                "content_type": content_type,
                "size": len(raw),
            },
        )
        return name

    def delete(self, name):
        from .models import StoredFile

        StoredFile.objects.filter(name=self._normalise_name(name)).delete()

    def exists(self, name):
        from .models import StoredFile

        return StoredFile.objects.filter(name=self._normalise_name(name)).exists()

    def size(self, name):
        from .models import StoredFile

        stored = StoredFile.objects.get(name=self._normalise_name(name))
        return stored.size

    def url(self, name):
        return f"/media/{self._normalise_name(name)}"

    def get_created_time(self, name):
        from .models import StoredFile

        return StoredFile.objects.get(name=self._normalise_name(name)).created_at

    def get_modified_time(self, name):
        from .models import StoredFile

        return StoredFile.objects.get(name=self._normalise_name(name)).updated_at or timezone.now()
