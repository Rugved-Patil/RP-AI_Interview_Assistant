"""Tests for the saved-presets CRUD routes (presets.py)."""

import time

import pytest


def _create(client, role: str = "ML Engineer", **extra: str) -> dict:
    response = client.post("/presets", json={"role": role, **extra})
    assert response.status_code == 200, response.text
    return response.json()


def _pause_so_timestamps_differ() -> None:
    # Lists are ordered by created_at; two presets created back-to-back could
    # otherwise land on the same timestamp and make the order ambiguous.
    time.sleep(0.02)


# --- create -------------------------------------------------------------------


def test_create_returns_the_saved_preset(client):
    preset = _create(client, company="Acme", location="Berlin")

    assert isinstance(preset["id"], int)
    assert preset["role"] == "ML Engineer"
    assert preset["company"] == "Acme"
    assert preset["location"] == "Berlin"
    assert preset["created_at"]


def test_company_and_location_are_optional(client):
    preset = _create(client)

    assert preset["company"] is None
    assert preset["location"] is None


def test_values_are_trimmed_and_blank_optionals_become_null(client):
    preset = _create(client, role="  ML Engineer  ", company="  Acme  ", location="")

    assert preset["role"] == "ML Engineer"
    assert preset["company"] == "Acme"
    assert preset["location"] is None


@pytest.mark.parametrize(
    "body",
    [{}, {"role": ""}, {"role": "   "}, {"role": None}],
)
def test_a_missing_or_blank_role_is_rejected_and_nothing_is_saved(client, body):
    assert client.post("/presets", json=body).status_code == 422
    assert client.get("/presets").json() == []


# --- read ---------------------------------------------------------------------


def test_list_is_empty_to_begin_with(client):
    assert client.get("/presets").json() == []


def test_list_is_most_recent_first(client):
    first = _create(client, role="First")
    _pause_so_timestamps_differ()
    second = _create(client, role="Second")

    roles = [preset["role"] for preset in client.get("/presets").json()]

    assert roles == ["Second", "First"]
    assert first["id"] != second["id"]


def test_get_returns_one_preset_by_id(client):
    created = _create(client, company="Acme")

    response = client.get(f"/presets/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_preset_is_a_404(client):
    assert client.get("/presets/999").status_code == 404


# --- update -------------------------------------------------------------------


def test_update_changes_the_fields_and_keeps_created_at(client):
    created = _create(client, company="Acme", location="Berlin")

    response = client.put(
        f"/presets/{created['id']}",
        json={"role": "Backend Engineer", "company": "Globex", "location": "Paris"},
    )

    assert response.status_code == 200
    updated = response.json()
    assert (updated["role"], updated["company"], updated["location"]) == (
        "Backend Engineer",
        "Globex",
        "Paris",
    )
    assert updated["id"] == created["id"]
    assert updated["created_at"] == created["created_at"]
    assert client.get(f"/presets/{created['id']}").json() == updated


def test_update_is_a_full_replace_so_omitted_fields_are_cleared(client):
    # The edit form sends `company.trim() || undefined`, so clearing a box in
    # the UI omits the field - and it has to actually clear it in the database.
    created = _create(client, company="Acme", location="Berlin")

    response = client.put(f"/presets/{created['id']}", json={"role": "ML Engineer"})

    assert response.status_code == 200
    assert response.json()["company"] is None
    assert response.json()["location"] is None


def test_update_with_a_blank_role_is_rejected_and_changes_nothing(client):
    created = _create(client, company="Acme")

    assert client.put(f"/presets/{created['id']}", json={"role": "   "}).status_code == 422
    assert client.get(f"/presets/{created['id']}").json() == created


def test_update_unknown_preset_is_a_404(client):
    assert client.put("/presets/999", json={"role": "ML Engineer"}).status_code == 404


# --- delete -------------------------------------------------------------------


def test_delete_removes_the_preset(client):
    created = _create(client)

    response = client.delete(f"/presets/{created['id']}")

    assert response.status_code == 200
    assert response.json() == {"id": created["id"], "deleted": True}
    assert client.get(f"/presets/{created['id']}").status_code == 404
    assert client.get("/presets").json() == []


def test_delete_leaves_other_presets_alone(client):
    keep = _create(client, role="Keep")
    drop = _create(client, role="Drop")

    client.delete(f"/presets/{drop['id']}")

    assert [preset["id"] for preset in client.get("/presets").json()] == [keep["id"]]


def test_delete_unknown_preset_is_a_404(client):
    assert client.delete("/presets/999").status_code == 404