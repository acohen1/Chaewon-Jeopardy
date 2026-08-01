"""Play-time cell state (used flags) + board settings."""
from __future__ import annotations


def test_set_cell_used_true_then_false(client, board):
    bid = board["id"]
    r = client.put(f"/api/boards/{bid}/cells/1/2/used", json={"used": True})
    assert r.status_code == 200
    assert r.json()["cells"][1][2]["used"] is True
    # Only that cell changed.
    flat = [
        (ri, ci, c["used"])
        for ri, row in enumerate(r.json()["cells"])
        for ci, c in enumerate(row)
        if c["used"]
    ]
    assert flat == [(1, 2, True)]

    r = client.put(f"/api/boards/{bid}/cells/1/2/used", json={"used": False})
    assert r.status_code == 200
    assert r.json()["cells"][1][2]["used"] is False


def test_set_cell_used_out_of_range_404(client, board):
    bid = board["id"]
    assert client.put(f"/api/boards/{bid}/cells/5/0/used", json={"used": True}).status_code == 404
    assert client.put(f"/api/boards/{bid}/cells/0/6/used", json={"used": True}).status_code == 404
    assert client.put(f"/api/boards/{bid}/cells/-1/0/used", json={"used": True}).status_code == 404
    assert client.put(f"/api/boards/{bid}/cells/99/99/used", json={"used": True}).status_code == 404


def test_reset_used_clears_all(client, board):
    bid = board["id"]
    for row, col in ((0, 0), (2, 3), (4, 5)):
        client.put(f"/api/boards/{bid}/cells/{row}/{col}/used", json={"used": True})
    r = client.post(f"/api/boards/{bid}/cells/reset-used")
    assert r.status_code == 200
    assert all(not c["used"] for row in r.json()["cells"] for c in row)
    # Persisted.
    fetched = client.get(f"/api/boards/{bid}").json()
    assert all(not c["used"] for row in fetched["cells"] for c in row)


def test_settings_allow_negatives(client, board):
    bid = board["id"]
    assert board["allow_negatives"] is True
    r = client.put(f"/api/boards/{bid}/settings", json={"allow_negatives": False})
    assert r.status_code == 200
    assert r.json()["allow_negatives"] is False
    assert client.get(f"/api/boards/{bid}").json()["allow_negatives"] is False
    r = client.put(f"/api/boards/{bid}/settings", json={"allow_negatives": True})
    assert r.json()["allow_negatives"] is True


# ------------------------------------------------------------------ #
#  Game settings: buzzer pacing + media autoplay                     #
# ------------------------------------------------------------------ #
def test_settings_defaults(client, board):
    """Fresh board (no app defaults saved): auto-arm on, answer clock 10s,
    buzz-in window off, autoplay on."""
    assert board["auto_arm_buzzers"] is True
    assert board["buzz_timer_seconds"] == 0
    assert board["answer_timer_seconds"] == 10
    assert board["autoplay_media"] is True


def test_settings_partial_put_leaves_others_alone(client, board):
    bid = board["id"]
    r = client.put(
        f"/api/boards/{bid}/settings",
        json={"buzz_timer_seconds": 15, "auto_arm_buzzers": False},
    )
    assert r.status_code == 200
    b = r.json()
    assert b["buzz_timer_seconds"] == 15
    assert b["auto_arm_buzzers"] is False
    # Untouched settings keep their values.
    assert b["answer_timer_seconds"] == 10
    assert b["autoplay_media"] is True
    assert b["turn_mode"] == "first-correct"

    r = client.put(f"/api/boards/{bid}/settings", json={"answer_timer_seconds": 0})
    b = r.json()
    assert b["answer_timer_seconds"] == 0  # 0 = off is a valid stored value
    assert b["buzz_timer_seconds"] == 15


def test_settings_timer_validation_422(client, board):
    bid = board["id"]
    for bad in (
        {"buzz_timer_seconds": -1},
        {"answer_timer_seconds": -5},
        {"buzz_timer_seconds": 601},
        {"answer_timer_seconds": 9999},
        {"auto_arm_buzzers": "sometimes"},
    ):
        r = client.put(f"/api/boards/{bid}/settings", json=bad)
        assert r.status_code == 422, bad


def test_settings_become_defaults_for_new_boards(client, board):
    """The sticky-settings convention covers the new settings too."""
    r = client.put(
        f"/api/boards/{board['id']}/settings",
        json={
            "auto_arm_buzzers": False,
            "buzz_timer_seconds": 20,
            "answer_timer_seconds": 0,
            "autoplay_media": False,
        },
    )
    assert r.status_code == 200

    fresh = client.post("/api/boards", json={"name": "Next Game"}).json()
    assert fresh["auto_arm_buzzers"] is False
    assert fresh["buzz_timer_seconds"] == 20
    assert fresh["answer_timer_seconds"] == 0
    assert fresh["autoplay_media"] is False


def test_import_clamps_out_of_range_timers(client):
    """Imports skip request validation — normalize_board clamps instead."""
    import json as J

    doc = {
        "num_cols": 1, "num_rows": 1, "categories": ["A"], "row_values": [100],
        "cells": [[{"question": "q", "answer": "a", "value": 100}]],
        "buzz_timer_seconds": -3, "answer_timer_seconds": 100000,
    }
    r = client.post("/api/boards/import", files={"file": ("old.json", J.dumps(doc).encode())})
    assert r.status_code == 201
    b = r.json()
    assert b["buzz_timer_seconds"] == 0
    assert b["answer_timer_seconds"] == 600


def test_corrupt_defaults_json_never_blocks_creation(client, board):
    """Hand-edited garbage in defaults.json degrades per-key: parseable
    values are coerced, junk falls back to the field default — and board
    creation always succeeds with a loadable board."""
    import json as J

    from app.storage import store

    (store.data_dir / "defaults.json").write_text(J.dumps({
        "buzz_timer_seconds": "20",   # lax-parseable → 20
        "answer_timer_seconds": "lots",  # junk → default 10
        "turn_mode": "Manual",        # wrong case → default first-correct
        "autoplay_media": "false",    # lax-parseable → False
    }), encoding="utf-8")

    r = client.post("/api/boards", json={"name": "Fresh"})
    assert r.status_code == 201
    b = r.json()
    assert b["buzz_timer_seconds"] == 20
    assert b["answer_timer_seconds"] == 10
    assert b["turn_mode"] == "first-correct"
    assert b["autoplay_media"] is False
    # The written board must be loadable (a bad literal used to persist and
    # then fail validation on the next read).
    assert client.get(f"/api/boards/{b['id']}").status_code == 200


def test_import_sanitizes_wrong_typed_settings(client):
    """Booleans in timer fields and string bools degrade sanely on import."""
    import json as J

    doc = {
        "num_cols": 1, "num_rows": 1, "categories": ["A"], "row_values": [100],
        "cells": [[{"question": "q", "answer": "a", "value": 100}]],
        "answer_timer_seconds": True,   # int(True) == 1 trap → default 10
        "buzz_timer_seconds": "15",     # numeric string → 15
        "autoplay_media": "false",      # string bool → False
        "auto_arm_buzzers": "junk",     # junk → default True
    }
    r = client.post("/api/boards/import", files={"file": ("old.json", J.dumps(doc).encode())})
    assert r.status_code == 201
    b = r.json()
    assert b["answer_timer_seconds"] == 10
    assert b["buzz_timer_seconds"] == 15
    assert b["autoplay_media"] is False
    assert b["auto_arm_buzzers"] is True


def test_export_import_roundtrip_preserves_settings(client, board):
    """Sharing a board keeps its game settings (turn rules included — these
    used to be silently dropped by the import migration)."""
    bid = board["id"]
    r = client.put(
        f"/api/boards/{bid}/settings",
        json={
            "turn_mode": "sequential",
            "auto_arm_buzzers": False,
            "buzz_timer_seconds": 25,
            "answer_timer_seconds": 0,
            "autoplay_media": False,
        },
    )
    assert r.status_code == 200

    exported = client.get(f"/api/boards/{bid}/export")
    assert exported.status_code == 200
    r = client.post("/api/boards/import", files={"file": ("game.rhubarb", exported.content)})
    assert r.status_code == 201
    b = r.json()
    assert b["turn_mode"] == "sequential"
    assert b["auto_arm_buzzers"] is False
    assert b["buzz_timer_seconds"] == 25
    assert b["answer_timer_seconds"] == 0
    assert b["autoplay_media"] is False


def test_editor_save_cannot_revert_game_settings(client, board):
    """The full-doc PUT (editor autosave) must not clobber settings changed
    through the settings endpoint after the draft was taken."""
    bid = board["id"]
    stale_doc = client.get(f"/api/boards/{bid}").json()

    r = client.put(
        f"/api/boards/{bid}/settings",
        json={
            "auto_arm_buzzers": False,
            "buzz_timer_seconds": 30,
            "answer_timer_seconds": 5,
            "autoplay_media": False,
        },
    )
    assert r.status_code == 200

    saved = client.put(f"/api/boards/{bid}", json=stale_doc).json()
    assert saved["auto_arm_buzzers"] is False
    assert saved["buzz_timer_seconds"] == 30
    assert saved["answer_timer_seconds"] == 5
    assert saved["autoplay_media"] is False
