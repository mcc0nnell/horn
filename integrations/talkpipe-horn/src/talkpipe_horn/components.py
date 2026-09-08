from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, Iterator

from talkpipe import register_segment, register_source, segment, source

from .transform import compile_map_argument_bundle


@register_source("hornCorpus")
@source()
def horn_corpus(path: str) -> Iterator[dict[str, Any]]:
    """Read a machine-readable Horn corpus graph as one streaming item."""
    with Path(path).open(encoding="utf-8") as handle:
        yield json.load(handle)


@register_segment("hornMapArgument")
@segment()
def horn_map_argument(
    items: Iterable[dict[str, Any]],
    map_number: int = 1,
    geometry_path: str = "corpus/cct-1998-map1-geometry.json",
) -> Iterator[dict[str, Any]]:
    """Compile one map to HornArgument plus non-authoritative ECharts layout hints."""
    with Path(geometry_path).open(encoding="utf-8") as handle:
        geometry = json.load(handle)
    for graph in items:
        yield compile_map_argument_bundle(graph, geometry, map_number=map_number)


@register_segment("hornWriteJson")
@segment()
def horn_write_json(
    items: Iterable[dict[str, Any]],
    path: str,
) -> Iterator[dict[str, Any]]:
    """Persist a deterministic JSON snapshot while leaving the stream intact."""
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    for item in items:
        destination.write_text(json.dumps(item, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        yield item
