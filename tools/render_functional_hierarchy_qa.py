#!/usr/bin/env python3
"""Render browser-independent QA plates for the generated hierarchy bundle."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hierarchy"
AREA_COLORS = {"M2": "#2f7fc5", "M1": "#43a05a", "S1": "#c84c49"}
MAJOR_COLORS = ["#e76f00", "#49b653", "#ff3f91", "#24a7df", "#6657c8"]
COMMUNITY_COLORS = [
    "#ef4c45", "#436bd1", "#8bd43b", "#db3fbc",
    "#43c7bb", "#d98b2f", "#744bd6", "#39b54a",
]


def assigned_json(path: Path) -> dict | list:
    text = path.read_text()
    return json.loads(text[text.index("=") + 1 :].strip().rstrip(";"))


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    )
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def mix(left: str, right: str, amount: float) -> str:
    a = np.asarray([int(left[index : index + 2], 16) for index in (1, 3, 5)])
    b = np.asarray([int(right[index : index + 2], 16) for index in (1, 3, 5)])
    values = np.rint(a + (b - a) * amount).astype(int)
    return "#" + "".join(f"{value:02x}" for value in values)


def subtype_colors(data: dict) -> dict[str, str]:
    result: dict[str, str] = {}
    for major in range(1, 6):
        labels = [label for label in data["cue"]["subtypeOrder"] if int(label[1]) == major]
        for index, label in enumerate(labels):
            amount = 0.8 if len(labels) == 1 else 0.54 + 0.42 * index / (len(labels) - 1)
            result[label] = mix("#ffffff", MAJOR_COLORS[major - 1], amount)
    return result


def viridis(values: np.ndarray) -> np.ndarray:
    stops = np.asarray(
        [[68, 1, 84], [71, 44, 122], [59, 82, 139], [44, 113, 142],
         [33, 145, 140], [39, 173, 129], [94, 201, 98], [173, 220, 48], [253, 231, 37]],
        dtype=float,
    )
    position = np.clip((values + 2) / 6, 0, 1) * (len(stops) - 1)
    lower = np.floor(position).astype(int)
    fraction = (position - lower)[..., None]
    upper = np.minimum(lower + 1, len(stops) - 1)
    return np.rint(stops[lower] + (stops[upper] - stops[lower]) * fraction).astype(np.uint8)


def draw_heatmap(data: dict, units: list[dict]) -> None:
    cue = data["cue"]
    z = np.asarray(cue["z"], dtype=float)
    peak = np.asarray(cue["peak"], dtype=int)
    subtype_by_id = np.asarray(cue["subtypeById"])
    rank = {label: index for index, label in enumerate(cue["subtypeOrder"])}
    order = sorted(range(len(units)), key=lambda unit: (rank[subtype_by_id[unit]], peak[unit], unit))
    subtype_palette = subtype_colors(data)
    panel_specs = [("All units", None, 420), ("M2", "M2", 340), ("M1", "M1", 340), ("S1", "S1", 340)]
    image = Image.new("RGB", (1580, 950), "white")
    draw = ImageDraw.Draw(image)
    draw.text((790, 18), "Subtype-sorted z-score firing-rate heatmap", anchor="ma", font=font(24, True), fill="#17202c")
    draw.text((790, 50), "Raster-derived 80-trial profiles; rows z-scored over -1 to +5 s", anchor="ma", font=font(14), fill="#5f6c81")
    x = 54
    top = 105
    plot_height = 720
    for label, area, panel_width in panel_specs:
        ids = [unit for unit in order if area is None or units[unit]["area"] == area]
        pixels = viridis(z[ids])
        panel = Image.fromarray(pixels, "RGB").resize((panel_width, plot_height), Image.Resampling.BILINEAR)
        image.paste(panel, (x, top))
        cue_x = x + round(panel_width / 6)
        draw.line((cue_x, top, cue_x, top + plot_height), fill="white", width=2)
        previous = None
        for row, unit in enumerate(ids):
            current = subtype_by_id[unit]
            if previous is not None and current != previous:
                y = top + round(plot_height * row / len(ids))
                draw.line((x, y, x + panel_width, y), fill="#1c2430", width=1)
            previous = current
        if area is None:
            strip_x = x + panel_width + 5
            for row, unit in enumerate(ids):
                y1 = top + round(plot_height * row / len(ids))
                y2 = top + round(plot_height * (row + 1) / len(ids)) + 1
                major = int(cue["majorById"][unit])
                draw.rectangle((strip_x, y1, strip_x + 8, y2), fill=MAJOR_COLORS[major - 1])
                draw.rectangle((strip_x + 11, y1, strip_x + 19, y2), fill=subtype_palette[subtype_by_id[unit]])
            extra = 27
        else:
            extra = 0
            draw.rectangle((x, top - 10, x + panel_width, top - 5), fill=AREA_COLORS[area])
        draw.text((x + panel_width / 2, top - 26), f"{label} (n={len(ids):,})", anchor="mm", font=font(14, True), fill=AREA_COLORS.get(area, "#263144"))
        for tick, fraction in (("-1", 0), ("0", 1 / 6), ("+5", 1)):
            draw.text((x + panel_width * fraction, top + plot_height + 12), tick, anchor="ma", font=font(12), fill="#4f5c70")
        draw.text((x + panel_width / 2, top + plot_height + 35), "Time from cue (s)", anchor="ma", font=font(12), fill="#4f5c70")
        x += panel_width + extra + 28
    image.save(OUT / "qa_subtype_heatmap.png", optimize=True)


def draw_atlas(data: dict, units: list[dict]) -> None:
    graph = data["graph"]
    x_values = np.asarray(graph["x"], dtype=float)
    y_values = np.asarray(graph["y"], dtype=float)
    degree = np.asarray(graph["degree"], dtype=float)
    communities = np.asarray(graph["communityById"], dtype=int)
    image = Image.new("RGB", (1600, 650), "white")
    draw = ImageDraw.Draw(image)
    draw.text((800, 18), "Smoothed z-scored full-trial functional similarity atlas", anchor="ma", font=font(24, True), fill="#17202c")
    draw.text((800, 49), "Top-10 positive Pearson graph; 100-run consensus communities", anchor="ma", font=font(14), fill="#5f6c81")
    for panel, mode in enumerate(("community", "area")):
        left = 40 + panel * 790
        top = 92
        width = 750
        height = 520
        draw.rectangle((left, top, left + width, top + height), fill="#f8fafc", outline="#d7dde6")
        px = left + 20 + x_values * (width - 40)
        py = top + 20 + y_values * (height - 40)
        for source, target, weight in graph["edges"]:
            shade = int(230 - 65 * min(1, float(weight)))
            draw.line((px[source], py[source], px[target], py[target]), fill=(shade, shade + 4, min(255, shade + 12)), width=1)
        max_degree = max(float(degree.max()), 1.0)
        for index, unit in enumerate(units):
            radius = 1.4 + 4.8 * np.sqrt(degree[index] / max_degree)
            color = COMMUNITY_COLORS[(communities[index] - 1) % len(COMMUNITY_COLORS)] if mode == "community" else AREA_COLORS[unit["area"]]
            draw.ellipse((px[index] - radius, py[index] - radius, px[index] + radius, py[index] + radius), fill=color, outline="white")
        title = "Functional communities" if mode == "community" else "Same graph by brain region"
        draw.text((left + 16, top - 18), title, anchor="ls", font=font(15, True), fill="#263144")
    image.save(OUT / "qa_functional_atlas.png", optimize=True)


def main() -> None:
    data = assigned_json(ROOT / "data" / "functional_hierarchy.js")
    units = assigned_json(ROOT / "data" / "core.js")
    draw_heatmap(data, units)
    draw_atlas(data, units)
    print("Rendered qa_subtype_heatmap.png and qa_functional_atlas.png")


if __name__ == "__main__":
    main()
