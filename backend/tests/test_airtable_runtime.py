import pytest

from backend.runtime.tool_registry import (
    _build_filter_formula,
    _resolve_max_records,
    _validate_airtable_field_name,
)


def test_validate_airtable_field_name_trims_and_accepts_simple_strings() -> None:
    assert _validate_airtable_field_name("  Patient ID  ") == "Patient ID"


@pytest.mark.parametrize(
    "candidate",
    ["{Email}", 'Customer"Name', "Customer'Surname", "Field\nName"],
)
def test_validate_airtable_field_name_rejects_invalid_characters(candidate: str) -> None:
    with pytest.raises(ValueError):
        _validate_airtable_field_name(candidate)


def test_build_filter_formula_escapes_double_quotes() -> None:
    formula = _build_filter_formula("Patient ID", 'AC"123')
    assert formula == '{Patient ID} = "AC""123"'


@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, 1),
        ("", 1),
        ("5", 5),
        (0, 1),
        (1, 1),
        (25, 20),
        ("not-a-number", 1),
    ],
)
def test_resolve_max_records_handles_various_inputs(raw: object, expected: int) -> None:
    assert _resolve_max_records(raw) == expected
