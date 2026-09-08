from __future__ import annotations

from collections import Counter, defaultdict
from math import hypot
from typing import Any


class HornMapCompileError(ValueError):
    pass


def _center(rect: dict[str, float]) -> tuple[float, float]:
    return rect["x"] + rect["w"] / 2, rect["y"] + rect["h"] / 2


def _bbox_pixels(bbox_norm: list[float], width: int, height: int) -> dict[str, float]:
    if len(bbox_norm) != 4:
        raise HornMapCompileError(f"expected bbox_norm[4], got {bbox_norm!r}")
    x0, y0, x1, y1 = bbox_norm
    return {
        "x": x0 * width,
        "y": y0 * height,
        "w": (x1 - x0) * width,
        "h": (y1 - y0) * height,
    }


def _region_for_issue(
    claim_ids: list[str],
    layout_by_id: dict[str, dict[str, Any]],
    regions: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not claim_ids or not regions:
        return None

    inside_counts: Counter[str] = Counter()
    centers: list[tuple[float, float]] = []
    region_by_id = {r["id"]: r for r in regions}

    for claim_id in claim_ids:
        layout = layout_by_id.get(claim_id)
        if not layout:
            continue
        cx, cy = _center(layout["bbox"])
        centers.append((cx, cy))
        for region in regions:
            p = region["geometry"]
            if p["x"] <= cx <= p["x"] + p["w"] and p["y"] <= cy <= p["y"] + p["h"]:
                inside_counts[region["id"]] += 1

    if inside_counts:
        best_id, _ = max(inside_counts.items(), key=lambda kv: (kv[1], kv[0]))
        return region_by_id[best_id]

    if not centers:
        return None

    mx = sum(x for x, _ in centers) / len(centers)
    my = sum(y for _, y in centers) / len(centers)
    return min(regions, key=lambda r: hypot(_center(r["geometry"])[0] - mx, _center(r["geometry"])[1] - my))


def compile_map_argument_bundle(
    graph: dict[str, Any],
    geometry: dict[str, Any],
    map_number: int = 1,
) -> dict[str, Any]:
    """Compile one Horn corpus map into semantic argument + analytical layout hints.

    The HornArgument stays geometry-free. Source measurements live only in the
    sibling `sourceLayout` envelope so ECharts can use them without turning
    measured source positions into authored HornDocument geometry.
    """
    claims = [c for c in graph.get("claims", []) if c.get("map_number") == map_number]
    relations = [
        r
        for r in graph.get("typed_argument_relations", [])
        if r.get("map_number") == map_number
    ]
    if not claims:
        raise HornMapCompileError(f"map {map_number} has no claims")

    claim_by_id = {c["id"]: c for c in claims}
    if len(claim_by_id) != len(claims):
        raise HornMapCompileError("duplicate claim ids")

    outgoing: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for relation in relations:
        edge = relation.get("semantic_edge") or {}
        subject = edge.get("subject_claim_id")
        object_ = edge.get("object_claim_id")
        predicate = edge.get("predicate")
        if subject not in claim_by_id or object_ not in claim_by_id:
            raise HornMapCompileError(f"relation {relation.get('id')} has endpoint outside map {map_number}")
        if predicate not in {"supports", "disputes"}:
            raise HornMapCompileError(
                f"map {map_number} relation {relation.get('id')} uses unsupported semantic predicate {predicate!r}"
            )
        outgoing[subject].append(relation)

    roots = [c["id"] for c in claims if c["id"] not in outgoing]
    if len(roots) != 1:
        raise HornMapCompileError(f"expected one root claim, found {roots}")
    focus_claim_id = roots[0]

    for claim_id, edges in outgoing.items():
        if len(edges) != 1:
            raise HornMapCompileError(f"claim {claim_id} has {len(edges)} outgoing semantic moves")

    coord = geometry.get("coordinateSystem") or {}
    width = int(coord.get("pixelWidth", 0))
    height = int(coord.get("pixelHeight", 0))
    if width <= 0 or height <= 0:
        raise HornMapCompileError("geometry requires positive pixelWidth/pixelHeight")

    layout_nodes: list[dict[str, Any]] = []
    layout_by_id: dict[str, dict[str, Any]] = {}
    for claim in claims:
        bbox_norm = claim.get("bbox_norm")
        if not bbox_norm:
            continue
        item = {
            "id": claim["id"],
            "number": claim["number"],
            "bbox": _bbox_pixels(bbox_norm, width, height),
            "provenance": "source-measurement",
        }
        layout_nodes.append(item)
        layout_by_id[item["id"]] = item

    regions = [
        {
            "id": area["id"],
            "label": area.get("label", area["id"]),
            "geometry": dict(area["pixels"]),
            "provenance": "measured-source-raster",
        }
        for area in geometry.get("issueAreas", [])
    ]

    issue_claim_ids: dict[str, list[str]] = defaultdict(list)
    for claim in claims:
        issue_id = claim.get("issue_id")
        if issue_id:
            issue_claim_ids[issue_id].append(claim["id"])

    issue_region: dict[str, dict[str, Any] | None] = {
        issue_id: _region_for_issue(ids, layout_by_id, regions)
        for issue_id, ids in issue_claim_ids.items()
    }

    semantic_claims: list[dict[str, Any]] = []
    for claim in sorted(claims, key=lambda c: c["number"]):
        claim_id = claim["id"]
        if claim_id == focus_claim_id:
            role = "position"
        else:
            edge = outgoing[claim_id][0]["semantic_edge"]
            role = "grounds" if edge["predicate"] == "supports" else "rebuttal"

        semantic_claims.append(
            {
                "id": claim_id,
                "role": role,
                "title": claim.get("title") or f"Claim {claim['number']}",
                "statement": claim.get("body") or claim.get("title") or "",
                "sourceIds": [f"horn-cct-map-{map_number}-1998"],
                "origin": "source-explicit",
                "sourceLocator": f"Map {map_number}, box {claim['number']}",
                "extensions": {
                    "boxNumber": claim["number"],
                    "issueId": claim.get("issue_id"),
                    "attribution": claim.get("attribution"),
                    "relationStatus": claim.get("relation_status"),
                    "sourceArtifact": (claim.get("source") or {}).get("artifact"),
                },
            }
        )

    semantic_relations = []
    for relation in relations:
        edge = relation["semantic_edge"]
        semantic_relations.append(
            {
                "id": relation.get("source_relation_id") or relation["id"],
                "kind": edge["predicate"],
                "from": edge["subject_claim_id"],
                "to": edge["object_claim_id"],
                "label": relation.get("horn_relation", "").replace("is_", "").replace("_by", "").replace("_", " "),
                "extensions": {
                    "hornRelation": relation.get("horn_relation"),
                    "scope": relation.get("scope"),
                },
            }
        )

    streams = []
    for issue_id in sorted(issue_claim_ids):
        region = issue_region[issue_id]
        ids = sorted(issue_claim_ids[issue_id], key=lambda cid: claim_by_id[cid]["number"])
        streams.append(
            {
                "id": f"map{map_number}:stream:{issue_id}",
                "title": region["label"] if region else issue_id,
                "focusClaimId": focus_claim_id,
                "claimIds": [focus_claim_id, *ids],
                "extensions": {
                    "issueId": issue_id,
                    "sourceRegionId": region["id"] if region else None,
                },
            }
        )

    argument = {
        "id": f"horn:cct-1998:map-{map_number}:argument",
        "version": "horn-argument/0.1",
        "title": "Can Computers Think? — Map 1" if map_number == 1 else f"CCT Map {map_number}",
        "issueQuestion": "Can computers think?" if map_number == 1 else "Can computers think?",
        "issueType": "fact",
        "sources": [
            {
                "id": f"horn-cct-map-{map_number}-1998",
                "citation": f"Robert E. Horn. Mapping Great Debates: Can Computers Think? Map {map_number}. MacroVU Press, 1998.",
                "short": f"Horn CCT Map {map_number} (1998)",
                "year": 1998,
            }
        ],
        "claims": semantic_claims,
        "relations": semantic_relations,
        "focusClaimId": focus_claim_id,
        "streams": streams,
        "extensions": {
            "mapNumber": map_number,
            "corpusVersion": graph.get("corpus_version"),
            "compileMode": "semantic-from-corpus",
        },
    }

    return {
        "version": "horn-echarts-argument-bundle/0.1",
        "argument": argument,
        "sourceLayout": {
            "kind": "source-measurement",
            "authority": "analytical-hint-only",
            "canvas": {"width": width, "height": height, "origin": "top-left", "unit": "source-raster-pixel"},
            "nodes": layout_nodes,
            "regions": regions,
            "note": "Source measurements are projection hints only; they are not authored HornDocument geometry or reconstructed relation routes.",
        },
    }
