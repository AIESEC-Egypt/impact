from django.test import SimpleTestCase

from lms.video_embed import drive_preview_url, video_embed_url, youtube_embed_url, youtube_video_id


class VideoEmbedTests(SimpleTestCase):
    def test_watch_url(self):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share"
        self.assertEqual(youtube_video_id(url), "dQw4w9WgXcQ")
        self.assertIn("youtube.com/embed/dQw4w9WgXcQ", youtube_embed_url(url))

    def test_short_url(self):
        url = "https://youtu.be/dQw4w9WgXcQ"
        self.assertEqual(youtube_video_id(url), "dQw4w9WgXcQ")

    def test_shorts_url(self):
        url = "https://www.youtube.com/shorts/dQw4w9WgXcQ"
        self.assertEqual(youtube_video_id(url), "dQw4w9WgXcQ")

    def test_embed_url_passthrough_id(self):
        url = "https://www.youtube.com/embed/dQw4w9WgXcQ"
        self.assertEqual(youtube_video_id(url), "dQw4w9WgXcQ")

    def test_url_without_scheme(self):
        url = "www.youtube.com/watch?v=dQw4w9WgXcQ"
        self.assertEqual(youtube_video_id(url), "dQw4w9WgXcQ")

    def test_drive_preview(self):
        url = "https://drive.google.com/file/d/abc123XYZ/view?usp=sharing"
        self.assertEqual(
            drive_preview_url(url),
            "https://drive.google.com/file/d/abc123XYZ/preview",
        )

    def test_video_embed_url_youtube(self):
        self.assertIn(
            "youtube.com/embed/",
            video_embed_url("https://youtu.be/dQw4w9WgXcQ"),
        )

    def test_embed_includes_origin_when_provided(self):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        embed = youtube_embed_url(url, origin="http://127.0.0.1:8000")
        self.assertIn("origin=http://127.0.0.1:8000", embed)
