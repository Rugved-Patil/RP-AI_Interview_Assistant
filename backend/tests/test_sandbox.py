"""
Unit and integration tests for the Sandbox code runner and API endpoints.
"""

from fastapi.testclient import TestClient
import pytest

from app.schemas.sandbox import RunCodeRequest, SupportedLanguage, TestCase, TestResult
from app.services.code_runner import run_code_in_sandbox


def test_list_sandbox_problems(client: TestClient):
    response = client.get("/sandbox/problems")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 6
    assert any(p["id"] == "two-sum" for p in data)
    assert any(p["id"] == "lru-cache" for p in data)


def test_list_sandbox_problems_filtered(client: TestClient):
    response = client.get("/sandbox/problems?domain=System+Design")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    for p in data:
        assert p["domain"] == "System Design"


def test_get_sandbox_problem_by_id(client: TestClient):
    response = client.get("/sandbox/problems/two-sum")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "two-sum"
    assert data["title"] == "Two Sum"
    assert "starter_code" in data
    assert "python" in data["starter_code"]
    assert len(data["test_cases"]) >= 3


def test_get_sandbox_problem_not_found(client: TestClient):
    response = client.get("/sandbox/problems/nonexistent-problem-xyz")
    assert response.status_code == 404


def test_run_code_python_two_sum_success(client: TestClient):
    valid_python_code = """
def two_sum(nums: list[int], target: int) -> list[int]:
    lookup = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in lookup:
            return [lookup[diff], i]
        lookup[n] = i
    return []
"""
    payload = {
        "code": valid_python_code,
        "language": "python",
        "entry_function": "two_sum",
        "test_cases": [
            {"id": 1, "input_data": "[2, 7, 11, 15], 9", "expected_output": "[0, 1]"},
            {"id": 2, "input_data": "[3, 2, 4], 6", "expected_output": "[1, 2]"},
        ],
    }
    response = client.post("/sandbox/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["all_passed"] is True
    assert data["passed_count"] == 2
    assert len(data["results"]) == 2
    assert data["results"][0]["passed"] is True


def test_run_code_python_incorrect_solution(client: TestClient):
    failing_python_code = """
def two_sum(nums: list[int], target: int) -> list[int]:
    return [0, 0]
"""
    payload = {
        "code": failing_python_code,
        "language": "python",
        "entry_function": "two_sum",
        "test_cases": [
            {"id": 1, "input_data": "[2, 7, 11, 15], 9", "expected_output": "[0, 1]"},
        ],
    }
    response = client.post("/sandbox/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["all_passed"] is False
    assert data["passed_count"] == 0
    assert data["results"][0]["passed"] is False


def test_run_code_python_syntax_error(client: TestClient):
    broken_code = """
def two_sum(nums, target)
    syntax error here
"""
    payload = {
        "code": broken_code,
        "language": "python",
        "entry_function": "two_sum",
        "test_cases": [
            {"id": 1, "input_data": "[2, 7, 11, 15], 9", "expected_output": "[0, 1]"},
        ],
    }
    response = client.post("/sandbox/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["all_passed"] is False
    assert "SyntaxError" in data["stderr"] or "SyntaxError" in (data["error"] or "")


def test_grade_code_offline_fallback(client: TestClient):
    payload = {
        "problem_id": "two-sum",
        "problem_title": "Two Sum",
        "code": "def two_sum(nums, target):\n    lookup = {}\n    for i, x in enumerate(nums):\n        if target - x in lookup:\n            return [lookup[target - x], i]\n        lookup[x] = i\n    return []\n",
        "language": "python",
        "test_results": [
            {
                "test_case_id": 1,
                "passed": True,
                "input_data": "[2, 7, 11, 15], 9",
                "expected_output": "[0, 1]",
                "actual_output": "[0, 1]",
                "execution_time_ms": 0.5,
            }
        ],
        "role": "Software Engineer",
        "experience_level": "Mid-Level",
    }
    response = client.post("/sandbox/grade", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "score" in data
    assert 0 <= data["score"] <= 10
    assert "time_complexity" in data
    assert "space_complexity" in data
    assert "detailed_markdown" in data
    assert len(data["detailed_markdown"]) > 20
