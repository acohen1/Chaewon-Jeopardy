"""Players: add / remove / rename / award."""
from __future__ import annotations


def _players(board_json) -> dict[str, int]:
    return {p["name"]: p["score"] for p in board_json["players"]}


def test_add_player(client, board):
    r = client.post(f"/api/boards/{board['id']}/players", json={"name": "  Alice  "})
    assert r.status_code == 201
    assert _players(r.json()) == {"Alice": 0}


def test_add_duplicate_player_409(client, board):
    bid = board["id"]
    client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})
    r = client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})
    assert r.status_code == 409
    # Stripping applies before the duplicate check too.
    r = client.post(f"/api/boards/{bid}/players", json={"name": " Alice "})
    assert r.status_code == 409


def test_add_player_empty_422(client, board):
    bid = board["id"]
    assert client.post(f"/api/boards/{bid}/players", json={"name": ""}).status_code == 422
    assert client.post(f"/api/boards/{bid}/players", json={"name": "   "}).status_code == 422


def test_remove_player(client, board):
    bid = board["id"]
    client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})
    client.post(f"/api/boards/{bid}/players", json={"name": "Bob"})
    r = client.delete(f"/api/boards/{bid}/players/Alice")
    assert r.status_code == 200
    assert _players(r.json()) == {"Bob": 0}


def test_rename_player(client, board):
    bid = board["id"]
    client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})
    client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})  # 409, ignored
    client.post(f"/api/boards/{bid}/players/Alice/award", json={"delta": 600})
    r = client.patch(f"/api/boards/{bid}/players/Alice", json={"name": "Alicia"})
    assert r.status_code == 200
    assert _players(r.json()) == {"Alicia": 600}  # score survives the rename


def test_rename_player_to_existing_409(client, board):
    bid = board["id"]
    client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})
    client.post(f"/api/boards/{bid}/players", json={"name": "Bob"})
    r = client.patch(f"/api/boards/{bid}/players/Alice", json={"name": "Bob"})
    assert r.status_code == 409


def test_rename_player_empty_422_and_missing_404(client, board):
    bid = board["id"]
    client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})
    assert (
        client.patch(f"/api/boards/{bid}/players/Alice", json={"name": "  "}).status_code
        == 422
    )
    assert (
        client.patch(f"/api/boards/{bid}/players/Nobody", json={"name": "X"}).status_code
        == 404
    )


def test_award_accumulates_positive_and_negative(client, board):
    bid = board["id"]
    client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})
    r = client.post(f"/api/boards/{bid}/players/Alice/award", json={"delta": 400})
    assert _players(r.json()) == {"Alice": 400}
    r = client.post(f"/api/boards/{bid}/players/Alice/award", json={"delta": 600})
    assert _players(r.json()) == {"Alice": 1000}
    r = client.post(f"/api/boards/{bid}/players/Alice/award", json={"delta": -200})
    assert _players(r.json()) == {"Alice": 800}
    # Persisted, not just echoed.
    assert _players(client.get(f"/api/boards/{bid}").json()) == {"Alice": 800}


def test_award_missing_player_404(client, board):
    r = client.post(f"/api/boards/{board['id']}/players/Nobody/award", json={"delta": 100})
    assert r.status_code == 404


def test_reset_scores(client, board):
    bid = board["id"]
    for name in ("Alice", "Bob"):
        client.post(f"/api/boards/{bid}/players", json={"name": name})
    client.post(f"/api/boards/{bid}/players/Alice/award", json={"delta": 800})
    client.post(f"/api/boards/{bid}/players/Bob/award", json={"delta": -400})
    r = client.post(f"/api/boards/{bid}/scores/reset")
    assert r.status_code == 200
    assert _players(r.json()) == {"Alice": 0, "Bob": 0}

# ------------------------------------------------------------------ #
#  Full game reset (roster included)                                 #
# ------------------------------------------------------------------ #
def test_game_reset_clears_roster_history_used_control(client, board):
    bid = board["id"]
    for name in ("Alice", "Bob"):
        client.post(f"/api/boards/{bid}/players", json={"name": name})
    client.post(f"/api/boards/{bid}/players/Alice/award", json={"delta": 400})
    client.put(f"/api/boards/{bid}/cells/1/2/used", json={"used": True})
    client.put(f"/api/boards/{bid}/control", json={"player": "Bob"})
    client.put(f"/api/boards/{bid}/settings", json={"turn_mode": "sequential"})

    r = client.post(f"/api/boards/{bid}/game/reset")
    assert r.status_code == 200
    b = r.json()
    assert b["players"] == []          # couch roster: cleared outright
    assert b["history"] == []
    assert b["control_player"] is None
    assert all(not c["used"] for row in b["cells"] for c in row)
    # A game reset is not a settings reset.
    assert b["turn_mode"] == "sequential"
    # Content untouched.
    assert b["num_cols"] == board["num_cols"]


def test_scores_only_reset_keeps_roster(client, board):
    """The narrow tools stay narrow: scores/reset zeroes but never removes."""
    bid = board["id"]
    client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})
    client.post(f"/api/boards/{bid}/players/Alice/award", json={"delta": 400})
    b = client.post(f"/api/boards/{bid}/scores/reset").json()
    assert _players(b) == {"Alice": 0}


def test_stale_editor_save_cannot_resurrect_scores(client, board):
    """After a full game reset, a stale editor draft may re-add a deleted
    player (roster is editor-owned) — but never with last game's dollars:
    scores are game state and a name absent server-side starts at 0."""
    bid = board["id"]
    client.post(f"/api/boards/{bid}/players", json={"name": "Alice"})
    client.post(f"/api/boards/{bid}/players/Alice/award", json={"delta": 2400})
    stale_doc = client.get(f"/api/boards/{bid}").json()
    assert _players(stale_doc) == {"Alice": 2400}

    client.post(f"/api/boards/{bid}/game/reset")
    saved = client.put(f"/api/boards/{bid}", json=stale_doc).json()
    assert _players(saved) == {"Alice": 0}
