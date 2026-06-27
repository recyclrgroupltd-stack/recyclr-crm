import mimetypes

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.storage.filesystem import FileSystemStorage
from django.http import FileResponse, Http404


def serve_media_file(request, path):
    if not path or ".." in path.split("/"):
        raise Http404("File not found.")

    storage = default_storage
    if not storage.exists(path):
        disk_storage = FileSystemStorage(location=settings.MEDIA_ROOT)
        if not disk_storage.exists(path):
            raise Http404("File not found.")
        storage = disk_storage

    content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return FileResponse(storage.open(path, "rb"), content_type=content_type)
