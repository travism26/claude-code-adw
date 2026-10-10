#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic"]
# ///

"""Tests for pipelines/incident_types.py — the typed spine of the incident
triage pipeline (pipelines/pipe_incident.py).

Usage:
    uv run pytest adws/adw_tests/test_incident_types.py -q

Credential-free, no network, no agent imports — pure Pydantic model and
file-parsing tests. Covers:
  (a) IncidentPayload round-trip on a representative cache-alert example.
  (b) missing required field (resource) -> ValidationError.
  (c) closed enums on source/verdict/lens/supports all reject unknown values.
  (d) load_payload: missing path / invalid JSON / valid file.
  (e) load_incident_map: absent file -> {}; malformed JSON, missing
      "services" key, entry missing "repos" -> IncidentConfigError; valid
      map -> ServiceMapping with resource_class from the "class" key.
  (f) resolve_service: hit and miss.
"""

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from pydantic import ValidationError  # noqa: E402

from pipelines.incident_types import (  # noqa: E402
    CollectorResult,
    IncidentConfigError,
    IncidentPayload,
    LensFinding,
    ServiceMapping,
    TriageVerdict,
    load_incident_map,
    load_payload,
    resolve_service,
)

REDIS_PAYLOAD = {
    "incident_id": "inc-cache-01",
    "source": "datadog",
    "alert_name": "Cache load high",
    "resource": "cache-prod-01",
    "resource_class": "cache",
    "metric": "cache.cpu.load",
    "threshold": 0.80,
    "observed_value": 0.85,
    "fired_at": "2026-07-12T14:05:00Z",
    "links": ["https://app.datadoghq.com/monitors/12345"],
    "raw": {"monitor_id": 12345, "tags": ["service:cache", "env:prod"]},
}


# --- (a) IncidentPayload round-trip -------------------------------------------


def test_incident_payload_round_trip_cache_example():
    payload = IncidentPayload.model_validate(REDIS_PAYLOAD)

    assert payload.incident_id == "inc-cache-01"
    assert payload.source == "datadog"
    assert payload.alert_name == "Cache load high"
    assert payload.resource == "cache-prod-01"
    assert payload.resource_class == "cache"
    assert payload.metric == "cache.cpu.load"
    assert payload.threshold == 0.80
    assert payload.observed_value == 0.85
    assert payload.fired_at.year == 2026
    assert payload.fired_at.month == 7
    assert payload.fired_at.day == 12
    assert payload.fired_at.hour == 14
    assert payload.fired_at.minute == 5
    assert payload.links == ["https://app.datadoghq.com/monitors/12345"]
    assert payload.raw == {"monitor_id": 12345, "tags": ["service:cache", "env:prod"]}
    # severity omitted entirely -> defaults to None
    assert payload.severity is None

    # round-trip through JSON preserves the fields
    again = IncidentPayload.model_validate_json(payload.model_dump_json())
    assert again == payload


# --- (b) missing required field -----------------------------------------------


def test_incident_payload_missing_resource_raises_validation_error():
    bad = dict(REDIS_PAYLOAD)
    del bad["resource"]
    with pytest.raises(ValidationError):
        IncidentPayload.model_validate(bad)


def test_incident_payload_rejects_naive_fired_at():
    # Review decision: a naive timestamp makes the ±2h window
    # locale-dependent — reject, adapters normalize to UTC.
    bad = dict(REDIS_PAYLOAD, fired_at="2026-07-12T14:05:00")  # no Z / offset
    with pytest.raises(ValidationError, match="timezone-aware"):
        IncidentPayload.model_validate(bad)


def test_incident_payload_accepts_offset_fired_at():
    ok = dict(REDIS_PAYLOAD, fired_at="2026-07-12T11:05:00-03:00")
    payload = IncidentPayload.model_validate(ok)
    assert payload.fired_at.utcoffset() is not None


# --- (c) closed enums ----------------------------------------------------------


def test_incident_payload_rejects_unknown_source():
    bad = dict(REDIS_PAYLOAD, source="pagerduty")
    with pytest.raises(ValidationError):
        IncidentPayload.model_validate(bad)


def test_triage_verdict_rejects_unknown_verdict():
    with pytest.raises(ValidationError):
        TriageVerdict.model_validate(
            {
                "verdict": "maybe",
                "confidence": "high",
                "evidence": [],
                "suggested_next_action": "page someone",
                "summary": "unclear",
            }
        )


def test_lens_finding_rejects_unknown_lens_and_supports():
    with pytest.raises(ValidationError):
        LensFinding.model_validate(
            {
                "lens": "traces",
                "observations": [],
                "hypothesis": None,
                "supports": "real-issue",
                "cited_evidence": [],
            }
        )
    with pytest.raises(ValidationError):
        LensFinding.model_validate(
            {
                "lens": "metrics",
                "observations": [],
                "hypothesis": None,
                "supports": "unsure",
                "cited_evidence": [],
            }
        )


def test_collector_result_status_is_closed_enum():
    with pytest.raises(ValidationError):
        CollectorResult.model_validate(
            {
                "collector": "dd_metrics",
                "status": "partial",
                "artifact_path": None,
                "evidence_ids": [],
                "summary_stats": {},
            }
        )


# --- (d) load_payload ----------------------------------------------------------


def test_load_payload_missing_path_raises_incident_config_error(tmp_path):
    missing = tmp_path / "does-not-exist.json"
    with pytest.raises(IncidentConfigError):
        load_payload(str(missing))


def test_load_payload_invalid_json_raises_incident_config_error(tmp_path):
    bad_file = tmp_path / "payload.json"
    bad_file.write_text("{not valid json")
    with pytest.raises(IncidentConfigError):
        load_payload(str(bad_file))


def test_load_payload_valid_file_returns_model(tmp_path):
    good_file = tmp_path / "payload.json"
    good_file.write_text(json.dumps(REDIS_PAYLOAD))

    payload = load_payload(str(good_file))

    assert isinstance(payload, IncidentPayload)
    assert payload.resource == "cache-prod-01"
    assert payload.alert_name == "Cache load high"


# --- (e) load_incident_map ------------------------------------------------------


def test_load_incident_map_absent_file_returns_empty_dict(tmp_path):
    missing = tmp_path / "adw_incident.json"
    assert load_incident_map(str(missing)) == {}


def test_load_incident_map_malformed_json_raises(tmp_path):
    config = tmp_path / "adw_incident.json"
    config.write_text("{not valid json")
    with pytest.raises(IncidentConfigError):
        load_incident_map(str(config))


def test_load_incident_map_missing_services_key_raises(tmp_path):
    config = tmp_path / "adw_incident.json"
    config.write_text(json.dumps({"not_services": {}}))
    with pytest.raises(IncidentConfigError):
        load_incident_map(str(config))


def test_load_incident_map_entry_missing_repos_raises(tmp_path):
    config = tmp_path / "adw_incident.json"
    config.write_text(
        json.dumps({"services": {"cache-prod-01": {"class": "cache"}}})
    )
    with pytest.raises(IncidentConfigError):
        load_incident_map(str(config))


def test_load_incident_map_valid_map_populates_resource_class(tmp_path):
    config = tmp_path / "adw_incident.json"
    config.write_text(
        json.dumps(
            {
                "services": {
                    "cache-prod-01": {
                        "repos": ["org/checkout-service"],
                        "class": "cache",
                    }
                }
            }
        )
    )

    mapping = load_incident_map(str(config))

    assert set(mapping.keys()) == {"cache-prod-01"}
    entry = mapping["cache-prod-01"]
    assert isinstance(entry, ServiceMapping)
    assert entry.repos == ["org/checkout-service"]
    assert entry.resource_class == "cache"


# --- (f) resolve_service ---------------------------------------------------------


def test_resolve_service_hit_and_miss():
    mapping = {
        "cache-prod-01": ServiceMapping.model_validate(
            {"repos": ["org/checkout-service"], "class": "cache"}
        )
    }

    hit = resolve_service(mapping, "cache-prod-01")
    assert hit is not None
    assert hit.resource_class == "cache"

    miss = resolve_service(mapping, "postgres-prod-01")
    assert miss is None
