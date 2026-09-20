#!/usr/bin/env python3
"""Build the dedicated 1200x630 social preview for the Marchand Puck Vault."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SITE_IMAGES = ROOT / "images" / "site"
OUTPUT = SITE_IMAGES / "marchand-puck-vault-social-v1.jpg"

WIDTH = 1200
HEIGHT = 630
GOLD = "#f5b619"
WHITE = "#f7f3e8"
MUTED = "#bac2cb"
INK = "#06080b"
IMPACT = Path("/System/Library/Fonts/Supplemental/Impact.ttf")
ARIAL_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")


def cover_crop(image: Image.Image, size: tuple[int, int], focal: tuple[float, float]) -> Image.Image:
    target_width, target_height = size
    scale = max(target_width / image.width, target_height / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = round((resized.width - target_width) * focal[0])
    top = round((resized.height - target_height) * focal[1])
    left = max(0, min(left, resized.width - target_width))
    top = max(0, min(top, resized.height - target_height))
    return resized.crop((left, top, left + target_width, top + target_height))


def fit_font(text: str, font_path: Path, max_size: int, max_width: int) -> ImageFont.FreeTypeFont:
    size = max_size
    while size > 12:
        font = ImageFont.truetype(str(font_path), size)
        if font.getlength(text) <= max_width:
            return font
        size -= 1
    return ImageFont.truetype(str(font_path), size)


def paste_panel(
    canvas: Image.Image,
    source_name: str,
    polygon: list[tuple[int, int]],
    focal: tuple[float, float],
    tint: tuple[int, int, int, int],
) -> None:
    min_x = min(point[0] for point in polygon)
    max_x = max(point[0] for point in polygon)
    panel = cover_crop(
        Image.open(SITE_IMAGES / source_name).convert("RGB"),
        (max_x - min_x, HEIGHT),
        focal,
    )
    color = Image.new("RGBA", panel.size, tint)
    panel = Image.alpha_composite(panel.convert("RGBA"), color)
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    panel_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    panel_layer.paste(panel, (min_x, 0))
    canvas.alpha_composite(Image.composite(panel_layer, Image.new("RGBA", canvas.size), mask))


def build() -> None:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), INK)

    # A restrained museum backdrop with a subtle spotlight and grid texture.
    spotlight = Image.new("L", (WIDTH, HEIGHT), 0)
    spotlight_draw = ImageDraw.Draw(spotlight)
    spotlight_draw.ellipse((-260, -360, 1000, 900), fill=150)
    spotlight = spotlight.filter(ImageFilter.GaussianBlur(170))
    spotlight_layer = Image.new("RGBA", canvas.size, (26, 31, 38, 255))
    spotlight_layer.putalpha(spotlight)
    canvas.alpha_composite(spotlight_layer)
    texture = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    texture_draw = ImageDraw.Draw(texture)
    for x in range(0, WIDTH, 60):
        texture_draw.line((x, 0, x, HEIGHT), fill=(255, 255, 255, 10), width=1)
    for y in range(0, HEIGHT, 60):
        texture_draw.line((0, y, WIDTH, y), fill=(255, 255, 255, 8), width=1)
    canvas.alpha_composite(texture)

    # Three uniform eras, cut into the same diagonal visual language as the museum.
    paste_panel(
        canvas,
        "marchand-hero-boston.jpg",
        [(455, 0), (770, 0), (670, HEIGHT), (350, HEIGHT)],
        (0.50, 0.50),
        (7, 11, 18, 34),
    )
    paste_panel(
        canvas,
        "marchand-hero-florida.png",
        [(700, 0), (1010, 0), (915, HEIGHT), (600, HEIGHT)],
        (0.52, 0.50),
        (70, 0, 10, 35),
    )
    paste_panel(
        canvas,
        "marchand-hero-canada-cropped.png",
        [(945, 0), (WIDTH, 0), (WIDTH, HEIGHT), (850, HEIGHT)],
        (0.54, 0.48),
        (75, 0, 9, 32),
    )

    # Protect the headline from busy photography while retaining the three portraits.
    shade = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shade_pixels = shade.load()
    for x in range(WIDTH):
        alpha = round(238 * max(0, min(1, (760 - x) / 430)))
        for y in range(HEIGHT):
            shade_pixels[x, y] = (3, 6, 10, alpha)
    canvas.alpha_composite(shade)

    draw = ImageDraw.Draw(canvas)
    draw.rectangle((18, 18, WIDTH - 19, HEIGHT - 19), outline=(245, 182, 25, 105), width=2)
    draw.rectangle((29, 29, WIDTH - 30, HEIGHT - 30), outline=(255, 255, 255, 25), width=1)
    draw.line((64, 76, 210, 76), fill=GOLD, width=4)

    kicker_font = ImageFont.truetype(str(ARIAL_BOLD), 20)
    draw.text((64, 48), "THE PRIVATE COLLECTION  ·  EXHIBIT 63", font=kicker_font, fill=GOLD)

    name_font = fit_font("BRAD MARCHAND", IMPACT, 72, 540)
    draw.text((61, 103), "BRAD MARCHAND", font=name_font, fill=GOLD, stroke_width=1, stroke_fill=(0, 0, 0, 120))

    title_font = fit_font("PUCK VAULT", IMPACT, 112, 535)
    draw.text((59, 183), "PUCK VAULT", font=title_font, fill=WHITE, stroke_width=2, stroke_fill=(0, 0, 0, 180))

    descriptor_font = ImageFont.truetype(str(ARIAL_BOLD), 23)
    draw.text((64, 332), "AN INTERACTIVE HOCKEY MUSEUM", font=descriptor_font, fill=WHITE)
    draw.line((64, 378, 526, 378), fill=(245, 182, 25, 140), width=2)

    stat_font = ImageFont.truetype(str(ARIAL_BOLD), 24)
    label_font = ImageFont.truetype(str(ARIAL_BOLD), 17)
    draw.text((64, 411), "115", font=stat_font, fill=GOLD)
    draw.text((118, 417), "CATALOGUED ARTIFACTS", font=label_font, fill=WHITE)
    draw.text((64, 452), "100", font=stat_font, fill=GOLD)
    draw.text((118, 458), "MOMENTS ON FILM", font=label_font, fill=WHITE)

    teams_font = ImageFont.truetype(str(ARIAL_BOLD), 18)
    draw.text((64, 522), "BOSTON", font=teams_font, fill=WHITE)
    draw.line((150, 534, 188, 534), fill=GOLD, width=2)
    draw.text((203, 522), "FLORIDA", font=teams_font, fill=WHITE)
    draw.line((300, 534, 338, 534), fill=GOLD, width=2)
    draw.text((353, 522), "CANADA", font=teams_font, fill=WHITE)

    # A small puck seal connects the preview to Exhibit 63 without any poker branding.
    puck_center = (530, 524)
    draw.ellipse((480, 474, 580, 574), fill="#050607", outline="#252b31", width=7)
    draw.ellipse((491, 485, 569, 563), outline=GOLD, width=3)
    puck_font = ImageFont.truetype(str(IMPACT), 45)
    puck_text = "63"
    puck_box = draw.textbbox((0, 0), puck_text, font=puck_font)
    draw.text(
        (puck_center[0] - (puck_box[2] - puck_box[0]) / 2, puck_center[1] - 29),
        puck_text,
        font=puck_font,
        fill=WHITE,
        stroke_width=1,
        stroke_fill="#000000",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUTPUT, "JPEG", quality=92, optimize=True, progressive=True, subsampling=0)
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
