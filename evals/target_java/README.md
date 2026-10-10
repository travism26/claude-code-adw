# target_java — minimal Spring Boot 3 / Java 17 eval target

Vendored eval target for the ADW harness: a small, self-contained Java 17 /
Spring Boot 3 / Maven service used to validate `pom.xml` gate resolution and
slow-gate (Testcontainers) economics against a real JVM app — the
fast/slow-gate archetype alongside the Node (`target_backend`) and Python
(`target_cli`) targets.

## Prerequisites

- JDK 17+
- Maven 3.9+
- Docker — only required for the `integration` gate (Testcontainers Postgres)

## What's here

A one-entity notes service: `Note` (id, title, body, createdAt), a Spring
Data JPA repository, and a REST controller (`POST /notes`, `GET /notes/{id}`,
`GET /notes`) backed by Postgres. Single module, no CI config, no app
Dockerfile — production-shaped, minimal size.

## Gates

Gate wiring lives in `adw_gates.json` (see `docs/slim-pipelines-plan.md`
§6.3 for the harness's gate-resolution format):

```bash
mvn -q -DskipTests compile   # compile     — fast
mvn -q test                  # unit        — fast, no Docker
mvn -q verify                # integration — slow, needs Docker (Testcontainers Postgres); runs unit first
```

`mvn test` runs only `*Test.java` (maven-surefire default include pattern),
so the Testcontainers suite (`NotesIntegrationIT`, matched by maven-failsafe's
default `*IT.java` pattern) never runs on the fast path. `mvn verify` runs
both.

## Known gap

Not yet wired into eval task YAMLs or `run_eval.py` — eval-task minting for
this target is a later milestone.
