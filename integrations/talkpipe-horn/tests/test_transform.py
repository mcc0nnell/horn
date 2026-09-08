from __future__ import annotations

from collections import Counter
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from talkpipe_horn.transform import HornMapCompileError, compile_map_argument_bundle


def _fixture_graph() -> dict:
    return {
        "corpus_version": "test",
        "claims": [
            {
                "id": "m1-c001",
                "number": 1,
                "map_number": 1,
                "title": "Machines can think.",
                "body": "The focus position.",
                "bbox_norm": [0.10, 0.10, 0.20, 0.20],
                "issue_id": None,
                "relation_status": "verified",
                "source": {"artifact": "map-1.pdf"},
            },
            {
                "id": "m1-c002",
                "number": 2,
                "map_number": 1,
                "title": "Learning supports machine thought.",
                "body": "A supporting claim.",
                "bbox_norm": [0.30, 0.20, 0.40, 0.30],
                "issue_id": "m1-i01",
                "relation_status": "verified",
                "source": {"artifact": "map-1.pdf"},
            },
            {
                "id": "m1-c003",
                "number": 3,
                "map_number": 1,
                "title": "Free will is required.",
                "body": "A disputing claim.",
                "bbox_norm": [0.50, 0.30, 0.60, 0.40],
                "issue_id": "m1-i01",
                "relation_status": "verified",
                "source": {"artifact": "map-1.pdf"},
            },
        ],
        "typed_argument_relations": [
            {
                "id": "relation-2-1",
                "source_relation_id": "m1-r001",
                "map_number": 1,
                "horn_relation": "is_supported_by",
                "scope": "internal",
                "semantic_edge": {
                    "predicate": "supports",
                    "subject_claim_id": "m1-c002",
                    "object_claim_id": "m1-c001",
                },
            },
            {
                "id": "relation-3-1",
                "source_relation_id": "m1-r002",
                "map_number": 1,
                "horn_relation": "is_disputed_by",
                "scope": "internal",
                "semantic_edge": {
                    "predicate": "disputes",
                    "subject_claim_id": "m1-c003",
                    "object_claim_id": "m1-c001",
                },
            },
        ],
    }


def _fixture_geometry() -> dict:
    return {
        "coordinateSystem": {
            "origin": "top-left",
            "pixelWidth": 1000,
            "pixelHeight": 500,
            "normalizedRange": [0, 1],
        },
        "issueAreas": [
            {
                "id": "map1:free-will",
                "label": "Can computers think without free will?",
                "pixels": {"x": 250, "y": 50, "w": 450, "h": 250},
            }
        ],
    }


def test_map_compiles_to_semantic_argument_and_layout() -> None:
    bundle = compile_map_argument_bundle(_fixture_graph(), _fixture_geometry(), 1)
    argument = bundle["argument"]
    layout = bundle["sourceLayout"]

    assert argument["version"] == "horn-argument/0.1"
    assert argument["focusClaimId"] == "m1-c001"
    assert len(argument["claims"]) == 3
    assert len(argument["relations"]) == 2
    assert Counter(r["kind"] for r in argument["relations"]) == Counter(
        {"supports": 1, "disputes": 1}
    )
    assert Counter(c["role"] for c in argument["claims"]) == Counter(
        {"position": 1, "grounds": 1, "rebuttal": 1}
    )
    assert argument["streams"] == [
        {
            "id": "map1:stream:m1-i01",
            "title": "Can computers think without free will?",
            "focusClaimId": "m1-c001",
            "claimIds": ["m1-c001", "m1-c002", "m1-c003"],
            "extensions": {
                "issueId": "m1-i01",
                "sourceRegionId": "map1:free-will",
            },
        }
    ]

    assert layout["authority"] == "analytical-hint-only"
    assert layout["canvas"]["width"] == 1000
    assert layout["canvas"]["height"] == 500
    assert len(layout["nodes"]) == 3
    assert len(layout["regions"]) == 1
    for node in layout["nodes"]:
        rect = node["bbox"]
        assert 0 <= rect["x"] <= 1000
        assert 0 <= rect["y"] <= 500
        assert rect["w"] > 0
        assert rect["h"] > 0
        assert rect["x"] + rect["w"] <= 1000
        assert rect["y"] + rect["h"] <= 500


def test_compile_rejects_non_tree_map_shape() -> None:
    graph = _fixture_graph()
    graph["typed_argument_relations"].append(
        {
            "id": "relation-2-3",
            "source_relation_id": "m1-r003",
            "map_number": 1,
            "horn_relation": "is_supported_by",
            "scope": "internal",
            "semantic_edge": {
                "predicate": "supports",
                "subject_claim_id": "m1-c002",
                "object_claim_id": "m1-c003",
            },
        }
    )

    try:
        compile_map_argument_bundle(graph, _fixture_geometry(), 1)
    except HornMapCompileError as exc:
        assert "outgoing semantic moves" in str(exc)
    else:
        raise AssertionError("expected HornMapCompileError")
