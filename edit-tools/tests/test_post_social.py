"""Tests für post_social.py – ohne Netz, ohne composio, ohne curl.

  python3 -m unittest discover -s edit-tools/tests -v
"""
import contextlib
import datetime as dt
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import post_social as ps  # noqa: E402

FAKE_TOKEN = "tK3nXyZ9aBcDeF12345"
FAKE_UPLOAD_URL = "https://zernio.com" + "/upload/" + FAKE_TOKEN  # absichtlich zerlegt: keine echte Upload-URL im Quelltext
UPLOAD_LINK_RESULT = (
    "Upload link created.\n"
    f"URL: {FAKE_UPLOAD_URL}\n"
    f"Token: {FAKE_TOKEN}\n"
    "Valid for 1 hour."
)
ACCOUNTS_RESULT = (
    "Found 3 connected account(s):\n\n"
    "- tiktok: Beispielkonto (ID: acc_tt_0001)\n"
    "- youtube: Beispiel Kanal (Test) (ID: acc_yt_0002)\n"
    "- instagram: bsp_konto (ID: acc_ig_0003)"
)
CAPTION_TEXT = "Erste Zeile mit Umlauten äöü und Emoji 🚀\n\nZweite Absatzzeile\n#eins #zwei"


def write(dirname, name, content):
    p = Path(dirname) / name
    p.write_bytes(content if isinstance(content, bytes) else content.encode("utf-8"))
    return p


class TokenTests(unittest.TestCase):
    def test_token_from_token_line(self):
        self.assertEqual(ps.extract_token(UPLOAD_LINK_RESULT), FAKE_TOKEN)

    def test_token_from_url_only(self):
        self.assertEqual(ps.extract_token(f"Open {FAKE_UPLOAD_URL} to upload"), FAKE_TOKEN)

    def test_token_missing_raises_and_does_not_echo_url_token(self):
        with self.assertRaises(ps.PostError) as cm:
            ps.extract_token("Kein Link hier")
        self.assertNotIn(FAKE_TOKEN, str(cm.exception))

    def test_mask_token_shows_no_character(self):
        shown = ps.mask_token(FAKE_TOKEN)
        for chunk in (FAKE_TOKEN[:3], FAKE_TOKEN[-3:]):
            self.assertNotIn(chunk, shown)

    def test_mask_text_removes_token_in_all_forms(self):
        text = (f"Fehler bei {FAKE_UPLOAD_URL} und https://x.example/api/v1/media/upload/presign?token={FAKE_TOKEN}\n"
                f"Token: {FAKE_TOKEN}\nSignierte URL https://s.example/f?X-Amz-Signature=abcdef123456&b=1")
        masked = ps.mask_text(text)
        self.assertNotIn(FAKE_TOKEN, masked)
        self.assertNotIn("abcdef123456", masked)
        self.assertIn("/upload/presign", masked)  # der Pfad bleibt lesbar

    def test_mask_text_removes_explicit_secrets(self):
        self.assertNotIn("geheimerWert99", ps.mask_text("Antwort: geheimerWert99 kam zurück", ["geheimerWert99"]))


class ParsingTests(unittest.TestCase):
    def test_json_after_tip_line(self):
        out = 'Tip: nutze -d \'{ a: 1 }\' für Argumente\n{\n  "successful": true,\n  "data": {"result": "ok"}\n}\n'
        self.assertEqual(ps.parse_json_output(out)["data"]["result"], "ok")

    def test_no_json_raises(self):
        with self.assertRaises(ps.PostError):
            ps.parse_json_output("nur Text")

    def test_accounts_list(self):
        accounts = ps.parse_accounts(ACCOUNTS_RESULT)
        self.assertEqual([a["platform"] for a in accounts], ["tiktok", "youtube", "instagram"])
        self.assertEqual(accounts[0], {"platform": "tiktok", "name": "Beispielkonto", "id": "acc_tt_0001"})
        self.assertEqual(accounts[1]["name"], "Beispiel Kanal (Test)")  # Klammern im Namen
        self.assertEqual(ps.parse_accounts("No accounts connected. Connect accounts at https://zernio.com"), [])

    def test_publish_result(self):
        res = ps.parse_post_result("✅ Published to tiktok (@beispiel)\nPost ID: 6f1a2b3c4d5e\nURL: pending")
        self.assertEqual(res, {"kind": "published", "platform": "tiktok", "handle": "@beispiel", "post_id": "6f1a2b3c4d5e"})

    def test_draft_and_scheduled_results(self):
        self.assertEqual(ps.parse_post_result("Saved as draft.\nPost ID: abc123")["kind"], "draft")
        self.assertEqual(ps.parse_post_result("Scheduled for 14:00.\nPost ID: abc123")["kind"], "scheduled")

    def test_result_without_post_id_is_error(self):
        with self.assertRaises(ps.PostError):
            ps.parse_post_result("❌ Failed to publish: account expired")

    def test_status(self):
        self.assertEqual(ps.parse_status("Post abc\nStatus: Published\nPlatform: tiktok"), "published")
        self.assertIsNone(ps.parse_status("keine Angabe"))


class CaptionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def test_trailing_newlines_removed_inner_kept(self):
        p = write(self.tmp.name, "c.txt", CAPTION_TEXT + "\n\n\n")
        self.assertEqual(ps.load_caption(p), CAPTION_TEXT)

    def test_crlf_and_bom(self):
        p = write(self.tmp.name, "c.txt", b"\xef\xbb\xbfZeile eins\r\n\r\nZeile drei\r\n")
        self.assertEqual(ps.load_caption(p), "Zeile eins\n\nZeile drei")

    def test_empty_missing_and_non_utf8(self):
        for content in ("", "  \n\n"):
            with self.assertRaises(ps.PostError):
                ps.load_caption(write(self.tmp.name, "leer.txt", content))
        with self.assertRaises(ps.PostError):
            ps.load_caption(Path(self.tmp.name) / "gibt-es-nicht.txt")
        with self.assertRaises(ps.PostError):
            ps.load_caption(write(self.tmp.name, "latin.txt", "Grüße".encode("latin-1")))

    def test_hashtag_count(self):
        self.assertEqual(ps.count_hashtags("#a #b #c"), 3)
        self.assertEqual(ps.count_hashtags("kein Hashtag, Nr. #1 und &#39; und https://x.example/seite#anker"), 0)
        self.assertEqual(ps.count_hashtags("#größe #tag_2 mitten#im Wort"), 2)

    def test_hashtag_warnings_both_platforms(self):
        six = "Text " + " ".join(f"#t{i}" for i in range(6))
        five = "Text " + " ".join(f"#t{i}" for i in range(5))
        for platform in ("instagram", "tiktok"):
            self.assertTrue(any("6 Hashtags" in w for w in ps.caption_warnings(platform, six)), platform)
            self.assertEqual(ps.caption_warnings(platform, five), [])

    def test_percent23_warning(self):
        self.assertTrue(any("%23" in w for w in ps.caption_warnings("instagram", "Text %23tag")))


class BuilderTests(unittest.TestCase):
    URL = "https://media.example/video.mp4"

    def test_tiktok_draft_has_exactly_is_draft(self):
        args = ps.build_tiktok_args("acc_tt_0001", CAPTION_TEXT, self.URL, publish=False)
        self.assertEqual(args["is_draft"], True)
        self.assertNotIn("publish_now", args)
        self.assertEqual(ps.ensure_one_mode(args), "is_draft")

    def test_tiktok_publish_has_exactly_publish_now(self):
        args = ps.build_tiktok_args("acc_tt_0001", CAPTION_TEXT, self.URL, publish=True)
        self.assertEqual(args["publish_now"], True)
        self.assertNotIn("is_draft", args)
        self.assertEqual(ps.ensure_one_mode(args), "publish_now")

    def test_ensure_one_mode_rejects_none_both_and_false(self):
        base = {"platform": "tiktok"}
        for bad in (base, dict(base, is_draft=True, publish_now=True), dict(base, is_draft=False),
                    dict(base, is_draft=True, publish_now=False)):
            with self.assertRaises(ps.PostError, msg=str(bad)):
                ps.ensure_one_mode(bad)

    def test_captions_are_raw_not_encoded(self):
        tt = ps.build_tiktok_args("a", CAPTION_TEXT, self.URL, False)
        ig = ps.build_instagram_container_args("1784", self.URL, CAPTION_TEXT)
        for args in (tt, ig):
            field = args["content"] if "content" in args else args["caption"]
            self.assertEqual(field, CAPTION_TEXT)
            self.assertIn("#eins", field)
            self.assertIn("\n\n", field)
            self.assertNotIn("%23", field)
            self.assertNotIn("%0A", field)
            # auch nach dem Serialisieren für composio bleibt es dieselbe Zeichenfolge
            self.assertEqual(json.loads(json.dumps(args, ensure_ascii=False))[("content" if "content" in args else "caption")], CAPTION_TEXT)

    def test_instagram_container(self):
        args = ps.build_instagram_container_args("1784", self.URL, "Text", thumb_ms=1500)
        self.assertEqual(args, {"ig_user_id": "1784", "media_type": "REELS", "video_url": self.URL, "caption": "Text",
                                "share_to_feed": True, "thumb_offset": 1500})
        self.assertNotIn("thumb_offset", ps.build_instagram_container_args("1784", self.URL, "Text"))
        self.assertIs(ps.build_instagram_container_args("1784", self.URL, "Text", share_to_feed=False)["share_to_feed"], False)

    def test_caption_comparison(self):
        self.assertTrue(ps.captions_equal(CAPTION_TEXT, CAPTION_TEXT))
        self.assertFalse(ps.captions_equal("#tag", "%23tag"))
        self.assertFalse(ps.captions_equal("a\nb", "a b"))
        self.assertFalse(ps.captions_equal("a", None))
        self.assertIn("erste Abweichung bei Zeichen 0", ps.describe_diff("#tag", "%23tag"))


class SmallHelperTests(unittest.TestCase):
    def test_curl_config_keeps_values_out_of_argv_and_is_escaped(self):
        cfg = ps.build_curl_config("https://x.example/p?token=abc", ["Content-Type: application/json"],
                                   data='{"a": "b\\"c"}', timeout=30)
        self.assertIn('url = "https://x.example/p?token=abc"', cfg)
        self.assertIn('data-raw = "{\\"a\\": \\"b\\\\\\"c\\"}"', cfg)
        self.assertIn('write-out = "\\n%{http_code}"', cfg)
        self.assertNotIn("\n\n", cfg.rstrip("\n"))  # keine unmaskierten Zeilenumbrüche mitten im Wert

    def test_content_length_takes_last_block(self):
        self.assertEqual(parse_cl("HTTP/1.1 301\r\nContent-Length: 0\r\n\r\nHTTP/2 200\r\ncontent-length: 1285302\r\n\r\n"), 1285302)
        self.assertIsNone(parse_cl("HTTP/2 200\r\nx: y\r\n"))

    def test_sidecar_freshness(self):
        with tempfile.TemporaryDirectory() as d:
            video = write(d, "v.mp4", b"x" * 100)
            self.assertIsNone(ps.read_fresh_upload(video))
            t0 = dt.datetime(2026, 10, 8, 12, 0, tzinfo=dt.timezone.utc)
            sidecar = ps.write_sidecar(video, "https://media.example/v.mp4", now=t0)
            self.assertEqual(sidecar.name, "v.mp4.upload.json")
            self.assertEqual(ps.read_fresh_upload(video, now=t0 + dt.timedelta(minutes=44)), "https://media.example/v.mp4")
            self.assertIsNone(ps.read_fresh_upload(video, now=t0 + dt.timedelta(minutes=46)))
            video.write_bytes(b"y" * 101)  # Datei geändert → alte URL gilt nicht mehr
            self.assertIsNone(ps.read_fresh_upload(video, now=t0 + dt.timedelta(minutes=1)))

    def test_config_loading(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(ps.load_config(Path(d) / "fehlt.json"), {})
            cfg = ps.load_config(write(d, "c.json", json.dumps({"tiktok_account_id": " x ", "instagram_user_id": ""})))
            self.assertEqual(cfg, {"tiktok_account_id": "x"})
            with self.assertRaises(ps.PostError):
                ps.need(cfg, "instagram_user_id", Path(d) / "c.json")
            with self.assertRaises(ps.PostError):
                ps.load_config(write(d, "kaputt.json", "{nope"))

    def test_global_flags_before_and_after_command(self):
        for argv in (["--dry-run", "tiktok", "v.mp4", "--caption-file", "c.txt"],
                     ["tiktok", "v.mp4", "--caption-file", "c.txt", "--dry-run"]):
            a = ps.parse_args(argv)
            self.assertTrue(a.dry_run, argv)
            self.assertFalse(a.publish)
        a = ps.parse_args(["accounts"])
        self.assertFalse(a.dry_run)
        self.assertIsNone(a.config)


def parse_cl(text):
    return ps.parse_content_length(text)


class CommandFlowTests(unittest.TestCase):
    """Befehle von außen, composio und Upload ersetzt: prüft, was tatsächlich gesendet wird."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        d = self.tmp.name
        self.video = write(d, "v.mp4", b"x" * 64)
        self.caption = write(d, "c.txt", CAPTION_TEXT + "\n")
        self.config = write(d, "post.config.json", json.dumps({
            "tiktok_account_id": "acc_tt_0001", "instagram_user_id": "1784", "composio_account_zernio": "z_conn"}))
        self.calls = []
        self.responses = {}
        for target, value in (("run_composio", self.fake_composio), ("obtain_url", lambda ctx, v, force_new=False, dry_run=False:
                                                                      ps.PLACEHOLDER_URL if dry_run else "https://media.example/v.mp4"),
                              ("time", mock.Mock(sleep=lambda s: None, time=lambda: 0))):
            patcher = mock.patch.object(ps, target, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def fake_composio(self, slug, args, account=None, dry_run=False, timeout=300):
        self.calls.append((slug, args, account, dry_run))
        if dry_run:
            return {"successful": True, "dryRun": True, "slug": slug, "arguments": args, "userId": "geheim"}
        response = self.responses[slug]
        return response(args) if callable(response) else response

    def run_main(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = ps.main(list(argv) + ["--config", str(self.config)])
        return code, out.getvalue(), err.getvalue()

    def log_lines(self):
        p = Path(self.tmp.name) / "post-log.jsonl"
        return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines()] if p.exists() else []

    def tiktok_args(self):
        return [c[1] for c in self.calls if c[0] == "ZERNIO_MCP_POSTS_CREATE"]

    def test_tiktok_default_is_a_draft(self):
        self.responses["ZERNIO_MCP_POSTS_CREATE"] = {"successful": True, "data": {"result": "Saved as draft.\nPost ID: p1"}}
        self.responses["ZERNIO_MCP_POSTS_GET"] = {"successful": True, "data": {"result": "Post p1\nStatus: draft"}}
        code, out, _ = self.run_main("tiktok", str(self.video), "--caption-file", str(self.caption))
        self.assertEqual(code, 0, out)
        (sent,) = self.tiktok_args()
        self.assertEqual(ps.ensure_one_mode(sent), "is_draft")
        self.assertEqual(sent["content"], CAPTION_TEXT)
        self.assertIn("Veröffentlicht ist NICHTS", out)
        self.assertEqual(self.log_lines()[0]["aktion"], "tiktok_entwurf")

    def test_tiktok_unreadable_create_result_is_logged_as_unclear(self):
        self.responses["ZERNIO_MCP_POSTS_CREATE"] = {"successful": True, "data": {"result": "Irgendetwas ohne Kennung"}}
        code, _, err = self.run_main("tiktok", str(self.video), "--caption-file", str(self.caption), "--publish")
        self.assertEqual(code, 1)
        self.assertIn("NICHT erneut ausführen", err)
        self.assertEqual(self.log_lines()[0]["status"], "unklar")

    def test_tiktok_draft_that_turns_out_scheduled_fails(self):
        self.responses["ZERNIO_MCP_POSTS_CREATE"] = {"successful": True, "data": {"result": "ok\nPost ID: p1"}}
        self.responses["ZERNIO_MCP_POSTS_GET"] = {"successful": True, "data": {"result": "Status: scheduled"}}
        code, _, err = self.run_main("tiktok", str(self.video), "--caption-file", str(self.caption))
        self.assertEqual(code, 1)
        self.assertIn("ACHTUNG", err)

    def test_tiktok_dry_run_only_previews(self):
        code, out, _ = self.run_main("tiktok", str(self.video), "--caption-file", str(self.caption), "--dry-run", "--publish")
        self.assertEqual(code, 0)
        self.assertEqual([(c[0], c[3]) for c in self.calls], [("ZERNIO_MCP_POSTS_CREATE", True)])
        self.assertEqual(ps.ensure_one_mode(self.tiktok_args()[0]), "publish_now")
        self.assertNotIn("geheim", out)  # userId aus der composio-Vorschau wird nicht angezeigt
        self.assertEqual(self.log_lines(), [])

    def test_tiktok_publish(self):
        self.responses["ZERNIO_MCP_POSTS_CREATE"] = {"successful": True, "data": {"result": "✅ Published to tiktok (@b)\nPost ID: p9"}}
        self.responses["ZERNIO_MCP_POSTS_GET"] = {"successful": True, "data": {"result": "Status: published"}}
        code, out, _ = self.run_main("tiktok", str(self.video), "--caption-file", str(self.caption), "--publish")
        self.assertEqual(code, 0, out)
        self.assertEqual(ps.ensure_one_mode(self.tiktok_args()[0]), "publish_now")
        self.assertIn("p9", out)
        self.assertEqual(self.log_lines()[0]["post_id"], "p9")
        self.assertEqual(self.calls[0][2], "z_conn")  # Verbindungsauswahl aus der Konfiguration wird durchgereicht

    def test_instagram_without_publish_creates_nothing(self):
        code, out, _ = self.run_main("instagram", str(self.video), "--caption-file", str(self.caption), "--thumb-ms", "800")
        self.assertEqual(code, 0, out)
        self.assertTrue(self.calls and all(c[3] for c in self.calls), "alle Aufrufe müssen --dry-run sein")
        self.assertEqual(self.calls[0][1]["caption"], CAPTION_TEXT)
        self.assertEqual(self.calls[0][1]["thumb_offset"], 800)
        self.assertEqual(self.log_lines(), [])

    def _instagram_publish_responses(self, returned_caption):
        polls = iter(["IN_PROGRESS", "FINISHED"])
        self.responses.update({
            "INSTAGRAM_POST_IG_USER_MEDIA": {"successful": True, "data": {"id": "c100"}},
            "INSTAGRAM_GET_POST_STATUS": lambda args: {"successful": True, "data": {"status_code": next(polls)}},
            "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH": {"successful": True, "data": {"id": "m200"}},
            "INSTAGRAM_GET_IG_MEDIA": {"successful": True, "data": {
                "id": "m200", "caption": returned_caption, "permalink": "https://www.instagram.com/reel/XYZ/",
                "media_product_type": "REELS", "timestamp": "2026-10-08T12:00:00+0000"}},
        })

    def test_instagram_publish_ok(self):
        self._instagram_publish_responses(CAPTION_TEXT)
        code, out, _ = self.run_main("instagram", str(self.video), "--caption-file", str(self.caption), "--publish")
        self.assertEqual(code, 0, out)
        self.assertEqual([c[0] for c in self.calls], ["INSTAGRAM_POST_IG_USER_MEDIA", "INSTAGRAM_GET_POST_STATUS",
                                                      "INSTAGRAM_GET_POST_STATUS", "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
                                                      "INSTAGRAM_GET_IG_MEDIA"])
        self.assertEqual(self.calls[0][1]["caption"], CAPTION_TEXT)
        self.assertIn("https://www.instagram.com/reel/XYZ/", out)
        entry = self.log_lines()[-1]
        self.assertEqual((entry["media_id"], entry["beschreibung_gleich"]), ("m200", True))

    def test_instagram_publish_caption_mismatch_exits_nonzero(self):
        self._instagram_publish_responses(CAPTION_TEXT.replace("#", "%23"))
        code, _, err = self.run_main("instagram", str(self.video), "--caption-file", str(self.caption), "--publish")
        self.assertEqual(code, 1)
        self.assertIn("weicht von der Datei ab", err)
        self.assertIs(self.log_lines()[-1]["beschreibung_gleich"], False)

    def test_instagram_container_error_publishes_nothing(self):
        self.responses.update({
            "INSTAGRAM_POST_IG_USER_MEDIA": {"successful": True, "data": {"id": "c100"}},
            "INSTAGRAM_GET_POST_STATUS": {"successful": True, "data": {"status_code": "ERROR", "status": "Videoformat"}},
        })
        code, _, err = self.run_main("instagram", str(self.video), "--caption-file", str(self.caption), "--publish")
        self.assertEqual(code, 1)
        self.assertNotIn("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", [c[0] for c in self.calls])
        self.assertIn("nichts veröffentlicht", err)

    def test_instagram_refuses_percent23_when_publishing(self):
        write(self.tmp.name, "c.txt", "Text %23tag\n")
        code, _, err = self.run_main("instagram", str(self.video), "--caption-file", str(self.caption), "--publish")
        self.assertEqual(code, 1)
        self.assertIn("%23", err)
        self.assertEqual(self.calls, [])

    def test_missing_config_value_is_clear(self):
        self.config.write_text("{}", encoding="utf-8")
        code, _, err = self.run_main("tiktok", str(self.video), "--caption-file", str(self.caption))
        self.assertEqual(code, 1)
        self.assertIn("tiktok_account_id", err)
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
