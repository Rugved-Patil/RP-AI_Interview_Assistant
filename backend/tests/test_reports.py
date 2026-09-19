"""Tests for the opt-in save / list / delete routes (reports.py)."""

import time


def _grade_and_save(client, start_session, answer: str) -> tuple[str, int]:
    """Runs one full attempt (question -> answer -> grade -> save); returns (session_id, report_id)."""
    session_id = start_session()
    client.post(f"/sessions/{session_id}/answer", json={"answer": answer})
    assert client.post(f"/sessions/{session_id}/grade").status_code == 200
    saved = client.post(f"/sessions/{session_id}/save")
    assert saved.status_code == 200, saved.text
    return session_id, saved.json()["id"]


# --- opt-in behaviour (scope doc Section 3.6) ---------------------------------


def test_grading_alone_saves_nothing(client, graded_session):
    # The core scope decision: a report only persists when the user asks.
    assert client.get("/reports").json() == []


def test_saving_a_graded_session_creates_a_report(client, providers, graded_session):
    response = client.post(f"/sessions/{graded_session}/save")

    assert response.status_code == 200
    saved = response.json()
    assert saved["session_id"] == graded_session
    assert saved["saved"] is True

    (report,) = client.get("/reports").json()
    assert report["id"] == saved["id"]
    assert report["session_id"] == graded_session
    assert report["question"] == providers.interviewer.reply
    assert report["answer"] == "My answer."
    assert report["score"] == 7
    assert report["feedback"] == "Solid answer."
    assert report["created_at"]


def test_saving_twice_is_idempotent(client, graded_session):
    # Covers the IntegrityError path: e.g. a double-click on "Save this report".
    first = client.post(f"/sessions/{graded_session}/save")
    second = client.post(f"/sessions/{graded_session}/save")

    assert first.status_code == second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert len(client.get("/reports").json()) == 1


def test_saving_an_unknown_session_is_a_404(client):
    assert client.post("/sessions/does-not-exist/save").status_code == 404


def test_saving_before_the_session_is_graded_is_a_400(client, start_session):
    session_id = start_session()
    assert client.post(f"/sessions/{session_id}/save").status_code == 400

    client.post(f"/sessions/{session_id}/answer", json={"answer": "My answer."})
    assert client.post(f"/sessions/{session_id}/save").status_code == 400


# --- list ---------------------------------------------------------------------


def test_list_is_empty_to_begin_with(client):
    assert client.get("/reports").json() == []


def test_reports_are_listed_most_recent_first(client, start_session):
    _, first_id = _grade_and_save(client, start_session, "First answer.")
    time.sleep(0.02)  # reports are ordered by created_at - make the timestamps differ
    _, second_id = _grade_and_save(client, start_session, "Second answer.")

    ids = [report["id"] for report in client.get("/reports").json()]

    assert ids == [second_id, first_id]


# --- delete -------------------------------------------------------------------


def test_delete_removes_only_that_report(client, start_session):
    _, keep_id = _grade_and_save(client, start_session, "Keep me.")
    _, drop_id = _grade_and_save(client, start_session, "Delete me.")

    response = client.delete(f"/reports/{drop_id}")

    assert response.status_code == 200
    assert response.json() == {"id": drop_id, "deleted": True}
    assert [report["id"] for report in client.get("/reports").json()] == [keep_id]


def test_delete_unknown_report_is_a_404(client):
    assert client.delete("/reports/999").status_code == 404