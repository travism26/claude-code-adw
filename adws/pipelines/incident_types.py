#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic"]
# ///

"""Typed spine of the incident triage pipeline (driven by pipe_incident.py):
IncidentPayload, CollectorResult, LensFinding, TriageVerdict, plus the
adw_incident.json service->repo mapping loader.

No network calls, no agent imports — this module only defines schemas and
reads/validates already-normalized JSON files. Adapters that turn a raw
webhook/Slack/Teams payload into an IncidentPayload are out of scope here;
Datadog, Slack and Teams are example adapters; the pipeline is source-agnostic.
Collector snapshot schemas live with the collectors, not here.

Fail-closed throughout: a missing or malformed --payload file raises
IncidentConfigError rather than returning a partial model. The service map
is the one deliberate exception, mirroring adw_gates.json's own split
(pipelines/gates.py) applied to service->repo mapping: an ABSENT
adw_incident.json means "no mapping configured yet" (callers log/warn and
skip the code lens), but a PRESENT, broken one is a config bug and must not
be silently swallowed.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class IncidentConfigError(Exception):
    """A payload or service-map file is present but malformed, or a payload
    path does not exist. Fail closed — never a partial model."""


class IncidentPayload(BaseModel):
    """The one intake schema: the single normalized shape every adapter produces."""
    incident_id: str
    source: Literal["datadog", "slack", "teams", "manual"]
    alert_name: str
    severity: Optional[str] = None
    resource: str
    resource_class: Optional[str] = None
    metric: Optional[str] = None
    threshold: Optional[float] = None
    observed_value: Optional[float] = None
    fired_at: datetime
    links: List[str] = []
    raw: dict = {}

    @field_validator("fired_at")
    @classmethod
    def _fired_at_must_be_tz_aware(cls, v: datetime) -> datetime:
        """Reject naive timestamps (review decision): a naive fired_at
        makes the ±2h window locale-dependent — a deploy-correlation
        bug waiting to happen. Adapters own normalizing to UTC before the payload."""
        if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
            raise ValueError(
                "fired_at must be timezone-aware (e.g. end in Z or an offset); "
                "normalize to UTC in the intake adapter"
            )
        return v


class CollectorResult(BaseModel):
    """Deterministic-plugin (evidence collector) output."""
    collector: str
    status: Literal["ok", "error", "empty"]
    artifact_path: Optional[str]
    evidence_ids: List[str]
    summary_stats: dict
    error: Optional[str] = None


class LensFinding(BaseModel):
    """Interpretation-lens output."""
    lens: Literal["metrics", "logs", "code"]
    observations: List[str]
    hypothesis: Optional[str]
    supports: Literal["real-issue", "false-positive", "inconclusive"]
    cited_evidence: List[str]


class TriageVerdict(BaseModel):
    """Verdict synthesis output."""
    verdict: Literal["real-issue", "false-positive", "needs-human"]
    confidence: Literal["low", "medium", "high"]
    evidence: List[str]
    suggested_next_action: str
    summary: str
    caveats: List[str] = []


def load_payload(path: str) -> IncidentPayload:
    """Read + validate an IncidentPayload JSON file. Fail closed: a missing
    file, unreadable/invalid JSON, or a schema violation all raise
    IncidentConfigError — never a partial payload."""
    p = Path(path)
    try:
        text = p.read_text()
    except OSError as e:
        raise IncidentConfigError(f"{path}: could not read payload — {e}") from e
    try:
        return IncidentPayload.model_validate_json(text)
    except ValidationError as e:
        raise IncidentConfigError(f"{path}: invalid IncidentPayload — {e}") from e


class ServiceMapping(BaseModel):
    """One entry in adw_incident.json's "services" map: resource -> repos +
    resource class."""
    model_config = ConfigDict(populate_by_name=True)

    repos: List[str]
    resource_class: str = Field(alias="class")


def load_incident_map(path: str) -> Dict[str, ServiceMapping]:
    """Parse {"services": {resource: {"repos": [...], "class": "redis"}}}.

    A MISSING file returns {} — absence is a loud-warning condition for
    callers (mirrors adw_gates.json's own "0 gates configured" warning),
    not an error, since adw_incident.json won't exist until a repo opts in.
    A PRESENT but unparseable/malformed file raises IncidentConfigError —
    fail closed, a broken config must never be silently treated as "no
    mapping"."""
    p = Path(path)
    if not p.exists():
        return {}
    try:
        raw = json.loads(p.read_text())
    except (OSError, json.JSONDecodeError) as e:
        raise IncidentConfigError(f"{path}: could not read/parse JSON — {e}") from e

    if not isinstance(raw, dict) or "services" not in raw:
        raise IncidentConfigError(f'{path}: missing top-level "services" object')

    services = raw["services"]
    if not isinstance(services, dict):
        raise IncidentConfigError(f'{path}: "services" must be an object')

    mapping: Dict[str, ServiceMapping] = {}
    for resource, entry in services.items():
        try:
            mapping[resource] = ServiceMapping.model_validate(entry)
        except ValidationError as e:
            raise IncidentConfigError(f'{path}: services["{resource}"] invalid — {e}') from e
    return mapping


def resolve_service(mapping: Dict[str, ServiceMapping], resource: str) -> Optional[ServiceMapping]:
    """Look up `resource` in an already-loaded service map; None on miss."""
    return mapping.get(resource)
